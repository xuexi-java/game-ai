/**
 * 工单异步聊天页面
 */
import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Input, Button, Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { getTicketByToken } from '../../services/ticket.service';
import MessageList from '../../components/Chat/MessageList';

const { TextArea } = Input;

const TicketChatPage = () => {
  const { token } = useParams<{ token: string }>();
  const [ticket, setTicket] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;

    const loadTicket = async () => {
      try {
        const ticketData = await getTicketByToken(token);
        setTicket(ticketData);
        // TODO: 加载工单消息
      } catch (error) {
        console.error('加载工单失败:', error);
      }
    };

    loadTicket();
  }, [token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    // TODO: 发送工单消息
    console.log('发送消息:', inputValue);
    setInputValue('');
  };

  if (!ticket) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Card 
        title={`工单 #{ticket.ticketNo}`}
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      >
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
          <MessageList messages={messages} />
          <div ref={messagesEndRef} />
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="输入消息..."
            autoSize={{ minRows: 1, maxRows: 4 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!inputValue.trim()}
          >
            发送
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default TicketChatPage;

