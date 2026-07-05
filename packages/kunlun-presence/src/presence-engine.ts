/**
 * PresenceEngine — 认知在场引擎
 *
 * 管理三元在场状态（AWAKE/WATCHING/RESTING）的转换、
 * 距场感知、脉冲记录、健康检查。
 *
 * 对应架构层：L1（认知存在层）+ L4（距离场）
 */

import type { Trit } from '@kunlun/ternary';
import type { ITernaryEventBus } from '@kunlun/eventbus';
import type {
  PresenceState,
  PulseType,
  PulseRecord,
  DistanceField,
  CognitivePresence,
  CognitivePresenceSnapshot,
  PresenceTransition,
  PresenceConfig,
  HealthReport,
  HealthStatus,
} from './types.js';
import { PRESENCE_TRIT } from './types.js';

const DEFAULT_CONFIG: Required<PresenceConfig> = {
  initialState: 'WATCHING',
  maxPulseHistory: 100,
  healthCheckIntervalMs: 30_000,
  idleTimeoutMs: 300_000,   // 5 分钟无脉冲 → WATCHING
  restTimeoutMs: 900_000,   // 15 分钟无脉冲 → RESTING
};

export class PresenceEngine {
  private config: Required<PresenceConfig>;
  private state: PresenceState;
  private presenceId: string;
  private createdAt: number;
  private lastPulseAt: number;
  private continuityIndex: number;
  private pulseHistory: PulseRecord[] = [];
  private transitionHistory: PresenceTransition[] = [];
  private activeContradictions = 0;
  private contradictionResolved = 0;
  private phaseTransitions = 0;
  private lastHealthCheck: number = 0;
  private eventBus?: ITernaryEventBus;

