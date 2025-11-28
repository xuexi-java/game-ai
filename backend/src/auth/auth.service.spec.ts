import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('8h'),
  };

  const mockWebsocketGateway = {
    notifyAgentStatusChange: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: WebsocketGateway,
          useValue: mockWebsocketGateway,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);

    // 重置所有 mock
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('应该成功验证用户（bcrypt密码）', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        password: '$2b$10$hashed_password',
        role: 'AGENT',
        deletedAt: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      // Mock bcrypt.compare
      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      const result = await service.validateUser('testuser', 'password');

      expect(result).toEqual({
        id: '1',
        username: 'testuser',
        role: 'AGENT',
        deletedAt: null,
      });
      expect(result).not.toHaveProperty('password');
    });

    it('应该抛出异常 当用户不存在时', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.validateUser('nonexistent', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('应该抛出异常 当用户已删除时', async () => {
      const mockUser = {
        id: '1',
        username: 'deleteduser',
        password: 'password',
        role: 'AGENT',
        deletedAt: new Date(),
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.validateUser('deleteduser', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('应该抛出异常 当密码错误时', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        password: '$2b$10$hashed_password',
        role: 'AGENT',
        deletedAt: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const bcrypt = require('bcrypt');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

      await expect(
        service.validateUser('testuser', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login', () => {
    it('应该成功登录并返回token', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        role: 'AGENT',
        realName: 'Test User',
        deletedAt: null,
      };

      jest.spyOn(service, 'validateUser').mockResolvedValue(mockUser as any);
      mockPrismaService.user.update.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock_token');

      const result = await service.login({
        username: 'testuser',
        password: 'password',
      });

      expect(result).toHaveProperty('accessToken', 'mock_token');
      expect(result).toHaveProperty('user');
      expect(result.user.username).toBe('testuser');
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          lastLoginAt: expect.any(Date),
          isOnline: true,
        },
      });
    });
  });

  describe('logout', () => {
    it('应该成功登出并更新在线状态', async () => {
      const mockUser = {
        id: '1',
        username: 'testuser',
        role: 'AGENT',
        realName: 'Test User',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...mockUser,
        isOnline: false,
      });

      const result = await service.logout('1');

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isOnline: false },
      });
    });

    it('应该抛出异常 当用户不存在时', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.logout('nonexistent')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
