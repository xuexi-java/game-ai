import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
    logout: jest.fn(),
    validateUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);

    jest.clearAllMocks();
  });

  describe('login', () => {
    const mockLoginDto: LoginDto = {
      username: 'testuser',
      password: 'password123',
    };

    const mockLoginResponse = {
      accessToken: 'mock_token',
      user: {
        id: 'user-1',
        username: 'testuser',
        role: 'AGENT',
        realName: '测试用户',
      },
    };

    it('应该成功登录', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      const result = await controller.login(mockLoginDto);

      expect(result).toEqual(mockLoginResponse);
      expect(authService.login).toHaveBeenCalledWith(mockLoginDto);
    });

    it('应该返回错误 当登录失败时', async () => {
      mockAuthService.login.mockRejectedValue(new Error('用户名或密码错误'));

      await expect(controller.login(mockLoginDto)).rejects.toThrow();
    });
  });

  describe('logout', () => {
    const mockUser = {
      id: 'user-1',
      username: 'testuser',
      role: 'AGENT',
    };

    it('应该成功登出', async () => {
      mockAuthService.logout.mockResolvedValue({ success: true });

      const result = await controller.logout(mockUser);

      expect(result).toEqual({ success: true });
      expect(authService.logout).toHaveBeenCalledWith('user-1');
    });
  });
});
