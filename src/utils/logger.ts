/**
 * Simple logger utility for consistent logging across the codebase.
 * Extend or replace with a more robust logger as needed.
 * @module utils/logger
 */
export class Logger {
  /**
   * @param context - Context string for log prefix
   */
  constructor(private readonly context: string) {}

  /**
   * Log an info message.
   * @param message - Message string
   * @param args - Additional arguments
   */
  info(message: string, ...args: unknown[]) {
    console.info(`[INFO] [${this.context}]`, message, ...args);
  }

  /**
   * Log a warning message.
   * @param message - Message string
   * @param args - Additional arguments
   */
  warn(message: string, ...args: unknown[]) {
    console.warn(`[WARN] [${this.context}]`, message, ...args);
  }

  /**
   * Log an error message.
   * @param message - Message string
   * @param args - Additional arguments
   */
  error(message: string, ...args: unknown[]) {
    console.error(`[ERROR] [${this.context}]`, message, ...args);
  }
}
