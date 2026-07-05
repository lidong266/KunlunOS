/**
 * 三元判定 Prompt 模板系统
 *
 * 为 LLM 提供结构化的 Prompt，使其能输出符合三元逻辑格式的结构化判定。
 *
 * 五个内置模板：
 *   1. standard-dilemma  -- 通用二元对立判定
 *   2. practice-feedback -- 实践反馈判定
 *   3. phase-transition   -- 阶段转换评估
 *   4. contradiction-audit -- 矛盾审计
 *   5. moral-ethical      -- 道德伦理三元判定
 *
 * 核心功能：
 *   - 模板管理（注册、查询、删除）
 *   - 变量替换（{{variable}} → 实际值）
 *   - 响应解析（LLM 自然语言输出 → TernaryJudgmentResult）
 */

import type { Trit } from '@kunlun/ternary';
import type {
  TernaryPromptTemplate,
  PromptTemplateVariables,
  TernaryJudgmentResult,
  ContradictionType,
} from './types';

// ═══════════════════════════════════════════════════════════════
// 内置模板
// ═══════════════════════════════════════════════════════════════

const BUILTIN_TEMPLATES: TernaryPromptTemplate[] = [
  // ─── 模板 1：通用二元对立判定 ───
  {
    name: 'standard-dilemma',
    version: '2.0.0',
    description: '通用二元对立矛盾的三元判定',
    recommendedDepth: 'standard',
    systemPrompt: `
你是一个基于唯物辩证法的矛盾分析助手。你的任务是分析给定的对立命题对，并做出三元判定。

**三元判定规则**：
- **+1（可统一/可调和）**：正反题存在共同基础，可以通过综合、超越、吸收或转化实现统一
- **0（条件性可统一/待定）**：正反题在特定条件下可以统一，但缺少某些关键信息或条件
- **-1（不可调和/对抗性）**：正反题存在根本性冲突，在现有框架下无法统一

**判定维度**：
1. 事实基础：双方是否承认共同的事实依据
2. 逻辑自洽：各自的论证逻辑是否内在一贯
3. 统一可能：是否存在第三选择（非 A 非 B、既 A 又 B）
4. 时间维度：问题是否随时间而变化，是否处于量变→质变的过程
`.trim(),
    userPromptTemplate: `
## 矛盾对分析

**领域**：{{domain}}
**矛盾类型**：{{contradictionType}}
**分析深度**：{{depth}}

### 正题
{{thesisStatement}}

### 反题
{{antithesisStatement}}

{{#additionalContext}}
### 额外上下文
{{additionalContext}}
{{/additionalContext}}

---

请基于唯物辩证法的视角，给出以下三元判定：

1. **综合判定**（+1 / 0 / -1）：
2. **判定理由**（300 字以内）：
3. **主要矛盾的方面**（+1=正题主导, 0=均势, -1=反题主导）：
4. **统一路径建议**（列出 1-3 条可行路径）：
5. **质变风险评估**（high / medium / low / none）：
6. **行动建议**（列出 1-5 条具体可执行建议）：
7. **信息缺口**（列出需要进一步调查的领域）：
8. **置信度**（0.0 ~ 1.0）：
`.trim(),
    outputFormatHint: '请严格按照上述 8 个标注序号输出，每项一行。置信度使用数值。',
  },

  // ─── 模板 2：实践反馈判定 ───
  {
    name: 'practice-feedback',
    version: '2.0.0',
    description: '对实践反馈进行三元判定——评估反馈是否验证了原有认识',
    recommendedDepth: 'quick',
    systemPrompt: `
你是一个实践论视角的分析助手。你的任务是评估实践反馈对原有认识的验证程度。

**三元判定规则**：
- **+1（验证）**：实践反馈证实了原有认识
- **0（部分验证/需要修正）**：实践反馈部分证实但也暴露了原有认识的不足
- **-1（证伪）**：实践反馈与原有认识相矛盾

**实践—认识循环**：
实践 → 认识 → 再实践 → 再认识，循环往复以至无穷。
`.trim(),
    userPromptTemplate: `
## 实践反馈判定

**原有认识**：
{{thesisStatement}}

**实践反馈**：
{{antithesisStatement}}

**领域**：{{domain}}

{{#additionalContext}}
### 额外上下文
{{additionalContext}}
{{/additionalContext}}

---

请判定实践反馈对原有认识的验证程度：

1. **综合判定**（+1=验证, 0=部分验证, -1=证伪）：
2. **判定理由**（200 字以内）：
3. **需要修正的内容**：
4. **可以保留的内容**：
5. **置信度**（0.0 ~ 1.0）：
`.trim(),
    outputFormatHint: '简洁为主，重点在判定理由和修正建议。',
  },

  // ─── 模板 3：阶段转换评估 ───
  {
    name: 'phase-transition',
    version: '2.0.0',
    description: '评估矛盾是否进入新的发展阶段',
    recommendedDepth: 'standard',
    systemPrompt: `
你是一个发展论视角的分析助手。矛盾的发展遵循"肯定 → 否定 → 否定之否定（螺旋上升）"的规律。

**三元判定规则**：
- **+1（否定之否定/螺旋上升）**：矛盾已超越简单对立，进入更高形式
- **0（第一次否定/过渡阶段）**：矛盾处于否定阶段，正在探索新的形式
- **-1（肯定阶段/原状态）**：矛盾仍处于原始状态，尚未发生实质变化
`.trim(),
    userPromptTemplate: `
## 阶段转换评估

**当前正题**：{{thesisStatement}}
**当前反题**：{{antithesisStatement}}
**矛盾类型**：{{contradictionType}}
**领域**：{{domain}}

{{#previousAnalysis}}
### 历史分析
{{previousAnalysis}}
{{/previousAnalysis}}

---

请评估矛盾所处的否定阶段：

1. **阶段判定**（+1=螺旋上升, 0=第一次否定, -1=原状态）：
2. **判定理由**（200 字以内）：
3. **是否真正的螺旋上升**（是/否）：
4. **涌现的新质**（列出 1-3 个新属性）：
5. **被保留的旧质**（列出 1-3 个）：
6. **置信度**（0.0 ~ 1.0）：
`.trim(),
    outputFormatHint: '重点判断是否在否定中实现了螺旋上升而非简单循环。',
  },

  // ─── 模板 4：矛盾审计 ───
  {
    name: 'contradiction-audit',
    version: '2.0.0',
    description: '对一组矛盾进行系统性审计——评估其完备性和一致性',
    recommendedDepth: 'deep',
    systemPrompt: `
你是一个严谨的辩证法审计员。你的任务是审查给定的矛盾对，找出逻辑漏洞、证据缺失、以及隐藏的前提假设。

**三元判定规则**：
- **+1（矛盾健康/可推进）**：矛盾对结构健康，可以直接推进分析
- **0（存在瑕疵/需补充）**：矛盾对存在逻辑或证据缺失，需补充后再推进
- **-1（矛盾不成立/伪矛盾）**：矛盾对存在根本性缺陷，无法进行有效分析
`.trim(),
    userPromptTemplate: `
## 矛盾审计

**正题**：{{thesisStatement}}
**反题**：{{antithesisStatement}}
**声明的矛盾类型**：{{contradictionType}}
**领域**：{{domain}}

{{#additionalContext}}
### 额外上下文
{{additionalContext}}
{{/additionalContext}}

---

请审计此矛盾对：

1. **审计结论**（+1=健康, 0=有瑕疵, -1=不成立）：
2. **逻辑漏洞**（逐一列出）：
3. **证据缺失**（列出哪些关键证据缺失）：
4. **隐藏前提**（指出未明说的假设）：
5. **矛盾类型是否准确**（准确/不准确，如果不准确应是什么）：
6. **是否伪矛盾**（是/否）：
7. **置信度**（0.0 ~ 1.0）：
`.trim(),
    outputFormatHint: '严谨、具体，每个漏洞和缺失都要给出明确位置和理由。',
  },

  // ─── 模板 5：道德伦理三元判定 ───
  {
    name: 'moral-ethical',
    version: '2.0.0',
    description: '对道德/伦理两难进行三元判定',
    recommendedDepth: 'standard',
    systemPrompt: `
你是一个辩证伦理分析助手。道德两难问题往往不存在完美的解决方案，但可以通过辩证法找到更高层次的解决路径。

**三元判定规则**：
- **+1（伦理统一路径存在）**：可以在更高价值框架下调和两个道德原则
- **0（情境性判定/待定）**：取决于具体情境，没有统一的答案
- **-1（根本性道德冲突）**：两个道德原则在本质上互相排斥
`.trim(),
    userPromptTemplate: `
## 道德伦理判定

**道德原则 A**：{{thesisStatement}}
**道德原则 B**：{{antithesisStatement}}
**领域**：{{domain}}

{{#additionalContext}}
### 具体情境
{{additionalContext}}
{{/additionalContext}}

---

请从辩证伦理视角判定：

1. **综合判定**（+1=可调和, 0=情境性, -1=根本冲突）：
2. **判定理由**（300 字以内）：
3. **更高层级的价值框架**（如果有）：
4. **情境性因素**（哪些因素影响判定）：
5. **置信度**（0.0 ~ 1.0）：
`.trim(),
    outputFormatHint: '注意区分普遍性原则与情境性判断。',
  },
];

