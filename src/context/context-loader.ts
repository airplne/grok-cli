import { promises as fs } from 'fs';
import path from 'path';

const CONTEXT_FILENAMES = ['GROK.md', 'grok.md'];

export async function loadContext(cwd: string = process.cwd()): Promise<string> {
  const contexts: string[] = [];

  // Walk up directory tree looking for GROK.md files
  let currentDir = cwd;
  const visitedDirs: string[] = [];

  while (true) {
    visitedDirs.push(currentDir);

    for (const filename of CONTEXT_FILENAMES) {
      const contextPath = path.join(currentDir, filename);
      try {
        const content = await fs.readFile(contextPath, 'utf-8');
        contexts.unshift(content); // Add parent contexts first
      } catch {
        // File doesn't exist, continue
      }
    }

    // Check .grok/context/ folder
    const contextFolder = path.join(currentDir, '.grok', 'context');
    try {
      const files = await fs.readdir(contextFolder);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const content = await fs.readFile(path.join(contextFolder, file), 'utf-8');
          contexts.push(`\n# Context: ${file}\n${content}`);
        }
      }
    } catch {
      // Folder doesn't exist, continue
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break; // Reached root
    }
    currentDir = parentDir;
  }

  return contexts.join('\n\n---\n\n');
}

export async function processImports(content: string, basePath: string): Promise<string> {
  // Process @import directives
  const importRegex = /@import\s+["'](.+?)["']/g;
  let result = content;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const importPath = path.resolve(basePath, match[1]);
    try {
      const importedContent = await fs.readFile(importPath, 'utf-8');
      result = result.replace(match[0], importedContent);
    } catch {
      console.warn(`Warning: Could not import ${importPath}`);
    }
  }

  return result;
}
