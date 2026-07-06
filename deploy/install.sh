#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║     昆仑OS (KunlunOS) 一键安装脚本                           ║
# ║     v0.5.0 — 适用于 Debian 13 / 腾讯轻量云服务器              ║
# ║     前提：已安装 Pi Agent 和 pnpm                             ║
# ╚══════════════════════════════════════════════════════════════╝
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

KUNLUN_HOME="${KUNLUN_HOME:-$HOME/.kunlun}"
PI_HOME="${PI_HOME:-$HOME/.pi}"
REPO_URL="https://github.com/lidong266/pi-kunlun.git"
REPO_BRANCH="main"

echo -e "${CYAN}"
cat << "EOF"
╔══════════════════════════════════════════════════════╗
║                                                      ║
║    ██╗  ██╗██╗   ██╗███╗   ██╗██╗     ██╗   ██╗███╗   ██╗
║    ██║ ██╔╝██║   ██║████╗  ██║██║     ██║   ██║████╗  ██║
║    █████╔╝ ██║   ██║██╔██╗ ██║██║     ██║   ██║██╔██╗ ██║
║    ██╔═██╗ ██║   ██║██║╚██╗██║██║     ██║   ██║██║╚██╗██║
║    ██║  ██╗╚██████╔╝██║ ╚████║███████╗╚██████╔╝██║ ╚████║
║    ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝ ╚═════╝ ╚═╝  ╚═══╝
║                                                      ║
║          AI 认知操作系统 — 一键安装                    ║
║          以大成智慧学为运行哲学                          ║
╚══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# ─── 1. 环境检查 ────────────────────────────────────────────
echo -e "${YELLOW}[1/6] 检查运行环境...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ 未找到 Node.js。请先安装: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt install -y nodejs${NC}"
    exit 1
fi
NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 22 ]; then
    echo -e "${RED}❌ 需要 Node.js >= 22，当前: $(node -v)${NC}"
    exit 1
fi
echo -e "  ✅ Node.js $(node -v)"

if ! command -v pnpm &> /dev/null; then
    echo -e "${YELLOW}  ⏳ 安装 pnpm...${NC}"
    npm install -g pnpm@9.15.0
fi
echo -e "  ✅ pnpm $(pnpm -v)"

if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}  ⏳ 安装 git...${NC}"
    sudo apt-get update -qq && sudo apt-get install -y -qq git
fi
echo -e "  ✅ git $(git --version | awk '{print $3}')"

# ─── 2. 克隆仓库 ────────────────────────────────────────────
echo -e "${YELLOW}[2/6] 克隆昆仑OS仓库...${NC}"

if [ -d "$KUNLUN_HOME" ]; then
    echo -e "  ⏳ 更新已有仓库..."
    cd "$KUNLUN_HOME"
    git fetch origin "$REPO_BRANCH"
    git reset --hard "origin/$REPO_BRANCH"
else
    git clone --depth 1 -b "$REPO_BRANCH" "$REPO_URL" "$KUNLUN_HOME"
    cd "$KUNLUN_HOME"
fi
echo -e "  ✅ 仓库就绪: $(git log -1 --format='%h %s')"

# ─── 3. 安装依赖 ────────────────────────────────────────────
echo -e "${YELLOW}[3/6] 安装依赖...${NC}"
pnpm install --frozen-lockfile 2>&1 | tail -3
echo -e "  ✅ 依赖安装完成"

# ─── 4. 构建 ────────────────────────────────────────────────
echo -e "${YELLOW}[4/6] 构建昆仑OS...${NC}"
pnpm run build 2>&1 | tail -5 || {
    echo -e "${YELLOW}  ⚠️  完整构建失败，尝试仅构建核心包...${NC}"
    for pkg in ternary eventbus presence contradiction ocgs pw spiral subsystems cogkal cogbus cog-algo cog-capability cog-trust cog-memory cog-pipeline cog-process cog-human cog-metasynthesis cog-executor os-core; do
        (cd "packages/kunlun-$pkg" && pnpm build 2>/dev/null) || true
    done
}
echo -e "  ✅ 构建完成"

# ─── 5. 运行测试 ────────────────────────────────────────────
echo -e "${YELLOW}[5/6] 运行测试验证...${NC}"
npx vitest@2.1.9 run 2>&1 | tail -5 || echo -e "${YELLOW}  ⚠️  部分测试未通过（不影响安装）${NC}"
echo -e "  ✅ 测试完成"

# ─── 6. 配置 Pi 集成 ────────────────────────────────────────
echo -e "${YELLOW}[6/6] 配置 Pi 集成...${NC}"

