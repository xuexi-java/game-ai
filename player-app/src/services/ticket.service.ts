/**
 * 工单服务
 */
import apiClient from './api';
import type { TicketDetail } from '../types';

export interface CheckOpenTicketRequest {
  gameId: string;
  serverId?: string;
  serverName?: string;
  playerIdOrName: string;
}

export interface CheckOpenTicketResponse {
  hasOpenTicket: boolean;
  ticket?: {
    id: string;
    ticketNo: string;
    token: string;
  } | null;
}

export interface CreateTicketRequest {
  gameId: string;
  serverId?: string;
  serverName?: string;
  playerIdOrName: string;
  description: string;
  occurredAt?: string;
  paymentOrderNo?: string;
  attachments?: string[];
  issueTypeIds: string[]; // 新增：问题类型 IDs
}

export interface CreateTicketResponse {
  id?: string;
  ticketId?: string;
  ticketNo: string;
  token: string;
}

/**
 * 检查是否有未关闭的工单
 */
export const checkOpenTicket = async (
  data: CheckOpenTicketRequest
): Promise<CheckOpenTicketResponse> => {
  return apiClient.post('/tickets/check-open', data);
};

/**
 * 检查是否有相同问题类型的未完成工单
 */
export const checkOpenTicketByIssueType = async (data: {
  gameId: string;
  serverId: string;
  playerIdOrName: string;
  issueTypeId: string;
}): Promise<CheckOpenTicketResponse> => {
  return apiClient.post('/tickets/check-open-by-issue-type', data);
};

/**
 * 创建新工单
 */
export const createTicket = async (
  data: CreateTicketRequest
): Promise<CreateTicketResponse> => {
  return apiClient.post('/tickets', data);
};

/**
 * 根据 token 获取工单信息
 */
export const getTicketByToken = async (token: string): Promise<TicketDetail> => {
  return apiClient.get(`/tickets/by-token/${token}`);
};

