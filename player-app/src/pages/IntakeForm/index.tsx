/**
 * 步骤3：前置分流表单页面
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Form, 
  Input, 
  Button, 
  Card, 
  Upload, 
  DatePicker, 
  message,
  Space,
  Typography,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import dayjs from 'dayjs';
import { createTicket } from '../../services/ticket.service';
import { uploadTicketAttachment } from '../../services/upload.service';
import { useTicketStore } from '../../stores/ticketStore';
import { createSession } from '../../services/session.service';

const { TextArea } = Input;
const { Title } = Typography;

const IntakeFormPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const { gameId, serverId, playerIdOrName, setTicket } = useTicketStore();

  // 如果没有身份信息，跳转到身份验证页面
  if (!gameId || !serverId || !playerIdOrName) {
    navigate('/identity-check');
    return null;
  }

  // 处理文件上传
  const handleUpload = async (file: File): Promise<string> => {
    // 先创建工单（临时），然后上传文件
    // 这里我们需要先提交表单，然后再上传文件
    // 为了简化，我们在这里先返回一个占位符
    return '';
  };

  // 提交表单
  const handleSubmit = async (values: {
    description: string;
    occurredAt?: dayjs.Dayjs;
    paymentOrderNo?: string;
  }) => {
    setLoading(true);
    try {
      // 1. 先创建工单
      const ticketData = {
        gameId: gameId!,
        serverId: serverId!,
        playerIdOrName: playerIdOrName!,
        description: values.description,
        occurredAt: values.occurredAt?.toISOString(),
        paymentOrderNo: values.paymentOrderNo,
        attachments: [], // 先不传附件，后续再上传
      };

      const ticket = await createTicket(ticketData);

      // 保存工单信息
      setTicket(ticket.id, ticket.ticketNo, ticket.token);

      // 2. 上传附件（如果有）
      if (fileList.length > 0) {
        const uploadPromises = fileList.map((file) => {
          if (file.originFileObj) {
            return uploadTicketAttachment(file.originFileObj, ticket.id);
          }
          return Promise.resolve(null);
        });
        await Promise.all(uploadPromises);
      }

      // 3. 创建会话
      const session = await createSession({ ticketId: ticket.id });

      // 4. 跳转到聊天页面
      navigate(`/chat/${session.id}`);
    } catch (error: any) {
      console.error('提交表单失败:', error);
      message.error(error.response?.data?.message || '提交失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '20px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Card>
          <Title level={3} style={{ textAlign: 'center', marginBottom: '24px' }}>
            问题反馈表单
          </Title>

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
          >
            <Form.Item
              label="问题描述"
              name="description"
              rules={[{ required: true, message: '请输入问题描述' }]}
            >
              <TextArea
                rows={6}
                placeholder="请详细描述您遇到的问题..."
                maxLength={2000}
                showCount
              />
            </Form.Item>

            <Form.Item
              label="问题发生时间"
              name="occurredAt"
            >
              <DatePicker
                showTime
                style={{ width: '100%' }}
                placeholder="选择问题发生的时间（可选）"
              />
            </Form.Item>

            <Form.Item
              label="问题截图"
              name="attachments"
            >
              <Upload
                listType="picture-card"
                fileList={fileList}
                onChange={({ fileList: newFileList }) => {
                  setFileList(newFileList.slice(0, 9)); // 最多9张
                }}
                beforeUpload={() => false} // 阻止自动上传
                accept="image/jpeg,image/png,image/gif"
                maxCount={9}
              >
                {fileList.length < 9 && (
                  <div>
                    <UploadOutlined />
                    <div style={{ marginTop: 8 }}>上传</div>
                  </div>
                )}
              </Upload>
              <div style={{ color: '#999', fontSize: '12px', marginTop: '8px' }}>
                支持 JPG、PNG、GIF 格式，最多上传 9 张图片
              </div>
            </Form.Item>

            <Form.Item
              label="最近一笔充值订单号"
              name="paymentOrderNo"
            >
              <Input
                placeholder="请输入充值订单号（可选，用于身份验证）"
              />
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                block 
                size="large"
                loading={loading}
              >
                提交并开始咨询
              </Button>
            </Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
};

export default IntakeFormPage;

