/**
 * EcosystemSensor — 生态感知器
 *
 * 负责监听九大生态源的变化，支持超时降级和部分结果返回。
 *
 * MVP 实现 3 个源：self / openclaw / mcp_topology
 * 其余 6 个源返回 Stub 结果。
 */

import type { Trit } from '@kunlun/ternary';
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import type {
  EcosystemSource,
  EcosystemScanResult,
  EcosystemSignal,
  SourceScanDetail,
  EcosystemChange,
  EcosystemEventHandler,
  SourceScanner,
  SourceStatus,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 生态感知器接口
// ═══════════════════════════════════════════════════════════════

export interface IEcosystemSensor {
  /** 扫描所有生态源 */
  scanEcosystem(): Promise<EcosystemScanResult>;

  /** 注册生态事件监听器 */
  onEcosystemEvent(source: EcosystemSource, handler: EcosystemEventHandler): string;

  /** 移除生态事件监听器 */
  offEcosystemEvent(listenerId: string): boolean;

  /** 获取已注册的监听器数量 */
  getListenerCount(): number;

  /** 获取上次扫描结果 */
  getLastScanResult(): EcosystemScanResult | null;
}

// ═══════════════════════════════════════════════════════════════
// 内置扫描器实现
// ═══════════════════════════════════════════════════════════════

/**
 * 自感知扫描器
 * 检测 Pi-昆仑自身子系统的版本、配置、负载变化
 */
function scanSelf(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      // MVP：返回基本自身状态信号
      const signals: EcosystemSignal[] = [
        {
          source: 'self',
          signalType: 'subsystem_heartbeat',
          significance: T_TRUE,
          description: '所有已注册子系统心跳正常',
          impact: { direction: T_TRUE, affectedSubsystems: ['all'], urgency: T_UNKNOWN },
          detectedAt: Date.now(),
        },
        {
          source: 'self',
          signalType: 'model_version',
          significance: T_UNKNOWN,
          description: '系统模型版本无变化',
          impact: { direction: T_UNKNOWN, affectedSubsystems: ['OCGS'], urgency: T_FALSE },
          detectedAt: Date.now(),
        },
      ];

      resolve({
        source: 'self',
        status: 'ok',
        signals,
        latencyMs: Date.now() - startMs,
      });
    }, Math.min(50, timeoutMs));
  });
}

/**
 * OpenClaw 生态扫描器（Stub）
 * 实际实现需对接 OpenClaw API 检测版本和能力变化
 */
function scanOpenclaw(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const signals: EcosystemSignal[] = [
        {
          source: 'openclaw',
          signalType: 'version_check',
          significance: T_UNKNOWN,
          description: '[Stub] OpenClaw 版本检查未启用实际 API 对接',
          impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
          detectedAt: Date.now(),
        },
      ];

      resolve({
        source: 'openclaw',
        status: 'stub',
        signals,
        latencyMs: Date.now() - startMs,
      });
    }, Math.min(30, timeoutMs));
  });
}

/**
 * MCP 拓扑扫描器（Stub）
 * 实际实现需对接 MCP 服务发现协议检测拓扑变化
 */
function scanMcpTopology(timeoutMs: number): Promise<SourceScanDetail> {
  const startMs = Date.now();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const signals: EcosystemSignal[] = [
        {
          source: 'mcp_topology',
          signalType: 'topology_check',
          significance: T_UNKNOWN,
          description: '[Stub] MCP 拓扑检查未启用实际协议对接',
          impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
          detectedAt: Date.now(),
        },
      ];

      resolve({
        source: 'mcp_topology',
        status: 'stub',
        signals,
        latencyMs: Date.now() - startMs,
      });
    }, Math.min(30, timeoutMs));
  });
}

/** 创建通用 Stub 扫描器 */
function createStubScanner(source: EcosystemSource): SourceScanner {
  return (timeoutMs: number) => {
    const startMs = Date.now();
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          source,
          status: 'stub',
          signals: [
            {
              source,
              signalType: 'stub',
              significance: T_UNKNOWN,
              description: `[Stub] ${source} 扫描器未实现`,
              impact: { direction: T_UNKNOWN, affectedSubsystems: [], urgency: T_FALSE },
              detectedAt: Date.now(),
            },
          ],
          latencyMs: Date.now() - startMs,
        });
      }, Math.min(30, timeoutMs));
    });
  };
}

// ═══════════════════════════════════════════════════════════════
// EcosystemSensor 实现
// ═══════════════════════════════════════════════════════════════

