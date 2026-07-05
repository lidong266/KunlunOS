/**
 * OCGSOrchestrator — OCGS 编排器
 *
 * 主循环调度逻辑：scanEcosystem → updateSystemModel → detectEmergence → adapt。
 * 支持三种触发模式：manual / interval / event_driven。
 *
 * 整合 EcosystemSensor + SystemModel + EmergenceDetector + AdaptiveRegulator
 * 四个引擎，提供统一的 IOCGSAdaptiveLayer 接口。
 */

import { T_TRUE, T_UNKNOWN } from '@kunlun/ternary';
import type { Trit } from '@kunlun/ternary';
import type {
  EcosystemSource,
  EcosystemScanResult,
  EcosystemChange,
  EcosystemEventHandler,
  SystemModelSnapshot,
  ComplexityAssessment,
  EmergenceReport,
  AdaptationResult,
  OCGSState,
  OCGSOrchestratorConfig,
} from './types';
import { DEFAULT_OCGS_ORCHESTRATOR_CONFIG } from './types';
import { type IEcosystemSensor, createEcosystemSensor } from './ecosystem-sensor';
import { type ISystemModel, createSystemModel } from './system-model';
import { type IEmergenceDetector, createEmergenceDetector } from './emergence-detector';
import { type IAdaptiveRegulator, createAdaptiveRegulator } from './adaptive-regulator';

// ═══════════════════════════════════════════════════════════════
// 编排器接口（对应架构文档 IOCGSAdaptiveLayer）
// ═══════════════════════════════════════════════════════════════

export interface IOCGSOrchestrator {
  /** 扫描外部生态变化 */
  scanEcosystem(): Promise<EcosystemScanResult>;

  /** 注册生态事件监听器 */
  onEcosystemEvent(source: EcosystemSource, handler: EcosystemEventHandler): string;

  /** 移除生态事件监听器 */
  offEcosystemEvent(listenerId: string): boolean;

  /** 更新内部系统模型 */
  updateSystemModel(): Promise<SystemModelSnapshot>;

  /** 评估系统复杂性等级 */
  assessComplexity(): ComplexityAssessment;

  /** 检测涌现行为 */
  detectEmergence(snapshot: SystemModelSnapshot): EmergenceReport;

  /** 执行自适应调整 */
  adapt(change: EcosystemChange): Promise<AdaptationResult>;

  /** 执行完整感知→适应循环 */
  fullCycle(): Promise<FullCycleResult>;

  /** 获取 OCGS 全局状态 */
  getOCGSState(): OCGSState;

  /** 获取编排器配置 */
  getConfig(): OCGSOrchestratorConfig;

  /** 启动定时循环 */
  start(): void;

  /** 停止定时循环 */
  stop(): void;

  /** 是否正在运行 */
  isRunning(): boolean;
}

/** 完整循环结果 */
export interface FullCycleResult {
  scan: EcosystemScanResult;
  snapshot: SystemModelSnapshot;
  emergence: EmergenceReport;
  adaptations: AdaptationResult[];
  cycleTimestamp: Date;
  cycleDurationMs: number;
}

// ═══════════════════════════════════════════════════════════════
// OCGSOrchestrator 实现
// ═══════════════════════════════════════════════════════════════

