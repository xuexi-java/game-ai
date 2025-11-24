import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Button,
  Tag,
  Space,
  Typography,
  Input,
  Image,
  message,
  Spin,
  Upload,
} from 'antd';
import {
  MessageOutlined,
  SendOutlined,
  CloseOutlined,
  PaperClipOutlined,
  SmileOutlined,
  FolderOutlined,
  CopyOutlined,
  RobotOutlined,
  UserAddOutlined,
  UserOutlined,
  CustomerServiceOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useSessionStore } from '../../stores/sessionStore';
import { useAgentStore } from '../../stores/agentStore';
import { useAuthStore } from '../../stores/authStore';
import type { Session, Message } from '../../types';
import './ActivePage.css';
import {
  API_BASE_URL,
  DIFY_API_KEY,
  DIFY_BASE_URL,
  DIFY_APP_MODE,
  DIFY_WORKFLOW_ID,
  AGENT_STATUS_POLL_INTERVAL,
} from '../../config/api';
import { getOnlineAgents } from '../../services/user.service';
import {
  getActiveSessions,
  getQueuedSessions,
  getSessionById,
  joinSession,
  closeSession,
} from '../../services/session.service';
import { websocketService } from '../../services/websocket.service';
import { uploadTicketAttachment } from '../../services/upload.service';

const { TextArea } = Input;
const { Text } = Typography;
const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
const COLLAPSE_STORAGE_KEY = 'workbench_collapsed_sections';

const resolveMediaUrl = (url?: string) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  const normalized = url.startsWith('/') ? url : `/${url}`;
  return `${API_ORIGIN}${normalized}`;
};

// 判断是否为文件URL
const isFileUrl = (content: string) => {
  return /\/uploads\//.test(content) || /\.(pdf|doc|docx|xls|xlsx|txt|zip|rar)$/i.test(content);
};

// 获取文件名
const getFileName = (url: string) => {
  const match = url.match(/\/([^\/]+)$/);
  return match ? match[1] : '文件';
};

const SESSION_STATUS_META: Record<
  string,
  { label: string; color: string; description?: string }
> = {
  PENDING: { label: '待分配', color: 'default', description: 'AI 处理中' },
  QUEUED: { label: '排队中', color: 'orange', description: '等待客服接入' },
  IN_PROGRESS: { label: '进行中', color: 'green', description: '客服处理中' },
  CLOSED: { label: '已结束', color: 'default', description: '会话已结束' },
};

const TICKET_STATUS_META: Record<string, { label: string; color: string }> = {
  WAITING: { label: '待人工', color: 'orange' },
  IN_PROGRESS: { label: '处理中', color: 'processing' },
  RESOLVED: { label: '已解决', color: 'green' },
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  return dayjs(value).format('YYYY-MM-DD HH:mm:ss');
};

