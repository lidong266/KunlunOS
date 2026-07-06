/**
 * @kunlun/os-core — 昆仑OS核心
 *
 * 认知操作系统核心，集成所有子系统
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

// ─── 主类 ───
export { KunlunOS } from './kunlun-os';
