# Dify 快速配置指南

## 🚀 快速开始

### 方式 1：通过管理后台配置（推荐）

1. **启动服务**
   ```bash
   # 启动后端
   cd backend
   npm run start:dev
   
   # 启动管理端（新终端）
   cd admin-portal
   npm run dev
   ```

2. **登录管理后台**
   - 访问：http://localhost:20001
   - 默认账户：`admin` / `admin123`

3. **配置游戏 Dify 信息**
   - 进入"游戏管理"
   - 创建或编辑游戏
   - 填写：
     - **Dify API Key**: 您的 Dify API 密钥
     - **Dify Base URL**: `http://118.89.16.95/v1`（或您的 Dify 服务器地址）
   - 保存

### 方式 2：通过数据库直接配置

```sql
-- 更新游戏的 Dify 配置
UPDATE "Game" 
SET 
  "difyApiKey" = 'your-api-key-here',
  "difyBaseUrl" = 'http://118.89.16.95/v1'
WHERE "name" = '弹弹堂';
```

### 方式 3：更新种子数据文件

编辑 `prisma/seed.ts`，修改游戏配置：

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

然后重新运行种子数据：
```bash
npm run db:seed
```

---

## 📝 环境变量配置（可选）

### 管理端环境变量

如果管理端需要直接调用 Dify API，创建 `admin-portal/.env` 文件：

```env
# API 配置
VITE_API_BASE_URL=http://localhost:21001/api/v1
VITE_WS_URL=ws://localhost:21001

# Dify AI 配置（可选，仅用于前端直接调用 Dify API）
VITE_DIFY_BASE_URL=http://118.89.16.95/v1
VITE_DIFY_API_KEY=your-dify-api-key-here
VITE_DIFY_APP_MODE=chat
VITE_DIFY_WORKFLOW_ID=your-workflow-id-here

# 其他配置
VITE_AGENT_STATUS_POLL_INTERVAL=30000
```

**注意**: 如果前端不需要直接调用 Dify API，可以省略 Dify 相关配置。

---

## ✅ 验证配置

1. **创建测试工单**
   - 在玩家端创建一个工单
   - 选择已配置 Dify 的游戏

2. **检查 AI 回复**
   - 工单创建后应该收到 AI 的初始回复
   - 如果没有回复，检查后端日志

3. **查看日志**
   ```bash
   # 查看后端日志
   cd backend
   tail -f logs/backend-*.log
   ```

---

## 🔍 常见问题

**Q: 如何获取 Dify API Key？**
- 登录 Dify 控制台
- 进入应用设置
- 生成 API Key

**Q: Base URL 是什么？**
- 通常是您的 Dify 服务器地址 + `/v1`
- 例如：`http://118.89.16.95/v1`

**Q: 配置后没有 AI 回复？**
- 检查数据库中的配置是否正确
- 检查 API Key 是否有效
- 查看后端日志了解错误信息

---

## 📚 详细文档

更多详细信息请参考：[Dify配置指南](./Dify配置指南.md)

