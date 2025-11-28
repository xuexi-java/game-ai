import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync, promises as fs } from 'fs';
import { join } from 'path';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

// 简单的日期格式化函数
function formatDate(date: Date, formatStr: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0');

  return formatStr
    .replace('yyyy', String(year))
    .replace('MM', month)
    .replace('dd', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
    .replace('SSS', milliseconds);
}

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  LOG = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  data?: any;
  stack?: string;
}

interface LoggerConfig {
  logLevel: LogLevel;
  logDir: string;
  format: 'text' | 'json';
  enableCompression: boolean;
  archiveAfterDays: number;
  batchSize: number;
  batchInterval: number;
  samplingRate: number; // 0-1, 1表示记录所有日志
  sensitiveFields: string[];
}

@Injectable()
export class OptimizedLoggerService implements NestLoggerService {
  private config: LoggerConfig;
  private errorLogStream: NodeJS.WritableStream;
  private combinedLogStream: NodeJS.WritableStream;
  private currentDate: string;
  private writeQueue: LogEntry[] = [];
  private writeTimer: NodeJS.Timeout | null = null;
  private isWriting = false;
  private writeErrors = 0;
  private fallbackMode = false; // 降级模式：仅控制台输出

  constructor() {
    this.initializeConfig();
    this.initializeLogStreams();
    this.scheduleLogRotation();
    this.scheduleArchive();
  }

  private initializeConfig() {
    const envLogLevel = process.env.LOG_LEVEL?.toUpperCase() || 'LOG';
    const logLevel = LogLevel[envLogLevel] ?? LogLevel.LOG;

    this.config = {
      logLevel,
      logDir: process.env.LOG_DIR || join(process.cwd(), 'logs'),
      format: (process.env.LOG_FORMAT as 'text' | 'json') || 'text',
      enableCompression: process.env.LOG_ENABLE_COMPRESSION !== 'false',
      archiveAfterDays: parseInt(process.env.LOG_ARCHIVE_AFTER_DAYS || '7'),
      batchSize: parseInt(process.env.LOG_BATCH_SIZE || '100'),
      batchInterval: parseInt(process.env.LOG_BATCH_INTERVAL || '100'),
      samplingRate: parseFloat(process.env.LOG_SAMPLING_RATE || '1'),
      sensitiveFields: (
        process.env.LOG_SENSITIVE_FIELDS ||
        'password,token,secret,apiKey,authorization'
      )
        .split(',')
        .map((s) => s.trim()),
    };

    if (!existsSync(this.config.logDir)) {
      mkdirSync(this.config.logDir, { recursive: true });
    }
  }

  private initializeLogStreams() {
    const dateStr = formatDate(new Date(), 'yyyy-MM-dd');
    const errorLogPath = join(
      this.config.logDir,
      `backend-${dateStr}.error.log`,
    );
    const combinedLogPath = join(this.config.logDir, `backend-${dateStr}.log`);

    // 关闭旧的流
    if (this.errorLogStream) {
      this.errorLogStream.end();
    }
    if (this.combinedLogStream) {
      this.combinedLogStream.end();
    }

    try {
      // 创建新的流（异步模式）
      this.errorLogStream = createWriteStream(errorLogPath, {
        flags: 'a',
        highWaterMark: 64 * 1024, // 64KB 缓冲区
      });
      this.combinedLogStream = createWriteStream(combinedLogPath, {
        flags: 'a',
        highWaterMark: 64 * 1024,
      });

      // 监听错误
      this.errorLogStream.on('error', (err) => this.handleWriteError(err));
      this.combinedLogStream.on('error', (err) => this.handleWriteError(err));

      this.currentDate = dateStr;
      this.fallbackMode = false;
      this.writeErrors = 0;
    } catch (error) {
      console.error('Failed to initialize log streams:', error);
      this.fallbackMode = true;
    }
  }

  private handleWriteError(error: Error) {
    this.writeErrors++;
    console.error('Log write error:', error.message);

    // 如果错误过多，进入降级模式
    if (this.writeErrors > 10 && !this.fallbackMode) {
      console.warn(
        'Too many write errors, entering fallback mode (console only)',
      );
      this.fallbackMode = true;
    }
  }

  private scheduleLogRotation() {
    // 每小时检查一次是否需要切换日志文件
    setInterval(() => {
      const now = formatDate(new Date(), 'yyyy-MM-dd');
      if (now !== this.currentDate) {
        this.flushQueue().then(() => {
          this.initializeLogStreams();
        });
      }
    }, 3600000); // 1小时
  }

  private scheduleArchive() {
    // 每天凌晨2点执行归档
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);

