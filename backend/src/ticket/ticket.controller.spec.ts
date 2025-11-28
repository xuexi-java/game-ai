import { Test, TestingModule } from '@nestjs/testing';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';
import { CreateTicketDto } from './dto/create-ticket.dto';

describe('TicketController', () => {
  let controller: TicketController;
  let ticketService: TicketService;

  const mockTicketService = {
    checkOpenTicket: jest.fn(),
    checkOpenTicketByIssueType: jest.fn(),
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    updateStatus: jest.fn(),
    updatePriority: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketController],
      providers: [
        {
          provide: TicketService,
          useValue: mockTicketService,
        },
      ],
    }).compile();

    controller = module.get<TicketController>(TicketController);
    ticketService = module.get<TicketService>(TicketService);

    jest.clearAllMocks();
  });

  describe('checkOpenTicket', () => {
    it('应该检查未关闭工单', async () => {
      const mockBody = {
        gameId: 'game-1',
        serverId: 'server-1',
        playerIdOrName: 'player-1',
      };

      const mockResult = {
        hasOpenTicket: true,
        ticket: {
          id: 'ticket-1',
          ticketNo: 'T-20250101-001',
          token: 'token-123',
        },
      };

      mockTicketService.checkOpenTicket.mockResolvedValue(mockResult);

      const result = await controller.checkOpenTicket(mockBody);

      expect(result).toEqual(mockResult);
      expect(ticketService.checkOpenTicket).toHaveBeenCalledWith(
        'game-1',
        'server-1',
        null,
        'player-1',
      );
    });
  });

  describe('create', () => {
    it('应该创建工单', async () => {
      const mockCreateDto: CreateTicketDto = {
        gameId: 'game-1',
        serverId: 'server-1',
        playerIdOrName: 'player-1',
        description: '测试问题',
        issueTypeIds: ['issue-type-1'],
      };

      const mockResult = {
        id: 'ticket-1',
        ticketNo: 'T-20250101-001',
        token: 'token-123',
      };

      mockTicketService.create.mockResolvedValue(mockResult);

      const result = await controller.create(mockCreateDto);

      expect(result).toEqual(mockResult);
      expect(ticketService.create).toHaveBeenCalledWith(mockCreateDto);
    });
  });

  describe('findAll', () => {
    it('应该返回工单列表', async () => {
      const mockQuery = { page: 1, pageSize: 10 };
      const mockResult = {
        items: [
          {
            id: 'ticket-1',
            ticketNo: 'T-20250101-001',
            status: 'IN_PROGRESS',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockTicketService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockQuery, {
        id: 'user-1',
        role: 'ADMIN',
      });

      expect(result).toEqual(mockResult);
      expect(ticketService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('应该返回工单详情', async () => {
      const mockTicket = {
        id: 'ticket-1',
        ticketNo: 'T-20250101-001',
        description: '测试问题',
        status: 'IN_PROGRESS',
      };

      mockTicketService.findOne.mockResolvedValue(mockTicket);

      const result = await controller.findOne('ticket-1');

      expect(result).toEqual(mockTicket);
      expect(ticketService.findOne).toHaveBeenCalledWith('ticket-1');
    });
  });

  describe('updateStatus', () => {
    it('应该更新工单状态', async () => {
      const mockBody = { status: 'RESOLVED' };
      const mockResult = {
        id: 'ticket-1',
        status: 'RESOLVED',
      };

      mockTicketService.updateStatus.mockResolvedValue(mockResult);

      const result = await controller.updateStatus('ticket-1', mockBody);

      expect(result).toEqual(mockResult);
      expect(ticketService.updateStatus).toHaveBeenCalledWith(
        'ticket-1',
        'RESOLVED',
      );
    });
  });
});
