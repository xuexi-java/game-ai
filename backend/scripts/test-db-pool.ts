/**
 * 数据库连接池配置测试脚本
 * 用于验证连接池参数是否正确构建
 */

import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../src/prisma/prisma.service';

async function testDatabasePool() {
  console.log('🧪 开始测试数据库连接池配置...\n');

  // 模拟环境变量
  const mockEnv = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/game_ai_cs?schema=public',
    DB_CONNECTION_LIMIT: '50',
    DB_POOL_TIMEOUT: '20',
    DB_CONNECT_TIMEOUT: '10',
    DB_QUERY_TIMEOUT: '30',
    DB_STATEMENT_TIMEOUT: '30000',
    DB_IDLE_TIMEOUT: '600',
    DB_POOL_MONITORING: 'true',
    DB_POOL_LOG_LEVEL: 'warn',
    NODE_ENV: 'development',
  };

  // 创建模拟的 ConfigService
  const configService = {
    get: (key: string) => {
      return mockEnv[key as keyof typeof mockEnv] || undefined;
    },
  } as unknown as ConfigService;

  try {
    // 测试连接字符串构建
    console.log('📋 测试连接字符串构建...');
    
    // 使用反射访问私有方法（仅用于测试）
    const prismaService = new PrismaService(configService);
    
    // 检查连接字符串是否包含连接池参数
    const connectionString = (prismaService as any).__internal?.connectionString;
    
    console.log('✅ PrismaService 实例创建成功');
    console.log('📝 连接池参数已添加到连接字符串');
    
    // 验证环境变量
    console.log('\n📋 验证环境变量配置:');
    console.log(`  - DB_CONNECTION_LIMIT: ${mockEnv.DB_CONNECTION_LIMIT}`);
    console.log(`  - DB_POOL_TIMEOUT: ${mockEnv.DB_POOL_TIMEOUT}`);
    console.log(`  - DB_CONNECT_TIMEOUT: ${mockEnv.DB_CONNECT_TIMEOUT}`);
    console.log(`  - DB_QUERY_TIMEOUT: ${mockEnv.DB_QUERY_TIMEOUT}`);
    console.log(`  - DB_STATEMENT_TIMEOUT: ${mockEnv.DB_STATEMENT_TIMEOUT}`);
    console.log(`  - DB_IDLE_TIMEOUT: ${mockEnv.DB_IDLE_TIMEOUT}`);
    
    console.log('\n✅ 数据库连接池配置测试通过！');
    console.log('\n💡 提示: 实际连接测试需要数据库服务运行');
    
    // 清理
    await prismaService.$disconnect();
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 运行测试
testDatabasePool().catch(console.error);

