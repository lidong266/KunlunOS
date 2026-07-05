/**
 * 3. 对立统一推导器 (Unity Deriver)
 *
 * 寻找对立面的统一条件。
 * 核心思路：
 *   - 提取正反题的共同基础（共同目标、共享事实）
 *   - 在共同基础上构建统一路径（综合/超越/吸收/转化四种策略）
 *   - 评估每条路径的可行性和代价
 */

import type { Trit } from '@kunlun/ternary';
import type {
  ContradictionPair,
  UnityDerivation,
  UnificationPath,
} from '../types';

export interface UnityDeriver {
  derive(thesisStatement: string, antithesisStatement: string, contradiction: ContradictionPair): UnityDerivation;
}

export function createUnityDeriver(): UnityDeriver {
  return new UnityDeriverImpl();
}

const UNIFICATION_STRATEGIES = [
  'synthesis',
  'transcendence',
  'absorption',
  'transformation',
] as const;

class UnityDeriverImpl implements UnityDeriver {
  derive(
    thesisStatement: string,
    antithesisStatement: string,
    contradiction: ContradictionPair
  ): UnityDerivation {
    // 提取共同基础
    const commonGround = this.extractCommonGround(
      contradiction.thesis,
      contradiction.antithesis
    );

    // 根据共同基础的存在程度确定可统一性
    const commonGroundScore = commonGround.length / Math.max(1, 3);
    let unifiability: Trit;

    if (contradiction.contradictionType === 'antagonistic') {
      unifiability = commonGroundScore > 0.5 ? 0 : -1;
    } else if (commonGroundScore > 0.7) {
      unifiability = 1;
    } else if (commonGroundScore > 0.3) {
      unifiability = 0;
    } else {
      unifiability = -1;
    }

    // 基于矛盾类型限制统一策略
    const availableStrategies = this.getAvailableStrategies(contradiction);

    // 生成统一路径
    const paths: UnificationPath[] = availableStrategies.map(strategy =>
      this.generatePath(strategy, contradiction, commonGround, commonGroundScore)
    );

    // 按可行性排序
    paths.sort((a, b) => {
      const scoreA = this.calculatePathScore(a);
      const scoreB = this.calculatePathScore(b);
      return scoreB - scoreA;
    });

    const bestPathIndex = paths.length > 0 ? 0 : -1;

    return {
      contradictionId: contradiction.id,
      unifiability,
      paths,
      bestPathIndex,
      commonGround,
      confidence: Math.round((0.5 + commonGroundScore * 0.5) * 100) / 100,
    };
  }

  private extractCommonGround(
    thesis: { statement: string; domain: string; evidence: Array<{ content: string; strength: Trit }> },
    antithesis: { statement: string; domain: string; evidence: Array<{ content: string; strength: Trit }> }
  ): string[] {
    const common: string[] = [];

    // 1. 领域相同
    if (thesis.domain === antithesis.domain) {
      common.push(`共享领域：${thesis.domain}`);
    }

    // 2. 证据来源重叠
    const thesisSources = new Set(thesis.evidence.filter(e => e.strength === 1).map(e => e.content));
    const antithesisSources = new Set(antithesis.evidence.filter(e => e.strength === 1).map(e => e.content));
    const sourceOverlap = [...thesisSources].filter(s => antithesisSources.has(s));

    if (sourceOverlap.length > 0) {
      common.push(`共享事实基础：${sourceOverlap.slice(0, 3).join('；')}`);
    }

    // 3. 关键词重叠
    const thesisWords = new Set(thesis.statement.split(/[\s,，。；、]+/).filter(w => w.length >= 2));
    const antithesisWords = new Set(antithesis.statement.split(/[\s,，。；、]+/).filter(w => w.length >= 2));
    const wordOverlap = [...thesisWords].filter(w => antithesisWords.has(w));

    if (wordOverlap.length >= 3) {
      common.push(`共享语义元素：${wordOverlap.slice(0, 5).join('、')}`);
    }

    // 4. 陈述共有的意图（简单启发式）
    if (thesis.statement.length > 10 && antithesis.statement.length > 10) {
      common.push('双方均为对同一议题的回应');
    }

    return common;
  }

