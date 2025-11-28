// E2E 测试全局设置

// 设置测试超时时间
jest.setTimeout(30000);

// 设置测试数据库 URL（如果使用）
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
}

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.LOG_LEVEL = 'ERROR'; // E2E 测试时只记录错误
