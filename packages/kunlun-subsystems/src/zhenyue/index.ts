/**
 * 镇岳 Zhenyue (S11) — 三进制安全判断
 * V2 职责: 四层风控管线三元化，多数表决
 *
 * 关键变化:
 *  - 风控判定: +1=允许, 0=审查, -1=禁止
 *  - 四层管线输出 Trit
 *  - 最终决策: MAJORITY 表决
 *  - TernaryRiskHeatmap: 三色风险热力图
 */

import { Trit, T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';

export enum PipelineLayer {
  AUTH = 'auth',
  AUDIT = 'audit',
  FILTER = 'filter',
  BLOCK = 'block',
}

export interface LayerResult {
  layer: PipelineLayer;
  decision: Trit;
  reason: string;
  riskScore: number;
  metadata?: Record<string, string>;
}

export interface RiskEntry {
  id: string;
  action: string;
  actor: string;
  context: Record<string, string>;
  layerResults: LayerResult[];
  finalDecision: Trit;
  timestamp: number;
}

export interface PipelineConfig {
  layers: Record<PipelineLayer, boolean>;
  reviewThreshold: number;
  blockThreshold: number;
}

const DEFAULT_PIPELINE_CONFIG: PipelineConfig = {
  layers: {
    [PipelineLayer.AUTH]: true,
    [PipelineLayer.AUDIT]: true,
    [PipelineLayer.FILTER]: true,
    [PipelineLayer.BLOCK]: true,
  },
  reviewThreshold: 0.5,
  blockThreshold: 0.8,
};

/**
 * TernarySecurityPipeline — 四层三元安全管线
 */
export class TernarySecurityPipeline {
  private config: PipelineConfig;
  private history: RiskEntry[] = [];
  private entryCounter = 0;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_PIPELINE_CONFIG, ...config };
  }

  evaluate(action: string, actor: string, context: Record<string, string> = {}): RiskEntry {
    const layerResults: LayerResult[] = [];

    if (this.config.layers[PipelineLayer.AUTH]) {
      layerResults.push(this.evaluateAuth(actor, context));
    }
    if (this.config.layers[PipelineLayer.AUDIT]) {
      layerResults.push(this.evaluateAudit(action, actor, context));
    }
    if (this.config.layers[PipelineLayer.FILTER]) {
      layerResults.push(this.evaluateFilter(action, context));
    }
    if (this.config.layers[PipelineLayer.BLOCK]) {
      layerResults.push(this.evaluateBlock(action, context));
    }

    const finalDecision = this.majorityVote(layerResults.map(r => r.decision));

    const entry: RiskEntry = {
      id: `risk-${++this.entryCounter}`,
      action, actor, context, layerResults, finalDecision,
      timestamp: Date.now(),
    };

    this.history.push(entry);
    return entry;
  }

  private evaluateAuth(actor: string, _context: Record<string, string>): LayerResult {
    if (!actor || actor === 'unknown') {
      return { layer: PipelineLayer.AUTH, decision: T_FALSE, reason: 'Unknown actor', riskScore: 0.9 };
    }
    if (actor === 'system' || actor === 'root') {
      return { layer: PipelineLayer.AUTH, decision: T_TRUE, reason: 'Trusted system actor', riskScore: 0.1 };
    }
    return { layer: PipelineLayer.AUTH, decision: T_UNKNOWN, reason: 'Actor requires audit', riskScore: 0.4 };
  }

  private evaluateAudit(action: string, actor: string, context: Record<string, string>): LayerResult {
    const riskyActions = ['delete', 'drop', 'rm', 'exec', 'sudo', 'admin', 'root'];
    const isRisky = riskyActions.some(a => action.toLowerCase().includes(a));
    if (isRisky) {
      return { layer: PipelineLayer.AUDIT, decision: T_FALSE, reason: `Risky action: ${action}`, riskScore: 0.85 };
    }
    return { layer: PipelineLayer.AUDIT, decision: T_UNKNOWN, reason: 'Standard audit check', riskScore: 0.3 };
  }

  private evaluateFilter(action: string, context: Record<string, string>): LayerResult {
    const forbiddenPatterns = ['DROP TABLE', '<script>', 'eval(', 'rm -rf', 'format c:'];
    const hasForbidden = forbiddenPatterns.some(p => action.toLowerCase().includes(p.toLowerCase()));
    if (hasForbidden) {
      return { layer: PipelineLayer.FILTER, decision: T_FALSE, reason: 'Forbidden pattern detected', riskScore: 0.95 };
    }
    return { layer: PipelineLayer.FILTER, decision: T_TRUE, reason: 'No forbidden patterns', riskScore: 0.1 };
  }

  private evaluateBlock(action: string, _context: Record<string, string>): LayerResult {
    if (action.includes('DROP') || action.includes('EXEC')) {
      return { layer: PipelineLayer.BLOCK, decision: T_FALSE, reason: 'Blocked by final layer', riskScore: 1.0 };
    }
    return { layer: PipelineLayer.BLOCK, decision: T_TRUE, reason: 'Passes final block check', riskScore: 0.05 };
  }

  private majorityVote(decisions: Trit[]): Trit {
    if (decisions.length === 0) return T_UNKNOWN;
    const counts = { [T_TRUE]: 0, [T_UNKNOWN]: 0, [T_FALSE]: 0 };
    for (const d of decisions) counts[d]++;
    if (counts[T_TRUE] > counts[T_UNKNOWN] && counts[T_TRUE] > counts[T_FALSE]) return T_TRUE;
    if (counts[T_FALSE] > counts[T_UNKNOWN] && counts[T_FALSE] > counts[T_TRUE]) return T_FALSE;
    return T_UNKNOWN;
  }

  getHistory(): RiskEntry[] {
    return [...this.history];
  }

  getStats() {
    const all = this.history;
    return {
      total: all.length,
      allowed: all.filter(e => e.finalDecision === T_TRUE).length,
      reviewNeeded: all.filter(e => e.finalDecision === T_UNKNOWN).length,
      blocked: all.filter(e => e.finalDecision === T_FALSE).length,
    };
  }

  reset(): void {
    this.history = [];
    this.entryCounter = 0;
  }
}

/**
 * TernaryRiskHeatmap — 三色风险热力图
 */
export interface HeatmapCell {
  action: string;
  riskScore: number;
  trit: Trit;
  color: string;
}

export class TernaryRiskHeatmap {
  private pipeline: TernarySecurityPipeline;

  constructor(pipeline: TernarySecurityPipeline) {
    this.pipeline = pipeline;
  }

  generate(): HeatmapCell[] {
    const history = this.pipeline.getHistory();
    return history.map(entry => {
      const avgRisk = entry.layerResults.reduce((s, r) => s + r.riskScore, 0) / entry.layerResults.length;
      return {
        action: entry.action,
        riskScore: avgRisk,
        trit: entry.finalDecision,
        color: entry.finalDecision === T_TRUE ? '#4CAF50'
          : entry.finalDecision === T_FALSE ? '#F44336'
          : '#FF9800',
      };
    });
  }

  getSummary(): { green: number; yellow: number; red: number } {
    const cells = this.generate();
    return {
      green: cells.filter(c => c.trit === T_TRUE).length,
      yellow: cells.filter(c => c.trit === T_UNKNOWN).length,
      red: cells.filter(c => c.trit === T_FALSE).length,
    };
  }
}
