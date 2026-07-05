# Pi-Kunlun V2 &mdash; Ternary Cognitive Infrastructure

> **&pi;-&Kcy;&#1091;&#1085;&#1100;&#1083;&#1091;&#1085;&#1100;** (Pi-Kunlun) is a ternary (+1/0/-1) cognitive infrastructure built on the philosophy of *Dacheng Zhihuixue* (大成智慧学 / Science of Great Wisdom) with four core algorithmic engines derived from dialectical materialism.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue)](https://www.typescriptlang.org/)
[![Node](https://img.shields.io/badge/Node-%3E%3D22-green)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-orange)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-90%2F90%20passing-brightgreen)](.)

---

## What is Pi-Kunlun?

Pi-Kunlun is **not** a backend platform, an AI chatbot, or a knowledge base. It is a **cognitive infrastructure** where AI and humans co-exist in the same cognitive field &mdash; perceiving, thinking, expressing, remembering, governing, evolving, and acting together.

### Core Architecture

```
  Ternary Math Base (+1/0/-1)
        &darr;
  Cognitive Presence (Dacheng Zhihuixue runtime)
        &darr;
  Event Bus (ternary lifecycle)
        &darr;
  Four Engines:
    &bull; Contradiction Engine   (矛盾论  &mdash; On Contradiction)
    &bull; Practice Spiral        (实践论  &mdash; On Practice)
    &bull; Protracted War Strategy (论持久战 &mdash; On Protracted War)
    &bull; OCGS Adaptive Layer    (开放复杂巨系统论 &mdash; OCGS Theory)
        &darr;
  Cognitive Subsystems (Diting, Taiyi, Tiangong, Langhuan, Guicang)
        &darr;
  Execution Infrastructure (Pi + pi-evolve + Python Bridge)
```

### Key Differences from Traditional AI Systems

| Dimension | Traditional AI | Pi-Kunlun V2 |
|-----------|---------------|--------------|
| **Math base** | Boolean (true/false) | Ternary (+1/0/-1) |
| **Runtime philosophy** | Request-response | Continuous presence, pulsed cognition |
| **Core algorithm** | Reasoning engine | Contradiction analysis engine |
| **Learning model** | Train &rarr; deploy &rarr; evaluate | Practice &rarr; cognition &rarr; re-practice &rarr; re-cognition (spiral) |
| **Time model** | External variable | Built-in dimension (defense &rarr; stalemate &rarr; counteroffensive) |
| **System boundary** | Closed (API-driven) | Open (ecosystem-aware, self-adaptive) |

---

## Package Structure

This monorepo contains 8 packages organized in a dependency hierarchy:

| Layer | Package | Description |
|:-----:|---------|-------------|
| L0 | `@kunlun/ternary` | Ternary logic base: Trit, Tryte, K3 operators, state machines |
| L2 | `@kunlun/eventbus` | Ternary event bus with +1/0/-1 lifecycle events |
| L4 | `@kunlun/presence` | Cognitive presence: continuous field, pulse engine, distance sensing |
| L5 | `@kunlun/contradiction` | Contradiction analysis engine: 8 analyzers for dialectical reasoning |
| L6 | `@kunlun/ocgs` | Open Complex Giant System: ecosystem sensor, emergence detector, adaptive regulator |
| L7 | `@kunlun/pw` | Protracted War strategy: phase assessment, tempo regulation, tactics |
| L8 | `@kunlun/spiral` | Practice Spiral: practice &rarr; cognition &rarr; re-practice &rarr; deepened cognition |
| L3 | `@kunlun/subsystems` | Cognitive subsystems: Diting, Taiyi, Tiangong, Langhuan, Guicang |

```
@kunlun/ternary
  &darr;
@kunlun/eventbus
  &darr;
@kunlun/presence  &rarr;  @kunlun/contradiction
  &darr;                      &darr;
@kunlun/spiral  &larr;  @kunlun/subsystems  &larr;  @kunlun/ocgs
  &darr;
@kunlun/pw
```

---

## Quick Start

### Prerequisites

- **Node.js** &ge; 22.0.0
- **pnpm** 9.15.0

### Install &amp; Build

```bash
# Clone the repository
git clone <repo-url>
cd pi-kunlun

# Install dependencies
pnpm install

# Build all packages (in dependency order)
pnpm run build
```

### Run Tests

```bash
# Run all integration tests (90 tests, 8 test suites)
pnpm exec vitest run integration-tests --config integration-tests/vitest.config.ts

# Run unit tests for a specific package
pnpm --filter @kunlun/ternary test

# Run with coverage
pnpm --filter @kunlun/ternary test --coverage
```

---

## The Ternary Type System

All logic in Pi-Kunlun is built on the `Trit` primitive:

```typescript
type Trit = 1 | 0 | -1;
// +1 = true / confirmed / strengthened
//  0 = unknown / pending / observing
// -1 = false / negated / weakened

const T_TRUE: Trit = 1;
const T_UNKNOWN: Trit = 0;
const T_FALSE: Trit = -1;

// K3 ternary logic operators
TernaryLogic.AND(1, 0);   // &rarr; 0
TernaryLogic.OR(-1, 0);   // &rarr; 0
TernaryLogic.NOT(1);      // &rarr; -1
TernaryLogic.IMPLIES(0, -1); // &rarr; 0 (unknown implies false = unknown)
```

The `Tryte` (6-trit vector) provides 729 states for fine-grained confidence encoding:

```typescript
type Tryte = [Trit, Trit, Trit, Trit, Trit, Trit];
// 3^6 = 729 possible states
// Range: -364 (all -1) to +364 (all +1)
// 0 = all unknown
```

---

## The Contradiction Engine

The heart of Pi-Kunlun is the contradiction analysis engine. Instead of "input &rarr; reason &rarr; answer", it works on **contradiction pairs**:

```typescript
const engine = createContradictionEngine();

const result = engine.analyzeSingle({
  id: 'cp-1',
  thesis: makeProposition('AI will replace human labor', T_TRUE),
  antithesis: makeProposition('AI will create new jobs', T_TRUE),
  contradictionType: 'non_antagonistic',
  priority: 1,
  discoveredAt: Date.now(),
  warPhaseAtDiscovery: 'strategic_defense',
});

// result.analysis.unifiability   &rarr; Trit (+1/0/-1)
// result.analysis.dominantAspect &rarr; Trit
// result.qualitativeChange       &rarr; threshold status
// result.negationCycle           &rarr; negation stage
// result.recommendations         &rarr; action items
// result.overallConfidence       &rarr; Trit
```

Eight analyzers implement the full dialectical framework:
1. **Principal Contradiction Locator** &mdash; identifies the key contradiction
2. **Aspect Analyzer** &mdash; analyzes each side of a contradiction
3. **Unity of Opposites Deriver** &mdash; finds conditions for unification
4. **Qualitative Change Detector** &mdash; detects approaching critical thresholds
5. **Negation of Negation Detector** &mdash; tracks spiral ascension
6. **Transformation Predictor** &mdash; predicts transformation paths
7. **Unification Conditions Deriver** &mdash; finds specific unification conditions
8. **Contradiction Chain Analyzer** &mdash; maps causal chains between contradictions

---

## Integration Tests

90 integration tests covering all 8 packages, organized by priority:

```
integration-tests/
&boxvr;&boxh; vitest.config.ts
&boxvr;&boxh; p0-core/
&boxv;  &boxvr;&boxh; trit-foundation.test.ts       (10 tests)  &mdash; Ternary math base
&boxv;  &boxvr;&boxh; eventbus-storm-resilience.test.ts (14 tests)  &mdash; Event bus resilience
&boxv;  &boxvr;&boxh; presence-eventbus-subsystems.test.ts (4 tests)  &mdash; Cross-layer integration
&boxv;  &boxvr;&boxh; diting-contradiction-taiyi.test.ts  (13 tests)  &mdash; Diting &rarr; Contradiction &rarr; Taiyi
&boxv;  &boxvr;&boxh; contradiction-spiral-pw.test.ts      (12 tests)  &mdash; Contradiction &rarr; Spiral &rarr; PW
&boxv;  &boxvr;&boxh; guicang-langhuan.test.ts             (10 tests)  &mdash; Guicang + Langhuan
&boxv;  &boxurl;&boxh; p1-important/
&boxv;  &boxvr;&boxh; trit-cross-package.test.ts    (20 tests)  &mdash; Cross-package Trit consistency
&boxv;  &boxvr;&boxh; ocgs-full-cycle.test.ts       (9 tests)   &mdash; OCGS full cycle
&boxv;  &boxurl;&boxh; p2-edge/
&boxv;     &boxurl;&boxh; ocgs-subsystems-contract.test.ts (6 tests) &mdash; OCGS-Diting contract
```

All tests pass: **90/90** &check;

---

## Project Structure

```
pi-kunlun/
&boxvr;&boxh; package.json              # Root workspace config
&boxvr;&boxh; pnpm-workspace.yaml       # pnpm monorepo definition
&boxvr;&boxh; tsconfig.base.json        # Shared TypeScript config
&boxvr;&boxh; integration-tests/        # Cross-package integration tests
&boxvr;&boxh; packages/
&boxv;  &boxvr;&boxh; kunlun-ternary/         # L0: Ternary logic base
&boxv;  &boxvr;&boxh; kunlun-eventbus/        # L2: Ternary event bus
&boxv;  &boxvr;&boxh; kunlun-presence/        # L4: Cognitive presence
&boxv;  &boxvr;&boxh; kunlun-contradiction/   # L5: Contradiction engine
&boxv;  &boxvr;&boxh; kunlun-ocgs/            # L6: OCGS adaptive layer
&boxv;  &boxvr;&boxh; kunlun-pw/              # L7: Protracted war strategy
&boxv;  &boxvr;&boxh; kunlun-spiral/          # L8: Practice spiral
&boxv;  &boxurl;&boxh; kunlun-subsystems/     # L3: Cognitive subsystems
&boxvr;&boxh; docs/                     # Architecture & design documents
&boxurl;&boxh; deliverables/            # Audit & review reports
```

---

## Documentation

- [Architecture Design (V2)](../PI-KUNLUN-V2-ARCHITECTURE.md) &mdash; Full system design document
- [Security Audit (V2)](../PI-KUNLUN-V2-SECURITY-AUDIT.md) &mdash; OWASP + STRIDE assessment
- [Integration Test Reports](deliverables/gstack/) &mdash; Round-by-round test fix reports
- [CHANGELOG](CHANGELOG.md) &mdash; Release history

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Key principles:
- **Ternary-first**: All new logic must use Trit/Tryte, not boolean
- **Test-driven**: Integration tests must pass before PR merge
- **Dependency order**: Build in topological order (L0 &rarr; L2 &rarr; L4-&rarr;...)
- **Monorepo discipline**: Cross-package imports must be explicit workspace dependencies

---

## License

[MIT](LICENSE) &copy; 2025-2026 Pi-Kunlun Contributors

---

> *"The unity of opposites is the fundamental law of the universe."*
> &mdash; *On Contradiction*
