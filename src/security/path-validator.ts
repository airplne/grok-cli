// Path Validator - Symlink-Aware Security Module
// Prevents path traversal attacks including symlink-based bypasses

import path from 'path';
import { promises as fs, constants } from 'fs';

interface ValidationResult {
  valid: boolean;
  error?: string;
  resolvedPath?: string;  // The real path after symlink resolution
}

interface ValidationOptions {
  allowNonExistent?: boolean;  // For write operations where file might not exist yet
  operation?: 'read' | 'write' | 'execute';  // Different rules for different operations
}

// ============================================================================
// BLOCKED PATTERNS - File/directory patterns that are always forbidden
// ============================================================================

const ENV_BLOCK_PATTERN = /\.env(?:\.|$)/i;
const ENV_DOC_ALLOW_PATTERN = /\.env\.(example|sample|template)$/i;

const BLOCKED_PATTERNS = [
  // SSH keys and config
  /\.ssh/,

  // Cloud provider credentials
  /\.aws/,
  /\.gcloud/,
  /\.azure/,

  // GPG keys
  /\.gnupg/,

  // Generic credential patterns
  /credentials/i,
  /secrets/i,

  // Environment files
  ENV_BLOCK_PATTERN,

  // Private keys
  /private.*key/i,

  // Git configuration (can contain tokens)
  /\.git\/config/,

  // NPM/package manager configs (can contain tokens)
  /\.npmrc/,
  /\.yarnrc/,

  // Docker credentials
  /\.docker\/config\.json/,

  // Kubernetes config (contains cluster credentials)
  /\.kube\/config/,

  // Other sensitive configs
  /\.netrc/,
];

// Absolute paths that should always be blocked regardless of pattern matching
const BLOCKED_ABSOLUTE_PATHS = [
  '/etc/passwd',
  '/etc/shadow',
  '/etc/sudoers',
  '/proc/',
  '/sys/',
  '/dev/',
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get list of directories that are allowed for file operations.
 * This can be extended to support configuration.
 */
function getAllowedDirectories(): string[] {
  const cwd = process.cwd();
  const home = process.env.HOME || '';

  // Current working directory and its subdirectories are always allowed
  const allowed = [cwd];

  // Optionally allow home directory
  // Note: This is permissive - blocked patterns provide the actual protection
  if (home) {
    allowed.push(home);
  }

  return allowed;
}

/**
 * For non-existent paths, walk up the directory tree until we find
 * an existing directory, resolve its real path, then append the
 * remaining path components.
 *
 * This is critical for write operations where the target file doesn't exist yet.
 * We must ensure the parent directory doesn't resolve to a forbidden location.
 */
async function resolveNonExistentPath(targetPath: string): Promise<string> {
  const parts = targetPath.split(path.sep);

  // Try progressively shorter paths until we find one that exists
  for (let i = parts.length; i > 0; i--) {
    const testPath = parts.slice(0, i).join(path.sep) || '/';
    try {
      const realParent = await fs.realpath(testPath);
      const remainder = parts.slice(i).join(path.sep);
      return remainder ? path.join(realParent, remainder) : realParent;
    } catch {
      continue;  // Parent doesn't exist, try grandparent
    }
  }

  // Fallback: no parent exists - return the normalized path
  return targetPath;
}

/**
 * Synchronous version of resolveNonExistentPath for contexts that cannot use async
 */
function resolveNonExistentPathSync(targetPath: string): string {
  const fsSync = require('fs');
  const parts = targetPath.split(path.sep);

  for (let i = parts.length; i > 0; i--) {
    const testPath = parts.slice(0, i).join(path.sep) || '/';
    try {
      const realParent = fsSync.realpathSync(testPath);
      const remainder = parts.slice(i).join(path.sep);
      return remainder ? path.join(realParent, remainder) : realParent;
    } catch {
      continue;
    }
  }

  return targetPath;
}

// ============================================================================
// MAIN VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validates a file path against security policies, resolving symlinks to prevent bypass.
 *
 * SECURITY GUARANTEES:
 * 1. All symlinks are resolved to their true target before validation
 * 2. Blocked patterns checked against real path, not user-provided path
 * 3. Path traversal via symlinks is prevented
 * 4. Non-existent file paths validated via parent directory resolution
 *
 * LIMITATIONS:
 * 1. TOCTOU window exists between validation and file operation
 * 2. Cannot prevent symlink creation after validation in the same session
 * 3. For better TOCTOU protection, use validateAndOpen() instead
 *
 * @param filePath - The path to validate (absolute or relative)
 * @param options - Validation options
 * @returns ValidationResult with valid flag, error message if invalid, and resolved real path
 */
export async function validatePath(
  filePath: string,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const { allowNonExistent = false, operation = 'read' } = options;

  try {
    // Step 1: Basic input validation
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'Invalid path: path must be a non-empty string' };
    }

    // Check for null bytes (path injection)
    if (filePath.includes('\x00')) {
      return { valid: false, error: 'Invalid path: null bytes detected' };
    }

    // Step 2: Normalize the input path first (handles .. and . lexically)
    const normalizedInput = path.resolve(filePath);

    // Step 3: Attempt to resolve the real path (follows all symlinks)
    // This is the CRITICAL step that prevents symlink-based path traversal
    let resolvedPath: string;
    let pathExists = true;

    try {
      resolvedPath = await fs.realpath(normalizedInput);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        pathExists = false;

        if (!allowNonExistent) {
          return { valid: false, error: `Path does not exist: ${filePath}` };
        }

        // For non-existent paths, resolve the parent directory's real path
        // This prevents creating files in symlinked directories pointing outside allowed scope
        resolvedPath = await resolveNonExistentPath(normalizedInput);
      } else if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
        // Circular symlink detected - this is a security risk (DoS or obfuscation)
        return { valid: false, error: 'Invalid path: circular symlink detected' };
      } else {
        throw error;
      }
    }

    // Step 4: Check against blocked absolute paths
    for (const blockedPath of BLOCKED_ABSOLUTE_PATHS) {
      if (resolvedPath.startsWith(blockedPath)) {
        return {
          valid: false,
          error: `Access denied: ${filePath} resolves to a restricted system path`,
        };
      }
    }

    // Step 5: Check against blocked patterns (using RESOLVED path, not input)
    // This prevents bypassing blocked patterns via symlinks
    const allowEnvDocs =
      operation === 'read' && ENV_DOC_ALLOW_PATTERN.test(resolvedPath);
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern === ENV_BLOCK_PATTERN && allowEnvDocs) {
        continue;
      }
      if (pattern.test(resolvedPath)) {
        return {
          valid: false,
          error: `Access denied: ${filePath} resolves to a path matching blocked pattern`,
        };
      }
    }

    // Step 6: Validate path is within allowed directories
    const allowedDirs = getAllowedDirectories();
    const isWithinAllowed = allowedDirs.some(
      (dir) => resolvedPath === dir || resolvedPath.startsWith(dir + path.sep)
    );

    if (!isWithinAllowed) {
      return {
        valid: false,
        error: `Path traversal blocked: ${filePath} resolves to ${resolvedPath} which is outside allowed directories`,
      };
    }

    // Step 7: For write operations, check if we're trying to write to a symlink
    // Prevents accidental/malicious overwrites of symlink targets
    if (operation === 'write' && pathExists) {
      const stats = await fs.lstat(normalizedInput);
      if (stats.isSymbolicLink()) {
        return {
          valid: false,
          error: `Security blocked: cannot write to symlink ${filePath}`,
        };
      }
    }

    return { valid: true, resolvedPath };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Path validation failed',
    };
  }
}

