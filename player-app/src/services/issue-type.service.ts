import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

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
  const response = await axios.get(`${API_BASE_URL}/issue-types`);
  // 后端返回格式：{ success: true, data: [...] }
  return response.data.data || response.data;
};
