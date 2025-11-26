import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { QuickReplyService } from './quick-reply.service';
import { CreateQuickReplyGroupDto } from './dto/create-quick-reply-group.dto';
import { UpdateQuickReplyGroupDto } from './dto/update-quick-reply-group.dto';
import { CreateQuickReplyItemDto } from './dto/create-quick-reply-item.dto';
import { UpdateQuickReplyItemDto } from './dto/update-quick-reply-item.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('快捷回复')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quick-replies')
export class QuickReplyController {
  constructor(private readonly quickReplyService: QuickReplyService) {}

  // ==================== 快捷回复查询（客服使用）====================

  @Get()
  @ApiOperation({ summary: '获取指定游戏的快捷回复（按分组聚合）' })
  @ApiResponse({ status: 200, description: '返回快捷回复分组列表' })
  @Roles('AGENT', 'ADMIN')
  findAll(@Query('gameId') gameId?: string) {
    return this.quickReplyService.findAllByGame(gameId);
  }

  @Get('search')
  @ApiOperation({ summary: '搜索快捷回复（支持内容和快捷键模糊搜索）' })
  @ApiResponse({ status: 200, description: '返回搜索结果' })
  @Roles('AGENT', 'ADMIN')
  search(@Query('q') query: string, @Query('gameId') gameId?: string) {
    if (!query) {
      return [];
    }
    return this.quickReplyService.search(query, gameId);
  }

  @Get('shortcut/:shortcut')
  @ApiOperation({ summary: '根据快捷键查找快捷回复' })
  @ApiResponse({ status: 200, description: '返回快捷回复项' })
  @Roles('AGENT', 'ADMIN')
  findByShortcut(
    @Param('shortcut') shortcut: string,
    @Query('gameId') gameId?: string,
  ) {
    return this.quickReplyService.findByShortcut(shortcut, gameId);
  }

  @Post('items/:id/increment-usage')
  @ApiOperation({ summary: '增加使用次数' })
  @ApiResponse({ status: 200, description: '更新成功' })
  @Roles('AGENT', 'ADMIN')
  incrementUsage(@Param('id', ParseIntPipe) id: number) {
    return this.quickReplyService.incrementUsage(id);
  }

  // ==================== 分组管理（仅管理员）====================

  @Post('groups')
  @Roles('ADMIN')
  @ApiOperation({ summary: '创建分组（仅管理员）' })
  @ApiResponse({ status: 201, description: '创建成功' })
  async createGroup(@Body() createDto: CreateQuickReplyGroupDto) {
    try {
      return await this.quickReplyService.createGroup(createDto);
    } catch (error) {
      console.error('创建快捷回复分组失败:', error);
      throw error;
    }
  }

  @Get('groups')
  @Roles('ADMIN')
  @ApiOperation({ summary: '获取所有分组（仅管理员）' })
  @ApiResponse({ status: 200, description: '返回分组列表' })
  async findAllGroups(@Query('gameId') gameId?: string) {
    try {
      return await this.quickReplyService.findAllGroups(gameId);
    } catch (error: any) {
      console.error('获取快捷回复分组失败:', error);
      // 如果是已知的错误，转换为HTTP异常
      if (error.message?.includes('数据库表不存在')) {
        throw new Error('数据库表不存在，请运行数据库迁移: npx prisma migrate deploy');
      }
      // 记录详细的错误信息以便调试
      if (error.stack) {
        console.error('错误堆栈:', error.stack);
      }
      throw error;
    }
  }

  @Get('groups/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '获取单个分组（仅管理员）' })
  @ApiResponse({ status: 200, description: '返回分组详情' })
  findGroupById(@Param('id', ParseIntPipe) id: number) {
    return this.quickReplyService.findGroupById(id);
  }

  @Patch('groups/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '更新分组（仅管理员）' })
  @ApiResponse({ status: 200, description: '更新成功' })
  updateGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateQuickReplyGroupDto,
  ) {
    return this.quickReplyService.updateGroup(id, updateDto);
  }

  @Delete('groups/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '删除分组（仅管理员）' })
  @ApiResponse({ status: 200, description: '删除成功' })
  removeGroup(@Param('id', ParseIntPipe) id: number) {
    return this.quickReplyService.removeGroup(id);
  }

  // ==================== 回复项管理（仅管理员）====================

  @Post('items')
  @Roles('ADMIN')
  @ApiOperation({ summary: '创建回复项（仅管理员）' })
  @ApiResponse({ status: 201, description: '创建成功' })
  createItem(@Body() createDto: CreateQuickReplyItemDto) {
    return this.quickReplyService.createItem(createDto);
  }

  @Get('items/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '获取单个回复项（仅管理员）' })
  @ApiResponse({ status: 200, description: '返回回复项详情' })
  findItemById(@Param('id', ParseIntPipe) id: number) {
    return this.quickReplyService.findItemById(id);
  }

  @Patch('items/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '更新回复项（仅管理员）' })
  @ApiResponse({ status: 200, description: '更新成功' })
  updateItem(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateQuickReplyItemDto,
  ) {
    return this.quickReplyService.updateItem(id, updateDto);
  }

  @Delete('items/:id')
  @Roles('ADMIN')
  @ApiOperation({ summary: '删除回复项（仅管理员）' })
  @ApiResponse({ status: 200, description: '删除成功' })
  removeItem(@Param('id', ParseIntPipe) id: number) {
    return this.quickReplyService.removeItem(id);
  }
}
