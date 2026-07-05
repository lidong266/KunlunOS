/**
 * L1+L4 认知在场层 — 类型定义
 *
 * 核心概念：
 *   PresenceState — 三元在场状态（AWAKE/WATCHING/RESTING）
 *   DistanceField — 距场感知（认知距离/认知负载/感受质地）
 *   CognitivePresence — 完整的认知在场实体
 */

import type { Trit } from '@kunlun/ternary';

// ─── 在场状态 ───

/** 认知在场状态（三元） */
export type PresenceState = 'AWAKE' | 'WATCHING' | 'RESTING';

/** 状态 → Trit 映射 */
export const PRESENCE_TRIT: Record<PresenceState, Trit> = {
  AWAKE: 1,
  WATCHING: 0,
  RESTING: -1,
};

// ─── 脉冲类型 ───

export type PulseType =
  | 'scheduled'       // 定时脉冲
  | 'event_driven'    // 事件脉冲
  | 'contradiction'   // 矛盾脉冲
  | 'practice'        // 实践脉冲
  | 'user_initiated'  // 用户交互
  | 'ecosystem'       // 生态变化
  | 'phase_shift';    // 阶段转换

// ─── 距场 ───

export interface DistanceField {
  /** 距距：0(重合) ~ 1(很远) */
  cognitiveDistance: number;
  /** 认知负载：0(轻松) ~ 1(超载) */
  cognitiveLoad: number;
  /** 感受质地：+1期待 / 0中性 / -1抗拒 */
  affectiveTone: Trit;
}

// ─── 脉冲记录 ───

export interface PulseRecord {
  type: PulseType;
  triggeredAt: number;  // Unix timestamp
  responseTrit: Trit;   // 脉冲响应结果
  latency: number;      // ms
}

// ─── 认知在场实体 ───

export interface CognitivePresence {
  /** 在场唯一标识 */
  id: string;

  /** 当前在场状态 */
  state: PresenceState;

  /** 状态对应的 Trit 值 */
  stateTrit: Trit;

  /** 距场感知 */
  distanceField: DistanceField;

  /** 连续性指数：0~1 */
  continuityIndex: number;

  /** 最近脉冲时间 (Unix timestamp) */
  lastPulseAt: number;

  /** 当前活跃的矛盾对数量 */
  activeContradictions: number;

  /** 在场元数据 */
  metadata: {
    createdAt: number;
    totalPulses: number;
    phaseTransitions: number;
    contradictionResolved: number;
  };
}

// ─── 在场快照（持久化用） ───

export interface CognitivePresenceSnapshot {
  id: string;
  state: Trit;
  distanceFieldJson: string;
  continuityIndex: number;
  lastPulseAt: number;
  currentPhase: string;
  snapshotAt: number;
}

// ─── 状态转移记录 ───

export interface PresenceTransition {
  from: PresenceState;
  to: PresenceState;
  reason: string;
  timestamp: number;
  trit: Trit; // +1=主动转移 / 0=被动转移 / -1=被迫转移
}

// ─── 在场健康 ───

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

export interface HealthReport {
  status: HealthStatus;
  trit: Trit;          // +1正常 / 0降级 / -1异常
  issues: string[];
  lastHealthyAt: number | null;
}

// ─── 配置 ───

export interface PresenceConfig {
  /** 初始状态 */
  initialState?: PresenceState;
  /** 最大脉冲记录保留数 */
  maxPulseHistory?: number;
  /** 健康检查间隔 (ms) */
  healthCheckIntervalMs?: number;
  /** 无脉冲进入 WATCHING 的超时 (ms) */
  idleTimeoutMs?: number;
  /** WATCHING 状态进入 RESTING 的超时 (ms) */
  restTimeoutMs?: number;
}
