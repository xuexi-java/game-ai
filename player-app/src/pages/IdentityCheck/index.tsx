/**
 * 步骤1：身份验证页面
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Select, Input, Button, Card, Modal, Typography } from 'antd';
import { getEnabledGames, type Game } from '../../services/game.service';
import { getEnabledIssueTypes, type IssueType } from '../../services/issue-type.service';
import { useTicketStore } from '../../stores/ticketStore';
import { validateGameId, validatePlayerIdOrName } from '../../utils/validation';
import { useMessage } from '../../hooks/useMessage';
import { checkOpenTicketByIssueType } from '../../services/ticket.service';
import './index.css';

const { Option } = Select;
const { Title, Text } = Typography;

const IdentityCheckPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [games, setGames] = useState<Game[]>([]);
  const [issueTypes, setIssueTypes] = useState<IssueType[]>([]);
  const [loading, setLoading] = useState(false);
  const messageApi = useMessage();
  const { setIdentity, setIssueTypes: setStoreIssueTypes } = useTicketStore();

  // 加载游戏列表和问题类型
  useEffect(() => {
    const loadData = async () => {
      try {
        const [gameList, issueTypeList] = await Promise.all([
          getEnabledGames(),
          getEnabledIssueTypes(),
        ]);
        
        // 确保 gameList 是数组
        if (Array.isArray(gameList)) {
          setGames(gameList);
        } else {
          console.warn('游戏列表格式不正确:', gameList);
          setGames([]);
        }

        // 设置问题类型
        if (Array.isArray(issueTypeList)) {
          setIssueTypes(issueTypeList);
        }
      } catch (error) {
        console.error('加载数据失败:', error);
        // 如果后端未运行，使用模拟数据
        setGames([
          {
            id: '1',
            name: '弹弹堂',
            enabled: true,
            servers: [
              { id: 'server-1', name: '一区', enabled: true },
              { id: 'server-2', name: '二区', enabled: true },
            ],
          },
          {
            id: '2',
            name: '神曲',
            enabled: true,
            servers: [{ id: 'server-3', name: '一区', enabled: true }],
          },
        ]);
        messageApi.warning('后端服务未连接，使用模拟数据');
      }
    };
    loadData();
  }, [messageApi]);



  // 提交表单
  const handleSubmit = async (values: {
    gameId: string;
    serverName: string;
    playerIdOrName: string;
    issueTypeId: string;
  }) => {
    setLoading(true);
    try {
      // 保存身份信息和问题类型到 store
      setIdentity({
        gameId: values.gameId,
        serverId: undefined,
        serverName: values.serverName,
        playerIdOrName: values.playerIdOrName,
      });

      // 验证并保存选中的问题类型
      if (!values.issueTypeId || typeof values.issueTypeId !== 'string') {
        messageApi.error('问题类型选择无效，请重新选择');
        setLoading(false);
        return;
      }

      // 保存选中的问题类型（不再验证 UUID 格式，因为数据库中的 ID 可能是字符串格式）
      setStoreIssueTypes([values.issueTypeId]);

      // 检查是否有相同问题类型的未完成工单（使用 serverName）
      const result = await checkOpenTicketByIssueType({
        gameId: values.gameId,
        serverId: values.serverName, // 使用 serverName 作为标识
        playerIdOrName: values.playerIdOrName,
        issueTypeId: values.issueTypeId,
      });

      if (result.hasOpenTicket && result.ticket) {
        // 询问玩家是否继续上次的工单
        Modal.confirm({
          title: '检测到未完成的工单',
          content: `您有一个相同问题类型的未完成工单（${result.ticket.ticketNo}），是否继续处理该工单？`,
          okText: '继续处理',
          cancelText: '创建新工单',
          onOk: () => {
            navigate('/escape-hatch', {
              state: {
                ticket: result.ticket,
              },
            });
          },
          onCancel: () => {
            navigate('/intake-form');
          },
        });
        return;
      }

      // 没有未完成工单，直接进入下一步
      navigate('/intake-form');
    } catch (error: unknown) {
      console.error('身份验证失败:', error);
      messageApi.error('身份验证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <Card 
        title={
          <div style={{ textAlign: 'center' }}>
            <Title level={3} style={{ margin: 0, color: '#1a202c' }}>
              身份验证
            </Title>
            <Text type="secondary" style={{ fontSize: 14, marginTop: 8, display: 'block' }}>
              请填写以下信息以开始反馈
            </Text>
          </div>
        }
        className="page-card"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
          className="enhanced-form"
        >
          <Form.Item
            label="选择游戏"
            name="gameId"
            rules={[{ validator: validateGameId }]}
          >
            <Select
              placeholder="请选择游戏"
              size="large"
              showSearch
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {Array.isArray(games) &&
                games.map((game) => (
                  <Option key={game.id} value={game.id}>
                    {game.name}
                  </Option>
                ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="输入区服"
            name="serverName"
            rules={[
              { required: true, message: '请输入区服名称' },
              { max: 50, message: '区服名称不能超过50个字符' },
            ]}
          >
            <Input 
              placeholder="请输入区服名称，例如：一区、二区" 
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="角色ID或昵称"
            name="playerIdOrName"
            rules={[{ validator: validatePlayerIdOrName }]}
          >
            <Input 
              placeholder="请输入角色ID或昵称" 
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="问题类型"
            name="issueTypeId"
            rules={[{ required: true, message: '请选择问题类型' }]}
          >
            <Select
              placeholder="请选择问题类型"
              size="large"
              showSearch
              filterOption={(input, option) =>
                (option?.children as unknown as string)?.toLowerCase().includes(input.toLowerCase())
              }
              onChange={(value) => {
                console.log('选择的问题类型 ID:', value);
              }}
            >
              {issueTypes.map((type) => (
                <Option key={type.id} value={type.id}>
                  {type.icon} {type.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              size="large"
              loading={loading}
            >
              下一步
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default IdentityCheckPage;
