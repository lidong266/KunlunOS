/**
 * 太一 Taiyi (S7) — 矛盾分析执行器
 * V2 职责: 接收矛盾引擎输出，执行具体分析计算
 *
 * 关键变化:
 *  - 辩论引擎: thesis vs antithesis 格式
 *  - 十一桥路由: 根据矛盾所在学科领域路由
 *  - Python 桥接: 调用矛盾分析算法
 */

import {
  Trit, T_TRUE, T_UNKNOWN, T_FALSE,
} from '@kunlun/ternary';
import type { ContradictionPair } from '../types.js';

// ═══════════════════════════════════════════════════════════
// 十一桥学科领域路由
// ═══════════════════════════════════════════════════════════

export enum BridgeDomain {
  PHILOSOPHY = 'philosophy',
  MATHEMATICS = 'mathematics',
  PHYSICS = 'physics',
  BIOLOGY = 'biology',
  SOCIOLOGY = 'sociology',
  ECONOMICS = 'economics',
  PSYCHOLOGY = 'psychology',
  COMPUTER_SCIENCE = 'computer_science',
  LINGUISTICS = 'linguistics',
  HISTORY = 'history',
  ART = 'art',
  GENERAL = 'general',
}

// ═══════════════════════════════════════════════════════════
// DebateRound — 辩论回合
// ═══════════════════════════════════════════════════════════

export interface DebateRound {
  /** 正题论述 */
  thesisArgument: string;
  /** 反题论述 */
  antithesisArgument: string;
  /** 正题得分 (Trit) */
  thesisScore: Trit;
  /** 反题得分 (Trit) */
  antithesisScore: Trit;
  /** 本轮结论 */
  roundConclusion: string;
  /** 回合编号 */
  roundNumber: number;
}

// ═══════════════════════════════════════════════════════════
// DebateResult — 辩论结果
// ═══════════════════════════════════════════════════════════

export interface DebateResult {
  /** 矛盾对 */
  contradiction: ContradictionPair;
  /** 所属学科领域 */
  domain: BridgeDomain;
  /** 辩论回合 */
  rounds: DebateRound[];
  /** 最终裁决: T_TRUE=thesis胜, T_FALSE=antithesis胜, T_UNKNOWN=不可调和 */
  verdict: Trit;
  /** 综合理由 */
  synthesis: string;
  /** 信度 */
  confidence: number;
}

// ═══════════════════════════════════════════════════════════
// AnalysisTask — 分析任务
// ═══════════════════════════════════════════════════════════

export interface AnalysisTask {
  id: string;
  contradiction: ContradictionPair;
  domain: BridgeDomain;
  priority: number;
  createdAt: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

// ═══════════════════════════════════════════════════════════
// DomainRouter — 十一桥路由
// ═══════════════════════════════════════════════════════════

const DOMAIN_KEYWORDS: Record<BridgeDomain, string[]> = {
  [BridgeDomain.PHILOSOPHY]: ['存在', '本质', '真理', '道德', '意识', 'being', 'truth', 'ethics', 'consciousness'],
  [BridgeDomain.MATHEMATICS]: ['数', '证明', '定理', '公理', 'math', 'proof', 'theorem', 'axiom'],
  [BridgeDomain.PHYSICS]: ['力', '能量', '量子', '相对论', 'physics', 'energy', 'quantum', 'relativity'],
  [BridgeDomain.BIOLOGY]: ['基因', '进化', '细胞', 'DNA', 'biology', 'gene', 'evolution', 'cell'],
  [BridgeDomain.SOCIOLOGY]: ['社会', '阶级', '制度', '文化', 'society', 'class', 'culture', 'institution'],
  [BridgeDomain.ECONOMICS]: ['市场', '资本', '价格', '货币', 'economy', 'market', 'capital', 'price'],
  [BridgeDomain.PSYCHOLOGY]: ['心理', '情绪', '认知', '行为', 'psychology', 'emotion', 'cognition', 'behavior'],
  [BridgeDomain.COMPUTER_SCIENCE]: ['算法', '程序', 'AI', '数据', 'algorithm', 'code', 'data', 'compute'],
  [BridgeDomain.LINGUISTICS]: ['语言', '语义', '语法', 'language', 'semantic', 'grammar', 'syntax'],
  [BridgeDomain.HISTORY]: ['历史', '朝代', '战争', '革命', 'history', 'dynasty', 'war', 'revolution'],
  [BridgeDomain.ART]: ['艺术', '美学', '创作', 'art', 'aesthetic', 'create', 'beauty'],
  [BridgeDomain.GENERAL]: [],
};

export class DomainRouter {
  /**
   * 根据矛盾对内容路由到对应学科领域
   */
  route(text: string): BridgeDomain {
    const lower = text.toLowerCase();
    let bestDomain = BridgeDomain.GENERAL;
    let bestScore = 0;

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      let score = 0;
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) {
          score += kw.length; // 长关键词权重更高
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestDomain = domain as BridgeDomain;
      }
    }

