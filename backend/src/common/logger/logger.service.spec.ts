import { Test, TestingModule } from '@nestjs/testing';
import { LoggerService, LogLevel } from './logger.service';
import { existsSync, readFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';

describe('LoggerService', () => {
  let service: LoggerService;
  let testLogDir: string;

  beforeEach(async () => {
    // 使用临时日志目录
    testLogDir = join(__dirname, '../../../../test-logs');
    if (!existsSync(testLogDir)) {
      mkdirSync(testLogDir, { recursive: true });
    }

    // 设置测试环境变量
    process.env.LOG_DIR = testLogDir;
    process.env.LOG_LEVEL = 'DEBUG';
    process.env.LOG_FORMAT = 'text';

    const module: TestingModule = await Test.createTestingModule({
      providers: [LoggerService],
    }).compile();

    service = module.get<LoggerService>(LoggerService);
  });

  afterEach(async () => {
    // 清理测试日志文件
    if (service && typeof (service as any).onModuleDestroy === 'function') {
      await (service as any).onModuleDestroy();
    }
  });

  describe('日志级别', () => {
    it('应该根据配置过滤日志', () => {
      service.setLogLevel(LogLevel.WARN);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation();
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      service.debug('调试信息', 'Test');
      service.log('普通信息', 'Test');
      service.warn('警告信息', 'Test');
      service.error('错误信息', undefined, 'Test');

      expect(consoleSpy).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  describe('敏感信息过滤', () => {
    it('应该过滤密码字段', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      service.log('用户登录', 'Test', {
        username: 'test',
        password: 'secret123',
        token: 'abc123',
      });

      const logCall = consoleSpy.mock.calls[0];
      expect(logCall[0]).toContain('***REDACTED***');
      expect(logCall[0]).not.toContain('secret123');
      expect(logCall[0]).not.toContain('abc123');

      consoleSpy.mockRestore();
    });

    it('应该递归过滤嵌套对象', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      service.log('测试', 'Test', {
        user: {
          username: 'test',
          password: 'secret',
          profile: {
            apiKey: 'key123',
          },
        },
      });

      const logCall = consoleSpy.mock.calls[0];
      expect(logCall[0]).toContain('***REDACTED***');
      expect(logCall[0]).not.toContain('secret');
      expect(logCall[0]).not.toContain('key123');

      consoleSpy.mockRestore();
    });
  });

  describe('日志格式', () => {
    it('应该支持文本格式', () => {
      process.env.LOG_FORMAT = 'text';
      const service = new LoggerService();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      service.log('测试消息', 'TestContext');

      const logCall = consoleSpy.mock.calls[0][0];
      expect(logCall).toContain('[TestContext]');
      expect(logCall).toContain('测试消息');

      consoleSpy.mockRestore();
    });

    it('应该支持JSON格式', () => {
      process.env.LOG_FORMAT = 'json';
      const service = new LoggerService();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      service.log('测试消息', 'TestContext');

      const logCall = consoleSpy.mock.calls[0][0];
      expect(() => JSON.parse(logCall)).not.toThrow();
      const parsed = JSON.parse(logCall);
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level', 'LOG');
      expect(parsed).toHaveProperty('context', 'TestContext');
      expect(parsed).toHaveProperty('message', '测试消息');

      consoleSpy.mockRestore();
    });
  });

  describe('日志采样', () => {
    it('应该根据采样率过滤日志', () => {
      process.env.LOG_SAMPLING_RATE = '0.5';
      const service = new LoggerService();

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // 运行多次，应该只有部分被记录
      for (let i = 0; i < 100; i++) {
        service.log(`消息 ${i}`, 'Test');
      }

      // 由于采样率是 0.5，应该有大约 50 条日志（允许一些误差）
      const logCount = consoleSpy.mock.calls.length;
      expect(logCount).toBeGreaterThan(30);
      expect(logCount).toBeLessThan(70);

      consoleSpy.mockRestore();
    });

    it('错误日志应该始终记录（不受采样影响）', () => {
      process.env.LOG_SAMPLING_RATE = '0';
      const service = new LoggerService();

      const errorSpy = jest.spyOn(console, 'error').mockImplementation();

      for (let i = 0; i < 10; i++) {
        service.error(`错误 ${i}`, undefined, 'Test');
      }

      // 所有错误日志都应该被记录
      expect(errorSpy.mock.calls.length).toBe(10);

      errorSpy.mockRestore();
    });
  });
});