// ═══════════════════════════════════════════════════════════════
// Prompt 管理器
// ═══════════════════════════════════════════════════════════════

export interface TernaryPromptManager {
  /** 获取所有已注册的模板 */
  listTemplates(): TernaryPromptTemplate[];

  /** 获取指定模板 */
  getTemplate(name: string): TernaryPromptTemplate | null;

  /** 注册自定义模板 */
  registerTemplate(template: TernaryPromptTemplate): void;

  /** 删除自定义模板 */
  removeTemplate(name: string): boolean;

  /** 构建 Prompt（填充模板变量） */
  buildPrompt(
    templateName: string,
    variables: PromptTemplateVariables
  ): { systemPrompt: string; userPrompt: string } | null;

  /** 解析 LLM 响应为结构化结果 */
  parseResponse(
    rawResponse: string,
    template: TernaryPromptTemplate
  ): TernaryJudgmentResult;

  /** 获取按深度推荐的模板 */
  recommendForDepth(depth: 'quick' | 'standard' | 'deep'): TernaryPromptTemplate[];
}

export function createTernaryPromptManager(): TernaryPromptManager {
  return new TernaryPromptManagerImpl();
}

class TernaryPromptManagerImpl implements TernaryPromptManager {
  private templates: Map<string, TernaryPromptTemplate>;