export function createOCGSOrchestrator(config?: Partial<OCGSOrchestratorConfig>): IOCGSOrchestrator {
  const cfg: OCGSOrchestratorConfig = { ...DEFAULT_OCGS_ORCHESTRATOR_CONFIG, ...config };

  // 创建四个引擎
  const sensor = createEcosystemSensor({
    timeoutMs: cfg.scanTimeoutMs,
    enabledSources: cfg.enabledSources,
  });
  const model = createSystemModel();
  const emergenceDetector = createEmergenceDetector();
  const regulator = createAdaptiveRegulator();

  // 定时器管理
  let intervalHandle: ReturnType<typeof setInterval> | null = null;
  let lastAdaptation = 0;

  async function scanEcosystem(): Promise<EcosystemScanResult> {
    return sensor.scanEcosystem();
  }

  function onEcosystemEvent(
    source: EcosystemSource,
    handler: EcosystemEventHandler,
  ): string {
    return sensor.onEcosystemEvent(source, handler);
  }

  function offEcosystemEvent(listenerId: string): boolean {
    return sensor.offEcosystemEvent(listenerId);
  }

  async function updateSystemModel(): Promise<SystemModelSnapshot> {
    // 先扫描最新生态状态
    const scanResult = sensor.getLastScanResult();
    if (scanResult) {
      return model.updateSystemModel(scanResult);
    }
    // 无历史扫描 → 先扫描
    const freshScan = await scanEcosystem();
    return model.updateSystemModel(freshScan);
  }

  function assessComplexity(): ComplexityAssessment {
    return model.assessComplexity();
  }

  function detectEmergence(snapshot: SystemModelSnapshot): EmergenceReport {
    return emergenceDetector.detectEmergence(snapshot);
  }

  async function adapt(change: EcosystemChange): Promise<AdaptationResult> {
    // 防抖：距离上次适应至少 cfg.minAdaptationIntervalMs
    const now = Date.now();
    if (now - lastAdaptation < cfg.minAdaptationIntervalMs) {
      // 频率限制：返回缓存状态
      const state = regulator.getOCGSState();
      return {
        success: state.ecosystemAwareness,
        measures: [],
        modelDelta: ['Adaptation skipped due to rate limiting'],
        triggeredContradictions: [],
        directiveId: 'rate-limited',
        timestamp: now,
      };
    }

    lastAdaptation = now;
    return regulator.adapt(change);
  }

  async function fullCycle(): Promise<FullCycleResult> {
    const startMs = Date.now();

    // Step 1: 扫描生态
    const scan = await scanEcosystem();

    // Step 2: 更新系统模型
    const snapshot = model.updateSystemModel(scan);

    // Step 3: 涌现检测
    const emergence = cfg.emergenceDetectionEnabled
      ? detectEmergence(snapshot)
      : {
          detected: T_UNKNOWN as Trit,
          emergentBehaviors: [],
          nonlinearities: [],
          selfOrganizationPatterns: [],
          timestamp: Date.now(),
          detectorVersion: 'disabled',
        };

    // Step 4: 从扫描结果生成 EcosystemChange 并适应
    const adaptations: AdaptationResult[] = [];
    for (const signal of scan.signals) {
      if (signal.significance !== 0) { // 非零信号才触发适应
        const change: EcosystemChange = {
          type: signal.impact.direction === T_TRUE ? 'capability_gain' : 'ecosystem_restructure',
          source: signal.source,
          description: signal.description,
          affectedComponents: signal.impact.affectedSubsystems,
          severity: signal.significance,
          timestamp: signal.detectedAt,
        };
        const result = await adapt(change);
        adaptations.push(result);
      }
    }

    const cycleDurationMs = Date.now() - startMs;

    return {
      scan,
      snapshot,
      emergence,
      adaptations,
      cycleTimestamp: new Date(),
      cycleDurationMs,
    };
  }

  function getOCGSState(): OCGSState {
    const regulatorState = regulator.getOCGSState();
    const complexity = assessComplexity();
    return {
      ...regulatorState,
      complexityClass: complexity.complexityClass,
    };
  }

  function getConfig(): OCGSOrchestratorConfig {
    return { ...cfg };
  }

  function start(): void {
    if (intervalHandle) return; // 已启动

    if (cfg.verbose) {
      console.log(`[OCGS] Orchestrator started, interval: ${cfg.scanIntervalMs}ms`);
    }

    intervalHandle = setInterval(async () => {
      try {
        const result = await fullCycle();
        if (cfg.verbose) {
          console.log(
            `[OCGS] Cycle completed | signals: ${result.scan.signals.length} | ` +
            `adaptations: ${result.adaptations.length} | ${result.cycleDurationMs}ms`,
          );
        }
      } catch (err) {
        if (cfg.verbose) {
          console.error('[OCGS] Cycle failed:', err);
        }
      }
    }, cfg.scanIntervalMs);
  }

  function stop(): void {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
      if (cfg.verbose) {
        console.log('[OCGS] Orchestrator stopped');
      }
    }
  }

  function isRunning(): boolean {
    return intervalHandle !== null;
  }

  return {
    scanEcosystem,
    onEcosystemEvent,
    offEcosystemEvent,
    updateSystemModel,
    assessComplexity,
    detectEmergence,
    adapt,
    fullCycle,
    getOCGSState,
    getConfig,
    start,
    stop,
    isRunning,
  };
}
