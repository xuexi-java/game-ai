import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { UpdateReplyDto } from './dto/update-reply.dto';
import { QueryReplyDto, SortByEnum } from './dto/query-reply.dto';

@Injectable()
export class QuickReplyService {
  constructor(private prisma: PrismaService) {}

  // ========== 分类管理 ==========

  /**
   * 获取分类列表
   */
  async getCategories(userId: string, isAdmin: boolean) {
    try {
      const where: any = {
        isActive: true,
        deletedAt: null,
      };

      if (!isAdmin) {
        // 普通用户只能看到全局分类和自己的分类
        where.OR = [{ isGlobal: true }, { creatorId: userId }];
      }
      // 管理员可以看到全部分类（不限制条件）

      const categories = await this.prisma.quickReplyCategory.findMany({
        where,
        orderBy: { sortOrder: 'asc' },
      });

      // 如果分类为空，直接返回空数组
      if (categories.length === 0) {
        return [];
      }

      // 批量查询所有分类的回复数量，提高性能
      const categoryIds = categories.map((cat) => cat.id);
      const replyCounts = await this.prisma.quickReply.groupBy({
        by: ['categoryId'],
        where: {
          categoryId: { in: categoryIds },
          isActive: true,
          deletedAt: null,
        },
        _count: {
          id: true,
        },
      });

      // 创建回复数量的映射
      const countMap = new Map(
        replyCounts.map((item) => [item.categoryId, item._count.id]),
      );

      // 为每个分类添加回复数量
      return categories.map((category) => ({
        ...category,
        _count: {
          replies: countMap.get(category.id) || 0,
        },
      }));
    } catch (error) {
      console.error('获取分类列表失败:', error);
      throw error;
    }
  }

  /**
   * 创建分类
   */
  async createCategory(
    userId: string,
    isAdmin: boolean,
    createCategoryDto: CreateCategoryDto,
  ) {
    // ⭐ 权限检查：只有管理员能创建全局分类
    if (createCategoryDto.isGlobal && !isAdmin) {
      throw new ForbiddenException('仅管理员可创建全局分类');
    }

    return this.prisma.quickReplyCategory.create({
      data: {
        ...createCategoryDto,
        creatorId: createCategoryDto.isGlobal ? null : userId,
      },
    });
  }

  /**
   * 更新分类
   */
  async updateCategory(
    categoryId: string,
    userId: string,
    isAdmin: boolean,
    updateCategoryDto: UpdateCategoryDto,
  ) {
    const category = await this.prisma.quickReplyCategory.findUniqueOrThrow({
      where: { id: categoryId },
    });

    // ⭐ 权限检查
    this.validateCategoryAccess(category, userId, isAdmin);

    // ⭐ 禁止非管理员修改全局标记
    if (
      updateCategoryDto.isGlobal !== undefined &&
      !isAdmin &&
      updateCategoryDto.isGlobal
    ) {
      throw new ForbiddenException('仅管理员可修改全局标记');
    }

    return this.prisma.quickReplyCategory.update({
      where: { id: categoryId },
      data: updateCategoryDto,
    });
  }

  /**
   * 删除分类（软删除）
   */
  async deleteCategory(categoryId: string, userId: string, isAdmin: boolean) {
    const category = await this.prisma.quickReplyCategory.findUniqueOrThrow({
      where: { id: categoryId },
    });

    // ⭐ 权限检查
    this.validateCategoryAccess(category, userId, isAdmin);

    return this.prisma.quickReplyCategory.update({
      where: { id: categoryId },
      data: { deletedAt: new Date() },
    });
  }

  // ========== 快捷回复管理 ==========