    return bestDomain;
  }

  /**
   * 获取领域的所有关键词
   */
  getKeywords(domain: BridgeDomain): string[] {
    return DOMAIN_KEYWORDS[domain] || [];
  }
}

// ═══════════════════════════════════════════════════════════
// DebateEngine — 辩论引擎
// ═══════════════════════════════════════════════════════════

export interface DebateConfig {
  /** 最大辩论轮次 */
  maxRounds: number;
  /** 默认学科领域 */
  defaultDomain: BridgeDomain;
}

const DEFAULT_DEBATE_CONFIG: DebateConfig = {
  maxRounds: 3,
  defaultDomain: BridgeDomain.GENERAL,
};

export class DebateEngine {
  private config: DebateConfig;
  private router: DomainRouter;
  private debateHistory: DebateResult[] = [];

  constructor(config: Partial<DebateConfig> = {}) {
    this.config = { ...DEFAULT_DEBATE_CONFIG, ...config };
    this.router = new DomainRouter();
  }

  /**
   * 执行 thesis vs antithesis 辩论
   */
  debate(
    contradiction: ContradictionPair,
    domain?: BridgeDomain,
  ): DebateResult {
    const resolvedDomain = domain || this.router.route(
      `${contradiction.thesis} ${contradiction.antithesis}`,
    );

    const rounds: DebateRound[] = [];
    let thesisScore = 0;
    let antithesisScore = 0;

    for (let i = 0; i < this.config.maxRounds; i++) {
      const round = this.executeRound(contradiction, i, resolvedDomain);
      rounds.push(round);
      thesisScore += round.thesisScore;
      antithesisScore += round.antithesisScore;
    }

    let verdict: Trit;
    let synthesis: string;

    if (thesisScore > antithesisScore) {
      verdict = T_TRUE;
      synthesis = `Thesis "${contradiction.thesis}" prevails after ${this.config.maxRounds} rounds`;
    } else if (antithesisScore > thesisScore) {
      verdict = T_FALSE;
      synthesis = `Antithesis "${contradiction.antithesis}" prevails after ${this.config.maxRounds} rounds`;
    } else {
      verdict = T_UNKNOWN;
      synthesis = `Deadlock: thesis and antithesis are equally matched`;
    }

    const result: DebateResult = {
      contradiction,
      domain: resolvedDomain,
      rounds,
      verdict,
      synthesis,
      confidence: Math.abs(thesisScore - antithesisScore) / this.config.maxRounds,
    };

    this.debateHistory.push(result);
    return result;
  }

  /**
   * 执行单轮辩论
   */
  private executeRound(
    contradiction: ContradictionPair,
    roundNumber: number,
    domain: BridgeDomain,
  ): DebateRound {
    // 基于领域关键词计算正反方论点强度
    const keywords = this.router.getKeywords(domain);

    const thesisRelevance = keywords.filter(
      kw => contradiction.thesis.toLowerCase().includes(kw.toLowerCase()),
    ).length;

    const antithesisRelevance = keywords.filter(
      kw => contradiction.antithesis.toLowerCase().includes(kw.toLowerCase()),
    ).length;

    const thesisScore: Trit = thesisRelevance > antithesisRelevance ? T_TRUE
      : thesisRelevance < antithesisRelevance ? T_FALSE
      : T_UNKNOWN;

    const antithesisScore: Trit = antithesisRelevance > thesisRelevance ? T_TRUE
      : antithesisRelevance < thesisRelevance ? T_FALSE
      : T_UNKNOWN;

    return {
      thesisArgument: `Round ${roundNumber + 1}: ${contradiction.thesis}`,
      antithesisArgument: `Round ${roundNumber + 1}: ${contradiction.antithesis}`,
      thesisScore,
      antithesisScore,
      roundConclusion: thesisScore === T_TRUE
        ? 'Thesis has stronger domain alignment'
        : antithesisScore === T_TRUE
        ? 'Antithesis has stronger domain alignment'
        : 'Round is inconclusive',
      roundNumber: roundNumber + 1,
    };
  }

