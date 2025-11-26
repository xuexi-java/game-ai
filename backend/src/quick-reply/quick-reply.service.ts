import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuickReplyGroupDto } from './dto/create-quick-reply-group.dto';
import { UpdateQuickReplyGroupDto } from './dto/update-quick-reply-group.dto';
import { CreateQuickReplyItemDto } from './dto/create-quick-reply-item.dto';
import { UpdateQuickReplyItemDto } from './dto/update-quick-reply-item.dto';

@Injectable()
export class QuickReplyService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取指定游戏的快捷回复（按分组聚合）
   * 返回 gameId 匹配的或 gameId 为 null（通用）的分组
   */
  async findAllByGame(gameId?: string) {
    const where: any = {
      enabled: true,
      deletedAt: null,
    };

    // 如果指定了游戏ID，查询该游戏专用的或通用的（gameId = null）
    if (gameId) {
      where.OR = [
        { gameId },
        { gameId: null }, // 通用回复
      ];
    } else {
      // 如果没有指定游戏ID，只返回通用的
      where.gameId = null;
    }

    const groups = await this.prisma.quickReplyGroup.findMany({
      where,
      include: {
        items: {
          where: {
            deletedAt: null,
          },
          orderBy: [
            { sortOrder: 'asc' },
            { usageCount: 'desc' }, // 使用次数多的排在前面
            { createdAt: 'asc' },
          ],
        },
        game: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return groups;
  }

  /**
   * 根据快捷键搜索快捷回复
   */
  async findByShortcut(shortcut: string, gameId?: string) {
    const where: any = {
      shortcut: {
        equals: shortcut,
        mode: 'insensitive', // 不区分大小写
      },
      deletedAt: null,
      group: {
        enabled: true,
        deletedAt: null,
      },
    };

    // 如果指定了游戏ID，只搜索该游戏专用的或通用的
    if (gameId) {
      where.group.OR = [
        { gameId },
        { gameId: null },
      ];
    } else {
      where.group.gameId = null;
    }

    const item = await this.prisma.quickReplyItem.findFirst({
      where,
      include: {
        group: {
          include: {
            game: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    return item;
  }

  /**
   * 搜索快捷回复（支持内容模糊搜索）
   */
  async search(query: string, gameId?: string) {
    const where: any = {
      OR: [
        { content: { contains: query, mode: 'insensitive' } },
        { shortcut: { contains: query, mode: 'insensitive' } },
      ],
      deletedAt: null,
      group: {
        enabled: true,
        deletedAt: null,
      },
    };

    if (gameId) {
      where.group.OR = [
        { gameId },
        { gameId: null },
      ];
    } else {
      where.group.gameId = null;
    }

    const items = await this.prisma.quickReplyItem.findMany({
      where,
      include: {
        group: {
          include: {
            game: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { usageCount: 'desc' },
        { createdAt: 'asc' },
      ],
      take: 20, // 限制返回数量
    });

    return items;
  }

  /**
   * 增加使用次数
   */
  async incrementUsage(id: number) {
    await this.prisma.quickReplyItem.update({
      where: { id },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });
  }

  // ==================== 分组管理 ====================

  /**
   * 创建分组
   */
  async createGroup(createDto: CreateQuickReplyGroupDto) {
    try {
      // 如果指定了游戏ID，验证游戏是否存在
      if (createDto.gameId) {
        const game = await this.prisma.game.findFirst({
          where: {
            id: createDto.gameId,
            deletedAt: null,
          },
        });

        if (!game) {
          throw new NotFoundException('游戏不存在');
        }
      }

      return await this.prisma.quickReplyGroup.create({
      data: {
        name: createDto.name,
        sortOrder: createDto.sortOrder ?? 0,
        gameId: createDto.gameId || null,
        enabled: createDto.enabled ?? true,
      },
      include: {
        game: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    } catch (error: any) {
      console.error('createGroup 错误:', error);
      // 如果是 Prisma 错误，提供更友好的错误信息
      if (error.code === 'P2002') {
        throw new Error('分组名称已存在');
      }
      if (error.code === 'P2003') {
        throw new Error('关联的游戏不存在');
      }
      if (error.code === 'P2025' || error.message?.includes('does not exist')) {
        throw new Error('数据库表不存在，请运行数据库迁移: npx prisma migrate deploy');
      }
      throw error;
    }
  }

  /**
   * 获取所有分组
   */
  async findAllGroups(gameId?: string) {
    try {
      const where: any = {
        deletedAt: null,
      };

      if (gameId) {
        where.OR = [
          { gameId },
          { gameId: null },
        ];
      }

      const groups = await this.prisma.quickReplyGroup.findMany({
        where,
        include: {
          game: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            where: {
              deletedAt: null,
            },
            orderBy: [
              { sortOrder: 'asc' },
              { usageCount: 'desc' },
              { createdAt: 'asc' },
            ],
          },
          _count: {
            select: {
              items: {
                where: {
                  deletedAt: null,
                },
              },
            },
          },
        },
        orderBy: [
          { sortOrder: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      return groups;
    } catch (error: any) {
      console.error('findAllGroups 错误:', error);
      console.error('错误详情:', {
        code: error.code,
        message: error.message,
        meta: error.meta,
      });
      
      // 如果是 Prisma 错误，提供更友好的错误信息
      if (error.code === 'P2025' || 
          error.message?.includes('does not exist') || 
          error.message?.includes('Unknown table') ||
          error.message?.includes('Table') && error.message?.includes('doesn\'t exist')) {
        throw new Error('数据库表不存在，请运行数据库迁移: npx prisma migrate deploy');
      }
      
      // Prisma 连接错误
      if (error.code === 'P1001' || error.message?.includes('Can\'t reach database')) {
        throw new Error('无法连接到数据库，请检查数据库服务是否运行');
      }
      
      // 其他 Prisma 错误
      if (error.code?.startsWith('P')) {
        throw new Error(`数据库查询失败: ${error.message || '未知错误'}`);
      }
      
      throw error;
    }
  }

  /**
   * 获取单个分组
   */
  async findGroupById(id: number) {
    const group = await this.prisma.quickReplyGroup.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        game: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          where: {
            deletedAt: null,
          },
          orderBy: [
            { sortOrder: 'asc' },
            { usageCount: 'desc' },
          ],
        },
      },
    });

    if (!group) {
      throw new NotFoundException('分组不存在');
    }

    return group;
  }

  /**
   * 更新分组
   */
  async updateGroup(id: number, updateDto: UpdateQuickReplyGroupDto) {
    await this.findGroupById(id); // 检查是否存在

    if (updateDto.gameId) {
      const game = await this.prisma.game.findFirst({
        where: {
          id: updateDto.gameId,
          deletedAt: null,
        },
      });

      if (!game) {
        throw new NotFoundException('游戏不存在');
      }
    }

    return this.prisma.quickReplyGroup.update({
      where: { id },
      data: updateDto,
      include: {
        game: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * 删除分组（软删除）
   */
  async removeGroup(id: number) {
    await this.findGroupById(id);

    return this.prisma.quickReplyGroup.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ==================== 回复项管理 ====================

  /**
   * 创建回复项
   */
  async createItem(createDto: CreateQuickReplyItemDto) {
    // 验证分组是否存在
    const group = await this.prisma.quickReplyGroup.findFirst({
      where: {
        id: createDto.groupId,
        deletedAt: null,
      },
    });

    if (!group) {
      throw new NotFoundException('分组不存在');
    }

    // 如果指定了快捷键，检查是否在同一分组内重复
    if (createDto.shortcut) {
      const existing = await this.prisma.quickReplyItem.findFirst({
        where: {
          groupId: createDto.groupId,
          shortcut: createDto.shortcut,
          deletedAt: null,
        },
      });

      if (existing) {
        throw new Error('该分组内已存在相同的快捷键');
      }
    }

    return this.prisma.quickReplyItem.create({
      data: {
        content: createDto.content,
        groupId: createDto.groupId,
        shortcut: createDto.shortcut || null,
        sortOrder: createDto.sortOrder ?? 0,
      },
      include: {
        group: {
          include: {
            game: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 获取单个回复项
   */
  async findItemById(id: number) {
    const item = await this.prisma.quickReplyItem.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        group: {
          include: {
            game: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('回复项不存在');
    }

    return item;
  }

  /**
   * 更新回复项
   */
  async updateItem(id: number, updateDto: UpdateQuickReplyItemDto) {
    const item = await this.findItemById(id);

    // 如果更新了分组，验证新分组是否存在
    if (updateDto.groupId && updateDto.groupId !== item.groupId) {
      const group = await this.prisma.quickReplyGroup.findFirst({
        where: {
          id: updateDto.groupId,
          deletedAt: null,
        },
      });

      if (!group) {
        throw new NotFoundException('分组不存在');
      }
    }

    // 如果更新了快捷键，检查是否重复
    if (updateDto.shortcut && updateDto.shortcut !== item.shortcut) {
      const existing = await this.prisma.quickReplyItem.findFirst({
        where: {
          groupId: updateDto.groupId || item.groupId,
          shortcut: updateDto.shortcut,
          id: { not: id },
          deletedAt: null,
        },
      });

      if (existing) {
        throw new Error('该分组内已存在相同的快捷键');
      }
    }

    return this.prisma.quickReplyItem.update({
      where: { id },
      data: updateDto,
      include: {
        group: {
          include: {
            game: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 删除回复项（软删除）
   */
  async removeItem(id: number) {
    await this.findItemById(id);

    return this.prisma.quickReplyItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * 初始化系统默认快捷回复
   */
  async initSystemDefaultReplies() {
    // 检查是否已有系统默认分组
    const existingGroup = await this.prisma.quickReplyGroup.findFirst({
      where: { name: '问候', gameId: null, deletedAt: null },
    });

    if (existingGroup) {
      return; // 如果已有，不重复创建
    }

    const defaultGroups = [
      { name: '问候', sortOrder: 10, gameId: null, enabled: true },
      { name: '问题处理', sortOrder: 20, gameId: null, enabled: true },
      { name: '结束语', sortOrder: 30, gameId: null, enabled: true },
      { name: '常见问题', sortOrder: 40, gameId: null, enabled: true },
      { name: '沟通', sortOrder: 50, gameId: null, enabled: true },
    ];

    const createdGroups: Array<{ id: number; name: string }> = [];
    for (const groupData of defaultGroups) {
      const group = await this.prisma.quickReplyGroup.create({ data: groupData });
      createdGroups.push({ id: group.id, name: group.name });
    }

    const findGroup = (name: string) => createdGroups.find(g => g.name === name);

    const defaultItems = [
      { content: '您好，请问有什么可以帮助您的吗？', shortcut: '/hi', sortOrder: 1, groupName: '问候' },
      { content: '好的，我明白了，让我为您处理一下。', shortcut: '/ok', sortOrder: 1, groupName: '问题处理' },
      { content: '为了更好地帮助您，请提供一下您的游戏ID、区服和具体问题描述。', shortcut: '/info', sortOrder: 2, groupName: '问题处理' },
      { content: '正在为您处理中，请稍候...', shortcut: '/wait', sortOrder: 3, groupName: '问题处理' },
      { content: '问题已解决，如果还有其他问题，随时联系我。', shortcut: '/done', sortOrder: 1, groupName: '结束语' },
      { content: '感谢您的反馈，祝您游戏愉快！', shortcut: '/thanks', sortOrder: 2, groupName: '结束语' },
      { content: '关于充值问题，我来帮您查询一下。请提供您的订单号或充值时间。', shortcut: '/recharge', sortOrder: 1, groupName: '常见问题' },
      { content: '关于账号问题，为了您的账号安全，请提供您的注册信息进行验证。', shortcut: '/account', sortOrder: 2, groupName: '常见问题' },
      { content: '关于游戏bug，我会记录并反馈给技术团队。请详细描述一下问题出现的场景。', shortcut: '/bug', sortOrder: 3, groupName: '常见问题' },
      { content: '请稍等，我正在为您查询相关信息。', shortcut: '/hold', sortOrder: 1, groupName: '沟通' },
      { content: '非常抱歉给您带来不便，我会尽快为您处理。', shortcut: '/sorry', sortOrder: 2, groupName: '沟通' },
      { content: '您的问题我已经记录，稍后会有专人联系您，请保持通讯畅通。', shortcut: '/followup', sortOrder: 3, groupName: '沟通' },
    ];

    for (const itemData of defaultItems) {
      const group = findGroup(itemData.groupName);
      if (group) {
        await this.prisma.quickReplyItem.create({
          data: {
            content: itemData.content,
            shortcut: itemData.shortcut,
            sortOrder: itemData.sortOrder,
            groupId: group.id,
          },
        });
      }
    }
  }
}
