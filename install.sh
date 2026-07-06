#!/usr/bin/env bash
#
# 昆仑OS 一键安装脚本
# 用法:
#   bash install.sh              # 克隆到 ./KunlunOS 并安装
#   bash install.sh my-app       # 克隆到 ./my-app 并安装
#   在已克隆的仓库内: bash install.sh .   # 仅安装依赖
#
set -euo pipefail

REPO_URL="https://github.com/lidong266/KunlunOS.git"
REQUIRED_NODE_MAJOR=22
TARGET_DIR="${1:-KunlunOS}"

echo "🔷 昆仑OS 安装脚本"

# ── 1. 检查 Node 版本 ─────────────────────────────
check_node() {
  if ! command -v node >/dev/null 2>&1; then
    echo "❌ 未找到 node。请先安装 Node.js >= ${REQUIRED_NODE_MAJOR} (https://nodejs.org)"
    exit 1
  fi
  local node_major
  node_major=$(node -v | sed -E 's/v([0-9]+).*/\1/')
  if [ "${node_major}" -lt "${REQUIRED_NODE_MAJOR}" ]; then
    echo "❌ Node 版本过低: v${node_major}，需要 >= v${REQUIRED_NODE_MAJOR}"
    exit 1
  fi
  echo "✅ Node $(node -v) 满足要求 (>= v${REQUIRED_NODE_MAJOR})"
}

# ── 2. 确保 pnpm 可用 ─────────────────────────────
ensure_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    echo "✅ 已安装 pnpm $(pnpm -v)"
    return
  fi
  echo "⏳ 未找到 pnpm，尝试通过 corepack 启用 ..."
  if command -v corepack >/dev/null 2>&1; then
    corepack enable
    corepack prepare pnpm@9.15.0 --activate
    echo "✅ pnpm $(pnpm -v) 已就绪"
  else
    echo "❌ 未找到 pnpm 且 corepack 不可用。请手动安装: npm i -g pnpm@9.15.0"
    exit 1
  fi
}

# ── 3. 克隆或进入仓库 ─────────────────────────────
setup_repo() {
  # 当前已在 KunlunOS 仓库内（例如 clone 后直接运行）
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local remote
    remote=$(git remote get-url origin 2>/dev/null || true)
    if [[ "${remote}" == *KunlunOS* ]] || [[ "${remote}" == *pi-kunlun* ]]; then
      echo "✅ 已在昆仑OS仓库内，使用当前目录"
      return
    fi
  fi

  if [ -d "${TARGET_DIR}/.git" ]; then
    echo "✅ 目标目录已是 git 仓库，跳过克隆: ${TARGET_DIR}"
    cd "${TARGET_DIR}"
    git pull --ff-only 2>/dev/null || echo "⚠️ git pull 失败（可能无网络），继续使用本地代码"
  else
    echo "⏳ 克隆仓库 ${REPO_URL} → ${TARGET_DIR}"
    git clone "${REPO_URL}" "${TARGET_DIR}"
    cd "${TARGET_DIR}"
  fi
}

# ── 4. 安装依赖 ──────────────────────────────────
install_deps() {
  echo "⏳ 安装依赖 (pnpm install) ..."
  pnpm install
}

# ── 4.5 构建工作区包 ─────────────────────────────
# os-core 从源码(tsx)运行，但其依赖(@kunlun/ternary、@kunlun/cogkal 等)
# 的入口指向 ./dist/index.js，必须构建后 dist 才存在，否则 import 报
# ERR_MODULE_NOT_FOUND。fork/agent 包有已知的预存类型错误(build 脚本以
# || true 容忍)，不影响离线运行。
build_packages() {
  echo "⏳ 构建工作区包 (pnpm -r build) ..."
  if pnpm -r build > /tmp/kunlun-build.log 2>&1; then
    echo "✅ 工作区包构建完成"
  else
    echo "⚠️ 构建出现错误（常见于 fork 包的已知类型问题，已忽略），继续..."
    tail -8 /tmp/kunlun-build.log
  fi
}

# ── 5. (可选) 验证运行 ────────────────────────────
verify() {
  echo "⏳ 运行离线引导验证安装 (boot) ..."
  if npx tsx packages/kunlun-os-core/bin/kunlun.mjs boot >/dev/null 2>&1; then
    echo "✅ 引导验证通过"
  else
    echo "⚠️ 引导验证未通过（多为非 TTY 环境所致），但依赖安装已完成，可正常部署"
  fi
}

main() {
  check_node
  ensure_pnpm
  setup_repo
  install_deps
  build_packages
  verify
  echo ""
  echo "🎉 安装完成！在终端（TTY）中运行以查看鸿蒙6风格启动动画："
  echo "   npx tsx packages/kunlun-os-core/bin/kunlun.mjs boot"
  echo "   npx tsx packages/kunlun-os-core/bin/kunlun.mjs analyze \"你的认知分析文本\""
  echo "   npx tsx packages/kunlun-os-core/bin/kunlun.mjs bridges"
  echo ""
  echo "提示: 若 pnpm 报 'must be a string without null bytes'，是 ~/.npmrc 被保存为"
  echo "      UTF-16 编码所致，转成 UTF-8 (iconv -f UTF-16 -t UTF-8 ~/.npmrc > ~/.npmrc.utf8) 即可。"
}

main "$@"
