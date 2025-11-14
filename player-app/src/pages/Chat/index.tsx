/**
 * 步骤4：AI引导聊天页面
 */
import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Input, Button, Space, Typography, message } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { io, Socket } from 'socket.io-client';
import { getSession, transferToAgent } from '../../services/session.service';
import { sendPlayerMessage } from '../../services/message.service';
import { useSessionStore } from '../../stores/sessionStore';
import { WS_URL } from '../../config/api';
import MessageList from '../../components/Chat/MessageList';
import './index.css';

const { TextArea } = Input;

const ChatPage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const { session, messages, setSession, addMessage, updateSession } = useSessionStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载会话信息
  useEffect(() => {
    if (!sessionId) return;

    const loadSession = async () => {
      try {
        const sessionData = await getSession(sessionId);
        setSession(sessionData);
      } catch (error) {
        console.error('加载会话失败:', error);
        message.error('加载会话失败');
      }
    };

    loadSession();
  }, [sessionId, setSession]);

  // 连接 WebSocket
  useEffect(() => {
    if (!sessionId) return;

    const newSocket = io(WS_URL, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket 连接成功');
      newSocket.emit('join-session', sessionId);
    });

    newSocket.on('message', (messageData) => {
      addMessage(messageData);
    });

    newSocket.on('session-updated', (sessionData) => {
      updateSession(sessionData);
      if (sessionData.status === 'QUEUED') {
        navigate(`/queue/${sessionId}`);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [sessionId, addMessage, updateSession, navigate]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 发送消息
  const handleSend = async () => {
    if (!inputValue.trim() || !sessionId) return;

    const content = inputValue.trim();
    setInputValue('');
    setLoading(true);

    try {
      await sendPlayerMessage({
        sessionId,
        content,
      });
      // WebSocket 会收到新消息
    } catch (error) {
      console.error('发送消息失败:', error);
      message.error('发送消息失败');
    } finally {
      setLoading(false);
    }
  };

  // 转人工客服
  const handleTransferToAgent = async () => {
    if (!sessionId) return;

    setLoading(true);
    try {
      const updatedSession = await transferToAgent(sessionId);
      updateSession(updatedSession);
      navigate(`/queue/${sessionId}`);
    } catch (error) {
      console.error('转人工失败:', error);
      message.error('转人工失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        加载中...
      </div>
    );
  }

  return (
    <div className="chat-container">
      <Card 
        title={`客服咨询 - ${session.ticket.ticketNo}`}
        style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
          <MessageList messages={messages} />
          <div ref={messagesEndRef} />
        </div>

        <Space.Compact style={{ width: '100%' }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="输入消息...（Shift+Enter 换行）"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={loading}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!inputValue.trim()}
          >
            发送
          </Button>
        </Space.Compact>

        {session.status === 'PENDING' && (
          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <Button
              type="primary"
              onClick={handleTransferToAgent}
              loading={loading}
            >
              转人工客服
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ChatPage;

