import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MessageService } from './message.service';
import { PrismaService } from '../prisma/prisma.service';
import { SenderType, MessageType } from '@prisma/client';

describe('MessageService', () => {
  let service: MessageService;
  let prisma: PrismaService;

  const mockPrismaService = {
    session: {
      findUnique: jest.fn(),
    },
    message: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MessageService>(MessageService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    const mockCreateDto = {
      sessionId: 'session-1',
      content: '测试消息',
      messageType: MessageType.TEXT,
    };

    const mockSession = {
      id: 'session-1',
      ticketId: 'ticket-1',
      status: 'IN_PROGRESS',
    };

    const mockMessage = {
      id: 'message-1',
      sessionId: 'session-1',
      senderType: 'PLAYER' as SenderType,
      senderId: null,
      content: '测试消息',
      messageType: MessageType.TEXT,
      createdAt: new Date(),
    };

    beforeEach(() => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
    });

    it('应该成功创建玩家消息', async () => {
      mockPrismaService.message.create.mockResolvedValue(mockMessage);

      const result = await service.create(mockCreateDto, 'PLAYER');

      expect(result).toEqual(mockMessage);
      expect(mockPrismaService.message.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          senderType: 'PLAYER',
          senderId: null,
          content: '测试消息',
          messageType: MessageType.TEXT,
        },
        include: {},
      });
    });

    it('应该成功创建客服消息', async () => {
      const agentMessage = {
        ...mockMessage,
        senderType: 'AGENT' as SenderType,
        senderId: 'agent-1',
        agent: {
          id: 'agent-1',
          username: 'agent1',
          realName: '客服1',
        },
      };

      mockPrismaService.message.create.mockResolvedValue(agentMessage);

      const result = await service.create(mockCreateDto, 'AGENT', 'agent-1');

      expect(result).toEqual(agentMessage);
      expect(mockPrismaService.message.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          senderType: 'AGENT',
          senderId: 'agent-1',
          content: '测试消息',
          messageType: MessageType.TEXT,
        },
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
    });

    it('应该抛出异常 当会话不存在时', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(service.create(mockCreateDto, 'PLAYER')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findBySession', () => {
    const mockSession = {
      id: 'session-1',
      ticketId: 'ticket-1',
      status: 'IN_PROGRESS',
    };

    const mockMessages = [
      {
        id: 'message-1',
        sessionId: 'session-1',
        content: '第一条消息',
        senderType: 'PLAYER' as SenderType,
        createdAt: new Date('2024-01-01T10:00:00Z'),
      },
      {
        id: 'message-2',
        sessionId: 'session-1',
        content: '第二条消息',
        senderType: 'AGENT' as SenderType,
        agent: {
          id: 'agent-1',
          username: 'agent1',
          realName: '客服1',
        },
        createdAt: new Date('2024-01-01T10:01:00Z'),
      },
    ];

    beforeEach(() => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
    });

    it('应该返回会话的所有消息', async () => {
      mockPrismaService.message.findMany.mockResolvedValue(mockMessages);

      const result = await service.findBySession('session-1');

      expect(result).toEqual(mockMessages);
      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith({
        where: { sessionId: 'session-1' },
        orderBy: { createdAt: 'asc' },
        take: undefined,
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
    });

    it('应该支持限制消息数量', async () => {
      mockPrismaService.message.findMany.mockResolvedValue([mockMessages[0]]);

      const result = await service.findBySession('session-1', 1);

      expect(result).toHaveLength(1);
      expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1,
        }),
      );
    });

    it('应该抛出异常 当会话不存在时', async () => {
      mockPrismaService.session.findUnique.mockResolvedValue(null);

      await expect(service.findBySession('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createAIMessage', () => {
    const mockSession = {
      id: 'session-1',
      ticketId: 'ticket-1',
      status: 'IN_PROGRESS',
    };

    const mockAIMessage = {
      id: 'message-1',
      sessionId: 'session-1',
      senderType: 'AI' as SenderType,
      content: 'AI回复消息',
      messageType: MessageType.TEXT,
      metadata: null,
    };

    beforeEach(() => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.message.create.mockResolvedValue(mockAIMessage);
    });

    it('应该成功创建AI消息', async () => {
      const result = await service.createAIMessage('session-1', 'AI回复消息');

      expect(result).toEqual(mockAIMessage);
      expect(mockPrismaService.message.create).toHaveBeenCalled();
    });

    it('应该支持添加元数据', async () => {
      const metadata = { conversationId: 'conv-1', model: 'gpt-4' };
      const messageWithMetadata = {
        ...mockAIMessage,
        metadata,
      };

      mockPrismaService.message.update.mockResolvedValue(messageWithMetadata);

      const result = await service.createAIMessage(
        'session-1',
        'AI回复消息',
        metadata,
      );

      expect(result).toEqual(messageWithMetadata);
      expect(mockPrismaService.message.update).toHaveBeenCalledWith({
        where: { id: 'message-1' },
        data: { metadata },
      });
    });
  });

  describe('createSystemMessage', () => {
    const mockSession = {
      id: 'session-1',
      ticketId: 'ticket-1',
      status: 'IN_PROGRESS',
    };

    const mockSystemMessage = {
      id: 'message-1',
      sessionId: 'session-1',
      senderType: 'SYSTEM' as SenderType,
      content: '系统通知消息',
      messageType: MessageType.SYSTEM_NOTICE,
    };

    beforeEach(() => {
      mockPrismaService.session.findUnique.mockResolvedValue(mockSession);
      mockPrismaService.message.create.mockResolvedValue(mockSystemMessage);
    });

    it('应该成功创建系统消息', async () => {
      const result = await service.createSystemMessage(
        'session-1',
        '系统通知消息',
      );

      expect(result).toEqual(mockSystemMessage);
      expect(mockPrismaService.message.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1',
          senderType: 'SYSTEM',
          senderId: null,
          content: '系统通知消息',
          messageType: MessageType.SYSTEM_NOTICE,
        },
        include: {},
      });
    });
  });
});
