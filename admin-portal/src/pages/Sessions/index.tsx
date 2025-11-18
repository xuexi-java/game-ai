import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Tag,
  Space,
  Input,
  Select,
  Button,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  SearchOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Session, User } from '../../types';
import {
  getSessions,
  type SessionQueryParams,
} from '../../services/session.service';
import { getUsers } from '../../services/user.service';
import { useAuthStore } from '../../stores/authStore';
import { useMessage } from '../../hooks/useMessage';
import './index.css';

const { Option } = Select;
const { Title } = Typography;

const statusMap: Record<
  Session['status'],
  { text: string; color: string }
> = {
  PENDING: { text: '待识别', color: 'default' },
  QUEUED: { text: '排队中', color: 'processing' },
  IN_PROGRESS: { text: '处理中', color: 'warning' },
  CLOSED: { text: '已关闭', color: 'success' },
};

const SessionsPage: React.FC = () => {
  const { user } = useAuthStore();
  const message = useMessage();
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [agents, setAgents] = useState<User[]>([]);
  const [filters, setFilters] = useState({
    status: '',
    agentId: '',
    search: '',
  });

  const isAdmin = user?.role === 'ADMIN';

  const loadSessions = async () => {
    setLoading(true);
    try {
      const params: SessionQueryParams = {
        page: currentPage,
        pageSize,
        status: filters.status || undefined,
        search: filters.search ? filters.search.trim() : undefined,
      };

      if (isAdmin && filters.agentId) {
        params.agentId = filters.agentId;
      }

      const result = await getSessions(params);
      setSessions(result.items ?? []);
      setTotal(result.total ?? 0);
    } catch (error) {
      console.error('加载会话列表失败:', error);
      message.error('加载会话失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAdmin) {
      setAgents([]);
      return;
    }

    const fetchAgents = async () => {
      try {
        const result = await getUsers({ role: 'AGENT', page: 1, pageSize: 100 });
        setAgents(result.items ?? []);
      } catch (error) {
        console.error('加载客服列表失败:', error);
      }
    };

    fetchAgents();
  }, [isAdmin]);

  useEffect(() => {
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, filters.status, filters.agentId, filters.search]);

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value }));
    setCurrentPage(1);
  };

  const columns: ColumnsType<Session> = useMemo(
    () => [
      {
        title: '会话ID',
        dataIndex: 'id',
        key: 'id',
        width: 200,
        ellipsis: true,
      },
      {
        title: '工单编号',
        dataIndex: ['ticket', 'ticketNo'],
        key: 'ticketNo',
        width: 160,
        render: (_, record) => record.ticket?.ticketNo || '-',
      },
      {
        title: '游戏',
        dataIndex: ['ticket', 'game', 'name'],
        key: 'game',
        width: 140,
        render: (_, record) => record.ticket?.game?.name || '-',
      },
      {
        title: '区服',
        key: 'server',
        width: 120,
        render: (_, record) => record.ticket?.server?.name || '-',
      },
      {
        title: '玩家ID/昵称',
        dataIndex: ['ticket', 'playerIdOrName'],
        key: 'player',
        width: 160,
      },
      {
        title: '状态',
        dataIndex: 'status',
        key: 'status',
        width: 120,
        render: (status: Session['status']) => {
          const info = statusMap[status];
          return <Tag color={info.color}>{info.text}</Tag>;
        },
      },
      {
        title: '处理客服',
        key: 'agent',
        width: 160,
        render: (_, record) =>
          record.agent?.realName ||
          record.agent?.username ||
          (record.agentId ? record.agentId : '-'),
      },
      {
        title: '排队时间',
        dataIndex: 'queuedAt',
        key: 'queuedAt',
        width: 180,
        render: (value?: string) =>
          value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-',
      },
      {
        title: '更新时间',
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        width: 180,
        render: (value?: string) =>
          value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-',
      },
    ],
    [],
  );

  return (
    <div className="sessions-page">
      <Card className="sessions-card">
        <div className="sessions-card__header">
          <div className="sessions-card__title">
            <MessageOutlined />
            <Title level={4}>会话管理</Title>
          </div>

          <Space size="middle" wrap>
            <Input
              placeholder="搜索工单编号或玩家"
              prefix={<SearchOutlined />}
              allowClear
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: 240 }}
            />

            <Select
              placeholder="状态"
              value={filters.status}
              onChange={(value) => {
                setFilters((prev) => ({ ...prev, status: value || '' }));
                setCurrentPage(1);
              }}
              allowClear
              style={{ width: 150 }}
            >
              {Object.entries(statusMap).map(([key, info]) => (
                <Option key={key} value={key}>
                  {info.text}
                </Option>
              ))}
            </Select>

            {isAdmin && (
              <Select
                placeholder="客服"
                value={filters.agentId}
                onChange={(value) => {
                  setFilters((prev) => ({ ...prev, agentId: value || '' }));
                  setCurrentPage(1);
                }}
                allowClear
                style={{ width: 180 }}
              >
                {agents.map((agent) => (
                  <Option key={agent.id} value={agent.id}>
                    {agent.realName || agent.username}
                  </Option>
                ))}
              </Select>
            )}

            <Button
              icon={<ReloadOutlined />}
              onClick={loadSessions}
              loading={loading}
            >
              刷新
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={sessions}
          rowKey="id"
          loading={loading}
          pagination={{
            current: currentPage,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
            showTotal: (t) => `共 ${t} 条`,
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default SessionsPage;
