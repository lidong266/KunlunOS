# Contributing to Pi-Kunlun

## 开发环境搭建

### 前置要求

- **Node.js** >= 22.0.0
- **pnpm** >= 9.15.0

```bash
node -v   # 确认 >= 22
pnpm -v   # 确认 >= 9.15
```

### 安装与构建

```bash
git clone https://github.com/lidong266/pi-kunlun.git
cd pi-kunlun
pnpm install       # 安装所有依赖
pnpm -r build      # 构建所有包（22 packages）
pnpm test          # 运行全部测试（853 tests）
```

### 验证安装

```bash
# 运行端到端 demo（无需 LLM API）
npx tsx demo/contradiction-demo.ts
```

---

## 项目结构

```
pi-kunlun/
  packages/                    # 20 个核心包（monorepo）
    kunlun-ternary/            # L0: 三进制类型系统
    kunlun-eventbus/           # L2: 三元事件总线
    kunlun-presence/           # L4: 认知在场
    kunlun-subsystems/         # L3: 八子系统
    kunlun-contradiction/      # L5: 矛盾分析引擎
    kunlun-ocgs/               # L6: OCGS 自适应层
    kunlun-cogkal/             # L6: 认知内核调度器
    kunlun-cogbus/             # L6: 认知事件总线
    kunlun-cog-algo/           # L6: 算法 Plugin 注册
    kunlun-cog-capability/     # L6: 认知能力注册
    kunlun-cog-trust/          # L6: 信任管理
    kunlun-cog-memory/         # L6: Token/记忆管理
    kunlun-cog-pipeline/       # L6: 七层流管道
    kunlun-cog-process/        # L6: 认知进程管理
    kunlun-cog-human/          # L6: 人类节点通道
    kunlun-cog-metasynthesis/ # L6: 大成智慧学综合集成
    kunlun-cog-executor/       # L6: 认知执行引擎
    kunlun-pw/                 # L7: 持久战策略
    kunlun-spiral/             # L8: 实践螺旋
    kunlun-os-core/            # OS: 认知操作系统核心
  fork/packages/agent/         # Pi 微内核（AgentLoop/Bridge/Proxy）
  extension/                   # VS Code 扩展入口
  integration-tests/           # 跨包集成测试（P0/P1/P2 优先级）
  demo/                        # 演示脚本
  docs/architecture/           # 设计文档（24 章）
  scripts/                     # 构建辅助脚本
```

### 构建依赖拓扑

```
kunlun-ternary → eventbus → presence → contradiction → spiral → subsystems → ocgs → pw
                                                                         ↓
                              cog-* (10 包) → os-core → fork/agent
```

---

## 开发流程

### 日常开发

```bash
# 运行单个包的测试
cd packages/kunlun-ternary && pnpm test

# 运行全部单元测试
pnpm test

# 运行集成测试
npx vitest run integration-tests --config integration-tests/vitest.config.ts

# 类型检查（os-core）
cd packages/kunlun-os-core && pnpm build

# 代码风格检查
pnpm lint

# 自动格式化
pnpm format
```

### 添加新包

1. 在 `packages/` 下创建目录，遵循 `kunlun-<name>` 命名
2. 创建 `package.json`（`name: "@kunlun/<name>"`，`type: "module"`）
3. 创建 `tsconfig.json`（extends `../../tsconfig.base.json`）
4. 在 `vitest.config.ts` 和 `tsconfig.base.json` 中添加 alias
5. 在 `pnpm-workspace.yaml` 中已通过 `packages/*` 自动包含

### 添加测试

- 单元测试放在包的 `__tests__/` 目录下，文件名 `*.test.ts`
- 集成测试放在 `integration-tests/` 对应优先级目录下
- 使用 `vitest` 的 `describe` / `it` / `expect` 语法

---

## 编码规范

- **TypeScript**：strict 模式（各包 tsconfig 继承 `tsconfig.base.json`）
- **模块系统**：ESM only（`"type": "module"`）
- **三进制值**：统一使用 `Trit` 类型（`T_TRUE` / `T_UNKNOWN` / `T_FALSE`）
- **包命名**：`@kunlun/<name>` 命名约定
- **导入**：使用 `import type` 区分类型导入和值导入

---

## 提交规范

```
<type>: <description>
```

| type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `refactor` | 代码重构 |
| `test` | 测试相关 |
| `docs` | 文档变更 |
| `chore` | 构建/工具变更 |
| `perf` | 性能优化 |

示例：
```
feat: 添加矛盾链分析器
fix: 修复 ternary state machine 状态转换错误
test: 补充 ocgs 集成测试覆盖
```

---

## 运行 CI 检查

提交前可本地运行 CI 检查脚本：

```bash
bash ci-check.sh
```

该脚本验证：monorepo 构建 + 单元测试 + 集成测试 + fork 构建 + 扩展加载。
