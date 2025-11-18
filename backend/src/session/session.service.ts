import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSessionDto, TransferToAgentDto } from './dto/create-session.dto';
import {
  MessageType as PrismaMessageType,
  SessionStatus,
  Urgency,
} from '@prisma/client';
import { MessageType as MessageDtoType } from '../message/dto/create-message.dto';
import { DifyService, DifyMessageResult } from '../dify/dify.service';
import { MessageService } from '../message/message.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class SessionService {
  constructor(
    private prisma: PrismaService,
    private difyService: DifyService,
    private messageService: MessageService,
    private websocketGateway: WebsocketGateway,
  ) {}

  // 鍒涘缓浼氳瘽锛堟楠?锛欰I寮曞锛?
  async create(createSessionDto: CreateSessionDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: createSessionDto.ticketId },
      include: { game: true },
    });

    if (!ticket) {
      throw new NotFoundException('工单不存在');
    }

    // 妫€鏌ユ槸鍚﹀凡鏈変細璇?
    const existingSession = await this.prisma.session.findFirst({
      where: {
        ticketId: createSessionDto.ticketId,
        status: { not: 'CLOSED' },
      },
    });

    if (existingSession) {
      return existingSession;
    }

    // 鍒涘缓鏂颁細璇?
    const session = await this.prisma.session.create({
      data: {
        ticketId: createSessionDto.ticketId,
        status: 'PENDING',
      },
      include: {
        ticket: {
          include: {
            game: true,
            server: true,
          },
        },
      },
    });

    // 璋冪敤Dify AI鑾峰彇鍒濆鍥炲
    try {
      const difyResponse = await this.difyService.triage(
        ticket.description,
        ticket.game.difyApiKey,
        ticket.game.difyBaseUrl,
      );

      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          detectedIntent: difyResponse.detectedIntent,
          aiUrgency:
            difyResponse.urgency === 'urgent' ? 'URGENT' : 'NON_URGENT',
          difyStatus: difyResponse.status ? String(difyResponse.status) : null,
        },
      });

      const aiMessage = await this.messageService.createAIMessage(
        session.id,
        difyResponse.text || '鎮ㄥソ锛屾垜姝ｅ湪涓烘偍鍒嗘瀽闂...',
        { suggestedOptions: difyResponse.suggestedOptions },
      );
      this.websocketGateway.notifyMessage(session.id, aiMessage);
    } catch (error) {
      console.error('Dify AI璋冪敤澶辫触:', error);
      // 鍒涘缓榛樿鍥炲
      const fallback = await this.messageService.createAIMessage(
        session.id,
        '鎮ㄥソ锛屾劅璋㈡偍鐨勫弽棣堛€傛垜浠鍦ㄤ负鎮ㄥ鐞嗭紝璇风◢鍊?..',
      );
      this.websocketGateway.notifyMessage(session.id, fallback);
    }

    return this.findOne(session.id);
  }

  // 鐜╁鍙戦€佹秷鎭紝鑷姩涓?Dify 浜や簰
  async handlePlayerMessage(
    sessionId: string,
    content: string,
    messageType: MessageDtoType = MessageDtoType.TEXT,
  ) {
    if (!content || !content.trim()) {
      throw new BadRequestException('娑堟伅鍐呭涓嶈兘涓虹┖');
    }

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        ticket: {
          include: {
            game: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    const playerMessage = await this.messageService.create(
      {
        sessionId,
        content,
        messageType,
      },
      'PLAYER',
    );
    this.websocketGateway.notifyMessage(sessionId, playerMessage);

    let difyResult: DifyMessageResult | null = null;
    let aiMessage: Awaited<
      ReturnType<MessageService['createAIMessage']>
    > | null = null;

    if (messageType === MessageDtoType.TEXT) {
      try {
        difyResult = await this.difyService.sendChatMessage(
          content,
          session.ticket.game.difyApiKey,
          session.ticket.game.difyBaseUrl,
          session.difyConversationId || undefined,
          session.ticket.playerIdOrName || 'player',
        );

        const updateData: Record<string, any> = {};
        if (
          difyResult.conversationId &&
          difyResult.conversationId !== session.difyConversationId
        ) {
          updateData.difyConversationId = difyResult.conversationId;
        }
        if (difyResult.status) {
          updateData.difyStatus = String(difyResult.status);
        }
        if (Object.keys(updateData).length > 0) {
          await this.prisma.session.update({
            where: { id: sessionId },
            data: updateData,
          });
        }

        if (difyResult.text) {
          aiMessage = await this.messageService.createAIMessage(
            sessionId,
            difyResult.text,
            {
              suggestedOptions: difyResult.suggestedOptions,
              difyStatus: difyResult.status,
            },
          );
          this.websocketGateway.notifyMessage(sessionId, aiMessage);
        }

        if (
          difyResult.status &&
          ['5', 5, 'TRANSFER', 'HANDOFF', 'AGENT'].includes(
            String(difyResult.status).toUpperCase(),
          )
        ) {
          await this.transferToAgent(sessionId, { urgency: 'URGENT' });
        }
      } catch (error: any) {
        console.error('Dify 瀵硅瘽澶辫触:', error.message || error);
      }
    }

    return {
      playerMessage,
      aiMessage,
      difyStatus: difyResult?.status || session.difyStatus || null,
    };
  }

  // 鑾峰彇浼氳瘽璇︽儏
  async findOne(id: string) {
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: {
        ticket: {
          include: {
            game: true,
            server: true,
            attachments: true,
          },
        },
        agent: {
          select: {
            id: true,
            username: true,
            realName: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      throw new NotFoundException('会话不存在');
    }

    return session;
  }

  // 鑾峰彇寰呮帴鍏ヤ細璇濆垪琛紙绠＄悊绔級
  async findQueuedSessions() {
    return this.prisma.session.findMany({
      where: {
        status: 'QUEUED',
      },
      include: {
        ticket: {
          include: {
            game: true,
            server: true,
            attachments: true,
          },
        },
        agent: {
          select: {
            id: true,
            username: true,
            realName: true,
          },
        },
      },
      orderBy: [{ priorityScore: 'desc' }, { queuedAt: 'asc' }],
    });
  }

  // 会话列表（管理端/客服�?
  async findAll(
    query: {
      status?: SessionStatus;
      agentId?: string;
      gameId?: string;
      search?: string;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    },
    currentUser: { id: string; role: string },
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (currentUser?.role === 'AGENT') {
      where.agentId = currentUser.id;
    } else if (query.agentId) {
      where.agentId = query.agentId;
    }

    const ticketFilter: any = {};

    if (query.gameId) {
      ticketFilter.gameId = query.gameId;
    }

    if (query.search) {
      ticketFilter.OR = [
        {
          ticketNo: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
        {
          playerIdOrName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (Object.keys(ticketFilter).length > 0) {
      where.ticket = ticketFilter;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.session.findMany({
        where,
        include: {
          ticket: {
            include: {
              game: true,
              server: true,
              attachments: true,
            },
          },
          agent: {
            select: {
              id: true,
              username: true,
              realName: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'asc' },
            take: 50, // 限制消息数量，避免数据过大
          },
        },
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortOrder || 'desc',
        },
        skip,
        take: pageSize,
      }),
      this.prisma.session.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // 瀹㈡湇鎺ュ叆浼氳瘽
  async joinSession(sessionId: string, agentId: string) {
    const session = await this.findOne(sessionId);

    if (session.status !== 'QUEUED' && session.status !== 'PENDING') {
      throw new BadRequestException('浼氳瘽鐘舵€佷笉鍏佽鎺ュ叆');
    }

    // 鏇存柊浼氳瘽鐘舵€?
    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        agentId,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
      include: {
        ticket: {
          include: {
            game: true,
            server: true,
            attachments: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // 鏇存柊瀹㈡湇鍦ㄧ嚎鐘舵€?
    await this.prisma.user.update({
      where: { id: agentId },
      data: { isOnline: true },
    });

    return updatedSession;
  }

  // 杞汉宸ワ紙姝ラ5锛氭櫤鑳藉垎娴侊級
  async transferToAgent(sessionId: string, transferDto: TransferToAgentDto) {
    const session = await this.findOne(sessionId);

    // 妫€鏌ユ槸鍚︽湁鍦ㄧ嚎瀹㈡湇
    const onlineAgents = await this.prisma.user.count({
      where: {
        role: 'AGENT',
        isOnline: true,
        deletedAt: null,
      },
    });

    if (onlineAgents === 0) {
      // 没有在线客服，转为工单
      await this.prisma.ticket.update({
        where: { id: session.ticketId },
        data: {
          status: 'WAITING',
          priority: 'URGENT',
        },
      });

      const closedSession = await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
        },
      });
      this.websocketGateway.notifySessionUpdate(sessionId, closedSession);

      return {
        queued: false,
        message: '当前非工作时间，您的问题已转为【加急工单】，我们将优先处理。',
        ticketNo: session.ticket.ticketNo,
      };
    }

    // 鏈夊湪绾垮鏈嶏紝杩涘叆鎺掗槦闃熷垪
    const priorityScore = await this.calculatePriorityScore(sessionId);

    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'QUEUED',
        playerUrgency: transferDto.urgency,
        priorityScore,
        queuedAt: new Date(),
        allowManualTransfer: false,
      },
    });
    this.websocketGateway.notifySessionUpdate(sessionId, updatedSession);

    // 閲嶆柊鎺掑簭闃熷垪
    await this.reorderQueue();

    // 璁＄畻鎺掗槦浣嶇疆
    const queuePosition = await this.getQueuePosition(sessionId);

    return {
      queued: true,
      queuePosition,
      estimatedWaitTime: queuePosition * 5, // 绠€鍗曚及绠楋細姣忎汉5鍒嗛挓
    };
  }

  // 璁＄畻浼樺厛绾у垎鏁?
  private async calculatePriorityScore(sessionId: string): Promise<number> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        ticket: true,
      },
    });

    if (!session) return 0;

    // 鑾峰彇鎵€鏈夊惎鐢ㄧ殑瑙勫垯
    const rules = await this.prisma.urgencyRule.findMany({
      where: {
        enabled: true,
        deletedAt: null,
      },
    });

    let totalScore = 0;

    for (const rule of rules) {
      if (this.matchRule(rule.conditions, session.ticket, session)) {
        totalScore += rule.priorityWeight;
      }
    }

    return totalScore;
  }

  // 鍖归厤瑙勫垯
  private matchRule(conditions: any, ticket: any, session: any): boolean {
    // 鍏抽敭璇嶅尮閰?
    if (conditions.keywords && Array.isArray(conditions.keywords)) {
      const matches = conditions.keywords.some((keyword: string) =>
        ticket.description.includes(keyword),
      );
      if (!matches) return false;
    }

    // 鎰忓浘鍖归厤
    if (conditions.intent && session.detectedIntent !== conditions.intent) {
      return false;
    }

    // 韬唤鐘舵€佸尮閰?
    if (
      conditions.identityStatus &&
      ticket.identityStatus !== conditions.identityStatus
    ) {
      return false;
    }

    // 娓告垙鍖归厤
    if (conditions.gameId && ticket.gameId !== conditions.gameId) {
      return false;
    }

    // 浼樺厛绾у尮閰?
    if (conditions.priority && ticket.priority !== conditions.priority) {
      return false;
    }

    return true;
  }

  // 閲嶆柊鎺掑簭闃熷垪
  private async reorderQueue() {
    const queuedSessions = await this.prisma.session.findMany({
      where: { status: 'QUEUED' },
      orderBy: [{ priorityScore: 'desc' }, { queuedAt: 'asc' }],
    });

    // 鏇存柊鎺掗槦浣嶇疆
    for (let i = 0; i < queuedSessions.length; i++) {
      await this.prisma.session.update({
        where: { id: queuedSessions[i].id },
        data: { queuePosition: i + 1 },
      });
    }
  }

  // 鑾峰彇鎺掗槦浣嶇疆
  private async getQueuePosition(sessionId: string): Promise<number> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || !session.queuedAt) return 0;

    const aheadCount = await this.prisma.session.count({
      where: {
        status: 'QUEUED',
        OR: [
          { priorityScore: { gt: session.priorityScore } },
          {
            AND: [
              { priorityScore: session.priorityScore },
              { queuedAt: { lt: session.queuedAt } },
            ],
          },
        ],
      },
    });

    return aheadCount;
  }

  // 缁撴潫浼氳瘽
  async closeSession(sessionId: string) {
    const session = await this.findOne(sessionId);

    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
  }

  async closeByPlayer(sessionId: string) {
    const session = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });
    this.websocketGateway.notifySessionUpdate(sessionId, session);
    return session;
  }
}
