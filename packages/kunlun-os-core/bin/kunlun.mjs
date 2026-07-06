#!/usr/bin/env node
/**
 * 昆仑OS CLI — 可执行入口 (kl)
 *
 * 双模式（按需动态加载，互不依赖）：
 *   1. 离线认知模式（无需 LLM API）：暴露矛盾分析、十一桥、大成智慧学等核心认知能力
 *   2. LLM 交互模式（需 KUNLUN_API_KEY）：完整 Pi 微内核 REPL
 *
 * 使用方式:
 *   # 离线认知命令（无需 API Key）
 *   npx tsx packages/kunlun-os-core/bin/kunlun.mjs analyze "性能和成本如何权衡"
 *   npx tsx packages/kunlun-os-core/bin/kunlun.mjs contradiction "追求性能" vs "保证成本"
 *   npx tsx packages/kunlun-os-core/bin/kunlun.mjs bridge "如何优化系统架构"
 *   npx tsx packages/kunlun-os-core/bin/kunlun.mjs boot
 *   npx tsx packages/kunlun-os-core/bin/kunlun.mjs        # 无 API Key 时进入离线 REPL
 *
 *   # LLM 交互模式（需 API Key）
 *   KUNLUN_API_KEY=sk-xxx npx tsx packages/kunlun-os-core/bin/kunlun.mjs
 *
 * 环境变量（仅 LLM 模式需要）:
 *   KUNLUN_MODEL_PROVIDER  — LLM provider (默认: openai)
 *   KUNLUN_MODEL_ID        — 模型 ID (默认: gpt-4o)
 *   KUNLUN_API_KEY         — API Key
 *   KUNLUN_API_BASE_URL    — API Base URL (可选)
 *   KUNLUN_SYSTEM_PROMPT   — 系统提示词 (可选)
 */

// 离线认知命令集（无需 LLM API Key）
const COGNITIVE_COMMANDS = new Set([
  'analyze', 'contradiction', 'bridge', 'bridges',
  'boot', 'status', 'help', 'version',
  '--help', '-h', '--version', '-v', '--offline',
]);

async function main() {
  const argv = process.argv.slice(2);
  const firstArg = argv[0];

  const apiKey = process.env.KUNLUN_API_KEY;
  const isOfflineCommand = firstArg !== undefined && COGNITIVE_COMMANDS.has(firstArg);
  const offlineFlag = argv.includes('--offline');
  // 离线命令、--offline 标志、或无 API Key 时，进入离线认知模式
  const useOffline = isOfflineCommand || offlineFlag || !apiKey;

  // ── 离线认知模式（动态加载，不依赖 LLM / pi-agent-core）──
  if (useOffline) {
    const { runCognitiveCli } = await import('../src/cognitive-cli.js');

    // 过滤掉 --offline 标志，保留真实命令与参数
    const cliArgs = argv.filter(a => a !== '--offline');

    if (!apiKey && !isOfflineCommand && !offlineFlag && cliArgs.length === 0) {
      // 无 API Key 且无命令 → 提示并进入离线 REPL
      console.log('ℹ️  未设置 KUNLUN_API_KEY，进入离线认知模式。');
      console.log('   设置 KUNLUN_API_KEY 后可使用完整 LLM 交互模式。');
      console.log('   输入 help 查看离线认知命令。\n');
    }

    const code = await runCognitiveCli(cliArgs);
    process.exit(code);
    return;
  }

  // ── LLM 交互模式（动态加载，需要 pi-agent-core）──
  const { createProvider } = await import('@earendil-works/pi-ai');
  const { KunlunCLI } = await import('../src/cli.js');

  const provider = process.env.KUNLUN_MODEL_PROVIDER || 'openai';
  const modelId = process.env.KUNLUN_MODEL_ID || 'gpt-4o';
  const baseUrl = process.env.KUNLUN_API_BASE_URL;
  const systemPrompt = process.env.KUNLUN_SYSTEM_PROMPT;

  // 创建 provider
  const models = createProvider({
    provider,
    apiKey,
    baseUrl,
  });

  const model = models.getModel(modelId);
  if (!model) {
    console.error(`❌ 未找到模型: ${modelId} (provider: ${provider})`);
    console.error(`   可用模型: ${models.listModels().map(m => m.id).join(', ')}`);
    process.exit(1);
  }

  const cli = new KunlunCLI({
    models,
    model,
    systemPrompt,
  });

  await cli.start();
}

main().catch((err) => {
  console.error('启动失败:', err);
  process.exit(1);
});