/**
 * Synchronous version for contexts that cannot use async.
 * Uses same security logic as async version.
 * WARNING: Prefer async version when possible.
 */
export function validatePathSync(
  filePath: string,
  options: ValidationOptions = {}
): ValidationResult {
  const { allowNonExistent = false, operation = 'read' } = options;
  const fsSync = require('fs');

  try {
    if (!filePath || typeof filePath !== 'string') {
      return { valid: false, error: 'Invalid path: path must be a non-empty string' };
    }

    if (filePath.includes('\x00')) {
      return { valid: false, error: 'Invalid path: null bytes detected' };
    }

    const normalizedInput = path.resolve(filePath);
    let resolvedPath: string;
    let pathExists = true;

    try {
      resolvedPath = fsSync.realpathSync(normalizedInput);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        pathExists = false;
        if (!allowNonExistent) {
          return { valid: false, error: `Path does not exist: ${filePath}` };
        }
        resolvedPath = resolveNonExistentPathSync(normalizedInput);
      } else if ((error as NodeJS.ErrnoException).code === 'ELOOP') {
        return { valid: false, error: 'Invalid path: circular symlink detected' };
      } else {
        throw error;
      }
    }

    for (const blockedPath of BLOCKED_ABSOLUTE_PATHS) {
      if (resolvedPath.startsWith(blockedPath)) {
        return {
          valid: false,
          error: `Access denied: ${filePath} resolves to a restricted system path`,
        };
      }
    }

    const allowEnvDocs =
      operation === 'read' && ENV_DOC_ALLOW_PATTERN.test(resolvedPath);
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern === ENV_BLOCK_PATTERN && allowEnvDocs) {
        continue;
      }
      if (pattern.test(resolvedPath)) {
        return {
          valid: false,
          error: `Access denied: ${filePath} resolves to a path matching blocked pattern`,
        };
      }
    }

    const allowedDirs = getAllowedDirectories();
    const isWithinAllowed = allowedDirs.some(
      (dir) => resolvedPath === dir || resolvedPath.startsWith(dir + path.sep)
    );

    if (!isWithinAllowed) {
      return {
        valid: false,
        error: `Path traversal blocked: ${filePath} resolves to ${resolvedPath} which is outside allowed directories`,
      };
    }

    if (operation === 'write' && pathExists) {
      const stats = fsSync.lstatSync(normalizedInput);
      if (stats.isSymbolicLink()) {
        return {
          valid: false,
          error: `Security blocked: cannot write to symlink ${filePath}`,
        };
      }
    }

    return { valid: true, resolvedPath };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Path validation failed',
    };
  }
}

/**
 * Enhanced validation that atomically validates and opens a file handle.
 * This significantly reduces the TOCTOU (Time-of-Check-Time-of-Use) window
 * by immediately opening the file after validation.
 *
 * Use this for read operations when possible.
 *
 * @param filePath - Path to validate and open
 * @param flags - File system flags (default: O_RDONLY)
 * @returns ValidationResult with file handle if successful
 */
export async function validateAndOpen(
  filePath: string,
  flags: string | number = constants.O_RDONLY
): Promise<{ valid: boolean; error?: string; handle?: fs.FileHandle }> {
  const validation = await validatePath(filePath);

  if (!validation.valid) {
    return { valid: false, error: validation.error };
  }

  try {
    // Open using the RESOLVED path to prevent remaining TOCTOU window
    const handle = await fs.open(validation.resolvedPath!, flags);
    return { valid: true, handle };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to open file',
    };
  }
}
