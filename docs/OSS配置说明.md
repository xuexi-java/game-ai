# 阿里云 OSS 配置说明

## 已配置的 OSS 信息

根据您提供的密钥信息，系统已配置以下 OSS 参数：

- **AccessKey ID**: `LTAI5t7pRSPCiPjPvwQ3spDn`
- **AccessKey Secret**: `B9xndkE3rjjIuAQgxEEGaThiv0UUxIA`
- **Bucket 名称**: `game-ai-cs`
- **地域**: `oss-cn-shenzhen` (华南1-深圳)
- **Endpoint**: `oss-cn-shenzhen.aliyuncs.com`

## 配置位置

请在 `backend/.env` 文件中添加以下配置：

```env
# 阿里云 OSS 配置
OSS_ACCESS_KEY_ID=LTAI5t7pRSPCiPjPvwQ3spDn
OSS_ACCESS_KEY_SECRET=B9xndkE3rjjIuAQgxEEGaThiv0UUxIA
OSS_BUCKET=game-ai-cs
OSS_REGION=oss-cn-shenzhen
OSS_ENDPOINT=oss-cn-shenzhen.aliyuncs.com
```

## 使用说明

### 自动检测机制

系统会自动检测是否配置了 OSS：
- **已配置 OSS**：所有文件（头像、工单附件）自动上传到阿里云 OSS
- **未配置 OSS**：文件存储在本地 `uploads` 目录

### 存储路径

- **头像文件**: `avatars/{userId}/{uuid}.{ext}`
- **工单附件**: `tickets/{ticketId}/{uuid}.{ext}`

### 访问 URL

配置 OSS 后，上传的文件会返回完整的 OSS URL，例如：
```
https://game-ai-cs.oss-cn-shenzhen.aliyuncs.com/avatars/user-123/xxx.jpg
```

## 安全建议

⚠️ **重要提示**：
1. `.env` 文件已添加到 `.gitignore`，不会被提交到 Git
2. 生产环境建议定期轮换 AccessKey
3. 建议为 OSS Bucket 配置适当的访问权限策略
4. 当前 Bucket 设置为"公共读写"，生产环境建议改为"私有"并使用签名 URL

## 验证配置

配置完成后，重启后端服务，上传头像或附件时：
- 如果成功上传到 OSS，文件 URL 会是完整的 HTTPS 地址
- 如果仍使用本地存储，文件 URL 会是相对路径

