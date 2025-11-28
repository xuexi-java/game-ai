# AI 客服系统 (game-ai-cs)

一个以"前置分流"和"智能路由"为核心的多游戏AI客服平台。

## 📋 项目概述

本系统旨在解决传统客服中"信息不足"、"无效排队"和"客服压力大"的核心痛点。利用 AI (Dify) 的能力，从"被动响应"转向"主动引导和智能分流"。

### 核心特性

- ✅ **前置分流**: 玩家先填表单，再咨询，确保客服获得完整信息
- ✅ **智能路由**: AI自动判断问题紧急程度，智能分配到人工或工单
- ✅ **多游戏支持**: 支持多个游戏，每个游戏独立配置
- ✅ **紧急排序**: 可配置的排队队列优先级规则
- ✅ **实时通信**: WebSocket实时消息推送
- ✅ **身份验证**: 无需登录，通过游戏信息验证身份
- ✅ **AI优化回复**: 客服回复内容AI智能优化，提升专业度和友好度
- ✅ **快捷回复**: 支持快捷回复模板，提高客服效率
- ✅ **个人偏好**: 支持快捷回复个人偏好设置
- ✅ **智能排队**: 自动分配客服，显示排队位置和预计等待时间
- ✅ **工单管理**: 完整的工单生命周期管理
- ✅ **满意度评价**: 会话结束后收集玩家满意度反馈

## 🏗️ 项目结构

```
game-ai-cs/
├── backend/              # 后端服务 (Nest.js)
│   ├── src/
│   │   ├── auth/        # 认证授权模块
│   │   ├── game/        # 游戏管理模块
│   │   ├── ticket/      # 工单模块
│   │   ├── session/     # 会话模块
│   │   ├── message/     # 消息模块
│   │   └── ...
│   └── package.json
├── player-app/          # 玩家端前端 (React + Vite)
│   ├── src/
│   │   ├── pages/      # 页面
│   │   ├── components/ # 组件
│   │   ├── stores/     # 状态管理
│   │   └── services/   # API服务
│   └── package.json
├── admin-portal/        # 管理端前端 (React + Vite)
│   ├── src/
│   │   ├── pages/      # 页面
│   │   ├── components/ # 组件
│   │   ├── stores/     # 状态管理
│   │   └── services/   # API服务
│   └── package.json
├── prisma/             # 数据库Schema和迁移
│   ├── schema.prisma
│   └── migrations/
├── docs/                # 项目文档
│   ├── AI 客服系统 - 产品需求文档.md
│   ├── 数据库设计文档.md
│   ├── 技术文档.md
│   └── 数据库创建指南.md
├── docker-compose.yml   # Docker服务配置
└── package.json         # 根项目配置
```

## 🚀 快速开始

### 前置要求

- **Node.js**: 20.19.5 (LTS版本)
- **Docker Desktop**: 用于本地开发 (可选)
- **PostgreSQL**: 14+ (如果不用Docker)
- **Git**: 用于代码克隆

### 1. 克隆项目

```bash
git clone <repository-url>
cd game-ai-cs
```

### 2. 配置环境变量

```bash
# 复制环境变量示例文件
cp .env.example .env
cp backend/.env.example backend/.env
cp player-app/.env.example player-app/.env
cp admin-portal/.env.example admin-portal/.env

# 编辑 .env 文件，根据实际情况修改配置
```

⚠️ **重要**: 请确保修改以下配置：
- `DATABASE_URL`: 数据库连接字符串
- `JWT_SECRET`: JWT 密钥（生产环境必须修改）
- `OSS_*`: 阿里云 OSS 配置（如果使用文件上传功能）

### 3. 安装依赖

```bash
# 安装根项目依赖
npm install

# 安装后端依赖
cd backend
npm install

# 安装玩家端依赖
cd ../player-app
npm install

# 安装管理端依赖
cd ../admin-portal
npm install
```

### 4. 启动数据库

```bash
# 从项目根目录启动Docker服务
npm run docker:up

# 或者
docker-compose up -d
```

### 5. 初始化数据库

