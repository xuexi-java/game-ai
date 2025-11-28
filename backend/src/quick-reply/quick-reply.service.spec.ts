import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { QuickReplyService } from './quick-reply.service';
import { PrismaService } from '../prisma/prisma.service';

describe('QuickReplyService', () => {
  let service: QuickReplyService;
  let prisma: PrismaService;

  const mockPrismaService = {
    quickReplyCategory: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    quickReply: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    quickReplyFavorite: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuickReplyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<QuickReplyService>(QuickReplyService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('getCategories', () => {
    it('应该返回分类列表（管理员）', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: '问候语',
          isGlobal: true,
          sortOrder: 1,
        },
        {
          id: 'cat-2',
          name: '问题确认',
          isGlobal: false,
          sortOrder: 2,
        },
      ];

      const mockReplyCounts = [
        { categoryId: 'cat-1', _count: { id: 5 } },
        { categoryId: 'cat-2', _count: { id: 3 } },
      ];

      mockPrismaService.quickReplyCategory.findMany.mockResolvedValue(
        mockCategories,
      );
      mockPrismaService.quickReply.groupBy.mockResolvedValue(mockReplyCounts);

      const result = await service.getCategories('user-1', true);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('_count');
      expect(result[0]._count.replies).toBe(5);
    });

    it('应该只返回全局分类和用户自己的分类（普通用户）', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: '问候语',
          isGlobal: true,
          sortOrder: 1,
        },
      ];

      mockPrismaService.quickReplyCategory.findMany.mockResolvedValue(
        mockCategories,
      );
      mockPrismaService.quickReply.groupBy.mockResolvedValue([]);

      await service.getCategories('user-1', false);

      expect(
        mockPrismaService.quickReplyCategory.findMany,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ isGlobal: true }, { creatorId: 'user-1' }],
          }),
        }),
      );
    });
  });

  describe('createCategory', () => {
    const mockCreateDto = {
      name: '新分类',
      isGlobal: false,
      sortOrder: 1,
    };

    const mockCategory = {
      id: 'cat-1',
      ...mockCreateDto,
      creatorId: 'user-1',
    };

    it('应该成功创建分类', async () => {
      mockPrismaService.quickReplyCategory.create.mockResolvedValue(
        mockCategory,
      );

      const result = await service.createCategory(
        'user-1',
        false,
        mockCreateDto,
      );

      expect(result).toEqual(mockCategory);
      expect(mockPrismaService.quickReplyCategory.create).toHaveBeenCalledWith({
        data: {
          ...mockCreateDto,
          creatorId: 'user-1',
        },
      });
    });

    it('应该抛出异常 当非管理员尝试创建全局分类时', async () => {
      const globalDto = { ...mockCreateDto, isGlobal: true };

      await expect(
        service.createCategory('user-1', false, globalDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('应该允许管理员创建全局分类', async () => {
      const globalCategory = {
        ...mockCategory,
        isGlobal: true,
        creatorId: null,
      };

      mockPrismaService.quickReplyCategory.create.mockResolvedValue(
        globalCategory,
      );

      const result = await service.createCategory('admin-1', true, {
        ...mockCreateDto,
        isGlobal: true,
      });

      expect(result.isGlobal).toBe(true);
      expect(result.creatorId).toBeNull();
    });
  });

  describe('getReplies', () => {
    const mockReplies = [
      {
        id: 'reply-1',
        content: '您好，有什么可以帮助您的吗？',
        categoryId: 'cat-1',
        isGlobal: true,
        isActive: true,
        usageCount: 10,
        favoriteCount: 5,
      },
      {
        id: 'reply-2',
        content: '问题已解决，如果还有其他问题，随时联系我。',
        categoryId: 'cat-1',
        isGlobal: true,
        isActive: true,
        usageCount: 5,
        favoriteCount: 2,
      },
    ];

    beforeEach(() => {
      mockPrismaService.quickReply.count.mockResolvedValue(2);
      mockPrismaService.quickReplyFavorite.findMany.mockResolvedValue([]);
    });

    it('应该返回快捷回复列表', async () => {
      // 添加 category 字段，因为查询包含 include
      const mockRepliesWithCategory = mockReplies.map((reply) => ({
        ...reply,
        category: {
          id: 'cat-1',
          name: '问候语',
          isGlobal: true,
          isActive: true,
          sortOrder: 1,
        },
      }));
      mockPrismaService.quickReply.findMany.mockResolvedValue(
        mockRepliesWithCategory,
      );

      const result = await service.getReplies('user-1', true, {
        page: 1,
        pageSize: 20,
      });

      // 数据会被 enrich，添加 isFavorited 字段
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toHaveProperty('isFavorited', false);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.page).toBe(1);
    });

    it('应该支持分类过滤', async () => {
      mockPrismaService.quickReply.findMany.mockResolvedValue([mockReplies[0]]);

      await service.getReplies('user-1', true, {
        categoryId: 'cat-1',
        page: 1,
        pageSize: 20,
      });

      expect(mockPrismaService.quickReply.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            categoryId: 'cat-1',
          }),
        }),
      );
    });

    it('应该支持启用状态过滤', async () => {
      mockPrismaService.quickReply.findMany.mockResolvedValue(mockReplies);

      await service.getReplies('user-1', true, {
        isActive: true,
        page: 1,
        pageSize: 20,
      });

      expect(mockPrismaService.quickReply.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
          }),
        }),
      );
    });

    it('应该支持查询所有状态（isActive为null）', async () => {
      mockPrismaService.quickReply.findMany.mockResolvedValue(mockReplies);

      await service.getReplies('user-1', true, {
        isActive: null,
        page: 1,
        pageSize: 20,
      });

      const whereCall =
        mockPrismaService.quickReply.findMany.mock.calls[0][0].where;
      expect(whereCall).not.toHaveProperty('isActive');
    });

    it('应该支持收藏过滤', async () => {
      // 当有收藏时，会调用 findMany
      const favoriteIds = ['reply-1'];
      mockPrismaService.quickReplyFavorite.findMany.mockResolvedValue([
        { replyId: 'reply-1' },
      ]);
      const mockReplyWithCategory = {
        ...mockReplies[0],
        category: {
          id: 'cat-1',
          name: '问候语',
          isGlobal: true,
          isActive: true,
          sortOrder: 1,
        },
      };
      mockPrismaService.quickReply.findMany.mockResolvedValue([
        mockReplyWithCategory,
      ]);
      mockPrismaService.quickReply.count.mockResolvedValue(1);

      const result = await service.getReplies('user-1', true, {
        onlyFavorites: true,
        page: 1,
        pageSize: 20,
      });

      expect(mockPrismaService.quickReply.findMany).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('reply-1');
    });

    it('应该支持搜索', async () => {
      mockPrismaService.quickReply.findMany.mockResolvedValue([mockReplies[0]]);
      mockPrismaService.quickReply.count.mockResolvedValue(1);

      const result = await service.getReplies('user-1', true, {
        search: '您好',
        page: 1,
        pageSize: 20,
      });

      expect(mockPrismaService.quickReply.findMany).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });
  });

  describe('createReply', () => {
    const mockCreateDto = {
      categoryId: 'cat-1',
      content: '新的快捷回复',
      isGlobal: false,
    };

    const mockCategory = {
      id: 'cat-1',
      name: '问候语',
      isGlobal: true,
      creatorId: null,
    };

    const mockReply = {
      id: 'reply-1',
      ...mockCreateDto,
      creatorId: 'user-1',
      isActive: true,
      usageCount: 0,
      favoriteCount: 0,
    };

    beforeEach(() => {
      // createReply 使用 findUniqueOrThrow
      mockPrismaService.quickReplyCategory.findUniqueOrThrow.mockResolvedValue(
        mockCategory,
      );
    });

    it('应该成功创建快捷回复', async () => {
      mockPrismaService.quickReply.create.mockResolvedValue(mockReply);

      const result = await service.createReply('user-1', false, mockCreateDto);

      expect(result).toEqual(mockReply);
      expect(mockPrismaService.quickReply.create).toHaveBeenCalled();
    });

    it('应该抛出异常 当分类不存在时', async () => {
      // findUniqueOrThrow 在找不到时会抛出异常
      mockPrismaService.quickReplyCategory.findUniqueOrThrow.mockRejectedValue(
        new NotFoundException('分类不存在'),
      );

      await expect(
        service.createReply('user-1', false, mockCreateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('应该抛出异常 当非管理员尝试创建全局回复时', async () => {
      const globalDto = { ...mockCreateDto, isGlobal: true };
      // 确保分类存在
      mockPrismaService.quickReplyCategory.findUniqueOrThrow.mockResolvedValue(
        mockCategory,
      );

      await expect(
        service.createReply('user-1', false, globalDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateReply', () => {
    const mockUpdateDto = {
      content: '更新后的内容',
    };

    const mockReply = {
      id: 'reply-1',
      content: '原始内容',
      categoryId: 'cat-1',
      creatorId: 'user-1',
      isGlobal: false,
    };

    const mockUpdatedReply = {
      ...mockReply,
      ...mockUpdateDto,
    };

    beforeEach(() => {
      mockPrismaService.quickReply.findUniqueOrThrow.mockResolvedValue(
        mockReply,
      );
    });

    it('应该成功更新快捷回复', async () => {
      mockPrismaService.quickReply.update.mockResolvedValue(mockUpdatedReply);

      const result = await service.updateReply(
        'reply-1',
        'user-1',
        false,
        mockUpdateDto,
      );

      expect(result).toEqual(mockUpdatedReply);
      expect(mockPrismaService.quickReply.update).toHaveBeenCalled();
    });

    it('应该抛出异常 当回复不存在时', async () => {
      mockPrismaService.quickReply.findUniqueOrThrow.mockRejectedValue(
        new NotFoundException('回复不存在'),
      );

      await expect(
        service.updateReply('nonexistent', 'user-1', false, mockUpdateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('应该抛出异常 当用户没有权限更新时', async () => {
      const otherUserReply = {
        ...mockReply,
        creatorId: 'other-user',
        isGlobal: false,
      };

      mockPrismaService.quickReply.findUniqueOrThrow.mockResolvedValue(
        otherUserReply,
      );

      await expect(
        service.updateReply('reply-1', 'user-1', false, mockUpdateDto),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('toggleFavorite', () => {
    const mockReply = {
      id: 'reply-1',
      content: '测试回复',
    };

    beforeEach(() => {
      mockPrismaService.quickReply.findUniqueOrThrow.mockResolvedValue(
        mockReply,
      );
    });

    it('应该添加收藏', async () => {
      const mockFavorite = {
        id: 'favorite-1',
        userId: 'user-1',
        replyId: 'reply-1',
      };
      mockPrismaService.quickReplyFavorite.findUnique.mockResolvedValue(null);
      mockPrismaService.quickReplyFavorite.create.mockResolvedValue(
        mockFavorite,
      );
      mockPrismaService.quickReply.update.mockResolvedValue({
        ...mockReply,
        favoriteCount: 1,
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          quickReplyFavorite: {
            findUnique: mockPrismaService.quickReplyFavorite.findUnique,
            create: mockPrismaService.quickReplyFavorite.create,
            delete: mockPrismaService.quickReplyFavorite.delete,
          },
          quickReply: {
            update: mockPrismaService.quickReply.update,
          },
        };
        return await callback(tx);
      });

      await service.toggleFavorite('reply-1', 'user-1');

      expect(mockPrismaService.quickReplyFavorite.create).toHaveBeenCalled();
    });

    it('应该取消收藏', async () => {
      const mockFavorite = {
        id: 'favorite-1',
        userId: 'user-1',
        replyId: 'reply-1',
      };
      mockPrismaService.quickReplyFavorite.findUnique.mockResolvedValue(
        mockFavorite,
      );
      mockPrismaService.quickReplyFavorite.delete.mockResolvedValue(
        mockFavorite,
      );
      mockPrismaService.quickReply.update.mockResolvedValue({
        ...mockReply,
        favoriteCount: 0,
      });
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const tx = {
          quickReplyFavorite: {
            findUnique: mockPrismaService.quickReplyFavorite.findUnique,
            create: mockPrismaService.quickReplyFavorite.create,
            delete: mockPrismaService.quickReplyFavorite.delete,
          },
          quickReply: {
            update: mockPrismaService.quickReply.update,
          },
        };
        return await callback(tx);
      });

      await service.toggleFavorite('reply-1', 'user-1');

      expect(mockPrismaService.quickReplyFavorite.delete).toHaveBeenCalled();
    });
  });
});
