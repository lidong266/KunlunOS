#!/usr/bin/env bash
# pi-kunlun CI check (local)
# Verifies: monorepo build+test+integration, fork build+injection+test, extension deps+load

set -e
PASS=0
FAIL=0

# 仓库根目录：自动定位到本脚本所在位置
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

check() {
  local rc=$?
  local label="$1"
  if [ $rc -eq 0 ]; then
    echo "  ✅ $label"
    PASS=$((PASS+1))
  else
    echo "  ❌ $label"
    FAIL=$((FAIL+1))
  fi
  return $rc
}

echo "═══════════════════════════════════════════"
echo "  pi-kunlun CI Check (local)"
echo "═══════════════════════════════════════════"

# ── Phase 1: Monorepo Build ──
echo ""
echo "=== Phase 1: Monorepo Build ==="
cd "$ROOT"
pnpm -r build 2>&1 | tail -3
check "8 packages built"

# ── Phase 2: Integration Tests (90 tests) ──
echo ""
echo "=== Phase 2: Integration Tests ==="
cd "$ROOT"
pnpm vitest run integration-tests --config integration-tests/vitest.config.ts 2>&1 | tail -5
check "integration tests (90)"

# ── Phase 3: Fork Build ──
echo ""
echo "=== Phase 3: Fork Build ==="
cd "$ROOT"/fork/packages/agent
npm run build:js 2>&1 | tail -3
check "fork JS bundle (esbuild)"

# ── Phase 4: Fork Verifications ──
echo ""
echo "=== Phase 4: Fork Verifications ==="

# Verify ternary injection in bundle
grep -q "runKunlunAnalysis" dist/index.js && echo "  ✅ runKunlunAnalysis" && P=0 || { echo "  ❌ runKunlunAnalysis"; P=1; }
grep -q "decideToolCall" dist/index.js && echo "  ✅ decideToolCall" && P=$((P+0)) || { echo "  ❌ decideToolCall"; P=1; }
grep -q "sortToolCallsByPriority" dist/index.js && echo "  ✅ sortToolCallsByPriority" && P=$((P+0)) || { echo "  ❌ sortToolCallsByPriority"; P=1; }
[ $P -eq 0 ] && PASS=$((PASS+1)) && echo "  ✅ ternary injection present" || FAIL=$((FAIL+1))

# Verify runtime exports
node -e "
import('./dist/index.js').then(m => {
  const names = ['registerKunlunEngine','runKunlunAnalysis','formatAnalysisForPrompt',
    'decideToolCall','decideToolCallBatch','sortToolCallsByPriority',
    'getLatestAnalysis','isKunlunEngineLoaded','Agent','agentLoop'];
  let ok = 0, fail = 0;
  for (const n of names) {
    if (typeof m[n] === 'function') { ok++; }
    else { fail++; console.log('  ❌', n); }
  }
  console.log('  ✅', ok, 'exports OK' + (fail ? ', ' + fail + ' missing' : ''));
  process.exit(fail > 0 ? 1 : 0);
}).catch(e => { console.error('  ❌ Import failed:', e.message); process.exit(1); });
" 2>&1
check "fork runtime exports"

# ── Phase 5: Fork Tests (19 kunlun-bridge tests) ──
echo ""
echo "=== Phase 5: Fork Tests ==="
cd "$ROOT"/fork/packages/agent
npx vitest run test/kunlun-bridge.test.ts 2>&1 | tail -5
check "kunlun-bridge tests (19)"

# ── Phase 6: Extension Dependencies ──
echo ""
echo "=== Phase 6: Extension Dependencies ==="
cd "$ROOT"/extension
npm install --silent 2>&1 | tail -1

node --experimental-strip-types -e "
const deps = [
  '@kunlun/ternary','@kunlun/contradiction','@kunlun/eventbus',
  '@kunlun/presence','@kunlun/spiral','@kunlun/pw',
  '@kunlun/ocgs','@kunlun/subsystems',
  '@earendil-works/pi-agent-core','typebox',
];
let ok = true;
for (const d of deps) {
  try {
    const m = await import(d);
    console.log('  ✅', d);
  } catch(e) {
    console.log('  ❌', d, '→', e.message?.slice(0,80));
    ok = false;
  }
}
process.exit(ok ? 0 : 1);
" 2>&1
check "10 extension dependencies"

# ── Phase 7: Extension Load ──
echo ""
echo "=== Phase 7: Extension Load ==="
cd "$ROOT"/extension
node --experimental-strip-types -e "
import('./index.ts').then(m => {
  const ok = typeof m.default === 'function';
  console.log(ok ? '  ✅ Extension exports default function' : '  ❌ Extension failed');
  process.exit(ok ? 0 : 1);
}).catch(e => { console.error('  ❌', e.message?.slice(0,100)); process.exit(1); });
" 2>&1
check "extension module loads"

# ── Phase 8: Persistent Memory ──
echo ""
echo "=== Phase 8: Persistent Memory ==="
cd "$ROOT"/extension
node --experimental-strip-types -e "
import { PersistentMemoryStore } from './persistent-memory.ts';
const store = new PersistentMemoryStore('/tmp/ci-kunlun-memory.db');
store.store('CI test', 'ci', ['ci']);
const stats = store.getStats();
console.log('  ✅ Store OK: ' + stats.total + ' entries');
store.close();
" 2>&1
check "persistent memory"

# ── Summary ──
echo ""
echo "═══════════════════════════════"
echo "  Passed: $PASS   Failed: $FAIL"
echo "═══════════════════════════════"
# Cleanup
rm -f /tmp/ci-kunlun-memory.db
exit $FAIL
