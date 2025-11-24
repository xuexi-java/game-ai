#!/bin/bash
# Shell 项目启动脚本
# 用于 Linux/Mac 环境快速启动 AI 客服系统项目

MODE=${1:-"all"}  # 默认启动所有服务
AUTO_EXIT_FLAG=$(echo "${2:-""}" | tr '[:upper:]' '[:lower:]')
SKIP_DOCKER_FLAG=$(echo "${3:-""}" | tr '[:upper:]' '[:lower:]')

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 显示标题
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        AI 客服系统 - 项目启动脚本                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# 检查 Node.js
echo -e "${CYAN}🔍 检查 Node.js 环境...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 未检测到 Node.js，请先安装 Node.js 20.19.5${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js 版本: $NODE_VERSION${NC}"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ 未检测到 npm${NC}"
    exit 1
fi
NPM_VERSION=$(npm --version)
echo -e "${GREEN}✅ npm 版本: $NPM_VERSION${NC}"

# 检查并启动 Docker 服务
DOCKER_STARTED=false
if [ "$SKIP_DOCKER_FLAG" = "skip-docker" ] || [ "$SKIP_DOCKER_FLAG" = "skip" ] || [ "$SKIP_DOCKER_FLAG" = "--skip-docker" ]; then
    echo -e "${YELLOW}⚠️  已跳过 Docker 检查和数据库启动步骤${NC}"
else
    echo -e "${CYAN}🐳 检查 Docker 环境...${NC}"
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ 未检测到 Docker，请先安装 Docker${NC}"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        echo -e "${RED}❌ Docker 未运行，请先启动 Docker Desktop${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker 已运行${NC}"

    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ docker-compose 不可用，请检查 Docker 安装${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ docker-compose 可用${NC}"

    # 启动 Docker 服务
echo -e "${CYAN}🐳 启动 Docker 服务 (PostgreSQL)...${NC}"
    if docker-compose up -d; then
        DOCKER_STARTED=true
        echo -e "${GREEN}✅ Docker 服务已启动${NC}"
    else
        echo -e "${YELLOW}⚠️  Docker 服务启动可能有问题，继续尝试...${NC}"
    fi

    # 等待数据库就绪
    echo -e "${CYAN}⏳ 等待数据库就绪...${NC}"
    MAX_RETRIES=30
    RETRY_COUNT=0
    DB_READY=false

    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if docker-compose exec -T postgres pg_isready -U postgres &> /dev/null; then
            DB_READY=true
            break
        fi
        if [ $RETRY_COUNT -lt 5 ] || [ $((RETRY_COUNT % 5)) -eq 0 ]; then
            echo -e "${YELLOW}⏳ 等待数据库连接... ($RETRY_COUNT/$MAX_RETRIES)${NC}"
        fi
        sleep 2
        RETRY_COUNT=$((RETRY_COUNT + 1))
    done

    if [ "$DB_READY" = true ]; then
        echo -e "${GREEN}✅ 数据库已就绪${NC}"
    else
        echo -e "${YELLOW}⚠️  数据库连接超时，但继续启动应用服务...${NC}"
        echo -e "${YELLOW}⚠️  如果应用启动失败，请检查 Docker 服务状态${NC}"
    fi
fi

# 检查依赖
echo -e "${CYAN}📦 检查项目依赖...${NC}"
NEED_INSTALL=false

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  根目录依赖未安装${NC}"
    NEED_INSTALL=true
fi
if [ ! -d "backend/node_modules" ]; then
    echo -e "${YELLOW}⚠️  后端依赖未安装${NC}"
    NEED_INSTALL=true
fi
if [ ! -d "admin-portal/node_modules" ]; then
    echo -e "${YELLOW}⚠️  管理端依赖未安装${NC}"
    NEED_INSTALL=true
fi
if [ ! -d "player-app/node_modules" ]; then
    echo -e "${YELLOW}⚠️  玩家端依赖未安装${NC}"
    NEED_INSTALL=true
fi

if [ "$NEED_INSTALL" = true ]; then
    echo -e "${YELLOW}📦 检测到依赖未安装，是否现在安装？(Y/N)${NC}"
    read -r INSTALL_CHOICE
    if [ "$INSTALL_CHOICE" = "Y" ] || [ "$INSTALL_CHOICE" = "y" ]; then
        echo -e "${CYAN}📦 正在安装依赖，这可能需要几分钟...${NC}"
        npm run install:all
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ 依赖安装失败${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ 依赖安装完成${NC}"
    else
        echo -e "${YELLOW}⚠️  跳过依赖安装，如果启动失败请先运行: npm run install:all${NC}"
    fi
fi

# 检查 Prisma Client
if [ ! -d "node_modules/.prisma" ]; then
    echo -e "${CYAN}🔧 生成 Prisma Client...${NC}"
    npm run db:generate
fi

# 存储进程 PID
declare -A PIDS

# 启动函数
start_backend() {
    echo -e "${CYAN}🚀 启动后端服务...${NC}"
    cd backend
    npm run start:dev > ../logs/backend-dev.log 2> ../logs/backend-dev.err.log &
    PIDS["backend"]=$!
    cd ..
    echo -e "${GREEN}✅ 后端服务已启动 (PID: ${PIDS["backend"]})${NC}"
    echo -e "${CYAN}   📍 后端地址: http://localhost:3000${NC}"
}

start_admin() {
    echo -e "${CYAN}🚀 启动管理端前端...${NC}"
    cd admin-portal
    npm run dev > ../logs/admin-dev.log 2> ../logs/admin-dev.err.log &
    PIDS["admin"]=$!
    cd ..
    echo -e "${GREEN}✅ 管理端前端已启动 (PID: ${PIDS["admin"]})${NC}"
    echo -e "${CYAN}   📍 管理端地址: http://localhost:5173 (默认)${NC}"
}

start_player() {
    echo -e "${CYAN}🚀 启动玩家端前端...${NC}"
    cd player-app
    npm run dev > ../logs/player-dev.log 2> ../logs/player-dev.err.log &
    PIDS["player"]=$!
    cd ..
    echo -e "${GREEN}✅ 玩家端前端已启动 (PID: ${PIDS["player"]})${NC}"
    echo -e "${CYAN}   📍 玩家端地址: http://localhost:5174 (默认)${NC}"
}

# 确保 logs 目录存在
mkdir -p logs

# 根据模式启动服务
echo ""
case "$MODE" in
    "all")
        echo -e "${CYAN}🎯 启动模式: 全部服务${NC}"
        start_backend
        sleep 2
        start_admin
        sleep 1
        start_player
        ;;
    "backend")
        echo -e "${CYAN}🎯 启动模式: 仅后端${NC}"
        start_backend
        ;;
    "admin")
        echo -e "${CYAN}🎯 启动模式: 仅管理端${NC}"
        start_admin
        ;;
    "player")
        echo -e "${CYAN}🎯 启动模式: 仅玩家端${NC}"
        start_player
        ;;
    *)
        echo -e "${RED}❌ 未知的启动模式: $MODE${NC}"
        echo -e "${CYAN}💡 可用模式: all, backend, admin, player${NC}"
        exit 1
        ;;
