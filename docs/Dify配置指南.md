# Dify 配置指南

## 📋 概述

本系统的 Dify AI 配置分为两部分：
1. **数据库配置**（主要方式）：每个游戏在数据库中配置独立的 Dify API 信息
2. **前端环境变量配置**（可选）：用于前端直接调用 Dify API（如果前端需要）

---

## 🗄️ 数据库配置（主要方式）

### 配置位置

Dify 配置存储在数据库的 `Game` 表中，每个游戏可以有不同的配置。

### 配置字段

- `difyApiKey`: Dify API 密钥
- `difyBaseUrl`: Dify API 基础 URL（例如：`http://118.89.16.95/v1`）

### 配置方法

#### 方法 1：通过管理后台配置

1. 登录管理后台
2. 进入"游戏管理"页面
3. 创建或编辑游戏
4. 填写 Dify API Key 和 Base URL
5. 保存

#### 方法 2：通过数据库直接配置

```sql
-- 更新现有游戏的 Dify 配置
UPDATE "Game" 
SET 
  "difyApiKey" = 'your-api-key-here',
  "difyBaseUrl" = 'http://118.89.16.95/v1'
WHERE "name" = '弹弹堂';
```

#### 方法 3：通过种子数据配置

编辑 `prisma/seed.ts` 文件，在创建游戏时配置：

```typescript
const game1 = await prisma.game.upsert({
  where: { name: '弹弹堂' },
  update: {},
  create: {
    name: '弹弹堂',
    icon: null,
    enabled: true,
    difyApiKey: 'your-dify-api-key-here', // 替换为实际的 API Key
    difyBaseUrl: 'http://118.89.16.95/v1', // 替换为实际的 Dify 服务器地址
  },
});
```

---

## 🌐 前端环境变量配置（可选）

### 管理端配置

如果管理端需要直接调用 Dify API，需要配置以下环境变量：

**文件位置**: `admin-portal/.env`

```env
# Dify AI 配置
VITE_DIFY_BASE_URL=http://118.89.16.95/v1
VITE_DIFY_API_KEY=your-dify-api-key-here
VITE_DIFY_APP_MODE=chat
VITE_DIFY_WORKFLOW_ID=your-workflow-id-here
```

**注意**: 
- 这些配置仅用于前端直接调用 Dify API
- 后端主要使用数据库中游戏配置的 Dify 信息
- 如果前端不需要直接调用 Dify，可以留空

### 玩家端配置

玩家端不需要 Dify 配置，因为所有 AI 交互都通过后端处理。

---

## 🔧 配置步骤

### 步骤 1：获取 Dify API 信息

1. 登录您的 Dify 控制台
2. 创建或选择一个应用
3. 获取以下信息：
   - **API Key**: 在应用设置中生成
   - **Base URL**: 您的 Dify 服务器地址（例如：`http://118.89.16.95/v1`）
   - **Workflow ID**（如果使用工作流模式）: 在应用详情中查看

### 步骤 2：配置数据库

#### 通过管理后台（推荐）

1. 启动后端服务
2. 启动管理端前端
3. 登录管理后台（默认账户：`admin` / `admin123`）
4. 进入"游戏管理"
5. 创建或编辑游戏，填写 Dify 配置
6. 保存

#### 通过数据库

```sql
-- 查看现有游戏
SELECT id, name, "difyApiKey", "difyBaseUrl" FROM "Game";

-- 更新游戏的 Dify 配置
UPDATE "Game" 
SET 
  "difyApiKey" = 'app-xxxxxxxxxxxxx',
  "difyBaseUrl" = 'http://118.89.16.95/v1'
WHERE id = 'your-game-id';
```

### 步骤 3：配置前端环境变量（可选）

如果管理端需要直接调用 Dify API：

1. 复制 `admin-portal/.env.example` 为 `admin-portal/.env`
2. 填写 Dify 配置：
   ```env
   VITE_DIFY_BASE_URL=http://118.89.16.95/v1
   VITE_DIFY_API_KEY=your-api-key-here
   VITE_DIFY_WORKFLOW_ID=your-workflow-id-here
   ```
