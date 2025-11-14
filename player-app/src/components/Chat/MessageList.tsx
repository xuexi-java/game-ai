/**
 * 消息列表组件
 */
import { Message } from '../../services/session.service';
import { Typography, Space } from 'antd';
import dayjs from 'dayjs';
import './MessageList.css';

const { Paragraph } = Typography;

interface MessageListProps {
  messages: Message[];
}

const MessageList = ({ messages }: MessageListProps) => {
  if (messages.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#999', padding: '40px' }}>
        暂无消息
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => {
        const isPlayer = message.senderType === 'PLAYER';
        const isAI = message.senderType === 'AI';
        const isSystem = message.senderType === 'SYSTEM';

        return (
          <div
            key={message.id}
            className={`message-item ${isPlayer ? 'message-player' : isAI ? 'message-ai' : isSystem ? 'message-system' : 'message-agent'}`}
          >
            <div className="message-bubble">
              {isSystem ? (
                <div className="system-message">{message.content}</div>
              ) : (
                <>
                  <div className="message-content">{message.content}</div>
                  {message.metadata?.suggestedOptions && (
                    <div className="suggested-options">
                      {message.metadata.suggestedOptions.map((option: string, index: number) => (
                        <div key={index} className="option-item">
                          {option}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="message-time">
                {dayjs(message.createdAt).format('HH:mm')}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;