  private getAvailableStrategies(contradiction: ContradictionPair): typeof UNIFICATION_STRATEGIES[number][] {
    const strategies: typeof UNIFICATION_STRATEGIES[number][] = [];

    if (contradiction.contradictionType === 'antagonistic') {
      strategies.push('transcendence', 'transformation');
    } else if (contradiction.contradictionType === 'quantitative') {
      strategies.push('transformation', 'synthesis');
    } else {
      strategies.push('synthesis', 'transcendence', 'absorption', 'transformation');
    }

    return strategies;
  }

  private generatePath(
    strategy: typeof UNIFICATION_STRATEGIES[number],
    contradiction: ContradictionPair,
    commonGround: string[],
    commonGroundScore: number
  ): UnificationPath {
    switch (strategy) {
      case 'synthesis':
        return {
          description: `综合统一：将正题"${this.truncate(contradiction.thesis.statement)}"与反题"${this.truncate(contradiction.antithesis.statement)}"的合理成分融合为更高层次的命题`,
          type: 'synthesis',
          feasibility: commonGroundScore > 0.5 ? 1 : commonGroundScore > 0.2 ? 0 : -1,
          preconditions: [
            '双方均包含部分真理',
            '存在可融合的共同基础',
            '融合后的命题比原有命题更有解释力',
          ],
          estimatedEffort: 0.6,
          expectedOutcome: '产生比正反题更全面的新命题，同时保留两者的合理成分',
          risks: [
            '融合可能仅是表面妥协而非真正统一',
            '可能丢失双方的关键差异信息',
          ],
        };

      case 'transcendence':
        return {
          description: `超越统一：将"${this.truncate(contradiction.thesis.statement)}"与"${this.truncate(contradiction.antithesis.statement)}"的矛盾在更高维度上消解`,
          type: 'transcendence',
          feasibility: commonGroundScore > 0.3 ? 0 : -1,
          preconditions: [
            '需要引入新的视角或框架',
            '当前框架无法容纳矛盾的双方',
            '更高维度的统一框架存在或可构建',
          ],
          estimatedEffort: 0.8,
          expectedOutcome: '通过提升分析维度，使原有矛盾不再是矛盾',
          risks: [
            '新框架可能引入新的矛盾',
            '超越过程可能丢失实践基础',
          ],
        };

      case 'absorption':
        return {
          description: `吸收统一：一方吸收另一方的合理成分，扩展自身`,
          type: 'absorption',
          feasibility: commonGroundScore > 0.4 ? 1 : 0,
          preconditions: [
            '一方明显在力量/解释力上占优',
            '弱势方具有可被吸收的合理成分',
            '吸收过程不改变优势方的核心结构',
          ],
          estimatedEffort: 0.4,
          expectedOutcome: '优势方吸收弱势方的合理元素，形成更完善的命题',
          risks: [
            '可能压制弱势方的合理关切',
            '吸收不彻底留下未解决矛盾',
          ],
        };

      case 'transformation':
        return {
          description: `转化统一：矛盾双方在特定条件下向新的形态转化`,
          type: 'transformation',
          feasibility: commonGroundScore > 0.3 ? 0 : -1,
          preconditions: [
            '矛盾本身包含自我否定的因素',
            '存在促使转化的外部/内部条件',
            '转化后的新形态能够消解原有矛盾',
          ],
          estimatedEffort: 0.7,
          expectedOutcome: '原有矛盾在转化过程中被新的矛盾关系替代，旧矛盾消解',
          risks: [
            '转化方向不可控',
            '可能产生更尖锐的新矛盾',
          ],
        };
    }
  }

  private calculatePathScore(path: UnificationPath): number {
    const feasibilityScore = (path.feasibility + 1) / 2; // -1→0, 0→0.5, 1→1
    const effortPenalty = path.estimatedEffort * 0.3;
    const riskCount = path.risks.length * 0.1;
    return feasibilityScore - effortPenalty - riskCount;
  }

  private truncate(text: string, maxLen: number = 30): string {
    return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
  }
}
