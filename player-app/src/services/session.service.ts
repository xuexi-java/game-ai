/**
 * 会话服务
 */
import apiClient from './api';
import type { Session, Message } from '../types';

export interface CreateSessionRequest {
  ticketId: string;
}

// 重新导出类型以保持向后兼容
export type { Session, Message };

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

export interface TransferResult {
  queued: boolean;
  queuePosition?: number;
  estimatedWaitTime?: number;
  message?: string;
  ticketNo?: string;
}

/**
 * 转人工客服
 */
export const transferToAgent = async (
  sessionId: string,
  urgency: 'URGENT' | 'NON_URGENT' = 'URGENT',
): Promise<TransferResult> => {
  return apiClient.post(`/sessions/${sessionId}/transfer-to-agent`, {
    urgency,
  });
};

export const closeSession = async (sessionId: string): Promise<Session> => {
  return apiClient.patch(`/sessions/${sessionId}/close-player`, {});
};