  /**
   * 获取快捷回复列表
   */
  async getReplies(userId: string, isAdmin: boolean, query: QueryReplyDto) {
    try {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 20;
      const skip = (page - 1) * pageSize;

      // 构建 WHERE 条件
      const where: any = {
        deletedAt: null,
      };

      // 启用状态筛选：
      // - 如果明确指定了 isActive (true/false)，使用指定值
      // - 如果 isActive 为 null，查询所有状态的回复（全部）
      // - 如果 isActive 为 undefined，默认只查询启用的回复（保持向后兼容，用于其他地方的调用）
      if (query.isActive === null) {
        // 用户选择"全部"，不添加 isActive 条件，查询所有状态的回复
        // 不设置 where.isActive，查询所有
      } else if (query.isActive !== undefined) {
        // 明确指定了 true 或 false
        where.isActive = query.isActive;
      } else {
        // undefined 表示默认行为（保持向后兼容），只查询启用的
        where.isActive = true;
      }

      if (query.categoryId) {
        where.categoryId = query.categoryId;
      }

      // 权限过滤：用户只能看到全局回复和自己创建的回复
      if (!isAdmin) {
        where.OR = [{ isGlobal: true }, { creatorId: userId }];
      }

      // 只看收藏的回复
      if (query.onlyFavorites) {
        const favoriteIds = await this.prisma.quickReplyFavorite
          .findMany({
            where: { userId },
            select: { replyId: true },
          })
          .then((fav) => fav.map((f) => f.replyId));

        if (favoriteIds.length === 0) {
          // 如果没有收藏，直接返回空结果
          return {
            data: [],
            pagination: {
              total: 0,
              page,
              pageSize,
              totalPages: 0,
            },
          };
        }

        where.id = { in: favoriteIds };
      }

      // 只看最近使用的回复
      if (query.onlyRecent) {
        where.lastUsedAt = { not: null };
      }

      // 构建排序条件
      let orderBy = this.buildOrderBy(query.sortBy);

      // 查询数据和总数
      let data, total, favoriteIdsSet;
      try {
        [data, total, favoriteIdsSet] = await Promise.all([
          this.prisma.quickReply.findMany({
            where,
            orderBy,
            skip,
            take: pageSize,
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  isGlobal: true,
                  isActive: true,
                  sortOrder: true,
                },
              },
            },
          }),
          this.prisma.quickReply.count({ where }),
          // 获取当前用户收藏的所有回复 ID
          this.prisma.quickReplyFavorite
            .findMany({
              where: { userId },
              select: { replyId: true },
            })
            .then((favs) => new Set(favs.map((f) => f.replyId))),
        ]);
      } catch (dbError: any) {
        console.error('数据库查询错误:', dbError);
        console.error('错误类型:', dbError.constructor?.name);
        console.error('错误代码:', dbError.code);
        console.error('错误消息:', dbError.message);
        console.error('错误堆栈:', dbError.stack);

        // 如果是排序问题，尝试使用默认排序
        if (
          dbError.code === 'P2009' ||
          dbError.message?.includes('orderBy') ||
          dbError.message?.includes('sort')
        ) {
          console.log('检测到排序错误，尝试使用默认排序...');
          orderBy = { createdAt: 'desc' };
          [data, total, favoriteIdsSet] = await Promise.all([
            this.prisma.quickReply.findMany({
              where,
              orderBy,
              skip,
              take: pageSize,
              include: {
                category: {
                  select: {
                    id: true,
                    name: true,
                    isGlobal: true,
                    isActive: true,
                    sortOrder: true,
                  },
                },
              },
            }),
            this.prisma.quickReply.count({ where }),
            this.prisma.quickReplyFavorite
              .findMany({
                where: { userId },
                select: { replyId: true },
              })
              .then((favs) => new Set(favs.map((f) => f.replyId))),
          ]);
        } else {
          throw dbError;
        }
      }

      // 如果按 lastUsedAt 排序，对结果进行二次排序（将 null 值排在最后）
      let sortedData = data;
      if (
        query.sortBy === 'lastUsedAt' ||
        query.sortBy === SortByEnum.LAST_USED_AT
      ) {
        sortedData = [...data].sort((a, b) => {
          // 如果两个都是 null，按 createdAt 排序
          if (!a.lastUsedAt && !b.lastUsedAt) {
            return (
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
          }
          // 如果 a 是 null，排在后面
          if (!a.lastUsedAt) return 1;
          // 如果 b 是 null，排在后面
          if (!b.lastUsedAt) return -1;
          // 两个都不是 null，按 lastUsedAt 排序
          return (
            new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime()
          );
        });
      }

      // 后端去重：根据 id 和内容双重去重，确保不会返回重复数据
      const uniqueRepliesById = new Map();
      sortedData.forEach((reply) => {
        if (!uniqueRepliesById.has(reply.id)) {
          uniqueRepliesById.set(reply.id, reply);
        }
      });
      let deduplicatedData = Array.from(uniqueRepliesById.values());

      // 根据内容去重（防止数据库中有相同内容但不同 id 的重复数据）
      const uniqueRepliesByContent = new Map();
      deduplicatedData.forEach((reply) => {
        const contentKey = (reply.content || '').trim();
        if (!uniqueRepliesByContent.has(contentKey)) {
          uniqueRepliesByContent.set(contentKey, reply);
        } else {
          // 保留使用次数更高的，如果使用次数相同，保留 id 更小的（更早创建的）
          const existing = uniqueRepliesByContent.get(contentKey);
          if (reply.usageCount > existing.usageCount) {
            uniqueRepliesByContent.set(contentKey, reply);
          } else if (
            reply.usageCount === existing.usageCount &&
            reply.id < existing.id
          ) {
            uniqueRepliesByContent.set(contentKey, reply);
          }
        }
      });
      deduplicatedData = Array.from(uniqueRepliesByContent.values());

      // ✅ 获取用户个人偏好（添加错误处理，避免表不存在时导致 500 错误）
      let userPreferences: any[] = [];
      let preferenceMap = new Map<
        string,
        { replyId: string; isActive: boolean | null; content: string | null }
      >();
      
      try {
        userPreferences = await (this.prisma as any).quickReplyUserPreference.findMany({
          where: { userId },
          select: {
            replyId: true,
            isActive: true,
            content: true,
          },
        });
        
        preferenceMap = new Map(
          userPreferences.map((pref: any) => [pref.replyId, pref])
        );
      } catch (error) {
        // ✅ 如果查询个人偏好失败（表不存在等），记录警告但不影响主流程
        console.warn('查询用户个人偏好失败，使用全局设置:', error);
        // preferenceMap 保持为空 Map，所有回复使用全局设置
      }

      return {
        data: deduplicatedData.map((reply) => {
          const preference = preferenceMap.get(reply.id);

          // ✅ 合并个人偏好：如果用户有个人偏好，使用个人偏好；否则使用全局状态
          return {
            ...reply,
            isFavorited: favoriteIdsSet.has(reply.id),
            // 个人启用状态：如果有个人偏好，使用个人偏好；否则使用全局 isActive
            isActive: preference?.isActive !== null && preference?.isActive !== undefined
              ? preference.isActive
              : reply.isActive,
            // 个人内容：如果有个人修改的内容，使用个人内容；否则使用全局内容
            content: preference?.content || reply.content,
            // 标记是否有个人偏好
            hasPersonalPreference: !!preference,
          };
        }),
        pagination: {
          total: deduplicatedData.length, // 使用去重后的数量
          page,
          pageSize,
          totalPages: Math.ceil(deduplicatedData.length / pageSize),
        },
      };
    } catch (error) {
      console.error('获取快捷回复列表失败:', error);
      console.error('错误详情:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw error;
    }
  }

  /**
   * 创建快捷回复
   */
  async createReply(
    userId: string,
    isAdmin: boolean,
    createReplyDto: CreateReplyDto,
  ) {
    // 验证分类存在且有访问权限
    const category = await this.prisma.quickReplyCategory.findUniqueOrThrow({
      where: { id: createReplyDto.categoryId },
    });

    // ⭐ 检查分类访问权限
    if (!category.isGlobal && category.creatorId !== userId && !isAdmin) {
      throw new ForbiddenException('无权在此分类中添加回复');
    }

    // ⭐ 权限检查：只有管理员能创建全局回复
    if (createReplyDto.isGlobal && !isAdmin) {
      throw new ForbiddenException('仅管理员可创建全局回复');
    }

    return this.prisma.quickReply.create({
      data: {
        ...createReplyDto,
        creatorId: createReplyDto.isGlobal ? null : userId,
      },
      include: { category: true },
    });
  }

  /**
   * 更新快捷回复
   */
  async updateReply(
    replyId: string,
    userId: string,
    isAdmin: boolean,
    updateReplyDto: UpdateReplyDto,
  ) {
    const reply = await this.prisma.quickReply.findUniqueOrThrow({
      where: { id: replyId },
    });

    // ⭐ 权限检查：管理员可以修改所有回复，非管理员只能修改自己创建的回复
    // 但是，非管理员可以为任何回复设置个人偏好（只影响自己）
    if (!isAdmin && reply.creatorId !== userId) {
      // ✅ 如果不是管理员且不是创建者，但只是想设置个人偏好，允许
      // 检查是否只是设置个人偏好（只更新 isActive 或 content，且不更新其他字段）
      const isPersonalPreference = 
        (updateReplyDto.isActive !== undefined && Object.keys(updateReplyDto).length === 1) ||
        (updateReplyDto.content !== undefined && 
         (Object.keys(updateReplyDto).length === 1 || 
          (Object.keys(updateReplyDto).length === 2 && 'isActive' in updateReplyDto && 'content' in updateReplyDto))) ||
        (updateReplyDto.isActive !== undefined && updateReplyDto.content !== undefined && 
         Object.keys(updateReplyDto).length === 2 && !('isGlobal' in updateReplyDto) && !('categoryId' in updateReplyDto));
      
      if (isPersonalPreference) {
        // ✅ 允许设置个人偏好
        return this.updateUserPreference(replyId, userId, {
          isActive: updateReplyDto.isActive,
          content: updateReplyDto.content,
        });
      }
      
      throw new ForbiddenException('无权修改此回复');
    }

    // ⭐ 权限检查：非管理员不能修改全局标记
    if (
      updateReplyDto.isGlobal !== undefined &&
      !isAdmin &&
      updateReplyDto.isGlobal
    ) {
      throw new ForbiddenException('仅管理员可修改全局标记');
    }

    // ✅ 管理员或创建者：更新全局回复
    return this.prisma.quickReply.update({
      where: { id: replyId },
      data: updateReplyDto,
      include: { category: true },
    });
  }

  /**
   * 更新用户个人偏好
   */
  async updateUserPreference(
    replyId: string,
    userId: string,
    updateData: { isActive?: boolean; content?: string },
  ) {
    // 检查回复是否存在
    await this.prisma.quickReply.findUniqueOrThrow({
      where: { id: replyId },
    });

    // 使用 upsert 创建或更新个人偏好
    return (this.prisma as any).quickReplyUserPreference.upsert({
      where: {
        userId_replyId: {
          userId,
          replyId,
        },
      },
      create: {
        userId,
        replyId,
        isActive: updateData.isActive,
        content: updateData.content,
      },
      update: {
        isActive: updateData.isActive !== undefined ? updateData.isActive : undefined,
        content: updateData.content !== undefined ? updateData.content : undefined,
        updatedAt: new Date(),
      },
    });
  }

  /**
   * 删除用户个人偏好（恢复为全局状态）
   */
  async deleteUserPreference(replyId: string, userId: string) {
    return (this.prisma as any).quickReplyUserPreference.deleteMany({
      where: {
        userId,
        replyId,
      },
    });
  }

  /**
   * 删除快捷回复（软删除）
   */
  async deleteReply(replyId: string, userId: string, isAdmin: boolean) {
    const reply = await this.prisma.quickReply.findUniqueOrThrow({
      where: { id: replyId },
    });

    // ⭐ 权限检查
    if (!isAdmin && reply.creatorId !== userId) {
      throw new ForbiddenException('无权删除此回复');
    }

    return this.prisma.quickReply.update({
      where: { id: replyId },
      data: { deletedAt: new Date() },
    });
  }

  // ========== 收藏管理 ==========

  /**
   * 切换收藏状态
   */
  async toggleFavorite(replyId: string, userId: string): Promise<void> {
    // ⭐ 验证回复存在
    await this.prisma.quickReply.findUniqueOrThrow({
      where: { id: replyId },
    });

    // ⭐ 使用事务保证原子性
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.quickReplyFavorite.findUnique({
        where: {
          userId_replyId: { userId, replyId },
        },
      });

      if (existing) {
        // 取消收藏
        await tx.quickReplyFavorite.delete({
          where: { id: existing.id },
        });
        await tx.quickReply.update({
          where: { id: replyId },
          data: { favoriteCount: { decrement: 1 } },
        });
      } else {
        // 添加收藏
        await tx.quickReplyFavorite.create({
          data: { userId, replyId },
        });
        await tx.quickReply.update({
          where: { id: replyId },
          data: { favoriteCount: { increment: 1 } },
        });
      }
    });
  }

  /**
   * 获取用户收藏列表
   */
  async getUserFavorites(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.quickReplyFavorite.findMany({
        where: {
          userId,
          reply: {
            isActive: true, // 只返回启用的回复
            deletedAt: null,
          },
        },
        include: {
          reply: {
            include: { category: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.quickReplyFavorite.count({
        where: {
          userId,
          reply: {
            isActive: true, // 只统计启用的回复
            deletedAt: null,
          },
        },
      }),
    ]);

    return {
      data: data.map((fav) => ({
        ...fav.reply,
        isFavorited: true, // 收藏列表中的都是已收藏的
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ========== 使用统计 ==========

  /**
   * 增加使用次数
   */
  async incrementUsage(replyId: string): Promise<void> {
    await this.prisma.quickReply.update({
      where: { id: replyId },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    });
  }

  // ========== 辅助方法 ==========

  /**
   * 验证分类访问权限
   */
  private validateCategoryAccess(
    category: any,
    userId: string,
    isAdmin: boolean,
  ): void {
    if (!category.isGlobal && category.creatorId !== userId && !isAdmin) {
      throw new ForbiddenException('无权访问此分类');
    }
  }

  /**
   * 构建排序条件
   */
  private buildOrderBy(sortBy?: SortByEnum | string): any {
    const sortValue = sortBy || SortByEnum.USAGE_COUNT;
    switch (sortValue) {
      case SortByEnum.USAGE_COUNT:
      case 'usageCount':
        return { usageCount: 'desc' };
      case SortByEnum.FAVORITE_COUNT:
      case 'favoriteCount':
        return { favoriteCount: 'desc' };
      case SortByEnum.LAST_USED_AT:
      case 'lastUsedAt':
        // 对于 lastUsedAt，只按 lastUsedAt 排序
        // 在 PostgreSQL 中，null 值在降序排序时会自动排在最后
        // 如果遇到问题，可以在应用层进行二次排序
        return { lastUsedAt: 'desc' };
      default:
        return { usageCount: 'desc' };
    }
  }
}
