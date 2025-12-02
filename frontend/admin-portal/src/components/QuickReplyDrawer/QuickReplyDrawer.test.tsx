import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickReplyDrawer from './index';
import { useQuickReplyStore } from '../../stores/quickReplyStore';

// Mock store
vi.mock('../../stores/quickReplyStore', () => ({
  useQuickReplyStore: vi.fn(),
}));

// Mock API
vi.mock('../../services/quickReply.service', () => ({
  getReplies: vi.fn(),
  getUserFavorites: vi.fn(),
}));

describe('QuickReplyDrawer', () => {
  const mockStore = {
    categories: [
      { id: '1', name: '问候语', isGlobal: true },
      { id: '2', name: '问题确认', isGlobal: false },
    ],
    replies: [],
    selectedCategoryId: '1',
    setSelectedCategory: vi.fn(),
    fetchReplies: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuickReplyStore as any).mockReturnValue(mockStore);
  });

  it('应该渲染抽屉组件', () => {
    render(<QuickReplyDrawer open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    
    expect(screen.getByText('快捷回复')).toBeInTheDocument();
  });

  it('应该显示分类列表', () => {
    render(<QuickReplyDrawer open={true} onClose={vi.fn()} onSelect={vi.fn()} />);
    
    expect(screen.getByText('问候语')).toBeInTheDocument();
    expect(screen.getByText('问题确认')).toBeInTheDocument();
  });

  it('应该处理快捷回复选择', async () => {
    const onSelect = vi.fn();
    const mockReplies = [
      { id: '1', content: '您好，有什么可以帮助您的吗？', categoryId: '1' },
    ];

    mockStore.replies = mockReplies;

    render(<QuickReplyDrawer open={true} onClose={vi.fn()} onSelect={onSelect} />);

    const replyItem = screen.getByText('您好，有什么可以帮助您的吗？');
    fireEvent.click(replyItem);

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(mockReplies[0].content);
    });
  });
});