  constructor() {
    this.templates = new Map();
    for (const tpl of BUILTIN_TEMPLATES) {
      this.templates.set(tpl.name, { ...tpl });
    }
  }

  listTemplates(): TernaryPromptTemplate[] {
    return [...this.templates.values()];
  }

  getTemplate(name: string): TernaryPromptTemplate | null {
    return this.templates.get(name) ?? null;
  }

  registerTemplate(template: TernaryPromptTemplate): void {
    // 不允许覆盖内置模板
    if (BUILTIN_TEMPLATES.some(t => t.name === template.name)) {
      throw new Error(`Cannot override built-in template "${template.name}"`);
    }
    this.templates.set(template.name, { ...template });
  }

  removeTemplate(name: string): boolean {
    if (BUILTIN_TEMPLATES.some(t => t.name === name)) {
      return false; // 不能删除内置模板
    }
    return this.templates.delete(name);
  }

  buildPrompt(
    templateName: string,
    variables: PromptTemplateVariables
  ): { systemPrompt: string; userPrompt: string } | null {
    const template = this.templates.get(templateName);
    if (!template) return null;

    const userPrompt = this.fillTemplate(template.userPromptTemplate, variables);

    return {
      systemPrompt: template.systemPrompt,
      userPrompt,
    };
  }

  parseResponse(
    rawResponse: string,
    template: TernaryPromptTemplate
  ): TernaryJudgmentResult {
    return parseTernaryResponse(rawResponse, template);
  }

  recommendForDepth(depth: 'quick' | 'standard' | 'deep'): TernaryPromptTemplate[] {
    return this.listTemplates().filter(t => t.recommendedDepth === depth);
  }

  /**
   * 模板变量填充
   *
   * 支持：
   *   - {{variable}} 简单替换
   *   - {{#variable}}...{{/variable}} 条件块（变量存在则保留内容）
   *   - 不支持嵌套条件块
   */
  private fillTemplate(
    template: string,
    variables: PromptTemplateVariables
  ): string {
    let result = template;

    // 1. 处理条件块 {{#var}}...{{/var}}
    result = result.replace(
      /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
      (_match, varName: string, content: string) => {
        const key = varName as keyof PromptTemplateVariables;
        const value = variables[key];
        // 如果变量存在且非空，保留内容；否则删除
        if (value !== undefined && value !== null && value !== '') {
          // 递归填充内部变量
          return this.fillSimpleVariables(content, variables);
        }
        return '';
      }
    );

    // 2. 填充简单变量 {{var}}
    result = this.fillSimpleVariables(result, variables);

    return result;
  }

