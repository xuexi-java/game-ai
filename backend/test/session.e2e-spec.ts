import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Session (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let ticketId: string;
  let sessionId: string;

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

    // 创建一个工单用于测试
    const ticketResponse = await request(app.getHttpServer())
      .post('/api/v1/tickets')
      .send({
        gameId: 'game-1',
        playerIdOrName: 'player-1',
        description: '测试问题',
        issueTypeIds: ['issue-type-1'],
      });

    ticketId = ticketResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/sessions', () => {
    it('应该创建会话', () => {
      return request(app.getHttpServer())
        .post('/api/v1/sessions')
        .send({
          ticketId,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('ticketId', ticketId);
          expect(res.body).toHaveProperty('status');
          sessionId = res.body.id;
        });
    });

    it('应该返回404 当工单不存在时', () => {
      return request(app.getHttpServer())
        .post('/api/v1/sessions')
        .send({
          ticketId: 'nonexistent',
        })
        .expect(404);
    });
  });

  describe('GET /api/v1/sessions/:id', () => {
    it('应该返回会话详情', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/sessions/${sessionId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', sessionId);
          expect(res.body).toHaveProperty('ticketId', ticketId);
        });
    });

    it('应该返回404 当会话不存在时', () => {
      return request(app.getHttpServer())
        .get('/api/v1/sessions/nonexistent')
        .expect(404);
    });
  });

  describe('POST /api/v1/sessions/:id/messages', () => {
    it('应该发送玩家消息', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/messages`)
        .send({
          content: '测试消息',
          messageType: 'TEXT',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body.message).toHaveProperty('content', '测试消息');
        });
    });

    it('应该返回400 当缺少消息内容时', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/messages`)
        .send({
          messageType: 'TEXT',
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/sessions/:id/transfer-to-agent', () => {
    it('应该转接人工客服', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/transfer-to-agent`)
        .send({
          reason: '需要人工处理',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
        });
    });
  });

  describe('GET /api/v1/sessions/workbench/queued', () => {
    it('应该返回待接入会话列表（管理员/客服）', () => {
      return request(app.getHttpServer())
        .get('/api/v1/sessions/workbench/queued')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('应该返回401 当未提供token时', () => {
      return request(app.getHttpServer())
        .get('/api/v1/sessions/workbench/queued')
        .expect(401);
    });
  });

  describe('POST /api/v1/sessions/:id/join', () => {
    it('应该接入会话（管理员/客服）', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/join`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'IN_PROGRESS');
          expect(res.body).toHaveProperty('agentId');
        });
    });

    it('应该返回401 当未提供token时', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/sessions/${sessionId}/join`)
        .expect(401);
    });
  });
});
