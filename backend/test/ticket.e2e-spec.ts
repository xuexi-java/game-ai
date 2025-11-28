import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Ticket (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // 登录获取 token
    const loginResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        username: 'admin',
        password: 'admin123',
      });

    accessToken = loginResponse.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/tickets/check-open', () => {
    it('应该检查未关闭工单', () => {
      return request(app.getHttpServer())
        .post('/api/v1/tickets/check-open')
        .send({
          gameId: 'game-1',
          playerIdOrName: 'player-1',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('hasOpenTicket');
          expect(res.body).toHaveProperty('ticket');
        });
    });

    it('应该返回400 当缺少必要字段时', () => {
      return request(app.getHttpServer())
        .post('/api/v1/tickets/check-open')
        .send({
          gameId: 'game-1',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/tickets', () => {
    it('应该创建工单', () => {
      return request(app.getHttpServer())
        .post('/api/v1/tickets')
        .send({
          gameId: 'game-1',
          playerIdOrName: 'player-1',
          description: '测试问题',
          issueTypeIds: ['issue-type-1'],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('ticketNo');
          expect(res.body).toHaveProperty('token');
        });
    });

    it('应该返回400 当缺少必要字段时', () => {
      return request(app.getHttpServer())
        .post('/api/v1/tickets')
        .send({
          gameId: 'game-1',
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/tickets', () => {
    it('应该返回工单列表（管理员）', () => {
      return request(app.getHttpServer())
        .get('/api/v1/tickets')
        .set('Authorization', `Bearer ${accessToken}`)
        .query({ page: 1, pageSize: 10 })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('items');
          expect(res.body).toHaveProperty('total');
          expect(res.body).toHaveProperty('page');
          expect(res.body).toHaveProperty('pageSize');
        });
    });

    it('应该返回401 当未提供token时', () => {
      return request(app.getHttpServer()).get('/api/v1/tickets').expect(401);
    });
  });

  describe('GET /api/v1/tickets/:id', () => {
    let ticketId: string;

    beforeAll(async () => {
      // 创建一个工单用于测试
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/tickets')
        .send({
          gameId: 'game-1',
          playerIdOrName: 'player-1',
          description: '测试问题',
          issueTypeIds: ['issue-type-1'],
        });

      ticketId = createResponse.body.id;
    });

    it('应该返回工单详情（管理员）', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', ticketId);
          expect(res.body).toHaveProperty('ticketNo');
          expect(res.body).toHaveProperty('description');
        });
    });

    it('应该返回404 当工单不存在时', () => {
      return request(app.getHttpServer())
        .get('/api/v1/tickets/nonexistent')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });
});
