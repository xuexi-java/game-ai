/**
 * API 配置
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
// Socket.IO 使用 HTTP URL，不是 WebSocket URL
export const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