esac

# 如果是自动退出模式，启动后立即清理
if [ "$AUTO_EXIT_FLAG" = "auto-exit" ] || [ "$AUTO_EXIT_FLAG" = "auto" ] || [ "$AUTO_EXIT_FLAG" = "--auto-exit" ]; then
    echo -e "${CYAN}⚙️  AutoExit 模式：启动完成后立即停止服务${NC}"
    sleep 5
    cleanup
fi

# 显示启动信息
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              服务启动完成！                           ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}📋 运行中的服务:${NC}"
for key in "${!PIDS[@]}"; do
    PID=${PIDS[$key]}
    if ps -p $PID > /dev/null 2>&1; then
        echo -e "   - ${GREEN}$key${NC} : 运行中 (PID: $PID)"
    else
        echo -e "   - ${YELLOW}$key${NC} : 已停止 (PID: $PID)"
    fi
done

echo ""
echo -e "${YELLOW}⚠️  提示:${NC}"
echo "   - 按 Ctrl+C 停止所有服务（包括 Docker）"
echo "   - 查看日志: tail -f logs/*.log"
echo "   - 停止服务: kill <PID>"
echo ""

# 清理函数
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 正在停止所有服务...${NC}"
    for key in "${!PIDS[@]}"; do
        PID=${PIDS[$key]}
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID 2>/dev/null
            echo -e "${GREEN}✅ 已停止: $key${NC}"
        fi
    done
    
    # 停止 Docker 服务
    if [ "$DOCKER_STARTED" = true ]; then
        echo -e "${CYAN}🐳 正在停止 Docker 服务...${NC}"
        if docker-compose down 2>&1 > /dev/null; then
            echo -e "${GREEN}✅ Docker 服务已停止${NC}"
        else
            echo -e "${YELLOW}⚠️  Docker 服务停止可能有问题${NC}"
        fi
    fi
    
    echo ""
    echo -e "${GREEN}✅ 所有服务已停止${NC}"
    echo ""
    exit 0
}

# 捕获中断信号
trap cleanup INT TERM

# 等待用户中断
echo -e "${CYAN}⏳ 服务正在运行中，按 Ctrl+C 停止...${NC}"
wait

