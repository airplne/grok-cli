export class GrokError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'GrokError';
  }
}

export class APIError extends GrokError {
  constructor(message: string, public readonly statusCode?: number) {
    super(message, 'API_ERROR');
    this.name = 'APIError';
  }
}

export class ToolError extends GrokError {
  constructor(message: string, public readonly toolName?: string) {
    super(message, 'TOOL_ERROR');
    this.name = 'ToolError';
  }
}

export class SecurityError extends GrokError {
  constructor(message: string) {
    super(message, 'SECURITY_ERROR');
    this.name = 'SecurityError';
  }
}

export class ConfigError extends GrokError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

export function formatError(error: unknown): string {
  if (error instanceof GrokError) {
    return `[${error.code || error.name}] ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
