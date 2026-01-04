import { promises as fs } from 'fs';
import path from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private level: LogLevel = 'info';
  private logDir: string;

  constructor() {
    this.level = (process.env.GROK_LOG_LEVEL as LogLevel) || 'info';
    this.logDir = path.join(process.cwd(), '.grok', 'logs');
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private format(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${dataStr}`;
  }

  private async writeToFile(entry: string): Promise<void> {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      const logFile = path.join(this.logDir, `grok-${new Date().toISOString().split('T')[0]}.log`);
      await fs.appendFile(logFile, entry + '\n');
    } catch {
      // Silently fail - logging should never break the app
    }
  }

  debug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      const entry = this.format('debug', message, data);
      console.debug(entry);
      this.writeToFile(entry);
    }
  }

  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      const entry = this.format('info', message, data);
      console.info(entry);
      this.writeToFile(entry);
    }
  }

  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      const entry = this.format('warn', message, data);
      console.warn(entry);
      this.writeToFile(entry);
    }
  }

  error(message: string, data?: unknown): void {
    if (this.shouldLog('error')) {
      const entry = this.format('error', message, data);
      console.error(entry);
      this.writeToFile(entry);
    }
  }
}

export const logger = new Logger();
