# Contributing to Pi-Kunlun

## Development Setup

### Prerequisites
- Node.js >= 22.0.0
- pnpm >= 9.15.0

### Setup
```bash
git clone https://github.com/pi-kunlun/pi-kunlun.git
cd pi-kunlun
pnpm install
pnpm -r build
```

### Project Structure
```
pi-kunlun/
  packages/
    kunlun-ternary/      # L0: Ternary logic layer
    kunlun-eventbus/     # L2: Ternary event bus
    kunlun-presence/     # L1+L4: Cognitive presence
    kunlun-subsystems/   # L3: 8 cognitive subsystems
    kunlun-contradiction/ # L5: Contradiction analysis engine
    kunlun-ocgs/         # L6: OCGS adaptive layer
    kunlun-pw/           # L7: Protracted War strategy
    kunlun-spiral/       # L8: Practice spiral engine
  integration-tests/     # Cross-package integration tests
```

### Build Order (Dependency Topology)
```
kunlun-ternary → eventbus → presence → contradiction → spiral → subsystems → ocgs → pw
```

### Running Tests

**Unit tests (per package):**
```bash
cd packages/kunlun-ternary && pnpm test
```

**Integration tests (cross-package):**
```bash
npx vitest run integration-tests --config integration-tests/vitest.config.ts
```

### Coding Standards
- TypeScript strict mode enabled
- ESM modules only (`"type": "module"`)
- All ternary values use `Trit` type (`T_TRUE` / `T_UNKNOWN` / `T_FALSE`)
- Packages follow `@kunlun/<name>` naming convention

### Commit Convention
- `feat:` — New feature
- `fix:` — Bug fix
- `refactor:` — Code refactoring
- `test:` — Test additions/changes
- `docs:` — Documentation only
- `chore:` — Build/tooling changes
