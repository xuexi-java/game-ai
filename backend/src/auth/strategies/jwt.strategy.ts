import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger: Logger;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // 获取 JWT 密钥，不允许使用默认值
    const jwtSecret = configService.get<string>('JWT_SECRET');

    // 强制检查：如果密钥不存在，立即抛出错误阻止应用启动
    if (!jwtSecret || jwtSecret.trim().length === 0) {
      const errorMessage = '致命错误：未在环境变量中定义 JWT_SECRET。应用无法在没有安全 JWT 密钥的情况下启动。';
      // 在 super() 之前使用 console.error，因为此时无法访问 this.logger
      console.error(errorMessage);
      console.error('请在 .env 文件或环境变量中设置 JWT_SECRET。');
      throw new Error(errorMessage);
    }

    // 生产环境安全检查：警告密钥长度过短
    const nodeEnv = configService.get<string>('NODE_ENV');
    if (nodeEnv === 'production' && jwtSecret.length < 32) {
      // 在 super() 之前使用 console.warn
      console.warn(
        `⚠️  安全警告：JWT_SECRET 长度过短（${jwtSecret.length} 个字符）。` +
        `生产环境建议使用至少 32 个字符的密钥。`
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret, // 仅使用经过验证的密钥
    });

    // 在 super() 调用之后初始化 logger
    this.logger = new Logger(JwtStrategy.name);
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        role: true,
        realName: true,
        email: true,
        isOnline: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return user;
  }
}
