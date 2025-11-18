import { App } from 'antd';
import type { MessageInstance } from 'antd/es/message/interface';

/**
 * 通过 App Context 获取 message，防止静态调用产生的警告
 */
export const useMessage = (): MessageInstance => {
  const { message } = App.useApp();
  return message;
};

