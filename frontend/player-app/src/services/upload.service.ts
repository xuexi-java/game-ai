/**
 * 文件上传服务
 */
import apiClient from './api';

export interface UploadResponse {
  fileUrl: string;
  fileName: string;
  fileType: string;
  fileSize: number;
}

/**
 * 上传工单附件
 */
export interface UploadTicketAttachmentPayload {
  ticketId?: string;
  ticketToken?: string;
}

export const uploadTicketAttachment = async (
  file: File,
  payload: UploadTicketAttachmentPayload,
): Promise<UploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  if (payload.ticketId) {
    formData.append('ticketId', payload.ticketId);
  }
  if (payload.ticketToken) {
    formData.append('ticketToken', payload.ticketToken);
  }

  return apiClient.post('/upload/ticket-attachment', formData);
};
