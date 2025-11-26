import React, { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Switch,
  Button,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Typography,
  Tag,
  Popconfirm,
  Select,
  Tabs,
  Collapse,
  List,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useMessage } from '../../../hooks/useMessage';
import {
  getQuickReplyGroups,
  createQuickReplyGroup,
  updateQuickReplyGroup,
  deleteQuickReplyGroup,
  createQuickReplyItem,
  updateQuickReplyItem,
  deleteQuickReplyItem,
  type QuickReplyGroup,
  type QuickReplyItem,
} from '../../../services/quickReply.service';
import { getGames } from '../../../services/game.service';
import type { Game } from '../../../types';
import './index.css';

const { TextArea } = Input;
const { Panel } = Collapse;

interface GroupFormValues {
  name: string;
  sortOrder: number;
  gameId?: string;
  enabled: boolean;
}

interface ItemFormValues {
  content: string;
  groupId: number;
  shortcut?: string;
  sortOrder: number;
}

const QuickRepliesPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<QuickReplyGroup[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<QuickReplyGroup | null>(null);
  const [editingItem, setEditingItem] = useState<QuickReplyItem | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const message = useMessage();

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [groupsData, gamesData] = await Promise.all([
        getQuickReplyGroups(selectedGameId || undefined),
        getGames(),
      ]);
      setGroups(groupsData);
      setGames(Array.isArray(gamesData) ? gamesData : []);
    } catch (error: any) {
      let errorMessage = '加载数据失败';
      
      if (error?.response?.status === 404) {
        errorMessage = 'API 路由不存在，请检查后端服务是否已重启';
      } else if (error?.response?.status === 403) {
        errorMessage = '权限不足，需要管理员权限';
      } else if (error?.response?.status === 401) {
        errorMessage = '登录已过期，请重新登录';
      } else if (error?.response?.status === 500) {
        // 500错误，尝试从响应中获取详细错误信息
        const serverMessage = error?.response?.data?.message || error?.message;
        if (serverMessage) {
          errorMessage = `服务器错误: ${serverMessage}`;
        } else {
          errorMessage = '服务器内部错误，请检查后端日志';
        }
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      message.error(errorMessage);
      console.error('加载数据失败:', error);
      console.error('错误详情:', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedGameId]);

  // 打开新建/编辑分组弹窗
  const handleOpenGroupModal = (group?: QuickReplyGroup) => {
    if (group) {
      setEditingGroup(group);
      groupForm.setFieldsValue({
        name: group.name,
        sortOrder: group.sortOrder,
        gameId: group.gameId || undefined,
        enabled: group.enabled,
      });
    } else {
      setEditingGroup(null);
      groupForm.resetFields();
      groupForm.setFieldsValue({
        enabled: true,
        sortOrder: 0,
        gameId: selectedGameId || undefined,
      });
    }
    setGroupModalOpen(true);
  };

  // 保存分组
  const handleSaveGroup = async () => {
    try {
      const values = await groupForm.validateFields();
      if (editingGroup) {
        await updateQuickReplyGroup(editingGroup.id, values);
        message.success('更新分组成功');
      } else {
        await createQuickReplyGroup(values);
        message.success('创建分组成功');
      }
      setGroupModalOpen(false);
      loadData();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(editingGroup ? '更新分组失败' : '创建分组失败');
    }
  };

  // 删除分组
  const handleDeleteGroup = async (id: number) => {
    try {
      await deleteQuickReplyGroup(id);
      message.success('删除分组成功');
      loadData();
    } catch (error: any) {
      message.error('删除分组失败');
    }
  };

  // 打开新建/编辑回复项弹窗
  const handleOpenItemModal = (item?: QuickReplyItem, groupId?: number) => {
    if (item) {
      setEditingItem(item);
      itemForm.setFieldsValue({
        content: item.content,
        groupId: item.groupId,
        shortcut: item.shortcut || undefined,
        sortOrder: item.sortOrder,
      });
      setSelectedGroupId(item.groupId);
    } else {
      setEditingItem(null);
      itemForm.resetFields();
      itemForm.setFieldsValue({
        groupId: groupId || selectedGroupId || undefined,
        sortOrder: 0,
      });
      setSelectedGroupId(groupId || null);
    }
    setItemModalOpen(true);
  };

  // 保存回复项
  const handleSaveItem = async () => {
    try {
      const values = await itemForm.validateFields();
      if (editingItem) {
        await updateQuickReplyItem(editingItem.id, values);
        message.success('更新回复项成功');
      } else {
        await createQuickReplyItem(values);
        message.success('创建回复项成功');
      }
      setItemModalOpen(false);
      loadData();
    } catch (error: any) {
      if (error.errorFields) return;
      message.error(editingItem ? '更新回复项失败' : '创建回复项失败');
    }
  };

  // 删除回复项
  const handleDeleteItem = async (id: number) => {
    try {
      await deleteQuickReplyItem(id);
      message.success('删除回复项成功');
      loadData();
    } catch (error: any) {
      message.error('删除回复项失败');
    }
  };

  const groupColumns: ColumnsType<QuickReplyGroup> = [
    {
      title: '分组名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '游戏',
      key: 'game',
      render: (_, record) => (
        record.game ? (
          <Tag color="orange">{record.game.name}</Tag>
        ) : (
          <Tag color="default">通用</Tag>
        )
      ),
    },
    {
      title: '回复数量',
      key: 'itemCount',
      render: (_, record) => (
        <Tag color="blue">{record.items?.length || 0}</Tag>
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 100,
      render: (enabled: boolean, record) => (
        <Switch
          checked={enabled}
          onChange={(checked) => {
            updateQuickReplyGroup(record.id, { enabled: checked })
              .then(() => {
                message.success(`${checked ? '启用' : '禁用'}成功`);
                loadData();
              })
              .catch(() => {
                message.error(`${checked ? '启用' : '禁用'}失败`);
              });
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleOpenItemModal(undefined, record.id)}
          >
            添加回复
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenGroupModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个分组吗？"
            onConfirm={() => handleDeleteGroup(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="quick-replies-page">
      <Card
        title="快捷回复管理"
        extra={
          <Space>
            <Select
              placeholder="选择游戏"
              style={{ width: 200 }}
              value={selectedGameId || undefined}
              onChange={(value) => setSelectedGameId(value || '')}
              allowClear
            >
              {games.map((game) => (
                <Select.Option key={game.id} value={game.id}>
                  {game.name}
                </Select.Option>
              ))}
            </Select>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenGroupModal()}>
              新建分组
            </Button>
          </Space>
        }
      >
        <Collapse defaultActiveKey={groups.map((g) => g.id.toString())}>
          {groups.map((group) => (
            <Panel
              key={group.id}
              header={
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 500 }}>{group.name}</span>
                  {group.game && <Tag color="orange">{group.game.name}</Tag>}
                  {!group.game && <Tag color="default">通用</Tag>}
                  <Tag color="blue">{group.items?.length || 0} 条回复</Tag>
                  <span style={{ fontSize: 12, color: '#999' }}>
                    排序: {group.sortOrder}
                  </span>
                </div>
              }
              extra={
                <Space>
                  <Button
                    type="link"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenItemModal(undefined, group.id);
                    }}
                  >
                    添加回复
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenGroupModal(group);
                    }}
                  >
                    编辑
                  </Button>
                </Space>
              }
            >
              <List
                size="small"
                dataSource={group.items || []}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Button
                        key="edit"
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleOpenItemModal(item)}
                      >
                        编辑
                      </Button>,
                      <Popconfirm
                        key="delete"
                        title="确定要删除这个回复吗？"
                        onConfirm={() => handleDeleteItem(item.id)}
                      >
                        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>,
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{item.content.length > 50 ? `${item.content.substring(0, 50)}...` : item.content}</span>
                          {item.shortcut && <Tag color="purple">{item.shortcut}</Tag>}
                          <span style={{ fontSize: 12, color: '#999' }}>
                            使用 {item.usageCount} 次
                          </span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
              {(!group.items || group.items.length === 0) && (
                <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                  暂无回复，点击"添加回复"创建
                </div>
              )}
            </Panel>
          ))}
        </Collapse>
        {groups.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            暂无分组，点击"新建分组"创建
          </div>
        )}
      </Card>

      {/* 分组编辑弹窗 */}
      <Modal
        title={editingGroup ? '编辑分组' : '新建分组'}
        open={groupModalOpen}
        onOk={handleSaveGroup}
        onCancel={() => {
          setGroupModalOpen(false);
          setEditingGroup(null);
          groupForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={groupForm} layout="vertical">
          <Form.Item
            label="分组名称"
            name="name"
            rules={[{ required: true, message: '请输入分组名称' }]}
          >
            <Input placeholder="例如：充值问题" maxLength={50} />
          </Form.Item>

          <Form.Item
            label="关联游戏"
            name="gameId"
            tooltip="选择游戏后，该分组的回复仅在该游戏中显示。留空表示通用（所有游戏可用）"
          >
            <Select placeholder="选择游戏（可选，留空表示通用）" allowClear>
              {games.map((game) => (
                <Select.Option key={game.id} value={game.id}>
                  {game.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="排序"
            name="sortOrder"
            rules={[{ type: 'number', min: 0, message: '排序值不能小于0' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item label="状态" name="enabled" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="禁用" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 回复项编辑弹窗 */}
      <Modal
        title={editingItem ? '编辑回复' : '新建回复'}
        open={itemModalOpen}
        onOk={handleSaveItem}
        onCancel={() => {
          setItemModalOpen(false);
          setEditingItem(null);
          itemForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item
            label="所属分组"
            name="groupId"
            rules={[{ required: true, message: '请选择分组' }]}
          >
            <Select placeholder="选择分组">
              {groups.map((group) => (
                <Select.Option key={group.id} value={group.id}>
                  {group.name}
                  {group.game && ` (${group.game.name})`}
                  {!group.game && ' (通用)'}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="回复内容"
            name="content"
            rules={[{ required: true, message: '请输入回复内容' }]}
          >
            <TextArea
              placeholder="例如：您好，请问有什么可以帮助您的吗？"
              rows={4}
              maxLength={500}
              showCount
            />
          </Form.Item>

          <Form.Item
            label="快捷键"
            name="shortcut"
            tooltip="输入 / 开头的快捷键，例如：/hi、/充值。在输入框中输入 / 可快速搜索"
          >
            <Input placeholder="例如：/hi（可选）" maxLength={20} />
          </Form.Item>

          <Form.Item
            label="排序"
            name="sortOrder"
            rules={[{ type: 'number', min: 0, message: '排序值不能小于0' }]}
          >
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default QuickRepliesPage;