const ActivePage: React.FC = () => {
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [aiOptimizing, setAiOptimizing] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const lastManualInputRef = useRef('');
  const aiOptimizedRef = useRef(false);
  const currentSessionRef = useRef<Session | null>(null);
  
  // 布局调整相关状态
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(360);
  const isResizingLeft = useRef(false);
  const isResizingRight = useRef(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const [collapsedSections, setCollapsedSections] = useState(() => {
    if (typeof window === 'undefined') {
      return { queued: false, active: false };
    }
    try {
      const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
      return stored ? JSON.parse(stored) : { queued: false, active: false };
    } catch (error) {
      console.warn('读取面板折叠状态失败', error);
      return { queued: false, active: false };
    }
  });
  const toggleSection = (key: 'queued' | 'active') => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const {
    activeSessions,
    setActiveSessions,
    queuedSessions,
    setQueuedSessions,
    currentSession,
    setCurrentSession,
    sessionMessages,
    setSessionMessages,
    updateSession,
  } = useSessionStore();
  const onlineAgents = useAgentStore((state) => state.onlineAgents);
  const setOnlineAgents = useAgentStore((state) => state.setOnlineAgents);
  const authUser = useAuthStore((state) => state.user);
  const ticketInfo = currentSession?.ticket;
  const attachmentList = ticketInfo?.attachments ?? [];
  const sessionStatusMeta = currentSession
    ? SESSION_STATUS_META[currentSession.status] || {
        label: currentSession.status,
        color: 'default',
      }
    : null;
  const ticketStatusMeta = ticketInfo?.status
    ? TICKET_STATUS_META[ticketInfo.status] || {
        label: ticketInfo.status,
        color: 'default',
      }
    : null;
  const fallbackIssueTypes =
    ticketInfo?.ticketIssueTypes
      ?.map((item) => item.issueType?.name)
      .filter((name): name is string => Boolean(name)) ?? [];

  const ticketIssueTypes = ticketInfo?.issueTypes?.map((it) => it.name) ?? fallbackIssueTypes;

  useEffect(() => {
    let mounted = true;

    const fetchOnlineAgents = async () => {
      try {
        const agents = await getOnlineAgents();
        if (mounted) {
          setOnlineAgents(agents);
        }
      } catch (error) {
        console.error('加载在线客服失败', error);
      }
    };

    fetchOnlineAgents();
    const intervalId = window.setInterval(
      fetchOnlineAgents,
      AGENT_STATUS_POLL_INTERVAL,
    );

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [setOnlineAgents]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionsError(null);
    try {
      const [queued, active] = await Promise.all([
        getQueuedSessions(),
        getActiveSessions(),
      ]);
      setQueuedSessions(queued);
      setActiveSessions(active);
      const merged = [...active, ...queued];
      const previous = currentSessionRef.current;
      let next: Session | null = null;
      if (previous) {
        next = merged.find((item) => item.id === previous.id) || null;
      }
      if (!next) {
        next = active[0] || queued[0] || null;
      }
      setCurrentSession(next);
      currentSessionRef.current = next || null;
      if (next) {
        const { sessionMessages: cachedMessages } = useSessionStore.getState();
        // 总是重新加载消息，确保获取最新的完整消息列表
        try {
          const detail = await getSessionById(next.id);
          setCurrentSession(detail);
          currentSessionRef.current = detail;
          // 确保消息按时间排序
          const sortedMessages = (detail.messages ?? []).sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setSessionMessages(next.id, sortedMessages);
        } catch (error) {
          console.error('加载会话详情失败', error);
        }
      }
    } catch (error) {
      console.error('加载会话失败', error);
      setSessionsError('加载会话失败，请稍后重试');
      message.error('加载会话失败，请稍后重试');
    } finally {
      setLoadingSessions(false);
    }
  }, [setQueuedSessions, setActiveSessions, setCurrentSession, setSessionMessages]);

  // 拖拽调整左侧面板宽度
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft.current && leftPanelRef.current) {
        const newWidth = e.clientX;
        if (newWidth >= 200 && newWidth <= 600) {
          setLeftPanelWidth(newWidth);
        }
      }
      if (isResizingRight.current && rightPanelRef.current) {
        const newWidth = window.innerWidth - e.clientX;
        if (newWidth >= 200 && newWidth <= 600) {
          setRightPanelWidth(newWidth);
        }
      }
    };

    const handleMouseUp = () => {
      isResizingLeft.current = false;
      isResizingRight.current = false;
    };

    if (isResizingLeft.current || isResizingRight.current) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizingLeft.current, isResizingRight.current]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // 监听会话关闭事件，自动刷新会话列表
  useEffect(() => {
    const handleSessionClosed = (event: CustomEvent<string>) => {
      const closedSessionId = event.detail;
      console.log('会话已关闭:', closedSessionId);
      // 如果当前会话被关闭，清空当前会话
      if (currentSession?.id === closedSessionId) {
        setCurrentSession(null);
        currentSessionRef.current = null;
        setSessionMessages(closedSessionId, []);
      }
      // 刷新会话列表
      loadSessions();
    };

    window.addEventListener('session-closed', handleSessionClosed as EventListener);
    return () => {
      window.removeEventListener('session-closed', handleSessionClosed as EventListener);
    };
  }, [currentSession, loadSessions]);

  useEffect(() => {
    currentSessionRef.current = currentSession || null;
    
    // 当切换会话时，确保加载消息
    if (currentSession && currentSession.id) {
      const cachedMessages = sessionMessages[currentSession.id];
      // 如果没有缓存的消息，或者消息数量为0，重新加载
      if (!cachedMessages || cachedMessages.length === 0) {
        console.log('会话切换，重新加载消息:', currentSession.id);
        handleOpenChat(currentSession).catch((error) => {
          console.error('加载会话消息失败:', error);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSession?.id]); // 只依赖会话ID，避免重复加载

  const handleOpenChat = useCallback(
    async (session: Session) => {
      // 先设置会话，即使加载失败也能显示基本信息
      setCurrentSession(session);
      currentSessionRef.current = session;
      
      // 总是重新加载消息，确保获取最新的完整消息列表
      try {
        const detail = await getSessionById(session.id);
        console.log('加载会话详情:', detail.id, '消息数量:', detail.messages?.length || 0);
        
        // 更新会话信息
        setCurrentSession(detail);
        currentSessionRef.current = detail;
        
        // 确保消息按时间排序
        const sortedMessages = (detail.messages ?? []).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        console.log('设置消息列表，数量:', sortedMessages.length);
        setSessionMessages(session.id, sortedMessages);
        
        // 如果会话已接入，加入WebSocket房间以接收实时消息
        if (detail.status === 'IN_PROGRESS' && detail.agentId === authUser?.id) {
          await websocketService.joinSession(session.id);
        }
      } catch (error) {
        console.error('加载会话详情失败', error);
        message.error('加载会话详情失败');
        // 即使加载失败，也尝试使用会话中的消息（如果有）
        if (session.messages && session.messages.length > 0) {
          const sortedMessages = [...session.messages].sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
          setSessionMessages(session.id, sortedMessages);
        }
      }
    },
    [setCurrentSession, setSessionMessages, authUser?.id],
  );

  const handleInputChange = (value: string) => {
    setMessageInput(value);
    if (!aiOptimizedRef.current) {
      lastManualInputRef.current = value;
    }
  };

  const handleSendMessage = async () => {
    if (!currentSession || !messageInput.trim()) return;

    // 检查会话是否已接入（状态为 IN_PROGRESS 且 agentId 匹配当前用户）
    // 使用 ref 中的最新会话信息，如果 ref 中没有则使用 currentSession
    let sessionToUse = currentSessionRef.current || currentSession;
    let isJoined = 
      sessionToUse.status === 'IN_PROGRESS' && 
      sessionToUse.agentId === authUser?.id;

    // 如果检查失败，尝试重新获取会话信息（可能状态还没有更新）
    if (!isJoined) {
      try {
        const detail = await getSessionById(currentSession.id);
        if (detail.status === 'IN_PROGRESS' && detail.agentId === authUser?.id) {
          // 会话已接入，更新当前会话并继续发送
          setCurrentSession(detail);
          currentSessionRef.current = detail;
          sessionToUse = detail;
          isJoined = true;
        } else {
          message.warning('请先接入会话后才能发送消息');
          return;
        }
      } catch (error) {
        console.error('获取会话信息失败:', error);
        message.warning('请先接入会话后才能发送消息');
        return;
      }
    }
    
    if (!isJoined) {
      message.warning('请先接入会话后才能发送消息');
      return;
    }

    const content = messageInput.trim();
    setMessageInput('');
    setSendingMessage(true);

    try {
      // 先添加临时消息（乐观更新）
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        sessionId: sessionToUse.id,
        senderType: 'AGENT',
        messageType: 'TEXT',
        content,
        createdAt: new Date().toISOString(),
        metadata: {},
      };
      setSessionMessages(sessionToUse.id, [
        ...(sessionMessages[sessionToUse.id] || []),
        tempMessage,
      ]);

      // 通过WebSocket发送消息
      const result = await websocketService.sendAgentMessage(sessionToUse.id, content);

      if (!result.success) {
        // 发送失败，移除临时消息
        const currentMessages = sessionMessages[sessionToUse.id] || [];
        setSessionMessages(sessionToUse.id, currentMessages.filter(m => m.id !== tempMessage.id));
        message.error(result.error || '发送消息失败');
      }
      // 如果成功，WebSocket会收到服务器返回的真实消息，临时消息会被替换
    } catch (error: any) {
      console.error('发送消息失败:', error);
      // 移除临时消息
      const sessionIdToUse = sessionToUse?.id || currentSession?.id;
      if (sessionIdToUse) {
        const currentMessages = sessionMessages[sessionIdToUse] || [];
        setSessionMessages(sessionIdToUse, currentMessages.filter(m => m.id !== tempMessage.id));
      }
      message.error('发送消息失败，请重试');
    } finally {
      setSendingMessage(false);
      aiOptimizedRef.current = false;
      lastManualInputRef.current = '';
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!currentSession || !currentSession.ticket?.id) {
      message.warning('请先选择会话');
      return false;
    }

    const isJoined = 
      currentSession.status === 'IN_PROGRESS' && 
      currentSession.agentId === authUser?.id;

    if (!isJoined) {
      message.warning('请先接入会话后才能发送文件');
      return false;
    }

    setUploadingFile(true);
    try {
      // 上传文件
      const uploadResult = await uploadTicketAttachment(file, {
        ticketId: currentSession.ticket.id,
      });

      // 判断文件类型
      const isImage = file.type.startsWith('image/') || 
        /\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name);
      
      // 先添加临时消息（乐观更新）
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        sessionId: currentSession.id,
        senderType: 'AGENT',
        messageType: isImage ? 'IMAGE' : 'TEXT',
        content: uploadResult.fileUrl,
        createdAt: new Date().toISOString(),
        metadata: {},
      };
      setSessionMessages(currentSession.id, [
        ...(sessionMessages[currentSession.id] || []),
        tempMessage,
      ]);
      
      // 通过WebSocket发送消息
      const result = await websocketService.sendAgentMessage(
        currentSession.id, 
        uploadResult.fileUrl,
        isImage ? 'IMAGE' : 'TEXT'
      );

      if (!result.success) {
        // 发送失败，移除临时消息
        const currentMessages = sessionMessages[currentSession.id] || [];
        setSessionMessages(currentSession.id, currentMessages.filter(m => m.id !== tempMessage.id));
        message.error(result.error || '发送文件失败');
        return false;
      }

      message.success('文件发送成功');
      return false; // 阻止默认上传行为
    } catch (error: any) {
      console.error('文件上传失败:', error);
      message.error(error?.message || '文件上传失败');
      return false;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleJoinSession = async (session: Session) => {
    if (!session || !session.id) {
      message.error('会话信息无效');
      return;
    }

    try {
      const updatedSession = await joinSession(session.id);
      message.success('接入会话成功');
      
      // 立即更新当前会话（如果当前选中的是这个会话）
      if (currentSession?.id === session.id) {
        // 直接使用返回的更新后的会话信息
        const enrichedSession = {
          ...updatedSession,
          status: 'IN_PROGRESS' as const,
          agentId: updatedSession.agentId || authUser?.id,
        };
        setCurrentSession(enrichedSession);
        currentSessionRef.current = enrichedSession;
        
        // 更新会话列表中的会话
        updateSession(session.id, {
          status: 'IN_PROGRESS',
          agentId: updatedSession.agentId || authUser?.id,
        });
        
        // 加载消息
        const sortedMessages = (updatedSession.messages ?? []).sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setSessionMessages(session.id, sortedMessages);
      }
      
      // 加入WebSocket会话房间
      await websocketService.joinSession(session.id);
      
      // 刷新会话列表（在更新当前会话之后）
      await loadSessions();
    } catch (error: any) {
      console.error('接入会话失败:', error);
      message.error(error?.response?.data?.message || '接入会话失败，请重试');
    }
  };

  const handleCloseSession = async () => {
    if (!currentSession) {
      message.warning('请先选择一个会话');
      return;
    }

    try {
      await closeSession(currentSession.id);
      message.success('会话已结束');
      // 刷新会话列表
      await loadSessions();
      // 清空当前会话
      setCurrentSession(null);
      currentSessionRef.current = null;
      setSessionMessages(currentSession.id, []);
    } catch (error: any) {
      console.error('结束会话失败:', error);
      message.error(error?.response?.data?.message || '结束会话失败，请重试');
    }
  };

  const handleUndoAiOptimization = useCallback(() => {
    if (!aiOptimizedRef.current) return;
    setMessageInput(lastManualInputRef.current);
    aiOptimizedRef.current = false;
    message.info('已恢复AI优化前的文本');
  }, []);

  const handleAiOptimize = useCallback(async () => {
    const content = messageInput.trim();
    if (!content) {
      message.warning('请输入需要优化的内容');
      return;
    }
    
    // 强制使用最新的配置值（避免缓存问题）
    // 直接硬编码最新的API Key，确保不会被缓存影响
    const currentApiKey = 'app-mHw0Fsjq0pzuYZwrqDxoYLA6';
    const currentBaseUrl = 'http://118.89.16.95/v1';
    const currentAppMode = 'chat' as 'chat' | 'workflow';
    
    // 验证API Key格式
    if (!currentApiKey || !currentApiKey.startsWith('app-')) {
      message.error('Dify API Key 格式错误，无法执行AI优化');
      return;
    }
    
    if (!currentBaseUrl) {
      message.error('Dify Base URL 缺失，无法执行AI优化');
      return;
    }

    // 开发环境显示配置信息
    if (import.meta.env.DEV) {
      console.log('当前使用的Dify配置（强制使用最新值）:', {
        apiKey: currentApiKey,
        apiKeyLength: currentApiKey.length,
        baseUrl: currentBaseUrl,
        appMode: currentAppMode,
        timestamp: new Date().toISOString(),
      });
    }

    const difyUser = authUser?.id || authUser?.username || 'agent';

    lastManualInputRef.current = messageInput;
    setAiOptimizing(true);
    try {
      const normalizedBase = currentBaseUrl.replace(/\/$/, '');
      const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${currentApiKey}`,
      };

      let apiEndpoint: string;
      let payload: Record<string, any>;

      // 根据公共访问URL是 /chat/ 开头，直接使用chat API
      // 因为API Key是app-开头，已经关联了chat应用，不需要额外配置
      let useChatAPI = true;
      
      // 直接使用chat API（与后端sendChatMessage方法保持一致）
      apiEndpoint = `${normalizedBase}/chat-messages`;
        payload = {
        inputs: {},
        query: `请优化以下客服回复内容，使其更加专业和友好：\n${content}`,
        response_mode: 'blocking',
          user: difyUser,
        };
      
      // 开发环境显示实际请求信息
      if (import.meta.env.DEV) {
        console.log('实际发送的Dify请求:', {
          endpoint: apiEndpoint,
          apiKey: currentApiKey,
          apiKeyLength: currentApiKey?.length || 0,
          apiKeyPrefix: currentApiKey?.substring(0, 4) || 'N/A',
          headers: { ...headers, Authorization: `Bearer ${currentApiKey.substring(0, 15)}...` },
          payload,
        });
      }
      

      let response = await fetch(apiEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      // 开发环境：记录响应状态和错误详情
      if (import.meta.env.DEV) {
        console.log('Dify API响应状态:', {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
        });
      }

      // 如果chat API返回401，检查API Key是否正确
      if (!response.ok && response.status === 401) {
        if (import.meta.env.DEV) {
          console.error('Chat API认证失败，请检查API Key是否正确:', {
            apiKey: currentApiKey ? `${currentApiKey.substring(0, 15)}...` : '未配置',
            fullApiKey: currentApiKey, // 显示完整API Key用于调试
            endpoint: apiEndpoint,
            baseUrl: currentBaseUrl,
          });
        }
      }

      if (!response.ok) {
        let errorMessage = 'AI优化请求失败';
        let errorDetails: any = null;
        
        try {
          const errorData = await response.json();
          errorDetails = errorData;
          errorMessage =
            errorData?.message ||
            errorData?.error ||
            errorData?.detail ||
            errorMessage;
        } catch {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
        }
        }
        
        // 如果是401错误，提供更详细的错误信息和解决方案
        if (response.status === 401) {
          if (import.meta.env.DEV) {
            console.error('Dify API 401错误详情:', {
              endpoint: apiEndpoint,
              apiKey: currentApiKey ? `${currentApiKey.substring(0, 15)}...` : '未配置',
              fullApiKey: currentApiKey, // 仅在开发环境显示完整API Key用于调试
              mode: currentAppMode,
              baseUrl: currentBaseUrl,
              errorDetails,
            });
          }
          
          // 401错误：认证失败
          const apiKeyPreview = currentApiKey 
            ? `${currentApiKey.substring(0, 15)}...` 
            : '未配置';
          const errorMsg = `认证失败 (401): ${errorMessage}。\n\n请检查：\n1. Dify API Key (${apiKeyPreview}) 是否正确\n2. API Key 是否已启用并具有访问权限\n3. Dify Base URL (${currentBaseUrl}) 是否正确\n4. 应用是否已发布`;
          throw new Error(errorMsg);
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // 解析API的响应（参考后端parseDifyResult逻辑）
      let optimizedText = '';
      
      if (useChatAPI) {
        // chat API返回格式：data.answer 或 data.text
        optimizedText =
          data.answer ||
          data.text ||
          data.output ||
          data.content ||
          '';
      } else if (DIFY_APP_MODE === 'workflow' && DIFY_WORKFLOW_ID) {
        // workflow API返回格式：data.outputs 或 data.data.outputs
        const output = data.outputs || data.data?.outputs || data;
        
        // 尝试从output中提取文本
        optimizedText =
          output.text ||
          output.answer ||
          output.output ||
          output.initial_reply ||
          output.content ||
        '';

        // 如果output是数组，查找文本类型的输出
        if (!optimizedText && Array.isArray(output)) {
          const textOutput = output.find((item: any) => {
          if (typeof item === 'string') return true;
          if (item?.type === 'text' && typeof item?.text === 'string') {
            return true;
          }
          return false;
        });
        if (typeof textOutput === 'string') {
          optimizedText = textOutput.trim();
        } else if (textOutput?.text) {
          optimizedText = String(textOutput.text).trim();
        }
      }

        // 如果output是对象，尝试从各种字段获取
        if (!optimizedText && typeof output === 'object' && !Array.isArray(output)) {
          optimizedText = output.text || output.answer || output.output || '';
        }
      } else {
        // 默认chat API格式
        optimizedText =
          data.text ||
          data.answer ||
          data.output ||
          data.content ||
          '';
      }

      if (!optimizedText || !optimizedText.trim()) {
        throw new Error('AI未返回优化后的文本');
      }

      setMessageInput(optimizedText);
      aiOptimizedRef.current = true;
      message.success('AI优化完成，已写入输入框');
    } catch (error: any) {
      setMessageInput(lastManualInputRef.current);
      message.error(error?.message || 'AI优化失败，请稍后重试');
    } finally {
      setAiOptimizing(false);
    }
  }, [
    authUser?.id,
    authUser?.username,
    currentSession,
    messageInput,
    ticketInfo,
    ticketIssueTypes,
    updateSession,
  ]);

  const getDurationText = (startTime?: string) => {
    if (!startTime) return '-';
    const duration = dayjs().diff(dayjs(startTime), 'minute');
    if (duration < 60) return `${duration}分钟`;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return `${hours}小时${minutes}分钟`;
  };

  const getSessionDuration = (session: Session) =>
    getDurationText(session.startedAt || session.queuedAt || session.createdAt);

  const getWaitingDuration = (session: Session) =>
    getDurationText(session.queuedAt || session.createdAt);

  const getQueueSummary = (session: Session) => {
    const position = session.queuePosition ?? null;
    const estimated =
      session.estimatedWaitTime ??
      (position && position > 0 ? Math.max(position * 5, 3) : null);
    if (position && estimated) {
      return `第 ${position} 位 · 约 ${estimated} 分钟`;
    }
    if (position) {
      return `第 ${position} 位 · 排队中`;
    }
    return `等待 ${getWaitingDuration(session)}`;
  };

  const getAssignedLabel = (session: Session) =>
    session.agent
      ? `分配：${session.agent.realName || session.agent.username}`
      : '等待系统分配';

  const canJoinQueuedSession = (session: Session) => {
    if (session.status !== 'QUEUED') {
      return false;
    }
    const assignedToCurrent = session.agentId === authUser?.id;
    if (authUser?.role === 'AGENT') {
      return assignedToCurrent;
    }
    if (authUser?.role === 'ADMIN') {
      return assignedToCurrent;
    }
    return false;
  };

  const currentMessages =
    (currentSession && sessionMessages[currentSession.id]) || [];

  // 确保消息按时间排序（升序，最早的在前面）
  const sortedMessages = [...currentMessages].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  // 合并所有消息，统一按时间排序显示
  const allMessages = sortedMessages;
  const isAdmin = authUser?.role === 'ADMIN';
  const isAgentRole = authUser?.role === 'AGENT';

  const sessionTimeline = useMemo(() => {
    if (!currentSession) return [];
    const events: Array<{
      key: string;
      label: string;
      timestamp?: string;
      description?: string;
    }> = [];
    if (currentSession.ticket?.createdAt) {
      events.push({
        key: 'ticket-created',
        label: '工单提交',
        timestamp: currentSession.ticket.createdAt,
      });
    }
    if (currentSession.createdAt) {
      events.push({
        key: 'session-created',
        label: '会话创建',
        timestamp: currentSession.createdAt,
      });
    }
    if (currentSession.transferAt) {
      events.push({
        key: 'session-transfer',
        label: '已申请人工服务',
        timestamp: currentSession.transferAt,
        description: currentSession.transferReason || '用户请求人工协助',
      });
    }
    if (currentSession.queuedAt) {
      events.push({
        key: 'session-queued',
        label: '进入排队',
        timestamp: currentSession.queuedAt,
      });
    }
    if (currentSession.startedAt) {
      events.push({
        key: 'session-started',
        label: '客服已接入',
        timestamp: currentSession.startedAt,
        description:
          currentSession.agent?.realName || currentSession.agent?.username,
      });
    }
    if (currentSession.closedAt) {
      events.push({
        key: 'session-closed',
        label: '会话结束',
        timestamp: currentSession.closedAt,
      });
    }
    return events;
  }, [currentSession]);

  return (
    <div className="workbench-page">
      <div className="workbench-layout">
        <section 
          className="workbench-list-panel"
          ref={leftPanelRef}
          style={{ width: `${leftPanelWidth}px` }}
        >
          <div
            className="resize-handle resize-handle-right"
            onMouseDown={(e) => {
              e.preventDefault();
              isResizingLeft.current = true;
            }}
          />
          <header className="panel-header">
            <div>
              <div className="panel-title">
                会话 <span>共 {queuedSessions.length + activeSessions.length} 人</span>
              </div>
            </div>
            <Button
              type="primary"
              icon={<MessageOutlined />}
              onClick={loadSessions}
              loading={loadingSessions}
            >
              刷新列表
            </Button>
          </header>
          {sessionsError && <div className="session-error">{sessionsError}</div>}

          {isAdmin && (
            <div className="online-agents-panel">
              <div className="online-agents-header">
                在线客服 ({onlineAgents.length})
              </div>
              {onlineAgents.length === 0 ? (
                <div className="online-agents-empty">暂无客服在线</div>
              ) : (
                <div className="online-agents-list">
                  {onlineAgents.map((agent) => (
                    <div key={agent.id} className="online-agent-tag">
                      <span className="status-dot" />
                      <span className="agent-name">
                        {agent.realName || agent.username}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            className={`session-group ${collapsedSections.queued ? 'collapsed' : ''}`}
          >
            <div className="group-header" onClick={() => toggleSection('queued')}>
              <div className="group-header-content">
                <div className="group-title">待接入队列 ({queuedSessions.length})</div>
                <div className="group-subtitle">系统按优先级自动排序</div>
              </div>
              <CaretRightOutlined
                className={`collapse-icon ${collapsedSections.queued ? '' : 'expanded'}`}
              />
            </div>
            {!collapsedSections.queued && (
              <div className="session-group-content">
                {loadingSessions && queuedSessions.length === 0 ? (
                  <div className="session-loading">
                    <Spin />
                  </div>
                ) : queuedSessions.length === 0 ? (
                  <div className="session-empty">
                    暂无待接入会话，等待玩家请求转人工
                  </div>
                ) : (
                  queuedSessions.map((session) => {
                    const statusMeta =
                      SESSION_STATUS_META[session.status] || SESSION_STATUS_META.PENDING;
                    const issueTypeNames =
                      session.ticket?.issueTypes?.map((it) => it.name) ?? [];
                    const assignedLabel = getAssignedLabel(session);
                    const queueSummary = getQueueSummary(session);
                    const joinable = canJoinQueuedSession(session);
                    return (
                      <div
                        key={session.id}
                        className={`session-card ${
                          currentSession?.id === session.id ? 'active' : ''
                        }`}
                      >
                        <div
                          className="session-card-content"
                          onClick={() => handleOpenChat(session)}
                        >
                          <div className="session-meta">
                            <div className="session-name">
                              {session.ticket?.playerIdOrName || '未知玩家'}
                            </div>
                            <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                          </div>
                          <div className="session-desc">
                            <span>{session.ticket?.game?.name || '未知游戏'}</span>
                            <span>{session.ticket?.server?.name || '--'}</span>
                            <span>
                              {issueTypeNames.length > 0
                                ? issueTypeNames.join('、')
                                : '问题未分类'}
                            </span>
                          </div>
                          <div className="session-tags">
                            {session.queuePosition ? (
                              <Tag color="orange">第 {session.queuePosition} 位</Tag>
                            ) : (
                              <Tag color="orange">排队中</Tag>
                            )}
                            <Tag color={session.agent ? 'blue' : 'default'}>
                              {session.agent
                                ? `分配给 ${session.agent.realName || session.agent.username}`
                                : '等待分配'}
                            </Tag>
                          </div>
                          <div className="session-extra">{queueSummary}</div>
                          <div className="session-extra">{assignedLabel}</div>
                        </div>
                        <div className="session-actions" onClick={(e) => e.stopPropagation()}>
                          {joinable ? (
                            <Button
                              type="primary"
                              size="small"
                              icon={<UserAddOutlined />}
                              onClick={() => handleJoinSession(session)}
                            >
                              接入会话
                            </Button>
                          ) : (
                            <span className="session-assigned-hint">
                              仅可由分配对象接入
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div
            className={`session-group ${collapsedSections.active ? 'collapsed' : ''}`}
          >
            <div className="group-header" onClick={() => toggleSection('active')}>
              <div className="group-header-content">
                <div className="group-title">进行中会话 ({activeSessions.length})</div>
                <div className="group-subtitle">实时显示已接入的人工会话</div>
              </div>
              <CaretRightOutlined
                className={`collapse-icon ${collapsedSections.active ? '' : 'expanded'}`}
              />
            </div>
            {!collapsedSections.active && (
              <div className="session-group-content">
                {loadingSessions && activeSessions.length === 0 ? (
                  <div className="session-loading">
                    <Spin />
                  </div>
                ) : activeSessions.length === 0 ? (
                  <div className="session-empty">
                    暂无进行中的会话，等待客服接入
                  </div>
                ) : (
                  activeSessions.map((session) => {
                    const statusMeta =
                      SESSION_STATUS_META[session.status] || SESSION_STATUS_META.PENDING;
                    return (
                      <div
                        key={session.id}
                        className={`session-card ${
                          currentSession?.id === session.id ? 'active' : ''
                        }`}
                        onClick={() => handleOpenChat(session)}
                      >
                        <div className="session-meta">
                          <div className="session-name">
                            {session.ticket.playerIdOrName}
                          </div>
                          <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
                        </div>
                        <div className="session-desc">
                          <span>{session.ticket.game.name}</span>
                          <span>{session.ticket.server?.name || '未分配'}</span>
                          <span>{session.ticket.description}</span>
                        </div>
                        <div className="session-extra">
                          当前客服:{' '}
                          {session.agent?.realName ||
                            session.agent?.username ||
                            '未指派'}
                        </div>
                        <div className="session-extra">
                          持续: {getSessionDuration(session)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </section>

        <section className="workbench-chat-panel">
          {currentSession ? (
            <>
              <div className="chat-panel-spin">
                <div className="chat-panel-body">
                  <div className="chat-panel-header">
                    <div>
                      <div className="panel-title">
                        {currentSession.ticket.playerIdOrName || '--'} ·{' '}
                        {currentSession.ticket.game.name || '--'}
                        {sessionStatusMeta && (
                          <Tag color={sessionStatusMeta.color} style={{ marginLeft: 8 }}>
                            {sessionStatusMeta.label}
                          </Tag>
                        )}
                      </div>
                      <div className="chat-context">
                        {currentSession.ticket.ticketNo} ·{' '}
                        {currentSession.ticket.game.name} ·{' '}
                        {currentSession.ticket.server?.name || '一区'} · 持续:{' '}
                        {getSessionDuration(currentSession)}
                        {sessionStatusMeta?.description
                          ? ` · ${sessionStatusMeta.description}`
                          : ''}
                      </div>
                    </div>
                    <Space>
                      {(() => {
                        const isJoined =
                          currentSession.status === 'IN_PROGRESS' &&
                          currentSession.agentId === authUser?.id;
                        const canJoin = canJoinQueuedSession(currentSession);

                        if (!isJoined && canJoin) {
                          return (
                            <Button
                              type="primary"
                              onClick={() => handleJoinSession(currentSession)}
                            >
                              接入会话
                            </Button>
                          );
                        }

                        if (isJoined) {
                          return (
                            <Button icon={<CloseOutlined />} danger onClick={handleCloseSession}>
                              结束会话
                            </Button>
                          );
                        }

                        return null;
                      })()}
                    </Space>
                  </div>

                  <div className="chat-history">
                    <div className="message-list-container">
                      {allMessages.length === 0 ? (
                        <div className="chat-empty">欢迎接管会话，输入框支持 AI 优化。</div>
                      ) : (
                        allMessages.map((msg) => {
                          const isPlayer = msg.senderType === 'PLAYER';
                          const isAgent = msg.senderType === 'AGENT';
                          const isAI = msg.senderType === 'AI';

                          const avatarClass = 'avatar-player-wechat';
                          const avatarIcon = <UserOutlined />;

                          return (
                            <div
                              key={msg.id}
                              className={`message-item-wechat ${
                                isPlayer
                                  ? 'message-player-wechat'
                                  : isAI
                                    ? 'message-ai-wechat'
                                    : 'message-agent-wechat'
                              }`}
                            >
                              {/* 客服端：只显示玩家头像，不显示自己和AI的头像 */}
                              {isPlayer && (
                                <div className={`message-avatar-wechat ${avatarClass}`}>
                                  {avatarIcon}
                                </div>
                              )}
                              <div className="message-content-wrapper-wechat">
                                {isAI && (
                                  <span className="message-sender-name-wechat">
                                    AI助手
                                    {msg.metadata?.confidence
                                      ? ` (置信度:${msg.metadata.confidence}%)`
                                      : ''}
                                  </span>
                                )}
                                {isAgent && (
                                  <span className="message-sender-name-wechat">
                                    客服
                                    {currentSession.agent?.realName ||
                                      currentSession.agent?.username ||
                                      authUser?.realName ||
                                      authUser?.username ||
                                      ''}
                                  </span>
                                )}
                                <div
                                  className={`message-bubble-wechat ${
                                    isAgent
                                      ? 'bubble-agent-wechat'
                                      : isAI
                                        ? 'bubble-ai-wechat'
                                        : 'bubble-player-wechat'
                                  }`}
                                >
                                  {msg.messageType === 'IMAGE' ? (
                                    <Image
                                      src={resolveMediaUrl(msg.content)}
                                      alt="消息图片"
                                      width={200}
                                      style={{ 
                                        maxWidth: '200px', 
                                        maxHeight: '300px',
                                        borderRadius: 4,
                                        display: 'block'
                                      }}
                                      preview={{
                                        mask: '预览',
                                      }}
                                    />
                                  ) : (
                                    <div className="message-text-wechat">
                                      {isFileUrl(msg.content) ? (
                                        <a 
                                          href={resolveMediaUrl(msg.content)} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          style={{ color: '#1890ff', textDecoration: 'underline' }}
                                        >
                                          📎 {getFileName(msg.content)}
                                        </a>
                                      ) : (
                                        msg.content
                                      )}
                                    </div>
                                  )}
                                  <span className="message-time-wechat">
                                    {dayjs(msg.createdAt).format('HH:mm')}
                                  </span>
                                </div>
                              </div>
                              {/* AI和客服消息不显示头像 */}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="chat-empty-state">
              <div className="empty-message">请从左侧列表选择一个会话开始工作</div>
            </div>
          )}

          {currentSession && (() => {
            // 检查会话是否已接入（状态为 IN_PROGRESS 且 agentId 匹配当前用户）
            const isJoined = 
              currentSession.status === 'IN_PROGRESS' && 
              currentSession.agentId === authUser?.id;
            
            return (
              <div className="chat-input-bar">
                {!isJoined && currentSession.status === 'QUEUED' && (
                  <div style={{ 
                    padding: '16px', 
                    textAlign: 'center', 
                    background: '#fff3cd', 
                    border: '1px solid #ffc107',
                    borderRadius: '4px',
                    marginBottom: '8px'
                  }}>
                    <div style={{ marginBottom: '8px', color: '#856404' }}>
                      请先点击"接入会话"按钮才能开始聊天
                    </div>
                    <Button 
                      type="primary" 
                      onClick={() => handleJoinSession(currentSession)}
                    >
                      接入会话
                    </Button>
                  </div>
                )}
                <div className="input-toolbar">
                  <Upload
                    beforeUpload={(file) => {
                      handleFileUpload(file);
                      return false; // 阻止默认上传
                    }}
                    showUploadList={false}
                    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  >
                  <Button 
                    type="text" 
                    icon={<PaperClipOutlined />} 
                    title="附件"
                      disabled={!isJoined || uploadingFile}
                      loading={uploadingFile}
                  />
                  </Upload>
                  <Button 
                    type="text" 
                    icon={<SmileOutlined />} 
                    title="表情"
                    disabled={!isJoined}
                  />
                  <Button 
                    type="text" 
                    icon={<FolderOutlined />} 
                    title="快捷回复"
                    disabled={!isJoined}
                  />
                </div>
                <TextArea
                  value={messageInput}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder={isJoined ? "输入回复…（Shift+Enter 换行）" : "请先接入会话后才能发送消息"}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  disabled={!isJoined}
                  style={{ 
                    resize: 'vertical',
                    maxHeight: '120px',
                    minHeight: '32px'
                  }}
                  onPressEnter={(e) => {
                    if (e.shiftKey) return;
                    e.preventDefault();
                    if (isJoined) {
                      handleSendMessage();
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
                      e.preventDefault();
                      handleUndoAiOptimization();
                    }
                  }}
                />
                <div className="chat-actions">
                  <Space size="middle">
                    <Button
                      icon={<RobotOutlined />}
                      className="ai-optimize-btn"
                      onClick={handleAiOptimize}
                      disabled={!messageInput.trim() || aiOptimizing || !isJoined}
                      loading={aiOptimizing}
                      size="middle"
                    >
                      {aiOptimizing ? 'AI优化中…' : 'AI优化'}
                    </Button>
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      onClick={handleSendMessage}
                      loading={sendingMessage}
                      disabled={!messageInput.trim() || !isJoined}
                      size="middle"
                    >
                      发送
                    </Button>
                  </Space>
                </div>
              </div>
            );
          })()}
        </section>

        <section 
          className="workbench-info-panel"
          ref={rightPanelRef}
          style={{ width: `${rightPanelWidth}px` }}
        >
          <div
            className="resize-handle resize-handle-left"
            onMouseDown={(e) => {
              e.preventDefault();
              isResizingRight.current = true;
            }}
          />
          <div className="tab-content">
            {currentSession ? (
              <div className="ticket-card">
                <div className="ticket-title">工单详情</div>
                <div className="info-row">
                  <span>工单号</span>
                  <div className="info-value">
                    <Text copyable={{ text: currentSession.ticket.ticketNo }}>
                      {currentSession.ticket.ticketNo}
                    </Text>
                  </div>
                </div>
                <div className="info-row">
                  <span>游戏</span>
                  <strong>{currentSession.ticket.game.name}</strong>
                </div>
                <div className="info-row">
                  <span>区服</span>
                  <strong>{currentSession.ticket.server?.name || currentSession.ticket.serverName || '-'}</strong>
                </div>
                <div className="info-row">
                  <span>玩家ID/昵称</span>
                  <strong>{currentSession.ticket.playerIdOrName}</strong>
                </div>
                <div className="info-row">
                  <span>状态</span>
                  <div className="info-value">
                    {ticketStatusMeta ? (
                      <Tag color={ticketStatusMeta.color}>{ticketStatusMeta.label}</Tag>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>
                <div className="info-row">
                  <span>会话状态</span>
                  <div className="info-value">
                    {sessionStatusMeta ? (
                      <Tag color={sessionStatusMeta.color}>{sessionStatusMeta.label}</Tag>
                    ) : (
                      '-'
                    )}
                  </div>
                </div>
                <div className="info-row">
                  <span>问题类型</span>
                  <div className="info-value">
                    {ticketIssueTypes.length > 0 ? (
                      <Space size={[4, 4]} wrap>
                        {currentSession.ticket.issueTypes?.map((issueType: any) => (
                          <Tag key={issueType.id} color="blue">
                            {issueType.name}
                          </Tag>
                        ))}
                      </Space>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                </div>
                <div className="info-row">
                  <span>创建时间</span>
                  <strong>{dayjs(currentSession.ticket.createdAt).format('YYYY-MM-DD HH:mm:ss')}</strong>
                </div>
                <div className="info-row">
                  <span>更新时间</span>
                  <strong>{dayjs(currentSession.ticket.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</strong>
                </div>
                {currentSession.ticket.occurredAt && (
                  <div className="info-row">
                    <span>问题发生时间</span>
                    <strong>{dayjs(currentSession.ticket.occurredAt).format('YYYY-MM-DD HH:mm:ss')}</strong>
                  </div>
                )}
                <div className="info-row">
                  <span>充值订单号</span>
                  <strong>{currentSession.ticket.paymentOrderNo || '-'}</strong>
                </div>
                <div className="info-row">
                  <span>问题描述</span>
                  <p className="description-text">{currentSession.ticket.description}</p>
                </div>
                {attachmentList.length > 0 && (
                  <div className="info-row">
                    <span>附件</span>
                    <div className="attachments-preview">
                      {attachmentList.map((file) => (
                        <Image
                          key={file.id}
                          src={resolveMediaUrl(file.fileUrl)}
                          width={88}
                          height={88}
                          style={{ borderRadius: 12, objectFit: 'cover' }}
                          preview={{
                            mask: '预览',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
                {sessionTimeline.length > 0 && (
                  <div className="timeline-section">
                    <div className="timeline-title">状态跟踪</div>
                    <ul className="timeline-list">
                      {sessionTimeline.map((item) => (
                        <li key={item.key} className="timeline-item">
                          <div className="timeline-dot" />
                          <div className="timeline-content">
                            <div className="timeline-label">{item.label}</div>
                            <div className="timeline-time">
                              {formatDateTime(item.timestamp)}
                            </div>
                            {item.description && (
                              <div className="timeline-desc">{item.description}</div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="ticket-empty-state">
                <div className="empty-message">请选择一个会话查看工单详情</div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default ActivePage;
