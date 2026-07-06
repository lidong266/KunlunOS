# Changelog

All notable changes to Pi-Kunlun will be documented in this file.

## [0.9.0] - 2026-07-06

### Added
- **离线认知 CLI（CognitiveCLI）** — `packages/kunlun-os-core/src/cognitive-cli.ts`
  - 无需 LLM API Key 即可使用昆仑OS 的核心认知能力
  - `analyze <text>` — 大成智慧学认知管线（十一桥路由 → 知识卡片 → 矛盾分析 → 综合集成 → 天工渲染 → prompt 注入）
  - `contradiction <A> vs <B>` — 矛盾分析引擎（8 分析器：可统一性/主导方面/质变临界/否定之否定/转化预测/三进制编码）
  - `bridge <text>` — 十一桥路由与三层知识卡片（AX/SC/TC）
  - `bridges` — 列出全部 11 座学科桥与 33 张知识卡片
  - `boot` — CogBoot 6 阶段引导序列可视化
  - `status` — OS 运行状态
  - 支持一键命令模式与交互式 REPL 模式

- **CLI 双模式入口** — `bin/kunlun.mjs` 重写
  - 离线认知模式：无需 API Key，动态加载 CognitiveCLI（零依赖 pi-agent-core）
  - LLM 交互模式：需 API Key，加载完整 Pi 微内核 REPL
  - 无 API Key 时自动降级为离线认知模式，不再直接退出报错
  - 使用动态 import 隔离两套依赖链，离线模式不加载 LLM 栈

- **tsx 开发依赖** — 根 `package.json` 新增 `tsx@^4.23.0`
  - 项目 demos/CLI 均依赖 `npx tsx` 运行，现声明为正式 devDependency

- **CognitiveCLI 测试** — `packages/kunlun-os-core/__tests__/cognitive-cli.test.ts`（21 tests）
  - 覆盖全部命令：analyze/contradiction/bridge/bridges/boot/status/help/version
  - 错误处理：空输入、缺少 vs 分隔符、未知命令
  - `runCognitiveCli` 入口函数测试

- **OCGS 生态扫描器全实现** — `packages/kunlun-ocgs/src/ecosystem-sensor.ts`
  - 6 个 stub 扫描器升级为真实实现：hermes, clawhub, agent_ecosystem, tool_ecosystem, model_ecosystem, user_behavior
  - hermes：检测 HERMES_ENDPOINT/HERMES_VERSION 环境变量 + .hermes config 文件扫描
  - clawhub：检测 CLAWHUB_ENDPOINT/CLAHUB_TOKEN + .clawhub config 目录扫描
  - agent_ecosystem：AGENT_DIR + OPENCLAW_PLUGINS 环境变量 + 多路径 agent 目录扫描
  - tool_ecosystem：TOOL_PATH + MCP_TOOLS + workbuddy skills/tools 目录扫描
  - model_ecosystem：7 类 model endpoint + 7 类 API key provider + 3 类本地模型目录扫描
  - user_behavior：USER.md/MEMORY.md 用户画像 + session 历史 + 用户身份识别
  - 每个扫描器均支持优雅降级（env 缺失 → 'unavailable'，异常 → 'degraded'）

### Changed
- **OCGS 测试更新** — `packages/kunlun-ocgs/__tests__/ecosystem-sensor.test.ts`
  - 移除 6 个 stub 状态断言，替换为真实扫描器验证（状态：ok/degraded/unavailable，信号数 >= 1）

### Changed
- 项目版本 0.8.9 → 0.9.0
- 测试总数 853 → 874（+21），测试文件 35 → 36
- `@kunlun/os-core` 导出新增 `CognitiveCLI` 与 `runCognitiveCli`
- README 新增离线认知 CLI 文档与 v0.9 版本记录

## [0.2.0] - 2026-07-05

### Added
- **Pi Fork: ternary injection into agent loop** — `fork/packages/agent/` (fork of pi-agent-core v0.80.3)
  - `kunlun-bridge.ts`: 3-layer adapter (cognitive analysis injection / tool decision / memory)
  - `agent-loop.ts`: ternary analysis injected before each LLM call via `streamAssistantResponse()`
  - Tool decision hook: `decideToolCall()` / `decideToolCallBatch()` with priority-based reordering
  - Automatic alternative tool routing when a tool is blocked by the ternary engine
  - `sortToolCallsByPriority()`: read-tools-first priority scheme
  - `formatAnalysisForPrompt()`: structured analysis injection format

- **Pi Extension: full-stack Kunlun engine** — `extension/index.ts`
  - `KunlunEngine` implementation with contradiction detection / strategy / spiral / ecosystem analysis
  - Zhenyue (镇岳) 4-layer security pipeline for tool call risk assessment
  - Batch tool decision with mutual exclusion detection and priority assignment
  - 11-bridge detection system (ported from v6) for contextual analysis routing
  - `/kunlun analyze <query>` pipeline command (Diting → Taiyi → Tiangong)