  /**
   * 获取辩论历史
   */
  getDebateHistory(): DebateResult[] {
    return [...this.debateHistory];
  }

  /**
   * 获取历史统计
   */
  getStats(): { total: number; thesisWins: number; antithesisWins: number; deadlocks: number } {
    let thesisWins = 0;
    let antithesisWins = 0;
    let deadlocks = 0;

    for (const result of this.debateHistory) {
      if (result.verdict === T_TRUE) thesisWins++;
      else if (result.verdict === T_FALSE) antithesisWins++;
      else deadlocks++;
    }

    return { total: this.debateHistory.length, thesisWins, antithesisWins, deadlocks };
  }

  /**
   * 获取领域路由器
   */
  getRouter(): DomainRouter {
    return this.router;
  }

  /**
   * 重置
   */
  reset(): void {
    this.debateHistory = [];
  }
}

// ═══════════════════════════════════════════════════════════
// ContradictionExecutor — 矛盾分析执行器
// ═══════════════════════════════════════════════════════════

export interface ExecutionConfig {
  /** 是否启用辩论引擎 */
  enableDebate: boolean;
  /** 辩论配置 */
  debateConfig: Partial<DebateConfig>;
  /** 最大并行任务数 */
  maxParallelTasks: number;
}

const DEFAULT_EXECUTION_CONFIG: ExecutionConfig = {
  enableDebate: true,
  debateConfig: {},
  maxParallelTasks: 4,
};

export class ContradictionExecutor {
  private config: ExecutionConfig;
  private debateEngine: DebateEngine;
  private router: DomainRouter;
  private tasks: Map<string, AnalysisTask> = new Map();
  private taskCounter = 0;

  constructor(config: Partial<ExecutionConfig> = {}) {
    this.config = { ...DEFAULT_EXECUTION_CONFIG, ...config };
    this.debateEngine = new DebateEngine(this.config.debateConfig);
    this.router = new DomainRouter();
  }

  /**
   * 提交分析任务
   */
  submitTask(contradiction: ContradictionPair, priority = 1): AnalysisTask {
    const id = `task-${++this.taskCounter}`;
    const domain = this.router.route(
      `${contradiction.thesis} ${contradiction.antithesis}`,
    );

    const task: AnalysisTask = {
      id,
      contradiction,
      domain,
      priority,
      createdAt: Date.now(),
      status: 'pending',
    };

    this.tasks.set(id, task);
    return task;
  }

  /**
   * 执行分析任务
   */
  executeTask(taskId: string): DebateResult | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    task.status = 'running';

    let result: DebateResult;

    if (this.config.enableDebate) {
      result = this.debateEngine.debate(task.contradiction, task.domain);
    } else {
      // 无辩论模式：直接基于领域关键词判定
      const keywords = this.router.getKeywords(task.domain);
      const thesisMatch = keywords.filter(
        kw => task.contradiction.thesis.toLowerCase().includes(kw.toLowerCase()),
      ).length;
      const antithesisMatch = keywords.filter(
        kw => task.contradiction.antithesis.toLowerCase().includes(kw.toLowerCase()),
      ).length;

      result = {
        contradiction: task.contradiction,
        domain: task.domain,
        rounds: [],
        verdict: thesisMatch > antithesisMatch ? T_TRUE
          : antithesisMatch > thesisMatch ? T_FALSE
          : T_UNKNOWN,
        synthesis: `Direct analysis in domain ${task.domain}`,
        confidence: 0.5,
      };
    }

    task.status = 'completed';
    return result;
  }

  /**
   * 获取任务状态
   */
  getTask(taskId: string): AnalysisTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): AnalysisTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * 获取待处理任务
   */
  getPendingTasks(): AnalysisTask[] {
    return Array.from(this.tasks.values()).filter(t => t.status === 'pending');
  }

  /**
   * 获取执行统计
   */
  getStats(): { total: number; pending: number; running: number; completed: number; failed: number } {
    const tasks = Array.from(this.tasks.values());
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    };
  }

  /**
   * 获取辩论引擎
   */
  getDebateEngine(): DebateEngine {
    return this.debateEngine;
  }

  /**
   * 获取路由器
   */
  getRouter(): DomainRouter {
    return this.router;
  }

  /**
   * 重置
   */
  reset(): void {
    this.tasks.clear();
    this.taskCounter = 0;
    this.debateEngine.reset();
  }
}
