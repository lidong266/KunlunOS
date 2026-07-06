#!/usr/bin/env node
/**
 * 昆仑OS CLI — 可执行入口
 *
 * 使用方式:
 *   node packages/kunlun-os-core/bin/kunlun.mjs
 *   或 npx tsx packages/kunlun-os-core/bin/kunlun.mjs
 *
 * 环境变量:
 *   KUNLUN_MODEL_PROVIDER  — LLM provider (默认: openai)
 *   KUNLUN_MODEL_ID        — 模型 ID (默认: gpt-4o)
 *   KUNLUN_API_KEY         — API Key
 *   KUNLUN_API_BASE_URL    — API Base URL (可选)
 *   KUNLUN_SYSTEM_PROMPT   — 系统提示词 (可选)
 */

import { createProvider } from '@earendil-works/pi-ai';
import { KunlunCLI } from '../src/cli.js';

async function main() {
  const provider = process.env.KUNLUN_MODEL_PROVIDER || 'openai';
  const modelId = process.env.KUNLUN_MODEL_ID || 'gpt-4o';
  const apiKey = process.env.KUNLUN_API_KEY;
  const baseUrl = process.env.KUNLUN_API_BASE_URL;
  const systemPrompt = process.env.KUNLUN_SYSTEM_PROMPT;

  if (!apiKey) {
    console.error('❌ 请设置 KUNLUN_API_KEY 环境变量');
    console.error('   export KUNLUN_API_KEY=sk-xxx');
    process.exit(1);
  }

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
