/**
 * CogMetaSynthesis 类型定义 — 大成智慧学综合集成
 */

import type { Trit } from '@kunlun/ternary';

export interface SynthesisParticipant {
  id: string;
  name: string;
  type: 'pi-agent' | 'llm' | 'tool' | 'human';
}

export interface QualitativeResult {
  participantId: string;
  stance: Trit;
  reasoning: string;
  confidence: number; // 0-1
}

export interface QuantitativeResult {
  proposition: string;
  confidence: number;
  evidenceStrength: number;
  consensusRatio: number;
}

export interface UnifiedConclusion {
  stance: Trit;
  confidence: number;
  supportingIds: string[];
}

export interface SynthesisResult {
  consensus: UnifiedConclusion;
  disagreements: QualitativeResult[];
  overallConfidence: number;
}
