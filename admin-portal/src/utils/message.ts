import type { MessageInstance } from 'antd/es/message/interface';
import { message as antdMessage } from 'antd';

/**
 * 全局 message 实例引用
 * 用于在非 React 组件中使用（如 axios 拦截器）
 */
let globalMessageInstance: MessageInstance | null = null;

/**
 * 设置全局 message 实例
 */
export const setGlobalMessage = (message: MessageInstance) => {
  globalMessageInstance = message;
};

/**
 * 获取全局 message 实例
 * 如果未设置，则回退到静态方法（会有警告，但不影响功能）
 */
export const getGlobalMessage = (): MessageInstance => {
  if (globalMessageInstance) {
    return globalMessageInstance;
  }
  return antdMessage;
};

