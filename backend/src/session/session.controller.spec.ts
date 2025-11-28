import { Test, TestingModule } from '@nestjs/testing';
import { SessionController } from './session.controller';
import { SessionService } from './session.service';
import { CreateSessionDto, TransferToAgentDto } from './dto/create-session.dto';

describe('SessionController', () => {
  let controller: SessionController;
  let sessionService: SessionService;

  const mockSessionService = {
    create: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
    joinSession: jest.fn(),
    closeSession: jest.fn(),
    transferToAgent: jest.fn(),
    handlePlayerMessage: jest.fn(),
    findQueuedSessions: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    controller = module.get<SessionController>(SessionController);
    sessionService = module.get<SessionService>(SessionService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应该创建会话', async () => {
      const mockCreateDto: CreateSessionDto = {
        ticketId: 'ticket-1',
      };

      const mockSession = {
        id: 'session-1',
        ticketId: 'ticket-1',
        status: 'PENDING',
      };

      mockSessionService.create.mockResolvedValue(mockSession);

      const result = await controller.create(mockCreateDto);

      expect(result).toEqual(mockSession);
      expect(sessionService.create).toHaveBeenCalledWith(mockCreateDto);
    });
  });

  describe('findOne', () => {
    it('应该返回会话详情', async () => {
      const mockSession = {
        id: 'session-1',
        ticketId: 'ticket-1',
        status: 'IN_PROGRESS',
      };

      mockSessionService.findOne.mockResolvedValue(mockSession);

      const result = await controller.findOne('session-1');

      expect(result).toEqual(mockSession);
      expect(sessionService.findOne).toHaveBeenCalledWith('session-1');
    });
  });

  describe('sendPlayerMessage', () => {
    it('应该处理玩家消息', async () => {
      const mockBody = {
        content: '测试消息',
        messageType: 'TEXT' as const,
      };

      const mockResult = {
        message: {
          id: 'message-1',
          content: '测试消息',
        },
        aiResponse: {
          content: 'AI回复',
        },
      };

      mockSessionService.handlePlayerMessage.mockResolvedValue(mockResult);

      const result = await controller.sendPlayerMessage('session-1', mockBody);

      expect(result).toEqual(mockResult);
      expect(sessionService.handlePlayerMessage).toHaveBeenCalledWith(
        'session-1',
        '测试消息',
        'TEXT',
      );
    });
  });

  describe('transferToAgent', () => {
    it('应该转接人工客服', async () => {
      const mockTransferDto: TransferToAgentDto = {
        reason: '需要人工处理',
      };

      const mockResult = {
        id: 'session-1',
        status: 'QUEUED',
        agentId: 'agent-1',
      };

      mockSessionService.transferToAgent.mockResolvedValue(mockResult);

      const result = await controller.transferToAgent(
        'session-1',
        mockTransferDto,
      );

      expect(result).toEqual(mockResult);
      expect(sessionService.transferToAgent).toHaveBeenCalledWith(
        'session-1',
        mockTransferDto,
      );
    });
  });

  describe('joinSession', () => {
    it('应该接入会话', async () => {
      const mockUser = {
        id: 'agent-1',
        role: 'AGENT',
      };

      const mockSession = {
        id: 'session-1',
        status: 'IN_PROGRESS',
        agentId: 'agent-1',
      };

      mockSessionService.joinSession.mockResolvedValue(mockSession);

      const result = await controller.joinSession('session-1', mockUser);

      expect(result).toEqual(mockSession);
      expect(sessionService.joinSession).toHaveBeenCalledWith(
        'session-1',
        'agent-1',
      );
    });
  });

  describe('findQueuedSessions', () => {
    it('应该返回待接入会话列表', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          status: 'QUEUED',
        },
        {
          id: 'session-2',
          status: 'QUEUED',
        },
      ];

      mockSessionService.findQueuedSessions.mockResolvedValue(mockSessions);

      const result = await controller.findQueuedSessions({
        id: 'agent-1',
        role: 'AGENT',
      });

      expect(result).toEqual(mockSessions);
      expect(sessionService.findQueuedSessions).toHaveBeenCalled();
    });
  });
});
