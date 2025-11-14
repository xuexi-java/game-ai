/**
 * 消息服务
 */
import apiClient from './api';

export interface CreateMessageRequest {
  sessionId: string;
  content: string;
  messageType?: 'TEXT' | 'IMAGE';
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
 * 发送玩家消息
 */
export const sendPlayerMessage = async (
  data: CreateMessageRequest
): Promise<Message> => {
  return apiClient.post('/messages/player', data);
};

/**
 * 获取会话消息列表
 */
export const getSessionMessages = async (
  sessionId: string
): Promise<Message[]> => {
  return apiClient.get(`/messages/session/${sessionId}`);
};

