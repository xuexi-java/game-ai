/**
 * 步骤5：排队页面
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Spin, Alert, Button } from 'antd';
import { getSession } from '../../services/session.service';
import { useSessionStore } from '../../stores/sessionStore';
import { useTicketStore } from '../../stores/ticketStore';
import { io } from 'socket.io-client';
import { WS_URL } from '../../config/api';
import { useMessage } from '../../hooks/useMessage';

const { Title, Paragraph } = Typography;

const QueuePage = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, setSession, updateSession } = useSessionStore();
  const { ticketToken, ticketNo } = useTicketStore();
  const messageApi = useMessage();
  const navigate = useNavigate();
  const [onlineAgents, setOnlineAgents] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // 加载会话信息
    const loadSession = async () => {
      try {
        const sessionData = await getSession(sessionId);
        setSession(sessionData);
        
        // 如果会话已关闭（转为工单），不需要显示排队信息
        if (sessionData.status === 'CLOSED') {
          return;
        }
        
        // 如果会话状态为 QUEUED 但已分配客服，说明客服已分配但还未接入
        // 这种情况下，应该显示"客服已分配，等待接入"的提示
        if (sessionData.status === 'QUEUED' && sessionData.agentId) {
          console.log('会话已分配客服，等待客服接入:', sessionData);
        }
        
        // 如果会话状态为 IN_PROGRESS，直接跳转到聊天页面
        if (sessionData.status === 'IN_PROGRESS') {
          navigate(`/chat/${sessionId}`);
          return;
        }
      } catch (error) {
        console.error('加载会话失败:', error);
        messageApi.error('加载会话失败');
      }
    };

    loadSession();
    
    // 定期刷新会话状态（每3秒检查一次）
    const intervalId = setInterval(() => {
      loadSession();
    }, 3000);

    // 连接 WebSocket 监听排队状态
    const newSocket = io(WS_URL, {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      newSocket.emit('join-session', { sessionId });
    });

    newSocket.on('queue-update', (data) => {
      updateSession({
        priorityScore: data.priorityScore,
        queuedAt: data.queuedAt,
        queuePosition: data.position || data.queuePosition,
        estimatedWaitTime: data.waitTime,
      });
    });

    newSocket.on('session-update', (sessionData) => {
      updateSession(sessionData);
      
      // 如果会话已关闭（转为工单），跳转到工单页面
      if (sessionData.status === 'CLOSED' && ticketToken) {
        setTimeout(() => {
          navigate(`/ticket/${ticketToken}`);
        }, 2000);
        return;
      }
      
      if (sessionData.status === 'IN_PROGRESS') {
        // 客服已接入，跳转到聊天页面
        setTimeout(() => {
          navigate(`/chat/${sessionId}`);
        }, 100);
      }
    });

    // 监听消息（转接人工后可能收到客服消息）
    newSocket.on('message', (data: any) => {
      console.log('排队页面收到消息:', data);
      // 如果收到消息，说明客服可能已经接入，刷新会话状态
      const messageData = data.message || data;
      if (messageData?.senderType === 'AGENT') {
        loadSession();
      }
    });

    return () => {
      newSocket.disconnect();
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [sessionId, setSession, updateSession, messageApi, navigate, ticketToken]);

  if (!session) {
    return (
      <div className="page-container">
        <div className="loading-container">
          <Spin size="large" />
          <div className="loading-text">加载中...</div>
        </div>
      </div>
    );
  }

  // 如果会话已关闭（转为工单），显示工单提示
  if (session.status === 'CLOSED') {
    return (
      <div className="page-container">
        <Card className="page-card fade-in-up" style={{ textAlign: 'center' }}>
          <Alert
            message="当前无客服在线"
            description={
              <div>
                <p>您的问题已转为【加急工单】，我们将优先处理。</p>
                {ticketNo && (
                  <p style={{ marginTop: 8, fontWeight: 'bold' }}>
                    工单号：{ticketNo}
                  </p>
                )}
                <p style={{ marginTop: 8, color: '#666' }}>
                  再次提交区服和游戏ID再次验证时即可查看反馈。
                </p>
              </div>
            }
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
          {ticketToken && (
            <Button
              type="primary"
              onClick={() => navigate(`/ticket/${ticketToken}`)}
            >
              查看工单详情
            </Button>
          )}
        </Card>
      </div>
    );
  }

  // 格式化预计等待时间
  const formatWaitTime = (minutes: number | null | undefined) => {
    if (!minutes || minutes <= 0) return null;
    if (minutes < 1) return '不到1分钟';
    if (minutes < 60) return `约${Math.ceil(minutes)}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.ceil(minutes % 60);
    if (mins === 0) return `约${hours}小时`;
    return `约${hours}小时${mins}分钟`;
  };

  // 正常排队状态
  const isAssigned = session.agentId && session.status === 'QUEUED';
  
  return (
    <div className="page-container">
      <Card className="page-card fade-in-up" style={{ textAlign: 'center' }}>
        <Spin size="large" style={{ marginBottom: '24px' }} />
        <Title level={3}>正在为您转接人工客服</Title>
        {isAssigned ? (
          <Paragraph style={{ color: '#52c41a', fontSize: '16px' }}>
            客服已分配，等待客服接入中...
          </Paragraph>
        ) : (
          <Paragraph>请稍候，客服将尽快为您服务...</Paragraph>
        )}
        
        {session.queuePosition && session.queuePosition > 0 && (
          <Paragraph style={{ fontSize: '16px', marginTop: '16px' }}>
            当前排队位置: <strong style={{ color: '#1890ff', fontSize: '18px' }}>第 {session.queuePosition} 位</strong>
          </Paragraph>
        )}
        
        {session.estimatedWaitTime && session.estimatedWaitTime > 0 && (
          <Paragraph style={{ fontSize: '16px', marginTop: '8px' }}>
            预计等待时间: <strong style={{ color: '#52c41a', fontSize: '18px' }}>{formatWaitTime(session.estimatedWaitTime)}</strong>
          </Paragraph>
        )}
      </Card>
    </div>
  );
};

export default QueuePage;
