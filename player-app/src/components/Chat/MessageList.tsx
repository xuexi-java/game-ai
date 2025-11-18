/**
 * 消息列表组件
 */
import type { Message } from '../../types';
import dayjs from 'dayjs';
import './MessageList.css';

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
            {!isPlayer && !isSystem && (
              <div className={`message-avatar ${isAI ? 'avatar-ai' : 'avatar-agent'}`}>
                {isAI ? 'AI' : '座席'}
              </div>
            )}
            <div className="message-bubble">
              {isSystem ? (
                <div className="system-message">{message.content}</div>
              ) : (
                <>
                  <div className="message-content">
                    {message.messageType === 'IMAGE' ? (
                      <img
                        src={message.content}
                        alt="图片消息"
                        style={{ maxWidth: '220px', borderRadius: '8px' }}
                      />
                    ) : (
                      (() => {
                        let content = message.content || '';
                        // 处理 Dify 返回的 JSON 格式文本
                        if (typeof content === 'string' && content.includes('</think>')) {
                          // 提取 JSON 部分
                          const jsonMatch = content.match(/\{[\s\S]*\}/);
                          if (jsonMatch) {
                            try {
                              const jsonData = JSON.parse(jsonMatch[0]);
                              if (jsonData.text) {
                                content = jsonData.text;
                              }
                            } catch (e) {
                              // JSON 解析失败，移除标记
                              content = content.replace(/<\/redacted_reasoning>[\s\S]*$/, '').trim();
                            }
                          } else {
                            // 没有 JSON，移除标记
                            content = content.replace(/<\/redacted_reasoning>[\s\S]*$/, '').trim();
                          }
                        }
                        // 如果整个内容是 JSON，尝试解析
                        if (typeof content === 'string' && content.trim().startsWith('{') && content.trim().endsWith('}')) {
                          try {
                            const jsonData = JSON.parse(content);
                            if (jsonData.text) {
                              content = jsonData.text;
                            }
                          } catch (e) {
                            // 不是有效的 JSON，继续使用原始文本
                          }
                        }
                        return <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{content}</div>;
                      })()
                    )}
                  </div>
                  {Array.isArray(
                    (message.metadata as { suggestedOptions?: string[] })
                      ?.suggestedOptions,
                  ) && (
                    <div className="suggested-options">
                      {(
                        (message.metadata as { suggestedOptions?: string[] })
                          .suggestedOptions ?? []
                      ).map((option: string, index: number) => (
                        <div key={index} className="option-item">
                          {option}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="message-time">
                    {dayjs(message.createdAt).format('HH:mm')}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MessageList;
