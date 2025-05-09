/**
 * Logger utility for consistent logging across the application
 * In production, this could be replaced with a more robust solution like Winston
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  enableConsole: boolean;
  minLevel: LogLevel;
}

// Default configuration
const logLevels: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

let config: LogConfig = {
  enableConsole: process.env.NODE_ENV !== 'production',
  minLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
};

/**
 * Configure the logger
 */
export function configureLogger(newConfig: Partial<LogConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Determine if a log should be output based on its level
 */
function shouldLog(level: LogLevel): boolean {
  return logLevels[level] >= logLevels[config.minLevel];
}

/**
 * Format a log message
 */
function formatLog(level: LogLevel, message: string, data?: any): string {
  const timestamp = new Date().toISOString();
  let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  
  if (data) {
    try {
      if (typeof data === 'object') {
        logMessage += ` - ${JSON.stringify(data)}`;
      } else {
        logMessage += ` - ${data}`;
      }
    } catch (e) {
      logMessage += ' - [Unstringifiable data]';
    }
  }
  
  return logMessage;
}

/**
 * Log a debug message
 */
export function debug(message: string, data?: any): void {
  if (shouldLog('debug') && config.enableConsole) {
    console.debug(formatLog('debug', message, data));
  }
}

/**
 * Log an info message
 */
export function info(message: string, data?: any): void {
  if (shouldLog('info') && config.enableConsole) {
    console.info(formatLog('info', message, data));
  }
}

/**
 * Log a warning message
 */
export function warn(message: string, data?: any): void {
  if (shouldLog('warn') && config.enableConsole) {
    console.warn(formatLog('warn', message, data));
  }
}

/**
 * Log an error message
 */
export function error(message: string, data?: any): void {
  if (shouldLog('error') && config.enableConsole) {
    console.error(formatLog('error', message, data));
  }
}

export default {
  debug,
  info,
  warn,
  error,
  configureLogger
};
