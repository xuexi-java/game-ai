import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [
    PassportModule,
    WebsocketModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const jwtSecret = configService.get<string>('JWT_SECRET');
        
        // 强制检查：如果密钥不存在，立即抛出错误阻止应用启动
        if (!jwtSecret || jwtSecret.trim().length === 0) {
          const errorMessage = '致命错误：未在环境变量中定义 JWT_SECRET。应用无法在没有安全 JWT 密钥的情况下启动。';
          console.error(errorMessage);
          console.error('请在 .env 文件或环境变量中设置 JWT_SECRET。');
          throw new Error(errorMessage);
        }

        // 生产环境安全检查：警告密钥长度过短
        const nodeEnv = configService.get<string>('NODE_ENV');
        if (nodeEnv === 'production' && jwtSecret.length < 32) {
          console.warn(
            `⚠️  安全警告：JWT_SECRET 长度过短（${jwtSecret.length} 个字符）。` +
            `生产环境建议使用至少 32 个字符的密钥。`
          );
        }

        return {
          secret: jwtSecret,
          signOptions: {
            expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '8h',
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}
