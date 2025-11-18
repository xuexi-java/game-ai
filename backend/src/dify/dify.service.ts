import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface DifyMessageResult {
  text: string;
  status?: number | string;
  suggestedOptions: string[];
  detectedIntent: string;
  urgency: 'urgent' | 'non_urgent';
  metadata?: any;
  conversationId?: string;
}

@Injectable()
export class DifyService {
  private axiosInstance: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.axiosInstance = axios.create({
      timeout: 30000,
    });
  }

  /**
   * 调用Dify进行问题分流（使用工作流API）
   * 注意：如果您的Dify配置使用的是工作流，使用此方法
   */
  async triage(
    description: string,
    apiKey: string,
    baseUrl: string,
  ): Promise<DifyMessageResult> {
    try {
      // 尝试使用工作流API（如果配置了工作流）
      const response = await this.axiosInstance.post(
        `${baseUrl}/workflows/run`,
        {
          inputs: {
            description,
          },
          response_mode: 'blocking',
          user: 'system',
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // 解析Dify返回的数据
      const output =
        response.data?.outputs || response.data?.data?.outputs || response.data;
      return this.parseResult(output);
    } catch (error: any) {
      console.error('Dify 工作流API调用失败，尝试使用对话API:', error.message);

      // 如果工作流API失败，尝试使用对话API
      try {
        return await this.triageWithChatAPI(description, apiKey, baseUrl);
      } catch (chatError: any) {
        console.error('Dify 对话API调用失败:', chatError.message);

        // 返回默认响应
        return {
          text: '您好，感谢您的反馈。我们正在为您处理，请稍候...',
          suggestedOptions: ['转人工客服', '查看常见问题'],
          detectedIntent: 'unknown',
          urgency: 'non_urgent',
        };
      }
    }
  }

  /**
   * 使用对话API进行问题分流
   * 根据您提供的API文档，使用 /chat-messages 端点
   */
  async triageWithChatAPI(
    description: string,
    apiKey: string,
    baseUrl: string,
  ): Promise<DifyMessageResult> {
    try {
      const response = await this.axiosInstance.post(
        `${baseUrl}/chat-messages`,
        {
          inputs: {
            description,
          },
          query: description,
          response_mode: 'blocking',
          user: 'system',
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      // 解析Dify对话API返回的数据
      const parsed = this.parseResult(response.data);
      if (!parsed.text) {
        parsed.text = '您好，我正在为您分析问题...';
      }
      if (!parsed.suggestedOptions.length) {
        parsed.suggestedOptions = ['转人工客服', '查看常见问题'];
      }
      return parsed;
    } catch (error: any) {
      throw error;
    }
  }

  /**
   * 发送对话消息（支持会话持久化）
   * 根据您提供的API文档：POST /chat-messages
   */
  async sendChatMessage(
    query: string,
    apiKey: string,
    baseUrl: string,
    conversationId?: string,
    userId?: string,
  ): Promise<DifyMessageResult> {
    try {
      const requestBody: any = {
        inputs: {},
        query,
        response_mode: 'blocking',
        user: userId || 'system',
      };

      // 如果提供了会话ID，添加到请求中（支持会话持久化）
      if (conversationId) {
        requestBody.conversation_id = conversationId;
      }

      const response = await this.axiosInstance.post(
        `${baseUrl}/chat-messages`,
        requestBody,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const parsed = this.parseResult(response.data);
      parsed.conversationId =
        response.data?.conversation_id ?? parsed.conversationId;
      return parsed;
    } catch (error: any) {
      console.error('Dify发送对话消息失败:', error.message);
      throw new HttpException(
        `Dify API调用失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 优化客服回复（AI辅助）
   * 使用对话API优化回复内容
   */
  async optimizeReply(
    content: string,
    context: string,
    apiKey: string,
    baseUrl: string,
    conversationId?: string,
  ): Promise<string> {
    try {
      const query = `请优化以下客服回复内容，使其更加专业和友好：\n${content}\n\n上下文信息：\n${context}`;

      const response = await this.sendChatMessage(
        query,
        apiKey,
        baseUrl,
        conversationId,
        'system',
      );

      return response.text || content;
    } catch (error: any) {
      console.error('Dify优化回复失败:', error.message);
      return content; // 失败时返回原文
    }
  }

  /**
   * 获取会话历史消息
   * GET /messages?conversation_id={conversation_id}
   */
  async getConversationHistory(
    conversationId: string,
    apiKey: string,
    baseUrl: string,
    limit: number = 20,
  ): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get(`${baseUrl}/messages`, {
        params: {
          conversation_id: conversationId,
          limit,
        },
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      return response.data?.data || [];
    } catch (error: any) {
      console.error('获取会话历史失败:', error.message);
      return [];
    }
  }

  /**
   * 获取会话列表
   * GET /conversations
   */
  async getConversationList(
    apiKey: string,
    baseUrl: string,
    userId?: string,
    limit: number = 20,
  ): Promise<any[]> {
    try {
      const response = await this.axiosInstance.get(
        `${baseUrl}/conversations`,
        {
          params: {
            user: userId || 'system',
            limit,
          },
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        },
      );

      return response.data?.data || [];
    } catch (error: any) {
      console.error('获取会话列表失败:', error.message);
      return [];
    }
  }

  private parseResult(payload: any): DifyMessageResult {
    if (!payload || typeof payload !== 'object') {
      return {
        text: '',
        suggestedOptions: [],
        detectedIntent: 'unknown',
        urgency: 'non_urgent',
      };
    }

    const metadata = payload.metadata || payload.data?.metadata || {};
    let text =
      payload.text ||
      payload.answer ||
      payload.output ||
      payload.initial_reply ||
      metadata.text ||
      payload.content ||
      '';

    // 处理 Dify 返回的 JSON 格式文本（包含 </think> 和 JSON）
    if (typeof text === 'string' && text.includes('</think>')) {
      // 提取 JSON 部分
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[0]);
          // 如果 JSON 中有 text 字段，使用它
          if (jsonData.text) {
            text = jsonData.text;
          }
          // 如果 JSON 中有 status，使用它
          if (jsonData.status !== undefined) {
            metadata.status = jsonData.status;
          }
        } catch (e) {
          // JSON 解析失败，继续使用原始文本
          console.warn('解析 Dify JSON 失败:', e);
        }
      }
      // 移除 </think> 标记和 JSON 部分
      text = text.replace(/<\/redacted_reasoning>[\s\S]*$/, '').trim();
    }

    // 尝试从文本中提取 JSON（如果整个文本是 JSON）
    if (typeof text === 'string' && text.trim().startsWith('{') && text.trim().endsWith('}')) {
      try {
        const jsonData = JSON.parse(text);
        if (jsonData.text) {
          text = jsonData.text;
        }
        if (jsonData.status !== undefined) {
          metadata.status = jsonData.status;
        }
      } catch (e) {
        // 不是有效的 JSON，继续使用原始文本
      }
    }

    const status =
      payload.status ??
      payload.state ??
      payload.workflow_status ??
      metadata.status ??
      metadata.workflow_status;

    const suggestedOptions =
      payload.suggested_options ||
      metadata.suggested_options ||
      payload.options ||
      [];

    const detected_intent =
      payload.detected_intent || metadata.detected_intent || 'unknown';

    const urgencyValue =
      payload.urgency || metadata.urgency || payload.priority || 'non_urgent';

    return {
      text,
      status,
      suggestedOptions: Array.isArray(suggestedOptions) ? suggestedOptions : [],
      detectedIntent: detected_intent,
      urgency: urgencyValue === 'urgent' ? 'urgent' : 'non_urgent',
      metadata,
      conversationId: payload.conversation_id,
    };
  }
}