  constructor(config: PresenceConfig = {}, eventBus?: ITernaryEventBus) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.state = this.config.initialState;
    this.presenceId = `presence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.createdAt = Date.now();
    this.lastPulseAt = Date.now();
    this.continuityIndex = 1.0; // 初始连续
    this.eventBus = eventBus;
  }

  // ─── 状态管理 ───

  /** 获取当前在场实体 */
  getPresence(): CognitivePresence {
    return {
      id: this.presenceId,
      state: this.state,
      stateTrit: PRESENCE_TRIT[this.state],
      distanceField: this.senseDistanceField(),
      continuityIndex: this.continuityIndex,
      lastPulseAt: this.lastPulseAt,
      activeContradictions: this.activeContradictions,
      metadata: {
        createdAt: this.createdAt,
        totalPulses: this.pulseHistory.length,
        phaseTransitions: this.phaseTransitions,
        contradictionResolved: this.contradictionResolved,
      },
    };
  }

  /** 获取在场快照 */
  getSnapshot(): CognitivePresenceSnapshot {
    return {
      id: this.presenceId,
      state: PRESENCE_TRIT[this.state],
      distanceFieldJson: JSON.stringify(this.senseDistanceField()),
      continuityIndex: this.continuityIndex,
      lastPulseAt: this.lastPulseAt,
      currentPhase: this.state,
      snapshotAt: Date.now(),
    };
  }

  /** 过渡到场状态 */
  transition(to: PresenceState, reason: string): PresenceTransition {
    const from = this.state;
    this.state = to;

    // 判定转移性质
    const fromTrit = PRESENCE_TRIT[from];
    const toTrit = PRESENCE_TRIT[to];
    let trit: Trit;
    if (toTrit > fromTrit) {
      trit = 1;  // 主动升级（RESTING → WATCHING → AWAKE）
    } else if (toTrit < fromTrit) {
      trit = -1; // 被迫降级
    } else {
      trit = 0;
    }

    // 如果跨越了阶段，记录
    if (from !== to) {
      this.phaseTransitions++;
    }

    const transition: PresenceTransition = {
      from,
      to,
      reason,
      timestamp: Date.now(),
      trit,
    };

    this.transitionHistory.push(transition);

    // 通知事件总线
    this.eventBus?.emit('presence:state_change', {
      previous: from,
      current: to,
      trit,
    });

    return transition;
  }

  // ─── 脉冲管理 ───

  /** 发射认知脉冲 */
  emitPulse(type: PulseType, payload?: Record<string, unknown>): PulseRecord {
    const now = Date.now();
    const latency = now - this.lastPulseAt;

    let responseTrit: Trit = 0;
    switch (type) {
      case 'contradiction':
      case 'user_initiated':
        responseTrit = 1; // 触发认知
        break;
      case 'scheduled':
        responseTrit = 0; // 排队等待
        break;
      default:
        responseTrit = 0;
    }

    const record: PulseRecord = {
      type,
      triggeredAt: now,
      responseTrit,
      latency,
    };

    this.pulseHistory.push(record);
    this.lastPulseAt = now;

    // 限制历史记录长度
    if (this.pulseHistory.length > this.config.maxPulseHistory) {
      this.pulseHistory = this.pulseHistory.slice(-this.config.maxPulseHistory);
    }

    // 更新连续性指数：靠近的脉冲增加连续性
    if (latency < 60_000) {
      this.continuityIndex = Math.min(1, this.continuityIndex + 0.01);
    } else {
      this.continuityIndex = Math.max(0, this.continuityIndex - 0.05);
    }

    // 通知事件总线
    this.eventBus?.emit('presence:pulse', {
      pulseType: type,
      pulseId: `${type}-${now}`,
      trit: responseTrit,
    });

    return record;
  }

  // ─── 距场感知 ───

  /** 感知距场 */
  senseDistanceField(): DistanceField {
    const timeSinceLastPulse = Date.now() - this.lastPulseAt;

    // 认知距离：由连续性和最近脉冲间隔决定
    const cognitiveDistance = Math.min(
      1,
      (1 - this.continuityIndex) * 0.5 + Math.min(timeSinceLastPulse / 600_000, 1) * 0.5
    );

    // 认知负载：由活跃矛盾对数量决定
    const cognitiveLoad = Math.min(1, this.activeContradictions / 10);

    // 感受质地：由状态决定
    let affectiveTone: Trit;
    switch (this.state) {
      case 'AWAKE':   affectiveTone = 1;  break;
      case 'WATCHING': affectiveTone = 0; break;
      case 'RESTING':  affectiveTone = -1; break;
    }

    return { cognitiveDistance, cognitiveLoad, affectiveTone };
  }

  // ─── 矛盾计数 ───

  incrementContradictions(): void {
    this.activeContradictions++;
  }

  decrementContradictions(): void {
    if (this.activeContradictions > 0) {
      this.activeContradictions--;
      this.contradictionResolved++;
    }
  }

  // ─── 健康检查 ───

  healthCheck(): HealthReport {
    const now = Date.now();
    this.lastHealthCheck = now;

    const issues: string[] = [];
    let status: HealthStatus = 'HEALTHY';

    // 检查脉冲间隔
    const idleTime = now - this.lastPulseAt;
    if (idleTime > this.config.restTimeoutMs) {
      issues.push(`No pulse for ${Math.round(idleTime / 1000)}s, exceeding rest timeout`);
      status = 'UNHEALTHY';
    } else if (idleTime > this.config.idleTimeoutMs) {
      issues.push(`No pulse for ${Math.round(idleTime / 1000)}s, exceeding idle timeout`);
      if (status === 'HEALTHY') status = 'DEGRADED';
    }

    // 检查连续性
    if (this.continuityIndex < 0.2) {
      issues.push(`Low continuity index: ${this.continuityIndex.toFixed(2)}`);
      if (status === 'HEALTHY') status = 'DEGRADED';
    }

    const tritMap: Record<HealthStatus, Trit> = {
      HEALTHY: 1,
      DEGRADED: 0,
      UNHEALTHY: -1,
    };

    return {
      status,
      trit: tritMap[status],
      issues,
      lastHealthyAt: status === 'HEALTHY' ? now : null,
    };
  }

  // ─── 转移历史 ───

  getTransitionHistory(): ReadonlyArray<PresenceTransition> {
    return this.transitionHistory;
  }

  getPulseHistory(): ReadonlyArray<PulseRecord> {
    return this.pulseHistory;
  }
}
