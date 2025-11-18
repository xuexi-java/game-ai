/**
 * 公共类型定义
 */

export interface Message {
  id: string;
  sessionId: string;
  senderType: 'PLAYER' | 'AGENT' | 'AI' | 'SYSTEM';
  messageType: 'TEXT' | 'IMAGE' | 'SYSTEM_NOTICE';
  content: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface GameServer {
  id: string;
  name: string;
  enabled: boolean;
}

export interface Game {
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
  servers?: GameServer[];
}

export interface TicketAttachment {
  id: string;
  fileUrl: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  createdAt?: string;
}

export interface SessionTicket {
  id: string;
  ticketNo: string;
  game?: {
    id: string;
    name: string;
  } | null;
  server?: {
    id: string;
    name: string;
  } | null;
  playerIdOrName: string;
  description: string;
  occurredAt?: string | null;
  createdAt: string;
  attachments?: TicketAttachment[];
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
  difyStatus?: string | null;
  allowManualTransfer?: boolean;
  ticket: SessionTicket;
  messages?: Message[];
}

export type TicketStatus =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'WAITING'
  | 'RESOLVED'
  | 'CLOSED';

export interface TicketDetail {
  id: string;
  ticketNo: string;
  status: TicketStatus;
  description: string;
  playerIdOrName: string;
  game?: {
    id: string;
    name: string;
  };
  server?: {
    id: string;
    name: string;
  } | null;
  attachments?: Array<{
    id: string;
    fileUrl: string;
    fileName: string;
    fileType?: string;
  }>;
  [key: string]: unknown;
}
