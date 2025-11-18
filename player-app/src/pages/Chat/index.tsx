/**
 * 步骤4：AI 引导聊天页面
 */
import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input, Button, Typography, Spin, Alert } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { io } from 'socket.io-client';
import { getSession, transferToAgent, closeSession } from '../../services/session.service';
import { sendPlayerMessage } from '../../services/message.service';
import { uploadTicketAttachment } from '../../services/upload.service';
import { useSessionStore } from '../../stores/sessionStore';
import dayjs from 'dayjs';
import { API_BASE_URL, WS_URL } from '../../config/api';
import MessageList from '../../components/Chat/MessageList';
import EmojiPicker from '../../components/Chat/EmojiPicker';
import FileUpload from '../../components/Chat/FileUpload';
import NetworkStatus from '../../components/NetworkStatus';
import { useMessage } from '../../hooks/useMessage';
import './index.css';

const { TextArea } = Input;

const API_ORIGIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

const resolveAttachmentUrl = (url?: string) => {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  const normalized = url.startsWith('/') ? url : `/${url}`;
  return `${API_ORIGIN}${normalized}`;
};

const ChatPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const { session, messages, setSession, addMessage, removeMessage, updateSession } =
    useSessionStore();
  const messageApi = useMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  // 加载会话和消息
  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      try {
        const sessionData = await getSession(sessionId);
        setSession(sessionData);
        // setSession 已经会设置 messages，不需要重复添加
      } catch (error) {
        console.error('加载会话失败:', error);
        messageApi.error('加载会话失败');
      }
    };

    loadSession();
  }, [sessionId, setSession, addMessage, messageApi]);

  // 连接 WebSocket
  useEffect(() => {
    if (!sessionId) return;

    const socket = io(WS_URL, {
      transports: ['websocket', 'polling'], // 支持降级到 polling
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('WebSocket 连接成功');
      setWsConnected(true);
      socket.emit('join-session', sessionId);
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket 连接错误:', error);
      setWsConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('WebSocket 断开连接:', reason);
      setWsConnected(false);
    });

    socket.on('message', (messageData) => {
      console.log('收到消息:', messageData);
      addMessage(messageData);
    });

    socket.on('session-update', (sessionData) => {
      console.log('会话更新:', sessionData);
      updateSession(sessionData);
      if (sessionData.status === 'QUEUED') {
        navigate(`/queue/${sessionId}`);
      }
    });

    socket.on('error', (error) => {
      console.error('WebSocket 错误:', error);
    });

    return () => {
      console.log('清理 WebSocket 连接');
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [sessionId, addMessage, updateSession, navigate]);

  // 滚动到底部（使用 requestAnimationFrame 确保 DOM 更新后再滚动）
  useEffect(() => {
    if (messages.length > 0) {
      // 使用 setTimeout 延迟滚动，避免在消息更新时立即滚动导致界面跳动
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputValue.trim() || !sessionId) return;

    const content = inputValue.trim();
    setInputValue('');
    setSending(true);

    try {
      // 先添加玩家消息到界面（乐观更新）
      const playerMessage = {
        id: `temp-${Date.now()}`,
        sessionId,
        senderType: 'PLAYER' as const,
        messageType: 'TEXT' as const,
        content,
        createdAt: new Date().toISOString(),
      };
      addMessage(playerMessage);

      const response = await sendPlayerMessage(sessionId, content);

      // 移除临时消息
      removeMessage(playerMessage.id);

      if (response?.playerMessage) {
        addMessage(response.playerMessage);
      }
      if (response?.aiMessage) {
        addMessage(response.aiMessage);
      }

      if (response?.difyStatus) {
        updateSession({ difyStatus: String(response.difyStatus) });
      }
    } catch (error) {
      console.error('发送消息失败:', error);
      messageApi.error('发送消息失败');
      removeMessage(playerMessage.id);
    } finally {
      setSending(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setInputValue((prev) => prev + emoji);
  };

  const handleQuickReplySelect = (reply: string) => {
    setInputValue(reply);
  };

  const handleFileSelect = async (file: File) => {
    if (!sessionId || !session?.ticket?.id) return;

    setUploading(true);
    try {
      const uploadResult = await uploadTicketAttachment(file, {
        ticketId: session.ticket.id,
      });
      await sendPlayerMessage(sessionId, uploadResult.fileUrl, 'IMAGE');
      messageApi.success('图片发送成功');
    } catch (error) {
      console.error('文件上传失败:', error);
      messageApi.error('文件上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleTransferToAgent = async () => {
    if (!sessionId) return;

    setTransferring(true);
    try {
      const result = await transferToAgent(sessionId, 'URGENT');
      console.log('转人工结果:', result);
      if (result.queued) {
        messageApi.success('已为您转接人工客服，请稍候');
        updateSession({ 
          status: 'QUEUED',
          allowManualTransfer: false,
        });
        // 延迟一下再跳转，确保状态更新
        setTimeout(() => {
          navigate(`/queue/${sessionId}`);
        }, 500);
      } else {
        messageApi.info(result.message || '您的问题已升级为加急工单');
        // 即使没有排队，也更新会话状态
        if (result.ticketNo) {
          updateSession({ 
            status: 'CLOSED',
            allowManualTransfer: false,
          });
        }
      }
    } catch (error: any) {
      console.error('转人工失败:', error);
      const errorMessage = error?.response?.data?.message || error?.message || '转人工失败，请重试';
      messageApi.error(errorMessage);
    } finally {
      setTransferring(false);
    }
  };

  const handleCloseChat = async () => {
    if (!sessionId) return;
    setTransferring(true);
    try {
      await closeSession(sessionId);
      messageApi.success('会话已结束');
      navigate('/');
    } catch (error) {
      console.error('结束会话失败:', error);
      messageApi.error('结束会话失败');
    } finally {
      setTransferring(false);
    }
  };

  const canTransfer =
    session && session.status !== 'CLOSED' && session.allowManualTransfer !== false;
  const isInputDisabled = sending || uploading || transferring;
  const showTransferButton = Boolean(canTransfer);

  if (!session) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <div className="loading-text">加载会话中...</div>
      </div>
    );
  }

  return (
    <>
      <NetworkStatus wsConnected={wsConnected} />
      <div className="chat-container">
        <div className="chat-wrapper">
          <div className="chat-header">
            <div>
              <Typography.Title level={4} style={{ margin: 0, color: 'white' }}>
                客服咨询 - {session.ticket.ticketNo}
              </Typography.Title>
              <div
                className={`status-badge ${session.status
                  .toLowerCase()
                  .replace('_', '-')}`}
              >
                {session.status === 'PENDING'
                  ? '等待中'
                  : session.status === 'IN_PROGRESS'
                  ? '进行中'
                  : session.status === 'QUEUED'
                  ? '排队中'
                  : '已关闭'}
              </div>
            </div>
            <Button
              danger
              ghost
              onClick={handleCloseChat}
              disabled={transferring}
            >
              结束会话
            </Button>
          </div>

          <div className="chat-body">
            <div className="chat-thread">
              <MessageList messages={messages} />
              <div ref={messagesEndRef} />
            </div>

            <div className="chat-input-area">
              <div className="chat-input-enhanced">
                <TextArea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onFocus={(e) => e.target.classList.add('input-focused')}
                  onBlur={(e) => e.target.classList.remove('input-focused')}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="输入消息...（Shift+Enter 换行）"
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  disabled={isInputDisabled}
                  className="chat-textarea"
                />
              </div>
              <div className="chat-input-toolbar">
                <div className="toolbar-left">
                  <EmojiPicker onEmojiSelect={handleEmojiSelect} />
                  <FileUpload onFileSelect={handleFileSelect} />
                </div>
                <div className="toolbar-right">
                  {showTransferButton && (
                    <Button
                      size="small"
                      className="transfer-inline-btn"
                      onClick={handleTransferToAgent}
                      loading={transferring}
                      disabled={transferring}
                    >
                      转人工
                    </Button>
                  )}
                  <Button
                    type="primary"
                    className="send-btn"
                    icon={<SendOutlined />}
                    onClick={handleSend}
                    loading={sending}
                    disabled={!inputValue.trim() || isInputDisabled}
                  >
                    发送
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatPage;
