# @kunlun/os-core

昆仑OS 核心 — 认知操作系统核心层。

集成所有子系统的统一对外接口层，提供认知调度、多微内核编排、共享认知层和 CLI 入口。

## 核心模块

| 模块 | 功能 |
|------|------|
| `KunlunOS` | OS 主入口，管理生命周期和认知注入 |
| `KunlunAgent` | 统一 Agent 入口，驱动 LLM 调用 |
| `MultiKernelOrchestrator` | 多微内核 MapReduce 调度器 |
| `SharedCognitiveLayer` | 多 Pi 共享 Token / 缓存 / 记忆 |
| `ElevenBridges` | 十一桥知识卡片路由 |
| `KunlunCLI` | 命令行交互入口 |
| `AgentHarness` | Agent 运行时框架（session / env / compaction） |

## 用法

### 基础认知分析

```typescript
import { KunlunOS } from '@kunlun/os-core';

const os = new KunlunOS();
await os.start();

const analysis = await os.injectCognition(
  [{ role: 'user', content: '性能和成本如何权衡' }],
  'You are a helpful assistant.'
);

console.log(analysis.bridge?.name);       // 自然辩证法
console.log(analysis.contradictions);      // [{ thesis: '追求性能', antithesis: '保证成本' }]
```

### 多 Pi MapReduce 深度分析

```typescript
import { createOrchestrator, InMemorySessionRepo, NodeExecutionEnv } from '@kunlun/os-core';

const orch = await createOrchestrator({
  env: new NodeExecutionEnv({ cwd: '/tmp' }),
  session: await new InMemorySessionRepo().create(),
  models, model,  // 需要 LLM 后端
}, { workers: 3 });

// LLM 智能拆解 → 多 Pi 并行 → 综合汇总
const result = await orch.deepAnalyze('分析这个电商平台的增长策略');
console.log(orch.shared.getStats());

orch.stop();
```

### CLI

```bash
export KUNLUN_API_KEY=sk-xxx
export KUNLUN_MODEL_ID=gpt-4o
npx tsx packages/kunlun-os-core/bin/kunlun.mjs
```

## 构建

此包通过 `tsc --noEmit` 做类型检查，不产出 dist。源码通过 `tsx` 直接运行，`main` 指向 `src/index.ts`。

```bash
pnpm build   # 类型检查
```

## 测试

```bash
pnpm test  # 包含多核并行基准测试
```

## 许可证

MIT