    const msUntilArchive = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.archiveOldLogs();
      // 之后每天执行一次
      setInterval(() => {
        this.archiveOldLogs();
      }, 24 * 3600000);
    }, msUntilArchive);
  }

  private async archiveOldLogs() {
    if (!this.config.enableCompression) return;

    try {
      const archiveDir = join(this.config.logDir, 'archive');
      if (!existsSync(archiveDir)) {
        mkdirSync(archiveDir, { recursive: true });
      }

      const files = await fs.readdir(this.config.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.archiveAfterDays);

      for (const file of files) {
        if (!file.endsWith('.log') || file.includes('archive')) continue;

        const filePath = join(this.config.logDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          // 压缩文件
          const content = await fs.readFile(filePath);
          const compressed = await gzipAsync(content);
          const archivePath = join(archiveDir, `${file}.gz`);
          await fs.writeFile(archivePath, compressed);

          // 删除原文件
          await fs.unlink(filePath);
          console.log(`Archived log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to archive logs:', error);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    if (level > this.config.logLevel) return false;

    // 错误日志始终记录（不采样）
    if (level === LogLevel.ERROR) return true;

    // 其他日志按采样率记录
    return Math.random() < this.config.samplingRate;
  }

  private filterSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    const filtered = Array.isArray(data) ? [...data] : { ...data };

    for (const key in filtered) {
      const lowerKey = key.toLowerCase();
      if (
        this.config.sensitiveFields.some((field) =>
          lowerKey.includes(field.toLowerCase()),
        )
      ) {
        filtered[key] = '***REDACTED***';
      } else if (typeof filtered[key] === 'object' && filtered[key] !== null) {
        filtered[key] = this.filterSensitiveData(filtered[key]);
      }
    }

    return filtered;
  }

  private formatMessage(
    level: string,
    context: string,
    message: any,
    data?: any,
    stack?: string,
  ): LogEntry {
    const timestamp = formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss.SSS');
    const messageStr =
      typeof message === 'string' ? message : JSON.stringify(message);

    // 过滤敏感信息
    const filteredData = data ? this.filterSensitiveData(data) : undefined;

    return {
      timestamp,
      level,
      context: context || 'Application',
      message: messageStr,
      data: filteredData,
      stack,
    };
  }

  private formatLogEntry(entry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(entry) + '\n';
    }

    // 文本格式
    const dataStr = entry.data ? ' ' + JSON.stringify(entry.data) : '';
    const stackStr = entry.stack ? '\n' + entry.stack : '';
    return `[${entry.timestamp}] ${entry.level} [${entry.context}] ${entry.message}${dataStr}${stackStr}\n`;
  }

  private enqueueLog(entry: LogEntry) {
    this.writeQueue.push(entry);

    // 如果队列达到批量大小，立即刷新
    if (this.writeQueue.length >= this.config.batchSize) {
      this.flushQueue();
    } else if (!this.writeTimer) {
      // 设置定时器，定期刷新
      this.writeTimer = setTimeout(() => {
        this.flushQueue();
      }, this.config.batchInterval);
    }
  }

  private async flushQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return;

    this.isWriting = true;

    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }

    const logsToWrite = [...this.writeQueue];
    this.writeQueue = [];

    try {
      if (this.fallbackMode) {
        // 降级模式：仅输出到控制台
        logsToWrite.forEach((entry) => {
          const formatted = this.formatLogEntry(entry);
          if (entry.level === 'ERROR') {
            console.error(formatted.trim());
          } else if (entry.level === 'WARN') {
            console.warn(formatted.trim());
          } else {
            console.log(formatted.trim());
          }
        });
      } else {
        // 正常模式：写入文件
        const combinedMessages = logsToWrite
          .map((entry) => this.formatLogEntry(entry))
          .join('');
        const errorMessages = logsToWrite
          .filter((entry) => entry.level === 'ERROR')
          .map((entry) => this.formatLogEntry(entry))
          .join('');

        // 异步写入
        await Promise.all([
          new Promise<void>((resolve, reject) => {
            this.combinedLogStream.write(combinedMessages, (err) => {
              if (err) reject(err);
              else resolve();
            });
          }),
          errorMessages
            ? new Promise<void>((resolve, reject) => {
                this.errorLogStream.write(errorMessages, (err) => {
                  if (err) reject(err);
                  else resolve();
                });
              })
            : Promise.resolve(),
        ]);

        // 重置错误计数（写入成功）
        this.writeErrors = Math.max(0, this.writeErrors - 1);
      }
    } catch (error) {
      this.handleWriteError(error as Error);
      // 降级到控制台输出
      logsToWrite.forEach((entry) => {
        console.error(`[FALLBACK] ${this.formatLogEntry(entry).trim()}`);
      });
    } finally {
      this.isWriting = false;
    }
  }

  private writeLog(
    level: string,
    context: string,
    message: any,
    data?: any,
    stack?: string,
  ) {
    const entry = this.formatMessage(level, context, message, data, stack);

    // 输出到控制台
    if (level === 'ERROR') {
      console.error(`[${entry.context}] ${entry.message}`, data || '');
    } else if (level === 'WARN') {
      console.warn(`[${entry.context}] ${entry.message}`, data || '');
    } else {
      console.log(`[${entry.context}] ${entry.message}`, data || '');
    }

    // 加入写入队列
    this.enqueueLog(entry);
  }

  log(message: any, context?: string, ...optionalParams: any[]) {
    if (this.shouldLog(LogLevel.LOG)) {
      this.writeLog(
        'LOG',
        context || 'Application',
        message,
        optionalParams.length > 0 ? optionalParams : undefined,
      );
    }
  }

  error(
    message: any,
    trace?: string,
    context?: string,
    ...optionalParams: any[]
  ) {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog(
        'ERROR',
        context || 'Application',
        message,
        optionalParams.length > 0 ? optionalParams : undefined,
        trace,
      );
    }
  }

  warn(message: any, context?: string, ...optionalParams: any[]) {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog(
        'WARN',
        context || 'Application',
        message,
        optionalParams.length > 0 ? optionalParams : undefined,
      );
    }
  }

  debug(message: any, context?: string, ...optionalParams: any[]) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog(
        'DEBUG',
        context || 'Application',
        message,
        optionalParams.length > 0 ? optionalParams : undefined,
      );
    }
  }

  verbose(message: any, context?: string, ...optionalParams: any[]) {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      this.writeLog(
        'VERBOSE',
        context || 'Application',
        message,
        optionalParams.length > 0 ? optionalParams : undefined,
      );
    }
  }

  setLogLevel(level: LogLevel) {
    this.config.logLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.config.logLevel;
  }

  // 应用关闭时刷新队列
  async onModuleDestroy() {
    await this.flushQueue();
    if (this.errorLogStream) {
      this.errorLogStream.end();
    }
    if (this.combinedLogStream) {
      this.combinedLogStream.end();
    }
  }
}