3. 重启前端开发服务器

---

## ✅ 验证配置

### 验证数据库配置

1. 创建或编辑一个工单
2. 选择已配置 Dify 的游戏
3. 提交工单
4. 检查是否收到 AI 初始回复

### 验证前端配置（如果配置了）

1. 在管理端打开浏览器控制台
2. 检查是否有 Dify API 调用
3. 查看是否有错误信息

---

## 🔍 常见问题

### Q1: 如何知道 Dify 配置是否正确？

**A**: 检查以下几点：
1. 数据库中的 `difyApiKey` 和 `difyBaseUrl` 是否正确
2. API Key 是否有效（未过期）
3. Base URL 是否可以访问
4. 查看后端日志，是否有 Dify API 调用错误

### Q2: 为什么工单创建后没有 AI 回复？

**A**: 可能的原因：
1. 游戏未配置 Dify 信息
2. Dify API Key 无效
3. Dify 服务器无法访问
4. 查看后端日志了解详细错误

### Q3: 每个游戏可以有不同的 Dify 配置吗？

**A**: 是的，每个游戏在数据库中都有独立的 `difyApiKey` 和 `difyBaseUrl` 字段，可以配置不同的 Dify 应用。

### Q4: 前端环境变量配置是必需的吗？

**A**: 不是必需的。如果前端不需要直接调用 Dify API，可以留空。后端会使用数据库中游戏配置的 Dify 信息。

---

## 📝 配置示例

### 示例 1：通过管理后台配置

1. 登录管理后台
2. 进入"游戏管理" → "创建游戏"
3. 填写信息：
   - 游戏名称：弹弹堂
   - Dify API Key：`app-xxxxxxxxxxxxx`
   - Dify Base URL：`http://118.89.16.95/v1`
4. 保存

### 示例 2：通过 SQL 配置

```sql
-- 为"弹弹堂"游戏配置 Dify
UPDATE "Game" 
SET 
  "difyApiKey" = 'app-mHw0Fsjq0pzuYZwrqDxoYLA6',
  "difyBaseUrl" = 'http://118.89.16.95/v1'
WHERE "name" = '弹弹堂';
```

### 示例 3：前端环境变量配置

```env
# admin-portal/.env
VITE_DIFY_BASE_URL=http://118.89.16.95/v1
VITE_DIFY_API_KEY=app-mHw0Fsjq0pzuYZwrqDxoYLA6
VITE_DIFY_APP_MODE=chat
VITE_DIFY_WORKFLOW_ID=abe431ac-0c17-4fa9-af65-9eab34fa1457
```

---

## 🚨 安全提示

1. **不要将 API Key 提交到 Git**
   - 确保 `.env` 文件在 `.gitignore` 中
   - 使用 `.env.example` 作为模板

2. **定期更换 API Key**
   - 如果 API Key 泄露，立即在 Dify 控制台重新生成

3. **使用环境变量**
   - 生产环境使用环境变量，不要硬编码

4. **限制 API Key 权限**
   - 在 Dify 控制台中设置 API Key 的权限范围

---

## 📚 相关文档

- [Dify API 配置说明](../backend/DIFY_API_CONFIG.md)
- [系统检查报告](./系统检查报告.md)
- [环境变量配置](./项目完善计划.md)

---

## 🎯 快速开始

1. **获取 Dify API 信息**
   - 登录 Dify 控制台
   - 获取 API Key 和 Base URL

2. **配置数据库**
   - 通过管理后台配置（推荐）
   - 或通过 SQL 直接更新

3. **测试配置**
   - 创建测试工单
   - 检查是否收到 AI 回复

4. **（可选）配置前端环境变量**
   - 如果前端需要直接调用 Dify API

---

**配置完成后，系统就可以使用 Dify AI 进行智能客服对话了！** 🎉

