import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/login', () => {
    it('应该成功登录', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user).toHaveProperty('username', 'admin');
        });
    });

    it('应该返回401 当用户名或密码错误时', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'wronguser',
          password: 'wrongpassword',
        })
        .expect(401);
    });

    it('应该返回400 当缺少必要字段时', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'admin',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    let accessToken: string;

    beforeAll(async () => {
      // 先登录获取 token
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          username: 'admin',
          password: 'admin123',
        });

      accessToken = response.body.accessToken;
    });

    it('应该成功登出', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
        });
    });

    it('应该返回401 当未提供token时', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401);
    });
  });
});
