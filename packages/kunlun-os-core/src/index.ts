/**
 * @kunlun/os-core — 昆仑OS核心
 *
 * 认知操作系统核心，集成所有子系统。
 * 昆仑OS 是唯一对外接口层，内部通过 Pi 微内核驱动 LLM 调用和工具执行。
 *
 * 参考设计文档第23章
 */

// ─── 类型 ───
export type {
  OSStatus,
  OSState,
  KunlunOSConfig,
  CogKALConfig,
  CogBusConfig,
  CogAlgoConfig,
  CogCapabilityConfig,
  CogTrustConfig,
  CogMemoryConfig,
  CogPipelineConfig,
  CogProcessConfig,
  CogHumanConfig,
  CogMetasynthesisConfig,
  CogExecutorConfig,
  BootPhaseLog,
} from './types';

// ─── 工厂函数 ───
export { defaultOSConfig } from './types';

// ─── 引导 ───
export { CogBoot } from './boot';
export type { BootResult } from './boot';

// ─── OS 主类 ───
export { KunlunOS, getKunlunOS, bootKunlunOS } from './kunlun-os';
export type {
  KunlunAnalysis,
  KunlunToolDecision,
} from './kunlun-os';

// ─── Agent 封装（对外统一 API） ───
export { KunlunAgent, getKunlunAgent, createKunlunAgent } from './kunlun-agent';
export type { KunlunAgentOptions } from './kunlun-agent';

// ─── CLI 入口 ───
export { KunlunCLI } from './cli';

// ─── Harness 层（从 Pi 迁移来的上层功能） ───
export { AgentHarness } from './harness/agent-harness.js';
export type {
  AgentHarnessOptions,
  AgentHarnessResources,
  AgentHarnessStreamOptions,
  ExecutionEnv,
  Session,
  SessionRepo,
  SessionMetadata,
  Skill,
  PromptTemplate,
  AbortResult,
  NavigateTreeResult,
  AgentHarnessEvent,
  AgentHarnessEventResultMap,
  AgentHarnessOwnEvent,
} from './harness/types.js';
export { InMemorySessionRepo } from './harness/session/memory-repo.js';
export { JsonlSessionRepo } from './harness/session/jsonl-repo.js';
export { NodeExecutionEnv } from './harness/env/nodejs.js';

// ─── Pi Agent 集成（兼容旧 API） ───
export {
  createPiIntegration,
  startKunlun,
} from './pi-adapter';
export type {
  PiIntegrationConfig,
} from './pi-adapter';
