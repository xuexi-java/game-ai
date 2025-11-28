import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { SenderType, MessageType } from '@prisma/client';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  // 创建消息
  async create(
    createMessageDto: CreateMessageDto,
    senderType: SenderType,
    senderId?: string,
    currentUser?: { id: string; role: string },
  ) {
    // 验证会话存在
    const session = await this.prisma.session.findUnique({
      where: { id: createMessageDto.sessionId },
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    // 权限检查：如果是客服发送消息，只能发送到自己处理的会话
    if (senderType === 'AGENT' && senderId && currentUser) {
      if (currentUser.role === 'AGENT') {
        // 客服只能发送消息到自己处理的会话
        if (session.agentId !== senderId) {
          throw new NotFoundException(
            '无权发送消息：该会话已分配给其他客服，只有处理该会话的客服才能回复',
          );
        }
        // 检查会话状态，必须是IN_PROGRESS状态才能发送消息
        if (session.status !== 'IN_PROGRESS') {
          throw new BadRequestException(
            '会话未接入，请先接入会话后才能发送消息',
          );
        }
      }
    }

    const message = await this.prisma.message.create({
      data: {
        sessionId: createMessageDto.sessionId,
        senderType,
        senderId: senderId || null,
        content: createMessageDto.content,
        messageType:
          (createMessageDto.messageType as MessageType) || MessageType.TEXT,
      },
      include: {
        ...(senderType === 'AGENT' && senderId
          ? {
              agent: {
                select: {
                  id: true,
                  username: true,
                  realName: true,
                },
              },
            }
          : {}),
      },
    });

    return message;
  }

  // 获取会话消息列表
  async findBySession(sessionId: string, limit?: number) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    return this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: limit,
      include: {
        agent: {
          select: {
            id: true,
            username: true,
            realName: true,
          },
        },
      },
    });
  }

  // 创建AI消息
  async createAIMessage(sessionId: string, content: string, metadata?: any) {
    const createDto = {
      sessionId,
      content,
      messageType: MessageType.TEXT as any,
    };
    return this.create(createDto, 'AI').then((message) => {
      if (metadata) {
        return this.prisma.message.update({
          where: { id: message.id },
          data: { metadata },
        });
      }
      return message;
    });
  }

  // 创建系统通知消息
  async createSystemMessage(sessionId: string, content: string) {
    const createDto = {
      sessionId,
      content,
      messageType: MessageType.SYSTEM_NOTICE as any,
    };
    return this.create(createDto, 'SYSTEM');
  }
}
