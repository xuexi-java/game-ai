import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { CreateUserDto, UpdateUserDto, QueryUsersDto } from './dto/user.dto';

describe('UserController', () => {
  let controller: UserController;
  let userService: UserService;

  const mockUserService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);

    jest.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('应该返回当前用户信息', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        role: 'AGENT',
        realName: '测试用户',
      };

      mockUserService.findOne.mockResolvedValue(mockUser);

      const result = await controller.getCurrentUser(mockUser);

      expect(result).toEqual(mockUser);
      expect(userService.findOne).toHaveBeenCalledWith('user-1');
    });
  });

  describe('updateCurrentUser', () => {
    it('应该更新当前用户信息', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
      };

      const mockUpdateDto: UpdateUserDto = {
        realName: '更新后的名称',
        email: 'newemail@example.com',
      };

      const mockUpdatedUser = {
        ...mockUser,
        ...mockUpdateDto,
      };

      mockUserService.update.mockResolvedValue(mockUpdatedUser);

      const result = await controller.updateCurrentUser(
        mockUser,
        mockUpdateDto,
      );

      expect(result).toEqual(mockUpdatedUser);
      expect(userService.update).toHaveBeenCalledWith('user-1', mockUpdateDto);
    });
  });

  describe('create', () => {
    it('应该创建用户（管理员）', async () => {
      const mockCreateDto: CreateUserDto = {
        username: 'newuser',
        password: 'password123',
        role: 'AGENT',
        realName: '新用户',
      };

      const mockUser = {
        id: 'user-1',
        ...mockCreateDto,
        password: undefined, // 密码不应该返回
      };

      mockUserService.create.mockResolvedValue(mockUser);

      const result = await controller.create(mockCreateDto);

      expect(result).toEqual(mockUser);
      expect(userService.create).toHaveBeenCalledWith(mockCreateDto);
    });
  });

  describe('findAll', () => {
    it('应该返回用户列表（管理员）', async () => {
      const mockQuery: QueryUsersDto = {
        page: 1,
        pageSize: 10,
      };

      const mockResult = {
        items: [
          {
            id: 'user-1',
            username: 'user1',
            role: 'AGENT',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 10,
      };

      mockUserService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll(mockQuery);

      expect(result).toEqual(mockResult);
      expect(userService.findAll).toHaveBeenCalledWith(mockQuery);
    });
  });

  describe('findOne', () => {
    it('应该返回用户详情（管理员）', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        role: 'AGENT',
        realName: '测试用户',
      };

      mockUserService.findOne.mockResolvedValue(mockUser);

      const result = await controller.findOne('user-1');

      expect(result).toEqual(mockUser);
      expect(userService.findOne).toHaveBeenCalledWith('user-1');
    });
  });

  describe('update', () => {
    it('应该更新用户信息（管理员）', async () => {
      const mockUpdateDto: UpdateUserDto = {
        realName: '更新后的名称',
      };

      const mockUpdatedUser = {
        id: 'user-1',
        username: 'testuser',
        ...mockUpdateDto,
      };

      mockUserService.update.mockResolvedValue(mockUpdatedUser);

      const result = await controller.update('user-1', mockUpdateDto);

      expect(result).toEqual(mockUpdatedUser);
      expect(userService.update).toHaveBeenCalledWith('user-1', mockUpdateDto);
    });
  });

  describe('remove', () => {
    it('应该删除用户（管理员）', async () => {
      mockUserService.remove.mockResolvedValue({ success: true });

      const result = await controller.remove('user-1');

      expect(result).toEqual({ success: true });
      expect(userService.remove).toHaveBeenCalledWith('user-1');
    });
  });
});
