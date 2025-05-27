import { ENV } from '@/constants';

export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  context?: string;
}

class Logger {
  private isDevelopment = ENV.NODE_ENV === 'development';

  private formatMessage(level: LogLevel, message: string, context?: string): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? `[${context}]` : '';
    return `${timestamp} ${level.toUpperCase()} ${contextStr} ${message}`;
  }

  private log(level: LogLevel, message: string, data?: any, context?: string): void {
    const formattedMessage = this.formatMessage(level, message, context);
    
    // In production, you might want to send logs to a service
    if (this.isDevelopment) {
      switch (level) {
        case LogLevel.ERROR:
          console.error(formattedMessage, data || '');
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage, data || '');
          break;
        case LogLevel.INFO:
          console.info(formattedMessage, data || '');
          break;
        case LogLevel.DEBUG:
          console.debug(formattedMessage, data || '');
          break;
      }
    }
  }

  error(message: string, data?: any, context?: string): void {
    this.log(LogLevel.ERROR, message, data, context);
  }

  warn(message: string, data?: any, context?: string): void {
    this.log(LogLevel.WARN, message, data, context);
  }

  info(message: string, data?: any, context?: string): void {
    this.log(LogLevel.INFO, message, data, context);
  }

  debug(message: string, data?: any, context?: string): void {
    this.log(LogLevel.DEBUG, message, data, context);
  }

  // Specific logging methods for common use cases
  apiRequest(method: string, url: string, context?: string): void {
    this.info(`${method} ${url}`, undefined, context || 'API');
  }

  apiResponse(method: string, url: string, status: number, context?: string): void {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.INFO;
    this.log(level, `${method} ${url} - ${status}`, undefined, context || 'API');
  }

  dbOperation(operation: string, collection: string, context?: string): void {
    this.debug(`${operation} on ${collection}`, undefined, context || 'DB');
  }

  userAction(action: string, userId?: string, context?: string): void {
    this.info(`User action: ${action}`, { userId }, context || 'USER');
  }

  performance(operation: string, duration: number, context?: string): void {
    this.debug(`${operation} took ${duration}ms`, undefined, context || 'PERF');
  }
}

// Export singleton instance
export const logger = new Logger();

// Export convenience functions
export const logError = (message: string, data?: any, context?: string) => 
  logger.error(message, data, context);

export const logWarn = (message: string, data?: any, context?: string) => 
  logger.warn(message, data, context);

export const logInfo = (message: string, data?: any, context?: string) => 
  logger.info(message, data, context);

export const logDebug = (message: string, data?: any, context?: string) => 
  logger.debug(message, data, context); 