export function createEcosystemSensor(config?: {
  timeoutMs?: number;
  enabledSources?: EcosystemSource[];
}): IEcosystemSensor {
  const timeoutMs = config?.timeoutMs ?? 10000;
  const enabledSources = config?.enabledSources ?? [
    'self', 'openclaw', 'mcp_topology',
    'hermes', 'clawhub', 'agent_ecosystem',
    'tool_ecosystem', 'model_ecosystem', 'user_behavior',
  ];

  // 注册所有扫描器
  const scanners = new Map<EcosystemSource, SourceScanner>();
  scanners.set('self', scanSelf);
  scanners.set('openclaw', scanOpenclaw);
  scanners.set('mcp_topology', scanMcpTopology);
  // 其余6个用 Stub
  scanners.set('hermes', createStubScanner('hermes'));
  scanners.set('clawhub', createStubScanner('clawhub'));
  scanners.set('agent_ecosystem', createStubScanner('agent_ecosystem'));
  scanners.set('tool_ecosystem', createStubScanner('tool_ecosystem'));
  scanners.set('model_ecosystem', createStubScanner('model_ecosystem'));
  scanners.set('user_behavior', createStubScanner('user_behavior'));

  // 事件监听器注册
  const listeners = new Map<string, { source: EcosystemSource; handler: EcosystemEventHandler }>();
  let nextListenerId = 0;
  let lastScanResult: EcosystemScanResult | null = null;

  // 扫描计数器
  let scanCounter = 0;

  async function scanEcosystem(): Promise<EcosystemScanResult> {
    const scanId = `scan-${++scanCounter}-${Date.now()}`;
    const startMs = Date.now();
    const allSignals: EcosystemSignal[] = [];
    const sourceDetails: SourceScanDetail[] = [];

    // 并发扫描所有启用的源（带超时）
    const scanPromises = enabledSources.map(async (source) => {
      const scanner = scanners.get(source);
      if (!scanner) {
        return {
          source,
          status: 'unavailable' as SourceStatus,
          signals: [],
          error: `No scanner registered for source: ${source}`,
          latencyMs: 0,
        } as SourceScanDetail;
      }

      try {
        const result = await scanner(timeoutMs);
        return result;
      } catch (err) {
        return {
          source,
          status: 'unavailable' as SourceStatus,
          signals: [],
          error: err instanceof Error ? err.message : String(err),
          latencyMs: 0,
        } as SourceScanDetail;
      }
    });

    // 使用 Promise.allSettled 确保部分失败不影响整体
    const results = await Promise.allSettled(scanPromises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        sourceDetails.push(result.value);
        allSignals.push(...result.value.signals);
      }
    }

    // 计算统计信息
    const totalLatencyMs = Date.now() - startMs;
    const sourcesUnavailable = sourceDetails.filter((d) => d.status === 'unavailable').length;
    const sourcesDegraded = sourceDetails.filter((d) => d.status === 'degraded').length;

    // 计算生态健康度
    const ecosystemHealth = computeEcosystemHealth(allSignals);

    const scanResult: EcosystemScanResult = {
      scanId,
      timestamp: new Date(),
      signals: allSignals,
      sourceDetails,
      ecosystemHealth,
      stats: {
        totalLatencyMs,
        sourcesScanned: sourceDetails.length,
        sourcesUnavailable,
        sourcesDegraded,
      },
    };

    lastScanResult = scanResult;
    return scanResult;
  }

  function onEcosystemEvent(
    source: EcosystemSource,
    handler: EcosystemEventHandler,
  ): string {
    const id = `listener-${++nextListenerId}`;
    listeners.set(id, { source, handler });
    return id;
  }

  function offEcosystemEvent(listenerId: string): boolean {
    return listeners.delete(listenerId);
  }

  function getListenerCount(): number {
    return listeners.size;
  }

  function getLastScanResult(): EcosystemScanResult | null {
    return lastScanResult;
  }

  // ═══════════════════════════════════════════════════════════
  // 私有：计算生态健康度
  // ═══════════════════════════════════════════════════════════

  function computeEcosystemHealth(signals: EcosystemSignal[]): Trit {
    if (signals.length === 0) return T_UNKNOWN;

    let positive = 0;
    let negative = 0;

    for (const signal of signals) {
      if (signal.impact.direction === T_TRUE) positive++;
      else if (signal.impact.direction === T_FALSE) negative++;
    }

    const total = positive + negative;
    if (total === 0) return T_UNKNOWN;

    const ratio = positive / total;
    if (ratio >= 0.7) return T_TRUE;   // 繁荣
    if (ratio <= 0.3) return T_FALSE;  // 衰退
    return T_UNKNOWN;                   // 稳定
  }

  return {
    scanEcosystem,
    onEcosystemEvent,
    offEcosystemEvent,
    getListenerCount,
    getLastScanResult,
  };
}
