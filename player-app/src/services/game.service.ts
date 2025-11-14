/**
 * 游戏服务
 */
import apiClient from './api';

export interface Game {
  id: string;
  name: string;
  icon?: string;
  enabled: boolean;
}

/**
 * 获取已启用的游戏列表
 */
export const getEnabledGames = async (): Promise<Game[]> => {
  return apiClient.get('/games/enabled');
};

