# Changelog

All notable changes to Pi-Kunlun will be documented in this file.

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
