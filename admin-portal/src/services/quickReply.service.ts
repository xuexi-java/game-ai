/**
 * 快捷回复服务（新设计）
 */
import apiClient from './api';

export interface QuickReplyGroup {
  id: number;
  name: string;
  sortOrder: number;
  gameId?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  game?: {
    id: string;
    name: string;
  } | null;
  items: QuickReplyItem[];
}

export interface QuickReplyItem {
  id: number;
  content: string;
  shortcut?: string | null;
  sortOrder: number;
  usageCount: number;
  groupId: number;
  createdAt: string;
  updatedAt: string;
  group?: QuickReplyGroup;
}

export interface CreateQuickReplyGroupDto {
  name: string;
  sortOrder?: number;
  gameId?: string;
  enabled?: boolean;
}

export interface UpdateQuickReplyGroupDto {
  name?: string;
  sortOrder?: number;
  gameId?: string;
  enabled?: boolean;
}

export interface CreateQuickReplyItemDto {
  content: string;
  groupId: number;
  shortcut?: string;
  sortOrder?: number;
}

export interface UpdateQuickReplyItemDto {
  content?: string;
  groupId?: number;
  shortcut?: string;
  sortOrder?: number;
}

/**
 * 获取指定游戏的快捷回复（按分组聚合）
 */
export async function getQuickReplies(gameId?: string): Promise<QuickReplyGroup[]> {
  const params = gameId ? { gameId } : {};
  const response = await apiClient.get('/quick-replies', { params });
  return Array.isArray(response) ? response : [];
}

/**
 * 搜索快捷回复
 */
export async function searchQuickReplies(query: string, gameId?: string): Promise<QuickReplyItem[]> {
  const params: any = { q: query };
  if (gameId) {
    params.gameId = gameId;
  }
  const response = await apiClient.get('/quick-replies/search', { params });
  return Array.isArray(response) ? response : [];
}

/**
 * 根据快捷键查找快捷回复
 */
export async function getQuickReplyByShortcut(shortcut: string, gameId?: string): Promise<QuickReplyItem | null> {
  const params = gameId ? { gameId } : {};
  const response = await apiClient.get(`/quick-replies/shortcut/${shortcut}`, { params });
  return response || null;
}

/**
 * 增加使用次数
 */
export async function incrementQuickReplyUsage(id: number): Promise<void> {
  await apiClient.post(`/quick-replies/items/${id}/increment-usage`);
}

// ==================== 分组管理（仅管理员）====================

/**
 * 创建分组
 */
export async function createQuickReplyGroup(data: CreateQuickReplyGroupDto): Promise<QuickReplyGroup> {
  const response = await apiClient.post('/quick-replies/groups', data);
  return response;
}

/**
 * 获取所有分组
 */
export async function getQuickReplyGroups(gameId?: string): Promise<QuickReplyGroup[]> {
  const params = gameId ? { gameId } : {};
  const response = await apiClient.get('/quick-replies/groups', { params });
  return Array.isArray(response) ? response : [];
}

/**
 * 获取单个分组
 */
export async function getQuickReplyGroup(id: number): Promise<QuickReplyGroup> {
  const response = await apiClient.get(`/quick-replies/groups/${id}`);
  return response;
}

/**
 * 更新分组
 */
export async function updateQuickReplyGroup(id: number, data: UpdateQuickReplyGroupDto): Promise<QuickReplyGroup> {
  const response = await apiClient.patch(`/quick-replies/groups/${id}`, data);
  return response;
}

/**
 * 删除分组
 */
export async function deleteQuickReplyGroup(id: number): Promise<void> {
  await apiClient.delete(`/quick-replies/groups/${id}`);
}

// ==================== 回复项管理（仅管理员）====================

/**
 * 创建回复项
 */
export async function createQuickReplyItem(data: CreateQuickReplyItemDto): Promise<QuickReplyItem> {
  const response = await apiClient.post('/quick-replies/items', data);
  return response;
}

/**
 * 获取单个回复项
 */
export async function getQuickReplyItem(id: number): Promise<QuickReplyItem> {
  const response = await apiClient.get(`/quick-replies/items/${id}`);
  return response;
}

/**
 * 更新回复项
 */
export async function updateQuickReplyItem(id: number, data: UpdateQuickReplyItemDto): Promise<QuickReplyItem> {
  const response = await apiClient.patch(`/quick-replies/items/${id}`, data);
  return response;
}

/**
 * 删除回复项
 */
export async function deleteQuickReplyItem(id: number): Promise<void> {
  await apiClient.delete(`/quick-replies/items/${id}`);
}
