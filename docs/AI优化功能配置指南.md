# AI 优化功能配置指南

## 📋 功能说明

AI 优化功能允许客服在发送消息前，使用 Dify AI 优化回复内容，使其更加专业和友好。

**功能位置**: 管理端工作台 → 会话详情 → 消息输入框 → "AI优化" 按钮

---

## 🔧 配置步骤

### 1. 创建环境变量文件

在 `admin-portal/` 目录下创建 `.env` 文件：

```env
# Dify AI 配置（用于 AI 优化功能）
VITE_DIFY_BASE_URL=http://118.89.16.95/v1
VITE_DIFY_API_KEY=your-dify-api-key-here
VITE_DIFY_APP_MODE=chat
VITE_DIFY_WORKFLOW_ID=your-workflow-id-here
```

### 2. 配置说明

#### 必需配置

- **VITE_DIFY_BASE_URL**: Dify API 服务器地址
  - 格式：`http://your-dify-server/v1` 或 `https://your-dify-server/v1`
  - 示例：`http://118.89.16.95/v1`

- **VITE_DIFY_API_KEY**: Dify API 密钥
  - 格式：通常以 `app-` 或 `sk-` 开头
  - 获取方式：登录 Dify 控制台 → 应用设置 → 生成 API Key

#### 可选配置

- **VITE_DIFY_APP_MODE**: 应用模式
  - 可选值：`chat`（对话模式）或 `workflow`（工作流模式）
  - 默认值：`chat`
  - 说明：如果使用工作流模式，需要同时配置 `VITE_DIFY_WORKFLOW_ID`

- **VITE_DIFY_WORKFLOW_ID**: 工作流 ID
  - 格式：UUID 字符串
  - 说明：仅在 `VITE_DIFY_APP_MODE=workflow` 时需要配置
  - 获取方式：在 Dify 控制台的工作流详情中查看

### 3. 重启开发服务器

配置完成后，需要重启前端开发服务器：

```bash
cd admin-portal
# 停止当前服务器（Ctrl+C）
npm run dev
```

---

## ✅ 验证配置

### 1. 检查配置是否生效

1. 打开管理端工作台
2. 选择一个会话
3. 在消息输入框中输入一些文本
4. 点击"AI优化"按钮
5. 查看是否成功优化

### 2. 检查控制台日志

在开发环境下，打开浏览器控制台（F12），查看是否有配置信息输出：

```
当前使用的Dify配置（强制使用最新值）: {
  apiKey: "app-...",
  baseUrl: "http://118.89.16.95/v1",
  appMode: "chat",
  ...
}
```

### 3. 常见错误

#### 错误 1: "Dify API Key 未配置"

**原因**: 环境变量 `VITE_DIFY_API_KEY` 未设置或为空

**解决**: 在 `admin-portal/.env` 文件中添加 `VITE_DIFY_API_KEY=your-api-key`

#### 错误 2: "Dify Base URL 未配置"

**原因**: 环境变量 `VITE_DIFY_BASE_URL` 未设置或为空

**解决**: 在 `admin-portal/.env` 文件中添加 `VITE_DIFY_BASE_URL=http://your-server/v1`

#### 错误 3: "认证失败 (401)"

**原因**: API Key 无效或已过期

**解决**: 
1. 检查 API Key 是否正确
2. 在 Dify 控制台中重新生成 API Key
3. 更新 `.env` 文件中的 `VITE_DIFY_API_KEY`

#### 错误 4: "AI未返回优化后的文本"

**原因**: Dify API 返回的数据格式不符合预期

**解决**: 
1. 检查 Dify 应用是否已发布
2. 检查应用配置是否正确
3. 查看浏览器控制台的详细错误信息

---

## 🎯 使用方式

### 基本使用

1. **打开会话**
   - 在工作台中选择一个会话

2. **输入消息**
   - 在消息输入框中输入需要优化的文本

3. **点击 AI 优化**
   - 点击输入框右侧的"AI优化"按钮
   - 等待 AI 处理（显示"AI优化中…"）

4. **查看结果**
   - 优化后的文本会自动填入输入框
   - 可以继续编辑或直接发送

5. **撤销优化**（可选）
   - 如果对优化结果不满意，可以点击"撤销"按钮恢复原始文本

### 优化提示词

系统使用的优化提示词为：
```
请优化以下客服回复内容，使其更加专业和友好：
[您的回复内容]
```

---

## 🔍 技术实现

### API 调用方式

根据配置的 `VITE_DIFY_APP_MODE`，系统会使用不同的 API：

#### Chat API（默认）

**端点**: `POST /chat-messages`

**请求格式**:
```json
{
  "inputs": {},
  "query": "请优化以下客服回复内容，使其更加专业和友好：\n[回复内容]",
  "response_mode": "blocking",
  "user": "agent-id"
}
```

#### Workflow API

**端点**: `POST /workflows/run`

**请求格式**:
```json
{
  "inputs": {
    "description": "请优化以下客服回复内容，使其更加专业和友好：\n[回复内容]"
  },
  "response_mode": "blocking",
  "user": "agent-id"
}
```

### 响应解析

系统会尝试从以下字段中提取优化后的文本：
- `data.answer`
- `data.text`
- `data.output`
- `data.content`
- `data.outputs.text`（工作流模式）

---

## 📝 配置示例

### 示例 1: 使用 Chat API（推荐）

```env
# admin-portal/.env
VITE_DIFY_BASE_URL=http://118.89.16.95/v1
VITE_DIFY_API_KEY=app-mHw0Fsjq0pzuYZwrqDxoYLA6
VITE_DIFY_APP_MODE=chat
```

### 示例 2: 使用 Workflow API

```env
# admin-portal/.env
VITE_DIFY_BASE_URL=http://118.89.16.95/v1
VITE_DIFY_API_KEY=app-mHw0Fsjq0pzuYZwrqDxoYLA6
VITE_DIFY_APP_MODE=workflow
VITE_DIFY_WORKFLOW_ID=abe431ac-0c17-4fa9-af65-9eab34fa1457
```

---

## 🚨 安全提示

1. **不要将 API Key 提交到 Git**
   - 确保 `.env` 文件在 `.gitignore` 中
   - 使用 `.env.example` 作为模板（不包含真实 API Key）

2. **定期更换 API Key**
   - 如果 API Key 泄露，立即在 Dify 控制台重新生成

3. **限制 API Key 权限**
   - 在 Dify 控制台中设置 API Key 的权限范围

4. **生产环境配置**
   - 生产环境使用环境变量或配置管理服务
   - 不要在前端代码中硬编码 API Key

---

## 📚 相关文档

- [Dify配置指南](./Dify配置指南.md) - 完整的 Dify 配置说明
- [Dify快速配置](./Dify快速配置.md) - 快速开始指南
- [系统检查报告](./系统检查报告.md) - 系统配置检查

---

## 🎯 快速开始

1. **获取 Dify API Key**
   - 登录 Dify 控制台
   - 进入应用设置
   - 生成 API Key

2. **配置环境变量**
   - 创建 `admin-portal/.env` 文件
   - 填写 Dify 配置

3. **重启开发服务器**
   - 停止当前服务器
   - 重新运行 `npm run dev`

4. **测试功能**
   - 打开工作台
   - 选择一个会话
   - 输入文本并点击"AI优化"

**配置完成后，AI 优化功能就可以使用了！** 🎉

