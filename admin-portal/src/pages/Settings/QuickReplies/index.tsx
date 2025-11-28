import { useEffect, useState } from 'react';
import {
  Layout,
  List,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Checkbox,
  Space,
  Pagination,
  Empty,
  Spin,
  message,
  Tag,
  Tabs,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  HeartFilled,
  HeartOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
import { quickReplyService } from '../../../services/quickReply.service';
import { useQuickReplyStore } from '../../../stores/quickReplyStore';
import { useAuthStore } from '../../../stores/authStore';
import './index.css';

export default function QuickReplies() {
  const location = useLocation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';
  const isSystemSettings = location.pathname.startsWith('/settings/quick-replies');
  const {
    categories,
    replies,
    totalReplies,
    selectedCategoryId,
    loading,
    sortBy,
    currentPage,
    pageSize,
    activeTab,
    isActiveFilter,
    fetchCategories,
    fetchReplies,
    deleteReply,
    setSelectedCategory,
    setSortBy,
    setActiveTab,
    setIsActiveFilter,
    toggleFavorite,
    updateReply,
    createCategory,
    updateUserPreference,
  } = useQuickReplyStore();

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCategoryModalVisible, setIsCategoryModalVisible] = useState(false);
  const [editingReply, setEditingReply] = useState(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [form] = Form.useForm();
  const [categoryForm] = Form.useForm();

  useEffect(() => {
    fetchCategories();
  }, []);

  // 系统设置页面：不再强制设置 activeTab 为 'all'，允许使用标签页切换

  useEffect(() => {
    // 系统设置页面和个人页面都支持标签页切换
    //   - 如果是收藏或使用频率标签，不需要选择分类
    //   - 如果是全部标签，需要有选中分类
    if (activeTab === 'favorites' || activeTab === 'usage') {
      // 收藏或使用频率标签页，不需要分类
      fetchReplies(currentPage);
    } else if (activeTab === 'all' && selectedCategoryId) {
      // 全部标签页，需要有选中分类
      fetchReplies(currentPage);
    }
  }, [selectedCategoryId, sortBy, currentPage, activeTab, isSystemSettings]);

  const handleAddReply = () => {
    setEditingReply(null);
    form.resetFields();
    // 设置默认分类为当前选中的分类
    form.setFieldsValue({
      categoryId: selectedCategoryId,
    });
    setIsModalVisible(true);
  };

  const handleEditReply = (reply: any) => {
    setEditingReply(reply);
    form.setFieldsValue({
      content: reply.content,
      categoryId: reply.categoryId,
      // 如果不是系统设置页面，不显示全局选项
      isGlobal: isSystemSettings ? reply.isGlobal : false,
    });
    setIsModalVisible(true);
  };

  const handleSave = async (values: any) => {
    try {
      // 如果不是系统设置页面，强制设置为非全局（即使是管理员）
      if (!isSystemSettings) {
        values.isGlobal = false;
      } else if (!isAdmin) {
        // 如果是系统设置页面但不是管理员，强制设置为非全局
        values.isGlobal = false;
      }
      
      if (editingReply) {
        const isCreator = (editingReply as any).creatorId === user?.id;
        
        // ✅ 如果是管理员或创建者，更新全局回复
        // ✅ 如果不是创建者，更新个人偏好（只影响当前用户）
        if (isAdmin || isCreator) {
          await quickReplyService.updateReply((editingReply as any).id, values);
          message.success('更新成功');
        } else {
          // ✅ 更新个人偏好（只影响当前用户）
          // 只更新 content，其他字段（如 categoryId, isGlobal）不能通过个人偏好修改
          await updateUserPreference((editingReply as any).id, {
            content: values.content,
          });
          message.success('个人偏好已更新');
        }
      } else {
        // 使用表单中选择的分类，如果没有则使用当前选中的分类
        await quickReplyService.createReply({
          ...values,
          categoryId: values.categoryId || selectedCategoryId,
        });
        message.success('创建成功');
      }
      setIsModalVisible(false);
      fetchReplies(1);
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  const handleDelete = (replyId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除此快捷回复吗？',
      okText: '删除',
      cancelText: '取消',
      onOk: async () => {
        try {
          await deleteReply(replyId);
          message.success('删除成功');
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleToggleFavorite = async (replyId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    await toggleFavorite(replyId);
  };

  const handleToggleActive = async (reply: any) => {
    try {
      const newIsActive = !reply.isActive;
      const isCreator = reply.creatorId === user?.id;
      
      // ✅ 如果是管理员或创建者，更新全局状态
      // ✅ 如果不是创建者，更新个人偏好（只影响当前用户）
      if (isAdmin || isCreator) {
        await updateReply(reply.id, { isActive: newIsActive });
        message.success(newIsActive ? '已启用' : '已禁用');
      } else {
        // ✅ 更新个人偏好（只影响当前用户）
        await updateUserPreference(reply.id, { isActive: newIsActive });
        message.success(newIsActive ? '已为您启用' : '已为您禁用');
      }
      
      // 刷新列表以更新状态
      fetchReplies(currentPage);
    } catch (error: any) {
      message.error(error.message || '操作失败');
    }
  };

  // 过滤搜索结果，并再次去重（客户端双重保险）
  let filteredReplies = searchKeyword.trim()
    ? replies.filter((reply) =>
        reply.content.toLowerCase().includes(searchKeyword.toLowerCase())
      )
    : replies;

  // 客户端去重：根据 id 和内容双重去重
  const uniqueRepliesById = new Map();
  filteredReplies.forEach((reply) => {
    if (!uniqueRepliesById.has(reply.id)) {
      uniqueRepliesById.set(reply.id, reply);
    }
  });
  filteredReplies = Array.from(uniqueRepliesById.values());

  // 根据内容去重
  const uniqueRepliesByContent = new Map();
  filteredReplies.forEach((reply) => {
    const contentKey = reply.content?.trim() || '';
    if (!uniqueRepliesByContent.has(contentKey)) {
      uniqueRepliesByContent.set(contentKey, reply);
    } else {
      // 保留使用次数更高的
      const existing = uniqueRepliesByContent.get(contentKey);
      if (reply.usageCount > existing.usageCount) {
        uniqueRepliesByContent.set(contentKey, reply);
      } else if (reply.usageCount === existing.usageCount && reply.id < existing.id) {
        uniqueRepliesByContent.set(contentKey, reply);
      }
    }
  });
  filteredReplies = Array.from(uniqueRepliesByContent.values());

  return (
    <Layout className="quick-reply-settings">
      <Layout.Sider width={250} className="categories-sidebar">
        <div className="sidebar-header">
          <h3>分类列表</h3>
          {isSystemSettings && (
            <Button 
              type="primary" 
              size="small" 
              icon={<PlusOutlined />}
              onClick={() => {
                categoryForm.resetFields();
                categoryForm.setFieldsValue({ isGlobal: false, sortOrder: 0 });
                setIsCategoryModalVisible(true);
              }}
            >
              新建分类
            </Button>
          )}
        </div>
        <List
          dataSource={categories}
          renderItem={(category) => (
            <List.Item
              className={
                selectedCategoryId === category.id ? 'active' : ''
              }
              onClick={() => {
                console.log('点击分类:', category.id, category.name);
                setSelectedCategory(category.id);
              }}
              style={{ cursor: 'pointer', padding: '8px 16px' }}
            >
              <div className="category-item">
                <span>{category.name}</span>
                <span className="count">({category._count?.replies || 0})</span>
              </div>
            </List.Item>
          )}
        />
      </Layout.Sider>

      <Layout.Content className="replies-content">
        <div className="content-header">
          <h2>{isSystemSettings ? '快捷回复管理（系统设置）' : '快捷回复'}</h2>
          <Space>
            <Select
              value={isActiveFilter === null ? 'all' : isActiveFilter ? 'enabled' : 'disabled'}
              onChange={(value) => {
                setIsActiveFilter(value === 'all' ? null : value === 'enabled');
              }}
              style={{ width: 120 }}
            >
              <Select.Option value="all">全部</Select.Option>
              <Select.Option value="enabled">启用</Select.Option>
              <Select.Option value="disabled">未启用</Select.Option>
            </Select>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleAddReply}
              disabled={
                // 必须有选中的分类才能新增回复
                !selectedCategoryId
              }
            >
              新增回复
            </Button>
          </Space>
        </div>

        {/* 标签页切换 */}
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            // 确保切换到正确的标签页
            const newTab = key as 'all' | 'favorites' | 'usage';
            console.log('切换标签页:', newTab);
            setActiveTab(newTab);
            // 切换标签页时清空搜索
            setSearchKeyword('');
          }}
          style={{ marginBottom: 16 }}
          items={[
            { key: 'all', label: '全部' },
            { key: 'favorites', label: '收藏' },
            { key: 'usage', label: '使用频率' },
          ]}
        />

        {/* 搜索框 */}
        <Input
          placeholder="搜索快捷回复内容..."
          prefix={<SearchOutlined />}
          value={searchKeyword}
          onChange={(e) => setSearchKeyword(e.target.value)}
          allowClear
          style={{ marginBottom: 16, width: 300 }}
        />

        {/* 显示条件：
            - 全部标签：必须有选中的分类
            - 收藏/使用频率标签：不需要分类
        */}
        {(activeTab === 'all' && selectedCategoryId) ||
         (activeTab === 'favorites' || activeTab === 'usage') ? (
          <>
            <div className="replies-list-container">
              <Spin spinning={loading}>
                <List
                  dataSource={filteredReplies}
                  locale={{ emptyText: <Empty description={searchKeyword.trim() ? '未找到匹配的快捷回复' : '暂无数据'} /> }}
                  renderItem={(reply) => (
                    <List.Item
                      key={reply.id}
                      actions={[
                        <Button
                          type="text"
                          icon={
                            reply.isFavorited ? (
                              <HeartFilled style={{ color: 'red' }} />
                            ) : (
                              <HeartOutlined />
                            )
                          }
                          onClick={(e) => handleToggleFavorite(reply.id, e)}
                          title={reply.isFavorited ? '取消收藏' : '收藏'}
                        />,
                        <Button
                          type="text"
                          icon={reply.isActive ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                          onClick={() => handleToggleActive(reply)}
                          title={reply.isActive ? '禁用' : '启用'}
                        />,
                        <Button
                          type="text"
                          onClick={() => handleEditReply(reply)}
                          icon={<EditOutlined />}
                          title="编辑"
                        />,
                        <Button
                          type="text"
                          danger
                          onClick={() => handleDelete(reply.id)}
                          icon={<DeleteOutlined />}
                          title="删除"
                        />,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <div className="reply-content">
                            {reply.content}
                          </div>
                        }
                        description={
                          <Space>
                            <span>使用: {reply.usageCount}</span>
                            <span>收藏: {reply.favoriteCount}</span>
                            {reply.isGlobal && <Tag size="small" color="blue">全局</Tag>}
                            {!reply.isGlobal && <Tag size="small">个人</Tag>}
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              </Spin>
            </div>

            {totalReplies > 0 && (
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={totalReplies}
                onChange={(page) => fetchReplies(page)}
                style={{ marginTop: 16, textAlign: 'center', flexShrink: 0 }}
              />
            )}
          </>
        ) : (
          <Empty 
            description={
              isSystemSettings 
                ? "请选择分类查看快捷回复" 
                : "请选择分类查看快捷回复，或切换到收藏/使用频率标签"
            } 
          />
        )}

        <Modal
          title={editingReply ? '编辑快捷回复' : '新增快捷回复'}
          open={isModalVisible}
          onCancel={() => setIsModalVisible(false)}
          onOk={() => form.submit()}
        >
          <Form form={form} onFinish={handleSave} layout="vertical">
            <Form.Item
              name="categoryId"
              label="分类"
              rules={[{ required: true, message: '请选择分类' }]}
            >
              <Select
                placeholder="请选择分类"
                showSearch
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={categories.map((cat) => ({
                  label: cat.name,
                  value: cat.id,
                }))}
              />
            </Form.Item>

            <Form.Item
              name="content"
              label="回复内容"
              rules={[
                { required: true, message: '请输入回复内容' },
                { max: 300, message: '内容不超过 300 字' },
              ]}
            >
              <Input.TextArea rows={4} showCount maxLength={300} />
            </Form.Item>

            {isAdmin && isSystemSettings && (
              <Form.Item
                name="isGlobal"
                valuePropName="checked"
                initialValue={false}
              >
                <Checkbox>设置为全局模板（所有客服可见）</Checkbox>
              </Form.Item>
            )}
          </Form>
        </Modal>

        {/* 分类创建/编辑模态框 */}
        <Modal
          title="新建分类"
          open={isCategoryModalVisible}
          onCancel={() => setIsCategoryModalVisible(false)}
          onOk={() => categoryForm.submit()}
        >
          <Form 
            form={categoryForm} 
            onFinish={async (values) => {
              try {
                // 如果不是系统设置页面，强制设置为非全局（即使是管理员）
                if (!isSystemSettings) {
                  values.isGlobal = false;
                } else if (!isAdmin) {
                  // 如果是系统设置页面但不是管理员，强制设置为非全局
                  values.isGlobal = false;
                }
                await createCategory(values);
                message.success('创建成功');
                setIsCategoryModalVisible(false);
              } catch (error: any) {
                message.error(error.message || '创建失败');
              }
            }} 
            layout="vertical"
          >
            <Form.Item
              name="name"
              label="分类名称"
              rules={[{ required: true, message: '请输入分类名称' }]}
            >
              <Input placeholder="请输入分类名称" />
            </Form.Item>
            {isAdmin && isSystemSettings && (
              <Form.Item
                name="isGlobal"
                valuePropName="checked"
                initialValue={false}
              >
                <Checkbox>设置为全局分类（所有客服可见）</Checkbox>
              </Form.Item>
            )}
            <Form.Item
              name="sortOrder"
              label="排序"
              initialValue={0}
            >
              <Input type="number" placeholder="数字越小越靠前" />
            </Form.Item>
          </Form>
        </Modal>
      </Layout.Content>
    </Layout>
  );
}

