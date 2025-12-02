import apiClient from './api';

export interface IssueType {
  id: string;
  name: string;
  description?: string;
  priorityWeight: number;
  icon?: string;
  sortOrder: number;
  requireDirectTransfer?: boolean;
}

// 获取启用的问题类型列表
export const getEnabledIssueTypes = async (): Promise<IssueType[]> => {
  const response = await apiClient.get<IssueType[]>('/issue-types');
  // apiClient 的响应拦截器已经处理了 { success: true, data: [...] } 格式
  // 直接返回数组
  return Array.isArray(response) ? response : [];
};
