import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

// Mock bcrypt 模块
jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('create', () => {
    const mockCreateDto = {
      username: 'testuser',
      password: 'password123',
      role: 'AGENT' as const,
      realName: '测试用户',
      email: 'test@example.com',
      phone: '13800138000',
    };

    it('应该成功创建用户', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        ...mockCreateDto,
        password: 'hashed_password',
      });

      const result = await service.create(mockCreateDto);

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('id', 'user-1');
      expect(result).toHaveProperty('username', 'testuser');
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('应该抛出异常 当用户名已存在时', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        username: 'testuser',
        deletedAt: null,
      });

      await expect(service.create(mockCreateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('应该允许创建已删除的用户名', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 'deleted-user',
        username: 'testuser',
        deletedAt: new Date(),
      });
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        ...mockCreateDto,
        password: 'hashed_password',
      });

      const result = await service.create(mockCreateDto);

      expect(result).toHaveProperty('id');
      expect(mockPrismaService.user.create).toHaveBeenCalled();
    });

    it('应该对密码进行哈希处理', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({
        id: 'user-1',
        ...mockCreateDto,
        password: 'hashed_password',
      });

      await service.create(mockCreateDto);

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
    });
  });

  describe('findAll', () => {
    it('应该返回用户列表', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          username: 'user1',
          role: 'AGENT',
          password: 'hashed',
        },
        {
          id: 'user-2',
          username: 'user2',
          role: 'ADMIN',
          password: 'hashed',
        },
      ];

      mockPrismaService.$transaction.mockResolvedValue([mockUsers, 2]);

      const result = await service.findAll({ page: 1, pageSize: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).not.toHaveProperty('password');
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it('应该支持角色过滤', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll({ role: 'AGENT' });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('应该支持搜索', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll({ search: 'test' });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('应该支持分页', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 2, pageSize: 5 });

      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(5);
    });
  });

  describe('findOne', () => {
    it('应该返回用户详情', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        role: 'AGENT',
        password: 'hashed_password',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.findOne('user-1');

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('id', 'user-1');
      expect(result).toHaveProperty('username', 'testuser');
    });

    it('应该抛出异常 当用户不存在时', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    const mockUpdateDto = {
      realName: '更新后的名称',
      email: 'newemail@example.com',
    };

    it('应该成功更新用户', async () => {
      const existingUser = {
        id: 'user-1',
        username: 'testuser',
        password: 'hashed',
      };

      const updatedUser = {
        ...existingUser,
        ...mockUpdateDto,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue(updatedUser);

      const result = await service.update('user-1', mockUpdateDto);

      expect(result).not.toHaveProperty('password');
      expect(result).toHaveProperty('realName', '更新后的名称');
      expect(mockPrismaService.user.update).toHaveBeenCalled();
    });

    it('应该抛出异常 当用户不存在时', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', mockUpdateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('应该对密码进行哈希处理 当更新密码时', async () => {
      const existingUser = {
        id: 'user-1',
        username: 'testuser',
        password: 'old_hashed',
      };

      (bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        password: 'new_hashed_password',
      });

      await service.update('user-1', { password: 'newpassword' });

      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword', 10);
    });
  });

  describe('remove', () => {
    it('应该软删除用户', async () => {
      const existingUser = {
        id: 'user-1',
        username: 'testuser',
        deletedAt: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(existingUser);
      mockPrismaService.user.update.mockResolvedValue({
        ...existingUser,
        deletedAt: new Date(),
      });

      await service.remove('user-1');

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('应该抛出异常 当用户不存在时', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
