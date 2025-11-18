import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  UseGuards,
  Query,
} from '@nestjs/common';
import { SessionService } from './session.service';
import { CreateSessionDto, TransferToAgentDto } from './dto/create-session.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';

@Controller('sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  // 玩家端API - 创建会话
  @Public()
  @Post()
  create(@Body() createSessionDto: CreateSessionDto) {
    return this.sessionService.create(createSessionDto);
  }

  // 玩家端API - 发送消息并触发AI回复
  @Public()
  @Post(':id/messages')
  sendPlayerMessage(
    @Param('id') id: string,
    @Body()
    body: {
      content: string;
      messageType?: 'TEXT' | 'IMAGE';
    },
  ) {
    return this.sessionService.handlePlayerMessage(
      id,
      body.content,
      body.messageType ? (body.messageType as any) : undefined,
    );
  }

  // 玩家端API - 获取会话详情
  @Public()
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sessionService.findOne(id);
  }

  // 玩家端API - 转人工
  @Public()
  @Post(':id/transfer-to-agent')
  transferToAgent(
    @Param('id') id: string,
    @Body() transferDto: TransferToAgentDto,
  ) {
    return this.sessionService.transferToAgent(id, transferDto);
  }

  // 管理端API - 获取待接入会话列表
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @Get('workbench/queued')
  findQueuedSessions() {
    return this.sessionService.findQueuedSessions();
  }

  // 管理端API - 会话列表（支持管理员查看全部，客服仅查看自己的会话）
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @Get()
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.sessionService.findAll(
      {
        status: query.status,
        agentId: query.agentId,
        gameId: query.gameId,
        search: query.search,
        page: query.page ? parseInt(query.page) : 1,
        pageSize: query.pageSize ? parseInt(query.pageSize) : 10,
        sortBy: query.sortBy || 'createdAt',
        sortOrder: query.sortOrder || 'desc',
      },
      user,
    );
  }

  // 管理端API - 客服接入会话
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @Post(':id/join')
  joinSession(@Param('id') id: string, @CurrentUser() user: any) {
    return this.sessionService.joinSession(id, user.id);
  }

  // 管理端API - 结束会话
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'AGENT')
  @Patch(':id/close')
  closeSession(@Param('id') id: string) {
    return this.sessionService.closeSession(id);
  }

  // 玩家端API - 结束聊天
  @Public()
  @Patch(':id/close-player')
  closeByPlayer(@Param('id') id: string) {
    return this.sessionService.closeByPlayer(id);
  }
}
