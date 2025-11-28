#!/bin/bash

# 运行所有测试的脚本
# 使用方法: ./scripts/run-all-tests.sh

set -e

echo "=========================================="
echo "开始运行系统测试"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# 运行后端测试
echo -e "\n${YELLOW}[1/3] 运行后端测试...${NC}"
cd backend
if npm test; then
    echo -e "${GREEN}✓ 后端测试通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ 后端测试失败${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
cd ..

# 运行管理端测试
echo -e "\n${YELLOW}[2/3] 运行管理端测试...${NC}"
cd admin-portal
if npm test -- --run; then
    echo -e "${GREEN}✓ 管理端测试通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ 管理端测试失败${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
cd ..

# 运行玩家端测试
echo -e "\n${YELLOW}[3/3] 运行玩家端测试...${NC}"
cd player-app
if npm test -- --run; then
    echo -e "${GREEN}✓ 玩家端测试通过${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ 玩家端测试失败${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))
cd ..

# 输出总结
echo -e "\n=========================================="
echo "测试总结"
echo "=========================================="
echo -e "总测试套件: ${TOTAL_TESTS}"
echo -e "${GREEN}通过: ${PASSED_TESTS}${NC}"
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}失败: ${FAILED_TESTS}${NC}"
    exit 1
else
    echo -e "${GREEN}所有测试通过！${NC}"
    exit 0
fi

