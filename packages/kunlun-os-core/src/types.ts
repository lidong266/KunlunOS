/**
 * KunlunOS Core 类型定义 — OS配置与状态
 *
 * 参考设计文档第23章
 */

// ═══════════════════════════════════════════════════════════════
// OS 运行状态
// ═══════════════════════════════════════════════════════════════

export type OSStatus = 'booting' | 'running' | 'paused' | 'stopped' | 'error';

// ═══════════════════════════════════════════════════════════════
// OS 运行时状态快照
// ═══════════════════════════════════════════════════════════════

export interface OSState {
  status: OSStatus;
  uptime: number;
  instanceCount: number;
  taskCount: number;
  pipelineRuns: number;
}

// ═══════════════════════════════════════════════════════════════
// 各子系统配置选项
// ═══════════════════════════════════════════════════════════════

export interface CogKALConfig {
  /** 初始认知实例数量 */
  initialInstances: number;
  /** 统计采样间隔(ms)，0=不采样 */
  statsInterval: number;
}

export interface CogBusConfig {
  /** 节点TTL(ms) */
  nodeTTL: number;
  /** 是否启用节点发现 */
  enableDiscovery: boolean;
}

export interface CogAlgoConfig {
  /** 是否注册默认算法Plugin */
  registerDefaults: boolean;
}

export interface CogCapabilityConfig {
  /** 是否注册内置能力 */
  registerBuiltin: boolean;
}

export interface CogTrustConfig {
  /** 默认价值对齐 */
  valueAlignment: {
    values: string[];
    thresholds: {
      perceive: number;
      think: number;
      act: number;
      govern: number;
    };
  };
}

export interface CogMemoryConfig {
  /** LLM Token池容量 */
  llmPoolSize: number;
  /** 缓存Token池容量 */
  cachePoolSize: number;
  /** 知识Token池容量 */
  knowledgePoolSize: number;
}

export interface CogPipelineConfig {
  /** 是否启用默认处理器 */
  enableDefaultProcessors: boolean;
}

export interface CogProcessConfig {
  /** 最大进程数 */
  maxProcesses: number;
}

export interface CogHumanConfig {
  /** 默认TTL(ms) */
  defaultTTL: number;
  /** 默认优先级 */
  defaultPriority: number;
}

export interface CogMetasynthesisConfig {
  /** 最大研讨轮数 */
  maxRounds: number;
}

export interface CogExecutorConfig {
  /** 螺旋执行最大迭代次数 */
  maxSpiralIterations: number;
}

// ═══════════════════════════════════════════════════════════════
// KunlunOS 总配置
// ═══════════════════════════════════════════════════════════════

export interface KunlunOSConfig {
  /** OS实例ID */
  instanceId: string;
  /** 是否启用详细日志 */
  verbose: boolean;
  /** 认知内核调度器配置 */
  kal: CogKALConfig;
  /** 认知总线配置 */
  bus: CogBusConfig;
  /** 算法引擎配置 */
  algo: CogAlgoConfig;
  /** 能力注册表配置 */
  capability: CogCapabilityConfig;
  /** 信任框架配置 */
  trust: CogTrustConfig;
  /** Token/记忆管理配置 */
  memory: CogMemoryConfig;
  /** 认知管道配置 */
  pipeline: CogPipelineConfig;
  /** 认知进程配置 */
  process: CogProcessConfig;
  /** 人类通道配置 */
  human: CogHumanConfig;
  /** 大成智慧学配置 */
  metasynthesis: CogMetasynthesisConfig;
  /** 执行引擎配置 */
  executor: CogExecutorConfig;
}

// ═══════════════════════════════════════════════════════════════
// 默认配置工厂
// ═══════════════════════════════════════════════════════════════

export function defaultOSConfig(): KunlunOSConfig {
  return {
    instanceId: 'kunlun-os',
    verbose: false,
    kal: {
      initialInstances: 1,
      statsInterval: 0,
    },
    bus: {
      nodeTTL: 60000,
      enableDiscovery: true,
    },
    algo: {
      registerDefaults: true,
    },
    capability: {
      registerBuiltin: true,
    },
    trust: {
      valueAlignment: {
        values: ['safety', 'honesty', 'helpfulness'],
        thresholds: {
          perceive: 0.3,
          think: 0.5,
          act: 0.7,
          govern: 0.9,
        },
      },
    },
    memory: {
      llmPoolSize: 128000,
      cachePoolSize: 50000,
      knowledgePoolSize: 100000,
    },
    pipeline: {
      enableDefaultProcessors: false,
    },
    process: {
      maxProcesses: 100,
    },
    human: {
      defaultTTL: 30000,
      defaultPriority: 8,
    },
    metasynthesis: {
      maxRounds: 5,
    },
    executor: {
      maxSpiralIterations: 10,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// 引导阶段日志
// ═══════════════════════════════════════════════════════════════

export interface BootPhaseLog {
  phase: number;
  name: string;
  status: 'success' | 'error';
  duration: number;
  message: string;
  timestamp: number;
}