  private fillSimpleVariables(
    template: string,
    variables: PromptTemplateVariables
  ): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
      const key = varName as keyof PromptTemplateVariables;
      const value = variables[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
      return `{{${varName}}}`; // 未找到的变量保留原样
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 响应解析器
// ═══════════════════════════════════════════════════════════════

/**
 * 解析 LLM 响应为结构化三元判定结果
 *
 * 支持多种格式：
 *   - 中文标记格式（综合判定：+1）
 *   - 结构化格式（1. +1）
 *   - 自由格式（通过关键词提取）
 */
function parseTernaryResponse(
  rawResponse: string,
  template: TernaryPromptTemplate
): TernaryJudgmentResult {
  const text = rawResponse.trim();

  // 提取综合判定
  const verdict = extractVerdict(text);

  // 提取置信度
  const confidence = extractConfidence(text);

  // 提取主导方面
  const dominantAspect = extractDominantAspect(text);

  // 提取判定理由
  const reasoning = extractReasoning(text);

  // 提取统一路径建议
  const unificationSuggestions = extractListItems(text, '统一路径建议', 'unification', 3);

  // 提取质变风险
  const qualitativeChangeRisk = extractQualitativeRisk(text);

  // 提取行动建议
  const recommendations = extractListItems(text, '行动建议', 'recommendation', 5);

  // 提取信息缺口
  const informationGaps = extractListItems(text, '信息缺口', 'information gap', 5);

  return {
    verdict,
    reasoning,
    confidence,
    dominantAspect,
    unificationSuggestions,
    qualitativeChangeRisk,
    recommendations,
    informationGaps,
    rawResponse,
  };
}

// ─── 提取辅助函数 ───

function extractVerdict(text: string): Trit {
  // 尝试匹配 "综合判定：+1" 或 "判定：0" 或 "结论：-1"
  const patterns = [
    /综合判定[：:]\s*([+\-]?[10])/i,
    /判定[：:]\s*([+\-]?[10])/i,
    /结论[：:]\s*([+\-]?[10])/i,
    /verdict[：:]\s*([+\-]?[10])/i,
    /阶段判定[：:]\s*([+\-]?[10])/i,  // 阶段转换模板
    /审计结论[：:]\s*([+\-]?[10])/i,  // 矛盾审计模板
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseTrit(match[1]);
    }
  }

  // 兜底：关键词提取
  if (/可统一/.test(text) || /螺旋上升/.test(text) || /验证/.test(text)) return 1;
  if (/不可调和/.test(text) || /根本.*冲突/.test(text) || /证伪/.test(text)) return -1;
  return 0;
}

function extractConfidence(text: string): number {
  const patterns = [
    /置信度[：:]\s*([\d.]+)/,
    /confidence[：:]\s*([\d.]+)/i,
    /置信度.*?([\d.]+)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseFloat(match[1]);
      return Math.round(Math.min(1, Math.max(0, val)) * 100) / 100;
    }
  }

  return 0.5; // 默认置信度
}

function extractDominantAspect(text: string): Trit {
  const patterns = [
    /主要矛盾的方面[：:]\s*([+\-]?[10])/,
    /dominant[_\s]?aspect[：:]\s*([+\-]?[10])/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseTrit(match[1]);
    }
  }

  // 兜底
  if (/正题.*主导/.test(text)) return 1;
  if (/反题.*主导/.test(text)) return -1;
  return 0;
}

function extractReasoning(text: string): string {
  const patterns = [
    /判定理由[：:]\s*([\s\S]*?)(?=\n\s*\d+[.、]|\n\s*置信度|$)/,
    /理由[：:]\s*([\s\S]*?)(?=\n\s*\d+[.、]|\n\s*置信度|$)/,
    /reasoning[：:]\s*([\s\S]*?)(?=\n\s*\d+[.、]|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().slice(0, 500);
    }
  }

  return '无法从响应中提取判定理由';
}

/**
 * 提取列表项（如 "统一路径建议：1. xxx 2. yyy"）
 */
function extractListItems(
  text: string,
  chineseLabel: string,
  _englishLabel: string,
  maxItems: number
): string[] {
  // 查找标签后的内容
  const labelPatterns = [
    new RegExp(`${chineseLabel}[：:]\\s*([\\s\\S]*?)(?=\\n\\s*\\d+[.、]\\s*置信度|\\n\\s*置信度|\\n\\s*信息缺口|$)`, 'i'),
    new RegExp(`${chineseLabel}[：:]\\s*([\\s\\S]*?)(?=\\n\\n|$)`, 'i'),
  ];

  for (const pattern of labelPatterns) {
    const match = text.match(pattern);
    if (match) {
      // 提取编号列表项
      const items = match[1]
        .split(/\n\s*(?:\d+[.、)]\s*|[-•*]\s*)/)
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .slice(0, maxItems);

      if (items.length > 0) return items;
    }
  }

  return [];
}

function extractQualitativeRisk(text: string): 'high' | 'medium' | 'low' | 'none' {
  const match = text.match(/质变风险(?:评估)?[：:]\s*(high|medium|low|none|高|中|低|无)/i);
  if (match) {
    const risk = match[1].toLowerCase();
    if (risk === '高' || risk === 'high') return 'high';
    if (risk === '中' || risk === 'medium') return 'medium';
    if (risk === '低' || risk === 'low') return 'low';
    return 'none';
  }

  // 兜底
  if (/高风险|高概率/.test(text)) return 'high';
  if (/中风险/.test(text)) return 'medium';
  if (/低风险/.test(text)) return 'low';
  return 'none';
}

function parseTrit(raw: string): Trit {
  const trimmed = raw.trim();
  if (trimmed === '+1' || trimmed === '1') return 1;
  if (trimmed === '-1') return -1;
  return 0;
}
