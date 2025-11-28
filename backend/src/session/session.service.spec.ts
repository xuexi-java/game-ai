import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { SessionService } from './session.service';
import { PrismaService } from '../prisma/prisma.service';
import { DifyService } from '../dify/dify.service';
import { MessageService } from '../message/message.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { TicketService } from '../ticket/ticket.service';

describe('SessionService', () => {
  let service: SessionService;
  let prisma: PrismaService;
  let difyService: DifyService;
  let messageService: MessageService;

  const mockPrismaService = {
    session: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    ticket: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockDifyService = {
    createConversation: jest.fn(),
    sendMessage: jest.fn(),
    triage: jest.fn(),
  };

  const mockMessageService = {
    create: jest.fn(),
    createAIMessage: jest.fn(),
  };

  const mockWebsocketGateway = {
    notifyNewSession: jest.fn(),
    notifySessionUpdate: jest.fn(),
    notifyMessage: jest.fn(),
  };

  const mockTicketService = {
    findOne: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: DifyService,
          useValue: mockDifyService,
        },
        {
          provide: MessageService,
          useValue: mockMessageService,
        },
        {
          provide: WebsocketGateway,
          useValue: mockWebsocketGateway,
        },
        {
          provide: TicketService,
          useValue: mockTicketService,
        },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
    prisma = module.get<PrismaService>(PrismaService);
    difyService = module.get<DifyService>(DifyService);
    messageService = module.get<MessageService>(MessageService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockTicket = {
      id: 'ticket-1',
      gameId: 'game-1',
      playerIdOrName: 'player-1',
      description: '测试问题',
      game: { id: 'game-1', name: '测试游戏' },
    };

    const mockCreateDto = {
      ticketId: 'ticket-1',
    };

    const mockSession = {
      id: 'session-1',
      ticketId: 'ticket-1',
      status: 'PENDING',
      ticket: mockTicket,
    };

    beforeEach(() => {
      mockPrismaService.ticket.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.session.findFirst.mockResolvedValue(null);
      mockPrismaService.session.create.mockResolvedValue(mockSession);
      mockPrismaService.session.update.mockResolvedValue(mockSession);
      // create 方法最后会调用 findOne，需要 mock findUnique
      const enrichedSession = {
        ...mockSession,
        messages: [],
        agent: null,
      };
      mockPrismaService.session.findUnique.mockResolvedValue(enrichedSession);
      mockDifyService.triage.mockResolvedValue({
        text: '测试回复',
        detectedIntent: 'test',
        urgency: 'non_urgent',
      });
      mockMessageService.createAIMessage.mockResolvedValue({
        id: 'msg-1',
        content: '测试回复',
        messageType: 'TEXT',
      });
    });

    it('应该成功创建会话', async () => {
      const result = await service.create(mockCreateDto);

      expect(result).toBeDefined();
      expect(mockPrismaService.session.create).toHaveBeenCalled();
    });

    it('应该抛出异常 当工单不存在时', async () => {
      mockPrismaService.ticket.findUnique.mockResolvedValue(null);

      await expect(service.create(mockCreateDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('应该返回已存在的会话 当会话已存在时', async () => {
      const existingSession = {
        id: 'existing-session',
        ticketId: 'ticket-1',
        status: 'IN_PROGRESS',
      };

      mockPrismaService.session.findFirst.mockResolvedValue(existingSession);

      const result = await service.create(mockCreateDto);

      expect(result).toEqual(existingSession);
      expect(mockPrismaService.session.create).not.toHaveBeenCalled();
    });
  });

  describe('joinSession', () => {
    const mockSession = {
      id: 'session-1',
      ticketId: 'ticket-1',
      status: 'QUEUED',
      agentId: null,
      ticket: {
        id: 'ticket-1',
        status: 'WAITING',
      },
    };

    const mockAgent = {
      id: 'agent-1',
      role: 'AGENT',
      username: 'agent1',
    };

    const mockUpdatedSession = {
      ...mockSession,
      status: 'IN_PROGRESS',
      agentId: 'agent-1',
      startedAt: new Date(),
      queuedAt: null,
      queuePosition: null,
      agent: mockAgent,
    };

    beforeEach(() => {
      mockPrismaService.session.findUnique = jest
        .fn()
        .mockResolvedValue(mockSession);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAgent);
      mockPrismaService.session.update.mockResolvedValue(mockUpdatedSession);
      mockPrismaService.user.update.mockResolvedValue(mockAgent);
      mockPrismaService.ticket.update.mockResolvedValue(mockSession.ticket);
      // Mock reorderQueue 需要的查询
      mockPrismaService.session.findMany.mockResolvedValue([]);
      mockPrismaService.user.count.mockResolvedValue(0);
    });

    it('应该成功接入会话', async () => {
      const result = await service.joinSession('session-1', 'agent-1');

      expect(result).toHaveProperty('status', 'IN_PROGRESS');
      expect(result).toHaveProperty('agentId', 'agent-1');
      expect(mockPrismaService.session.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({
            agentId: 'agent-1',
            status: 'IN_PROGRESS',
            queuedAt: null,
            queuePosition: null,
          }),
        }),
      );
    });

    it('应该抛出异常 当会话状态不正确时', async () => {
      const closedSession = {
        ...mockSession,
        status: 'CLOSED',
      };

      mockPrismaService.session.findUnique = jest
        .fn()
        .mockResolvedValue(closedSession);

      await expect(service.joinSession('session-1', 'agent-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('应该抛出异常 当会话已分配给其他客服且当前用户不是管理员时', async () => {
      const assignedSession = {
        ...mockSession,
        agentId: 'other-agent',
      };

      mockPrismaService.session.findUnique = jest
        .fn()
        .mockResolvedValue(assignedSession);

      await expect(service.joinSession('session-1', 'agent-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('应该允许管理员接入已分配给其他客服的会话', async () => {
      const assignedSession = {
        ...mockSession,
        agentId: 'other-agent',
      };

      const adminUser = {
        id: 'admin-1',
        role: 'ADMIN',
      };

      mockPrismaService.session.findUnique = jest
        .fn()
        .mockResolvedValue(assignedSession);
      mockPrismaService.user.findUnique.mockResolvedValue(adminUser);
      mockPrismaService.session.update.mockResolvedValue({
        ...assignedSession,
        agentId: 'admin-1',
        status: 'IN_PROGRESS',
      });

      const result = await service.joinSession('session-1', 'admin-1');

      expect(result).toHaveProperty('status', 'IN_PROGRESS');
      expect(mockPrismaService.session.update).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('应该返回会话详情', async () => {
      const mockSession = {
        id: 'session-1',
        ticketId: 'ticket-1',
        status: 'IN_PROGRESS',
        ticket: {
          id: 'ticket-1',
          ticketIssueTypes: [
            {
              issueType: { id: 'issue-1', name: '充值问题' },
            },
          ],
        },
      };

      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);

      const result = await service.findOne('session-1');

      expect(result).toHaveProperty('ticket');
      expect(result.ticket).toHaveProperty('issueTypes');
    });

    it('应该抛出异常 当会话不存在时', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('应该返回会话列表', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          status: 'IN_PROGRESS',
        },
        {
          id: 'session-2',
          status: 'QUEUED',
        },
      ];

      mockPrismaService.$transaction.mockResolvedValue([mockSessions, 2]);

      const result = await service.findAll(
        { page: 1, pageSize: 10 },
        { id: 'agent-1', role: 'AGENT' },
      );

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('应该只返回分配给当前客服的会话 当用户是客服时', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll(
        { page: 1, pageSize: 10 },
        { id: 'agent-1', role: 'AGENT' },
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('应该返回所有会话 当用户是管理员时', async () => {
      mockPrismaService.$transaction.mockResolvedValue([[], 0]);

      const result = await service.findAll(
        { page: 1, pageSize: 10 },
        { id: 'admin-1', role: 'ADMIN' },
      );

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