```bash
# 从项目根目录
npm run db:generate  # 生成Prisma Client
npm run db:migrate   # 运行数据库迁移
npm run db:seed      # 初始化种子数据
```

### 6. 启动开发服务

#### 方式一：使用启动脚本（推荐）

**Windows 用户**:
```bash
# 启动所有服务（推荐方式）
.\start.bat
```

启动脚本会自动执行以下步骤：
1. ✅ 检查 Node.js 和 npm 环境
2. ✅ 检查 Docker 环境，如果 Docker Desktop 未运行会自动启动
3. ✅ 启动 Docker 服务 (PostgreSQL)
4. ✅ 等待数据库就绪
5. ✅ 启动后端服务（在独立窗口）
6. ✅ 启动管理端前端（在独立窗口）
7. ✅ 启动玩家端前端（在独立窗口）
8. ✅ 显示服务访问地址

**启动顺序**：
- 首先启动 Docker 服务（仅 PostgreSQL）
- 然后启动后端服务（等待 3 秒）
- 接着启动管理端前端（等待 2 秒）
- 最后启动玩家端前端（等待 2 秒）

**服务窗口**：
- 每个服务都在独立的命令行窗口中运行
- 关闭窗口将停止对应的服务
- 可以单独查看每个服务的输出日志

**日志文件**：
- 所有服务的日志都保存在 `logs` 文件夹中
- `backend.log` - 后端服务日志
- `admin.log` - 管理端日志
- `player.log` - 玩家端日志
- `*-error.log` - 各服务的错误日志

**注意**: 
- 如果 Docker Desktop 未运行，脚本会自动尝试启动它（最多等待 45 秒）
- 停止脚本窗口时，Docker 服务会继续运行。如需停止 Docker 服务，请运行 `docker-compose down`
- 如需停止所有服务，请关闭各个服务窗口，然后运行 `docker-compose down` 停止 Docker 服务

#### 方式二：手动启动

**后端服务**:
```bash
cd backend
npm run start:dev
```
后端服务运行在: http://localhost:21001

**玩家端**:
```bash

npm run dev
```
玩家端运行在: http://localhost:20002

**管理端**:
```bash
cd admin-portal
npm run dev
```
管理端运行在: http://localhost:20001

## 📚 开发命令

### 数据库相关

```bash
# 生成Prisma Client
npm run db:generate

# 创建数据库迁移
npm run db:migrate

# 部署迁移（生产环境）
npm run db:migrate:deploy

# 打开Prisma Studio（数据库可视化工具）
npm run db:studio

# 初始化种子数据
npm run db:seed

# 重置数据库（删除所有数据并重新迁移）
npm run db:reset
```

### Docker相关

```bash
npm run docker:up      # 启动服务
npm run docker:down    # 停止服务
npm run docker:logs    # 查看日志
```

### 后端开发

```bash
cd backend
npm run start:dev     # 开发模式（热重载）
npm run build         # 构建生产版本
npm run start:prod    # 生产模式运行
```

### 前端开发

```bash
# 玩家端
cd player-app
npm run dev           # 开发服务器
npm run build         # 构建生产版本
npm run preview       # 预览生产构建

# 管理端
cd admin-portal
npm run dev           # 开发服务器
npm run build         # 构建生产版本
npm run preview       # 预览生产构建
```

## 🔐 默认账户

数据库初始化后会创建以下默认账户：

- **管理员**: `admin` / `admin123`
- **客服**: `agent1` / `agent123`

⚠️ **重要**: 生产环境请务必修改这些默认密码！

## 📖 文档

### 产品文档
- [产品需求文档](./docs/AI%20客服系统%20-%20产品需求文档.md)
- [产品使用文档](./docs/产品使用文档.md) - **新用户必读**

### 技术文档
- [技术文档](./docs/技术文档.md)
- [数据库设计文档](./docs/数据库设计文档.md)
- [数据库创建指南](./docs/数据库创建指南.md)
- [生产环境部署指南](./docs/生产环境部署指南.md) - **生产部署必读**