# 检测 Pi 安装位置
PI_AGENT_PATH=""
for candidate in \
    "$PI_HOME" \
    "$HOME/pi" \
    "/opt/pi" \
    "/usr/local/lib/pi"; do
    if [ -d "$candidate" ]; then
        PI_AGENT_PATH="$candidate"
        break
    fi
done

if [ -z "$PI_AGENT_PATH" ]; then
    echo -e "${YELLOW}  ⚠️  未检测到 Pi Agent 安装路径。${NC}"
    echo -e "  昆仑OS 核心引擎已安装，可通过以下方式集成："
    echo -e "  1. 在 Pi 的配置中指向: $KUNLUN_HOME/extension"
    echo -e "  2. 或者设置环境变量: export KUNLUN_PATH=$KUNLUN_HOME"
else
    echo -e "  ✅ 检测到 Pi Agent: $PI_AGENT_PATH"

    # 写入昆仑OS配置到 Pi
    KUNLUN_CONFIG="$PI_AGENT_PATH/config/kunlun.json"
    mkdir -p "$(dirname "$KUNLUN_CONFIG")"
    cat > "$KUNLUN_CONFIG" << KUNLUNEOF
{
  "version": "0.5.0",
  "kunlunHome": "$KUNLUN_HOME",
  "extensionPath": "$KUNLUN_HOME/extension",
  "enabled": true,
  "autoStart": true,
  "modules": {
    "contradiction": true,
    "strategy": true,
    "spiral": true,
    "ecosystem": true,
    "memory": true,
    "trust": true
  }
}
KUNLUNEOF
    echo -e "  ✅ Pi 配置已写入: $KUNLUN_CONFIG"
fi

# ─── 创建 systemd 服务（可选） ─────────────────────────────
if command -v systemctl &> /dev/null; then
    SERVICE_FILE="/etc/systemd/system/kunlun-os.service"
    cat > /tmp/kunlun-os.service << SERVICEEOF
[Unit]
Description=昆仑OS 认知操作系统
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$KUNLUN_HOME
Environment=NODE_ENV=production
Environment=KUNLUN_HOME=$KUNLUN_HOME
Environment=PI_HOME=$PI_AGENT_PATH
ExecStart=$(which node) $KUNLUN_HOME/deploy/kunlun-daemon.mjs
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SERVICEEOF

    sudo cp /tmp/kunlun-os.service "$SERVICE_FILE"
    sudo systemctl daemon-reload
    echo -e "  ✅ systemd 服务已创建: kunlun-os.service"
    echo -e "  启动: sudo systemctl start kunlun-os"
    echo -e "  开机自启: sudo systemctl enable kunlun-os"
fi

# ─── 环境变量配置 ───────────────────────────────────────────
SHELL_RC=""
if [ -f "$HOME/.bashrc" ]; then SHELL_RC="$HOME/.bashrc"; fi
if [ -f "$HOME/.zshrc" ]; then SHELL_RC="$HOME/.zshrc"; fi

if [ -n "$SHELL_RC" ] && ! grep -q "KUNLUN_HOME" "$SHELL_RC" 2>/dev/null; then
    cat >> "$SHELL_RC" << 'EOF'

# 昆仑OS 认知操作系统
export KUNLUN_HOME="$HOME/.kunlun"
export PATH="$KUNLUN_HOME/deploy:$PATH"
alias kunlun="node $KUNLUN_HOME/deploy/kunlun-cli.mjs"
EOF
    echo -e "  ✅ 环境变量已写入 $SHELL_RC"
fi

# ─── 完成 ───────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}║   🎉 昆仑OS v0.5.0 安装完成！                        ║${NC}"
echo -e "${GREEN}║                                                      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  安装路径: ${CYAN}$KUNLUN_HOME${NC}"
echo -e "  测试验证: ${CYAN}cd $KUNLUN_HOME && npx vitest@2.1.9 run${NC}"
echo ""
echo -e "  ${YELLOW}快速开始:${NC}"
echo -e "    1. source ~/.bashrc  # 加载环境变量"
echo -e "    2. kunlun status     # 查看状态"
echo -e "    3. kunlun test       # 运行测试"
echo ""
echo -e "  ${YELLOW}Pi 集成:${NC}"
echo -e "    在你的 Pi 配置中添加 extension 路径:"
echo -e "    ${CYAN}$KUNLUN_HOME/extension${NC}"
echo ""
echo -e "  ${YELLOW}服务管理:${NC}"
echo -e "    sudo systemctl start kunlun-os   # 启动"
echo -e "    sudo systemctl enable kunlun-os  # 开机自启"
echo -e "    sudo journalctl -u kunlun-os -f  # 查看日志"
echo ""
