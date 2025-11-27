import { useState, useEffect } from 'react';
import {
  Drawer,
  List,
  Input,
  Tabs,
  Button,
  Space,
  Empty,
  Spin,
  message,
  Tag,
  Select,
  Form,
} from 'antd';
import {
  HeartOutlined,
  HeartFilled,
} from '@ant-design/icons';
import { quickReplyService } from '../../services/quickReply.service';
import { useAuthStore } from '../../stores/authStore';
import './index.css';

const { Search } = Input;

interface QuickReplyDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (content: string) => void;
}

interface Reply {
  id: string;
  content: string;
  category: {
    id: string;
    name: string;
  };
  usageCount: number;
  favoriteCount: number;
  isFavorited: boolean;
  isGlobal: boolean;
  isActive: boolean;
}

interface Category {
  id: string;
  name: string;
  _count?: {
    replies: number;
  };
}

export default function QuickReplyDrawer({
  open,
  onClose,
  onSelect,
}: QuickReplyDrawerProps) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'usage'>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  // 加载分类列表
  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  // 加载快捷回复
  useEffect(() => {
    if (open) {
      // 先清空之前的回复，避免重复显示
      setReplies([]);
      
      if (selectedCategoryId || activeTab === 'favorites' || activeTab === 'usage') {
        loadReplies();
      } else if (categories.length > 0 && !selectedCategoryId) {
        // 如果分类已加载但还没有选中分类，自动选中第一个
        setSelectedCategoryId(categories[0].id);
      }
    } else {
      // 关闭抽屉时清空数据
      setReplies([]);
      setSearchKeyword('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedCategoryId, activeTab]);

  const loadCategories = async () => {
    try {
      const data = await quickReplyService.getCategories();
      console.log('加载的分类数据:', data);
      setCategories(data);
      if (data.length > 0 && !selectedCategoryId) {
        setSelectedCategoryId(data[0].id);
      }
    } catch (error) {
      console.error('加载分类失败:', error);
      message.error('加载分类失败');
    }
  };

  const loadReplies = async () => {
    setLoading(true);
    try {
      let data;
      if (activeTab === 'favorites') {
        const result = await quickReplyService.getUserFavorites(1, 100);
        data = result.data || [];
      } else if (activeTab === 'usage') {
        // 使用频率标签页：按使用次数排序，只查询启用的回复
        const result = await quickReplyService.getReplies({
          categoryId: selectedCategoryId || undefined,
          sortBy: 'usageCount',
          isActive: true, // 只查询启用的回复
          pageSize: 100,
        });
        data = result.data || [];
      } else {
        // 全部标签页：按使用次数排序，只查询启用的回复
        const result = await quickReplyService.getReplies({
          categoryId: selectedCategoryId || undefined,
          sortBy: 'usageCount',
          isActive: true, // 只查询启用的回复
          pageSize: 100,
        });
        data = result.data || [];
      }

      console.log('加载的快捷回复数据（去重前）:', data);
      console.log('去重前数量:', data.length);

      // 去重：先根据 id 去重，再根据内容去重（双重保险）
      const uniqueRepliesById = new Map<string, Reply>();
      data.forEach((reply: Reply) => {
        if (!uniqueRepliesById.has(reply.id)) {
          uniqueRepliesById.set(reply.id, reply);
        } else {
          console.warn('发现重复的 id:', reply.id, reply.content);
        }
      });
      data = Array.from(uniqueRepliesById.values());

      // 再次去重：根据内容去重（防止数据库中有相同内容但不同 id 的重复数据）
      const uniqueRepliesByContent = new Map<string, Reply>();
      data.forEach((reply: Reply) => {
        const contentKey = reply.content.trim();
        if (!uniqueRepliesByContent.has(contentKey)) {
          uniqueRepliesByContent.set(contentKey, reply);
        } else {
          console.warn('发现重复的内容:', reply.id, reply.content);
          // 保留使用次数更高的
          const existing = uniqueRepliesByContent.get(contentKey)!;
          if (reply.usageCount > existing.usageCount) {
            uniqueRepliesByContent.set(contentKey, reply);
          }
        }
      });
      data = Array.from(uniqueRepliesByContent.values());

      console.log('去重后数量:', data.length);

      // 过滤：只显示启用的回复（严格过滤）
      data = data.filter((reply: Reply) => {
        // 只保留 isActive 明确为 true 的回复
        // 如果 isActive 是 false、undefined 或 null，都过滤掉
        return reply.isActive === true;
      });

      // 过滤搜索关键词
      if (searchKeyword.trim()) {
        data = data.filter((reply: Reply) =>
          reply.content.toLowerCase().includes(searchKeyword.toLowerCase())
        );
      }

      // 确保按使用次数排序（降序）
      data = data.sort((a: Reply, b: Reply) => b.usageCount - a.usageCount);

      setReplies(data);
    } catch (error) {
      console.error('加载快捷回复失败:', error);
      message.error('加载快捷回复失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (reply: Reply) => {
    // 如果回复已禁用，不允许使用
    if (reply.isActive === false) {
      message.warning('该快捷回复已禁用，无法使用');
      return;
    }
    
    try {
      // 增加使用次数
      await quickReplyService.incrementUsage(reply.id);
      onSelect(reply.content);
      message.success('已插入回复');
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleToggleFavorite = async (replyId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await quickReplyService.toggleFavorite(replyId);
      // 更新本地状态
      setReplies((prev) =>
        prev.map((reply) =>
          reply.id === replyId
            ? {
                ...reply,
                isFavorited: !reply.isFavorited,
                favoriteCount: reply.isFavorited
                  ? reply.favoriteCount - 1
                  : reply.favoriteCount + 1,
              }
            : reply
        )
      );
    } catch (error) {
      message.error('收藏失败');
    }
  };

  const handleSearch = (value: string) => {
    setSearchKeyword(value);
    // 不需要重新请求，因为已经在 loadReplies 中处理了搜索过滤
    // 搜索是客户端过滤，不需要延迟请求
  };

  return (
    <Drawer
      title="快捷回复"
      placement="right"
      width={500}
      open={open}
      onClose={onClose}
      className="quick-reply-drawer"
    >
      <div className="quick-reply-drawer-content">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key as 'all' | 'favorites' | 'usage');
          }}
          items={[
            { key: 'all', label: '全部' },
            { key: 'favorites', label: '收藏' },
            { key: 'usage', label: '使用频率' },
          ]}
        />

        <div style={{ padding: '0 16px', marginBottom: 16 }}>
          <Form.Item 
            label="分类"
            style={{ marginBottom: 12 }}
          >
            <Select
              placeholder="选择分类"
              value={selectedCategoryId || undefined}
              onChange={(value) => {
                setSelectedCategoryId(value);
              }}
              style={{ width: '100%' }}
              showSearch
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={categories.map((cat) => ({
                label: cat.name,
                value: cat.id,
              }))}
              notFoundContent={categories.length === 0 ? '暂无分类' : undefined}
            />
          </Form.Item>

          <Input.Search
            placeholder="搜索快捷回复..."
            allowClear
            onSearch={handleSearch}
            onChange={(e) => handleSearch(e.target.value)}
            enterButton
            size="large"
          />
        </div>

        <div className="reply-list">
          <Spin spinning={loading}>
            {replies.length === 0 ? (
              <Empty description="暂无快捷回复" />
            ) : (
              <List
                dataSource={replies}
                renderItem={(reply) => (
                  <List.Item
                    className="reply-item"
                    onClick={() => handleSelect(reply)}
                    actions={[
                      <Button
                        type="text"
                        size="small"
                        icon={
                          reply.isFavorited ? (
                            <HeartFilled style={{ color: '#ff4d4f' }} />
                          ) : (
                            <HeartOutlined />
                          )
                        }
                        onClick={(e) => handleToggleFavorite(reply.id, e)}
                      />,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{reply.category.name}</span>
                          {reply.isGlobal && <Tag size="small">全局</Tag>}
                        </Space>
                      }
                      description={
                        <div className="reply-content">{reply.content}</div>
                      }
                    />
                    <div className="reply-stats">
                      <Tag size="small">使用 {reply.usageCount}</Tag>
                      <Tag size="small">收藏 {reply.favoriteCount}</Tag>
                    </div>
                  </List.Item>
                )}
              />
            )}
          </Spin>
        </div>
      </div>
    </Drawer>
  );
}

