# 玩家端前端应用

AI 客服系统 - 玩家端前端应用

## 技术栈

- **React 19** - UI 框架
- **TypeScript** - 类型安全
- **Vite** - 构建工具
- **React Router 6** - 路由管理
- **Ant Design 5** - UI 组件库
- **Zustand** - 状态管理
- **Axios** - HTTP 客户端
- **Socket.io Client** - WebSocket 客户端
- **Day.js** - 日期处理

## 项目结构

```
player-app/
├── src/
│   ├── pages/              # 页面组件
│   │   ├── IdentityCheck/  # 步骤1：身份验证
│   │   ├── EscapeHatch/   # 步骤2：逃生舱
│   │   ├── IntakeForm/    # 步骤3：前置分流表单
│   │   ├── Chat/          # 步骤4：AI引导聊天
│   │   ├── Queue/         # 步骤5：排队页面
│   │   └── TicketChat/    # 工单异步聊天
│   ├── components/         # 组件
│   │   └── Chat/          # 聊天组件
│   ├── services/          # API 服务
│   ├── stores/            # 状态管理
│   ├── config/            # 配置文件
│   └── App.tsx            # 应用入口
├── public/                # 静态资源
└── package.json          # 依赖配置
```

## 快速开始

### 1. 安装依赖

```bash
cd player-app
npm install
```

### 2. 配置环境变量

创建 `.env` 文件：

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
VITE_WS_URL=ws://localhost:3000
```

### 3. 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:5173` 运行

### 4. 构建生产版本

```bash
npm run build
```

## 核心功能

### 玩家旅程流程

1. **身份验证** (`/identity-check`)
   - 选择游戏
   - 输入区服
   - 输入角色ID或昵称
   - 检查是否有未关闭的工单

2. **逃生舱** (`/escape-hatch`)
   - 如果有未关闭工单，显示选择界面
   - 继续处理工单或提交新问题

3. **前置分流表单** (`/intake-form`)
   - 问题描述
   - 问题发生时间
   - 问题截图（最多9张）
   - 充值订单号（可选）

4. **AI引导聊天** (`/chat/:sessionId`)
   - AI 自动回复
   - 玩家与AI对话
   - 转人工客服按钮

5. **排队页面** (`/queue/:sessionId`)
   - 显示排队状态
   - 实时更新排队位置
   - 客服接入后自动跳转

6. **工单聊天** (`/ticket/:token`)
   - 异步工单消息
   - 查看历史消息
   - 补充回复

## API 服务

- `game.service.ts` - 游戏相关API
- `ticket.service.ts` - 工单相关API
- `session.service.ts` - 会话相关API
- `message.service.ts` - 消息相关API
- `upload.service.ts` - 文件上传API

## 状态管理

使用 Zustand 管理全局状态：

- `ticketStore` - 工单和身份信息
- `sessionStore` - 会话和消息

## WebSocket 通信

使用 Socket.io 实现实时通信：

- 接收新消息
- 监听会话状态变化
- 监听排队状态更新

## 开发规范

- 使用 TypeScript 进行开发
- 遵循 React Hooks 最佳实践
- 使用 Ant Design 组件库
- 保持代码简洁和可维护

## 注意事项

1. 确保后端服务运行在 `http://localhost:3000`
2. WebSocket 服务需要正常运行
3. 文件上传需要配置 OSS 或使用本地存储