### 配置文档
- [Dify配置指南](./docs/Dify配置指南.md)
- [AI优化功能配置指南](./docs/AI优化功能配置指南.md)
- [功能测试指南](./docs/功能测试指南.md)

## 🛠️ 技术栈

### 后端
- **框架**: Nest.js 10.x
- **语言**: TypeScript 5.x
- **数据库**: PostgreSQL 14+
- **ORM**: Prisma 5.x
- **认证**: JWT
- **WebSocket**: Socket.io

### 前端
- **框架**: React 18.x
- **语言**: TypeScript 5.x
- **构建工具**: Vite 5.x
- **UI组件库**: Ant Design 5.x
- **状态管理**: Zustand
- **路由**: React Router 6.x
- **HTTP客户端**: Axios

## 📁 环境变量配置

### 后端 (.env)

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:22001/game_ai_cs?schema=public"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="8h"
PORT=21001
NODE_ENV="development"
FRONTEND_URL="http://localhost:20001,http://localhost:20002"
```

### 玩家端 (.env)

```env
VITE_API_BASE_URL=http://localhost:21001/api/v1
VITE_WS_URL=ws://localhost:21001
```

### 管理端 (.env)

```env
VITE_API_BASE_URL=http://localhost:21001/api/v1
VITE_WS_URL=ws://localhost:21001
```

## 🗄️ 数据库结构

系统包含以下核心数据表：

- `Game` - 游戏配置
- `Server` - 区服
- `Ticket` - 工单
- `TicketAttachment` - 工单附件
- `Session` - 会话
- `Message` - 消息
- `TicketMessage` - 工单消息
- `User` - 用户（管理员/客服）
- `IssueType` - 问题类型
- `UrgencyRule` - 紧急排序规则
- `SatisfactionRating` - 满意度评价
- `QuickReply` - 快捷回复
- `QuickReplyCategory` - 快捷回复分类
- `QuickReplyUserPreference` - 快捷回复个人偏好

详细设计请参考 [数据库设计文档](./docs/数据库设计文档.md)

## 📦 构建部署

### 生产环境构建

```bash
# 后端
cd backend
npm run build
npm run start:prod

# 前端
cd player-app
npm run build

cd ../admin-portal
npm run build
```

### 生产环境部署

详细的生产环境部署步骤请参考 [生产环境部署指南](./docs/生产环境部署指南.md)，包括：

- 服务器环境准备
- 数据库配置
- Nginx 反向代理配置
- PM2 进程管理
- SSL 证书配置
- 监控和日志
- 备份和恢复

### Docker部署

```bash
docker-compose -f docker-compose.prod.yml up -d
```

> ⚠️ **注意**: 生产环境建议使用 PM2 或 systemd 管理进程，而不是直接运行 `npm start:prod`

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📝 开发规范

- 使用 TypeScript 进行开发
- 遵循 ESLint 和 Prettier 配置
- 提交前运行测试
- 遵循 Git Commit 规范

## 🐛 问题反馈

如遇到问题，请：

1. 查看 [常见问题排查](./docs/生产环境部署指南.md#常见问题排查)
2. 查看日志文件
3. 提交 [GitHub Issue](https://github.com/xuexi-java/game-ai/issues)

## 🔄 更新日志

### 最新版本功能

- ✅ 修复转人工功能：自动分配客服，保持排队状态等待客服主动接入
- ✅ 实现快捷回复个人偏好：支持用户自定义启用/禁用和内容
- ✅ 修复快捷回复500错误：添加错误处理避免表不存在时崩溃
- ✅ 优化工单提交：添加完整的错误处理和验证
- ✅ 优化排队系统：实时显示排队位置和预计等待时间

## 📄 许可证

ISC

## 🙏 致谢

- [Nest.js](https://nestjs.com/) - 强大的 Node.js 框架
- [Prisma](https://www.prisma.io/) - 现代化的 ORM
- [React](https://react.dev/) - 用户界面库
- [Ant Design](https://ant.design/) - 企业级 UI 组件库
- [Dify](https://dify.ai/) - LLM 应用开发平台
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
