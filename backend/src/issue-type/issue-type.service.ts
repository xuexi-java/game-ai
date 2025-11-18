import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateIssueTypeDto } from './dto/create-issue-type.dto';
import { UpdateIssueTypeDto } from './dto/update-issue-type.dto';

@Injectable()
export class IssueTypeService {
  constructor(private prisma: PrismaService) {}

  // 获取启用的问题类型（玩家端）
  async findEnabled() {
    return this.prisma.issueType.findMany({
      where: {
        enabled: true,
        deletedAt: null,
      },
      orderBy: {
        sortOrder: 'asc',
      },
      select: {
        id: true,
        name: true,
        description: true,
        priorityWeight: true,
        icon: true,
        sortOrder: true,
      },
    });
  }

  // 获取所有问题类型（管理端）
  async findAll() {
    return this.prisma.issueType.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    });
  }

  // 根据 ID 获取问题类型
  async findOne(id: string) {
    const issueType = await this.prisma.issueType.findUnique({
      where: { id },
    });
    if (!issueType || issueType.deletedAt) {
      throw new NotFoundException('问题类型不存在');
    }
    return issueType;
  }

  // 创建问题类型
  async create(createDto: CreateIssueTypeDto) {
    return this.prisma.issueType.create({
      data: createDto,
    });
  }

  // 更新问题类型
  async update(id: string, updateDto: UpdateIssueTypeDto) {
    await this.findOne(id); // 验证存在
    return this.prisma.issueType.update({
      where: { id },
      data: updateDto,
    });
  }

  // 切换启用状态
  async toggle(id: string) {
    const issueType = await this.findOne(id);
    return this.prisma.issueType.update({
      where: { id },
      data: { enabled: !issueType.enabled },
    });
  }

  // 软删除
  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.issueType.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // 批量获取问题类型（用于优先级计算）
  async findByIds(ids: string[]) {
    return this.prisma.issueType.findMany({
      where: {
        id: { in: ids },
        enabled: true,
        deletedAt: null,
      },
    });
  }
}
