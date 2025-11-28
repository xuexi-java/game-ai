/**
 * 前端日志工具类（玩家端）
 * 统一管理前端日志，支持日志级别、本地存储等功能
 */

export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

interface LogEntry {
  timestamp: string;
  level: string;
  context?: string;
  message: string;
  data?: any;
  stack?: string;
}

class Logger {
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs = 500; // 玩家端减少内存占用
  private enableLocalStorage = true;

  constructor() {
    // 从环境变量读取日志级别，玩家端默认只记录 ERROR 和 WARN
    const envLogLevel = import.meta.env.VITE_LOG_LEVEL?.toUpperCase() || 'WARN';
    const levelMap: Record<string, LogLevel> = {
      ERROR: LogLevel.ERROR,
      WARN: LogLevel.WARN,
      INFO: LogLevel.INFO,
      DEBUG: LogLevel.DEBUG,
    };
    this.logLevel = levelMap[envLogLevel] ?? LogLevel.WARN;
  }

  private formatTimestamp(): string {
    return new Date().toISOString();
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private addLog(level: string, context: string | undefined, message: string, data?: any, stack?: string) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      context,
      message,
      data,
      stack,
    };

    this.logs.push(entry);

    // 限制内存中的日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 保存到 localStorage（仅错误）
    if (this.enableLocalStorage && level === 'ERROR') {
      this.saveToLocalStorage(entry);
    }
  }

  private saveToLocalStorage(entry: LogEntry) {
    try {
      const key = `player_logs_${new Date().toISOString().split('T')[0]}`;
      const existingLogs = localStorage.getItem(key);
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(entry);
      
      // 只保留最近3天的错误日志
      if (logs.length > 1000) {
        logs.splice(0, logs.length - 1000);
      }
      
      localStorage.setItem(key, JSON.stringify(logs));
    } catch (e) {
      // localStorage 可能已满，忽略错误
    }
  }

  error(message: string, error?: Error | any, context?: string) {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const errorData = error instanceof Error 
      ? { message: error.message, name: error.name }
      : error;
    const stack = error instanceof Error ? error.stack : undefined;

    console.error(`[${context || 'PlayerApp'}] ${message}`, error || '');
    this.addLog('ERROR', context, message, errorData, stack);
  }

  warn(message: string, data?: any, context?: string) {
    if (!this.shouldLog(LogLevel.WARN)) return;

    console.warn(`[${context || 'PlayerApp'}] ${message}`, data || '');
    this.addLog('WARN', context, message, data);
  }

  info(message: string, data?: any, context?: string) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    // 玩家端不输出 INFO 日志到控制台，减少干扰
    this.addLog('INFO', context, message, data);
  }

  debug(message: string, data?: any, context?: string) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    if (import.meta.env.DEV) {
      console.debug(`[${context || 'PlayerApp'}] ${message}`, data || '');
    }
    this.addLog('DEBUG', context, message, data);
  }
}

// 导出单例
export const logger = new Logger();

// 导出便捷方法
export const logError = (message: string, error?: Error | any, context?: string) => {
  logger.error(message, error, context);
};

export const logWarn = (message: string, data?: any, context?: string) => {
  logger.warn(message, data, context);
};

export const logInfo = (message: string, data?: any, context?: string) => {
  logger.info(message, data, context);
};

export const logDebug = (message: string, data?: any, context?: string) => {
  logger.debug(message, data, context);
};

