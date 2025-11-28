# Dify 配置完成总结

## ✅ 已完成的配置

### 1. **代码修复** ✅

- ✅ 移除了前端硬编码的 Dify API Key
- ✅ 前端配置改为从环境变量读取
- ✅ 更新了种子数据文件，使用正确的 Dify Base URL

### 2. **文档创建** ✅

- ✅ 创建了 `Dify配置指南.md` - 详细的配置说明
- ✅ 创建了 `Dify快速配置.md` - 快速开始指南
- ✅ 更新了种子数据文件中的 Dify Base URL

---

## 📋 配置方式说明

### 主要配置方式：数据库配置

**位置**: 数据库 `Game` 表

每个游戏在数据库中都有独立的 Dify 配置：
- `difyApiKey`: Dify API 密钥
- `difyBaseUrl`: Dify API 基础 URL（默认：`http://118.89.16.95/v1`）

**配置方法**:
1. **通过管理后台**（推荐）
   - 登录管理后台
   - 进入"游戏管理"
   - 创建或编辑游戏，填写 Dify 配置

2. **通过数据库 SQL**
   ```sql
   UPDATE "Game" 
   SET 
     "difyApiKey" = 'your-api-key-here',
     "difyBaseUrl" = 'http://118.89.16.95/v1'
   WHERE "name" = '弹弹堂';
   ```

3. **通过种子数据**
   - 编辑 `prisma/seed.ts`
   - 修改游戏配置
   - 运行 `npm run db:seed`

### 可选配置：前端环境变量

**位置**: `admin-portal/.env`

如果管理端需要直接调用 Dify API，可以配置：

```env
VITE_DIFY_BASE_URL=http://118.89.16.95/v1
VITE_DIFY_API_KEY=your-dify-api-key-here
VITE_DIFY_APP_MODE=chat
VITE_DIFY_WORKFLOW_ID=your-workflow-id-here
```

**注意**: 如果前端不需要直接调用 Dify，可以省略这些配置。

---

## 🚀 下一步操作

### 1. 配置数据库中的游戏 Dify 信息

**方式 A：通过管理后台（推荐）**

1. 启动后端服务：
   ```bash
   cd backend
   npm run start:dev
   ```

2. 启动管理端：
   ```bash
   cd admin-portal
   npm run dev
   ```

3. 登录管理后台：
   - 访问：http://localhost:20001
   - 账户：`admin` / `admin123`

4. 配置游戏：
   - 进入"游戏管理"
   - 创建或编辑游戏
   - 填写：
     - **Dify API Key**: 您的 Dify API 密钥
     - **Dify Base URL**: `http://118.89.16.95/v1`
   - 保存

**方式 B：通过 SQL**

```sql
-- 查看现有游戏
SELECT id, name, "difyApiKey", "difyBaseUrl" FROM "Game";

-- 更新游戏的 Dify 配置
UPDATE "Game" 
SET 
  "difyApiKey" = 'your-api-key-here',
  "difyBaseUrl" = 'http://118.89.16.95/v1'
WHERE "name" = '弹弹堂';
```

### 2. （可选）配置前端环境变量

如果管理端需要直接调用 Dify API：

1. 创建 `admin-portal/.env` 文件
2. 添加配置：
   ```env
   VITE_DIFY_BASE_URL=http://118.89.16.95/v1
   VITE_DIFY_API_KEY=your-dify-api-key-here
   VITE_DIFY_APP_MODE=chat
   VITE_DIFY_WORKFLOW_ID=your-workflow-id-here
   ```
3. 重启前端开发服务器

### 3. 验证配置

1. **创建测试工单**
   - 在玩家端创建一个工单
   - 选择已配置 Dify 的游戏

2. **检查 AI 回复**
   - 工单创建后应该收到 AI 的初始回复
   - 如果没有回复，检查后端日志

3. **查看日志**
   ```bash
   cd backend
   tail -f logs/backend-*.log
   ```

---

## 📝 配置检查清单

- [ ] 获取 Dify API Key
- [ ] 确认 Dify Base URL（默认：`http://118.89.16.95/v1`）
- [ ] 在数据库中配置游戏的 Dify 信息
- [ ] （可选）配置前端环境变量
- [ ] 测试创建工单，验证 AI 回复
- [ ] 检查后端日志，确认无错误

---

## 🔍 常见问题

### Q: 如何获取 Dify API Key？

**A**: 
1. 登录您的 Dify 控制台
2. 进入应用设置
3. 生成或查看 API Key

### Q: Base URL 是什么？

**A**: 
- 默认值：`http://118.89.16.95/v1`
- 如果使用自己的 Dify 服务器，替换为您的服务器地址 + `/v1`

### Q: 配置后没有 AI 回复？

**A**: 检查以下几点：
1. 数据库中的 `difyApiKey` 和 `difyBaseUrl` 是否正确
2. API Key 是否有效（未过期）
3. Base URL 是否可以访问
4. 查看后端日志了解详细错误

### Q: 前端环境变量配置是必需的吗？

**A**: 
- **不是必需的**
- 如果前端不需要直接调用 Dify API，可以省略
- 后端会使用数据库中游戏配置的 Dify 信息

---

## 📚 相关文档

- [Dify配置指南](./Dify配置指南.md) - 详细配置说明
- [Dify快速配置](./Dify快速配置.md) - 快速开始指南
- [Dify API 配置说明](../backend/DIFY_API_CONFIG.md) - API 使用说明

---

## 🎯 总结

**配置状态**: ✅ 代码已修复，文档已创建

**需要您完成的操作**:
1. ✅ 获取 Dify API Key
2. ✅ 在数据库中配置游戏的 Dify 信息（通过管理后台或 SQL）
3. ✅ （可选）配置前端环境变量
4. ✅ 测试验证

**配置完成后，系统就可以使用 Dify AI 进行智能客服对话了！** 🎉

