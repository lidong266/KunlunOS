# 昆仑OS (KunlunOS) — AI 认知操作系统

> **以大成智慧学为运行、以 Pi Agent 为微内核、以矛盾论/实践论/论持久战/OCGS为核心算法、**
> **以三进制(+1/0/-1)为数学底座、以七层认知流为架构的 AI 认知操作系统**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D22-green)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-orange)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-853%20passing-brightgreen)](.)
[![Build](https://img.shields.io/badge/build-22%20packages-blue)](.)

---

## 快速开始

```bash
git clone https://github.com/lidong266/pi-kunlun.git
cd pi-kunlun
pnpm install
pnpm test          # 853 tests, 35 files
pnpm -r build      # 22 packages
```

### 运行 CLI

```bash
export KUNLUN_API_KEY=sk-xxx
export KUNLUN_MODEL_ID=gpt-4o
npx tsx packages/kunlun-os-core/bin/kunlun.mjs
```

---

## 什么是昆仑OS？

昆仑OS 是一个 **AI 认知操作系统**。它不是一个聊天机器人、不是一个后端平台、不是一个知识库。

### 定位

```
Linux 内核     →  Android / HarmonyOS    用户操作系统
Pi Agent       →  昆仑OS (KunlunOS)      认知操作系统
   ↑                    ↑
   微内核               认知调度层 OS
```

**昆仑OS 调度 Pi，不是 Pi 调度昆仑OS。**

### 核心能力

| 能力 | 描述 |
|------|------|
| 🧠 **大成智慧学认知管线** | 十一桥路由 → 知识卡片 → 矛盾分析 → 综合集成 → 天工渲染 |
| ⚡ **多微内核 MapReduce** | 1个主Pi + N个工作Pi，LLM智能拆解 + 并行执行 + 综合汇总 |
| 💾 **共享认知层** | Token预算共享 / LLM缓存 / 归藏记忆 / 分析缓存 |
| 🔧 **工具调用去重** | 多Pi并发相同工具调用 → 只执行1次 |
| 📡 **认知预取** | 主Pi分析后预注入上下文到子Pi，省去各自检索 |
| 🛡️ **四层风控** | 镇岳安全管线（预检→门控→升级→热力图） |
| 🎯 **三策略调度** | EDF(截止时间) > HPF(矛盾优先级) > Spiral(螺旋迭代) |

---

## 架构

```
┌──────────────────────────────────────────────────────────┐
│  昆仑OS 核心 (kunlun-os-core)                             │
│  KunlunOS + KunlunAgent + MultiKernelOrchestrator        │
│  ElevenBridges + CogBoot + CLI                           │
├──────────────────────────────────────────────────────────┤
│  共享认知层 (SharedCognitiveLayer)                        │
│  TokenManager / LLM缓存 / 归藏记忆 / 分析缓存             │
├──────────────────────────────────────────────────────────┤
│  八子系统 (kunlun-subsystems)                             │
│  谛听·太一·天工·琅嬛·归藏·镇岳·镇熵·玄关                  │
├──────────────────────────────────────────────────────────┤
│  四大算法引擎                                             │
│  矛盾论 · 实践论 · 论持久战 · OCGS                        │
│  三进制数学底座 (+1/0/-1)                                 │
├──────────────────────────────────────────────────────────┤
│  认知基础设施 (10包)                                       │
│  CogKAL调度器 / CogBus事件总线 / CogAlgo算法Plugin         │
│  CogCapability能力注册 / CogTrust信任 / CogMemory记忆      │
│  CogPipeline七层流 / CogProcess进程 / CogHuman人机          │
│  CogMetaSynthesis大成智慧学 / CogExecutor执行引擎          │
├──────────────────────────────────────────────────────────┤
│  Pi 微内核 (fork/packages/agent)                          │
│  Agent + AgentLoop + KunlunBridge + Proxy                 │
└──────────────────────────────────────────────────────────┘
```

---

## 使用示例

### 基础认知分析

```typescript
import { KunlunOS } from '@kunlun/os-core';

const os = new KunlunOS();
await os.start();

const analysis = await os.injectCognition(
  [{ role: 'user', content: '性能和成本如何权衡' }],
  'You are a helpful assistant.'
);

console.log(analysis.bridge?.name);   // 自然辩证法
console.log(analysis.contradictions); // [{ thesis: '追求性能', antithesis: '保证成本' }]
console.log(analysis.promptInjection);
// ─── 大成智慧学·认知分析（昆仑OS） ───
// 【🔬 自然辩证法桥】物质第一性·意识第二性
// 【知识卡片】AX-001 / SC-001 / TC-001
// 【矛盾感知】追求性能 ↔ 保证成本
// 【综合集成】均势待定 (0.33)
// 【天工渲染】? 待验证
```

### 多 Pi MapReduce 深度分析

```typescript
import { createOrchestrator, InMemorySessionRepo, NodeExecutionEnv } from '@kunlun/os-core';

const orch = await createOrchestrator({
  env: new NodeExecutionEnv({ cwd: '/tmp' }),
  session: await new InMemorySessionRepo().create(),
  models, model,  // 需要 LLM 后端
}, { workers: 3 });

// 一键深度分析: injectCognition → LLM智能拆解 → 多Pi并行 → 综合
const result = await orch.deepAnalyze('分析这个电商平台的增长策略');

// 查看共享层状态
console.log(orch.shared.getStats());
// { tokens: {...}, cache: {...}, memories: 3, analysisCache: 1 }

orch.stop();
```

---

## 包结构（22包）

| 包 | 层 | 描述 |
|------|------|------|
| `kunlun-ternary` | L0 | 三进制类型系统（Trit/Tryte/K3） |
| `kunlun-eventbus` | L2 | 三元事件总线 |
| `kunlun-presence` | L4 | 认知在场 |
| `kunlun-subsystems` | L3 | 八子系统（谛听/太一/天工/琅嬛/归藏/镇岳/镇熵/玄关） |
| `kunlun-contradiction` | L5 | 矛盾引擎（8分析器） |
| `kunlun-spiral` | L8 | 实践螺旋 |
| `kunlun-pw` | L7 | 持久战策略 |
| `kunlun-ocgs` | L6 | OCGS自适应层 |
| `kunlun-cogkal` | L6 | 认知内核调度器 |
| `kunlun-cogbus` | L6 | 认知事件总线 |
| `kunlun-cog-algo` | L6 | 算法Plugin注册 |
| `kunlun-cog-capability` | L6 | 认知能力注册 |
| `kunlun-cog-trust` | L6 | 信任管理 |
| `kunlun-cog-memory` | L6 | Token/记忆管理 |
| `kunlun-cog-pipeline` | L6 | 七层流管道 |
| `kunlun-cog-process` | L6 | 认知进程管理 |
| `kunlun-cog-human` | L6 | 人类节点通道 |
| `kunlun-cog-metasynthesis` | L6 | 大成智慧学综合集成 |
| `kunlun-cog-executor` | L6 | 认知执行引擎 |
| `kunlun-os-core` | OS | **OS核心** (KunlunOS/Agent/CLI/Bridge) |
| `fork/packages/agent` | 微内核 | **Pi微内核** (AgentLoop/Bridge/Proxy) |

---

## 设计文档

完整24章设计方案：[`docs/architecture/昆仑OS-设计方案.md`](docs/architecture/昆仑OS-设计方案.md)

实现率：**23/24 章 (95.8%)**

---

## 测试

```bash
pnpm test                    # 853 tests, 35 files, all passing
pnpm -r build                # 22 packages
```

---

## 版本

| 版本 | 日期 | 核心变更 |
|------|------|----------|
| v0.8 | 07-06 | 多微内核MapReduce + 共享认知层 + LLM智能拆解 |
| v0.7 | 07-06 | 大成智慧学·十一桥知识卡片 + injectCognition五阶段管线 |
| v0.6 | 07-06 | Pi微内核化，AgentHarness迁移到昆仑OS |
| v0.5 | 07-06 | 12个认知基础设施包 + OS核心 |
| v0.4 | 07-05 | 三进制 + 八子系统 + 设计文档 |

---

## 许可证

[MIT](LICENSE) © 2025-2026

---

> *"从定性到定量综合集成"* — 钱学森 大成智慧学
