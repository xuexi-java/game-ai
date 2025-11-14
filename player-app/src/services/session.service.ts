/**
 * 会话服务
 */
import apiClient from './api';

export interface CreateSessionRequest {
  ticketId: string;
}

export interface Session {
  id: string;
  ticketId: string;
  status: 'PENDING' | 'QUEUED' | 'IN_PROGRESS' | 'CLOSED';
  detectedIntent?: string;
  aiUrgency?: 'URGENT' | 'NON_URGENT';
  priorityScore?: number;
  queuedAt?: string;
  agentId?: string;
  ticket: {
    id: string;
    ticketNo: string;
    game: {
      id: string;
      name: string;
    };
    server: {
      id: string;
      name: string;
    };
    playerIdOrName: string;
    description: string;
  };
  messages?: Message[];
}

export interface Message {
  id: string;
  sessionId: string;
  senderType: 'PLAYER' | 'AGENT' | 'AI' | 'SYSTEM';
  messageType: 'TEXT' | 'IMAGE' | 'SYSTEM_NOTICE';
  content: string;
  metadata?: any;
  createdAt: string;
}

/**
 * 创建会话
 */
export const createSession = async (
  data: CreateSessionRequest
): Promise<Session> => {
  return apiClient.post('/sessions', data);
};

/**
 * 获取会话详情
 */
export const getSession = async (sessionId: string): Promise<Session> => {
  return apiClient.get(`/sessions/${sessionId}`);
};

/**
 * 转人工客服
 */
export const transferToAgent = async (sessionId: string): Promise<Session> => {
  return apiClient.post(`/sessions/${sessionId}/transfer`, {});
};