- **Persistent memory store** — `extension/persistent-memory.ts`
  - SQLite-backed memory using `node:sqlite` (Node 24 built-in, zero external deps)
  - Ternary memory model with reinforcement/negation/decay
  - 3-phase cleanup strategy: faded purge / duplicate merge / capacity cap
  - Startup seed from pi-hermes-memory MEMORY.md
  - Periodic cleanup every 50 writes

- **Structured logging** — `extension/logger.ts`
  - Level-based logging (error/warn/info/debug) to file + console
  - 7 `catchError` replacements for previously silent catch blocks

- **CI/CD pipeline** — `.github/workflows/ci.yml` (196 lines)
  - 3-stage CI: monorepo (8 packages) → fork (ternary injection) → extension (dependency + load check)
  - `ci-check.sh`: local offline check script (9 phases, all green)

- **19 kunlun-bridge tests** — `fork/packages/agent/test/kunlun-bridge.test.ts`
  - Coverage: engine registration, cognitive analysis, single/batch tool decision, priority sorting, prompt formatting, error degradation

- **v6 → V2 migration** — `scripts/migrate-v6.mjs`
  - Migrates 75 records: 9 knowledge cards, 11 bridge profiles, 11 resonance relations, 16 domain maps, 28 rule/baseline memories
  - Migration report generated to `deliverables/v6-migration-report.md`

- **Dacheng Zhihuixue knowledge card system** — `scripts/init-knowledge-cards.mjs`
  - 11 bridges × 3 layers (basic discipline → science & technology → engineering & technology) × 3 card types (AX/SC/TC)
  - 33 initial knowledge cards written to `knowledge_cards_v2` table
  - 3 usage modes: perception (deconstruct) / thinking (reconstruct) / expression (content×architecture×aesthetics×narrative)

### Changed
- **@kunlun/contradiction**: Engine analysis refinements; build script now includes ESM import extension fix
- **@kunlun/ocgs**: Ecosystem sensor improvements
- **@kunlun/subsystems**: Xuanguan MCP gateway enhanced; Diting/Taiyi/Tiangong interfaces refined
- All 8 V2 packages: `tsc` build scripts updated with ESM import extension post-processing (`fix-esm-imports.mjs`)
- Fork build: esbuild `--banner` injects `createRequire` for ESM `process` compatibility
- Extension `package.json`: fork reference unified to `file:../fork/packages/agent`
- ESM import resolution: 5 packages had bare imports fixed via post-build script

### Fixed
- **Silent catches**: 7 `catch { /* 静默 */ }` replaced with `catchError()` logging in `extension/index.ts`
- **Fork error boundary**: Ternary analysis catch now logs via `console.warn` instead of silent degradation
- **Module resolution**: `@kunlun/contradiction` and `@kunlun/ocgs` ESM import extensions fixed
- **Fork `process` require**: esbuild `__require("process")` resolved via `createRequire` injection

## [0.1.0] - 2026-07-05

### Added
- **L0: @kunlun/ternary** — Ternary logic layer (Trit, Tryte, K3 algebra, ternary state machine, comparator, decision tree)
- **L1+L4: @kunlun/presence** — Cognitive presence layer (CognitivePresence, IPresenceManager, distance field)
- **L2: @kunlun/eventbus** — Ternary event bus with storm detection, loop detection, and handler isolation
- **L3: @kunlun/subsystems** — 8 ternary cognitive subsystems:
  - S6 Diting (contradiction perception)
  - S7 Taiyi (contradiction analysis executor)
  - S8 Tiangong (ternary confidence rendering)
  - S9 Langhuan (ternary knowledge index)
  - S10 Guicang (ternary memory model)
  - S11 Zhenyue (ternary security)
  - S12 Zhenshang (ternary governance)
  - S13 Xuanguan (MCP protocol gateway)
- **L5: @kunlun/contradiction** — Contradiction analysis engine with 8 analyzers (On Contradiction)
- **L6: @kunlun/ocgs** — OCGS adaptive layer: ecosystem sensing, emergence detection, adaptive regulation (Open Complex Giant Systems)
- **L7: @kunlun/pw** — Protracted War strategy engine: defense → stalemate → counter-offensive (On Protracted War)
- **L8: @kunlun/spiral** — Practice spiral engine: practice → cognition → re-practice → re-cognition (On Practice)
- 90 integration tests across 8 test files covering cross-package contracts and full-cycle scenarios
- TypeScript ternary type system with `Trit`, `Tryte`, and `K3` algebra

[0.2.0]: https://github.com/pi-kunlun/pi-kunlun/releases/tag/v0.2.0
[0.1.0]: https://github.com/pi-kunlun/pi-kunlun/releases/tag/v0.1.0
