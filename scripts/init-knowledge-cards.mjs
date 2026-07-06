#!/usr/bin/env node
/**
 * 初始化大成智慧学·十一桥三层认知卡体系
 *
 * 每桥分三层：基础学科 → 科学技术 → 工程技术
 * 每层三类卡：公理卡(AX) / 学科卡(SC) / 工具卡(TC)
 * 初始 33 张（每桥每层各一张），余缺经龙门推理补录
 *
 * 使用方式：
 *   感知环节 → 用卡拆解命题
 *   思考环节 → 用卡重组推理分析模型
 *   表达环节 → 用卡梳理（内容+架构+美化）× 叙事
 */

import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const V2_DB = join(ROOT, 'extension', 'kunlun-memory.db');
const REPORT = join(ROOT, 'deliverables', 'knowledge-cards-report.md');

// ═══════════════════════════════════════════════════════════════
// 桥定义
// ═══════════════════════════════════════════════════════════════

const BRIDGES = {
  Q01: { name: '自然辩证法', en: 'Dialectics of Nature', icon: '🔬' },
  Q02: { name: '社会科学', en: 'Social Science', icon: '📊' },
  Q03: { name: '数学科学', en: 'Mathematical Science', icon: '📐' },
  Q04: { name: '系统科学', en: 'System Science', icon: '🔷' },
  Q05: { name: '思维科学', en: 'Science of Mind', icon: '🧠' },
  Q06: { name: '人体科学', en: 'Human Body Science', icon: '🏃' },
  Q07: { name: '文学艺术', en: 'Literature & Arts', icon: '🎭' },
  Q08: { name: '军事科学', en: 'Military Science', icon: '⚔️' },
  Q09: { name: '行为科学', en: 'Behavioral Science', icon: '👥' },
  Q10: { name: '地理科学', en: 'Geographic Science', icon: '🌍' },
  Q11: { name: '建筑科学', en: 'Architectural Science', icon: '🏗️' },
};

// ═══════════════════════════════════════════════════════════════
// 认知卡定义：每桥三层，每层一张初始卡
// 编号规则: AX=公理 SC=学科 TC=工具
// 总计: 11桥 × 3层 = 33张
// ═══════════════════════════════════════════════════════════════

const CARDS = [
  // ═══════════════════════════════════════════════════════════
  // Q01 自然辩证法 — 连接哲学与自然科学
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-001', bridge: 'Q01', layer: '基础学科', type: 'AX',
    title: '物质第一性·意识第二性',
    content: `物质决定意识，意识对物质有能动反作用。在分析任何系统时，先问物质基础（资源/约束/条件），再问意识上层（认知/策略/文化）。反例：脱离资源约束谈战略规划必然失效。`,
    tags: ['ontology', 'materialism', 'foundation'],
  },
  {
    id: 'SC-001', bridge: 'Q01', layer: '科学技术', type: 'SC',
    title: '自然科学的三大发现',
    content: `细胞学说、能量守恒与转化定律、生物进化论——三大发现揭示了自然界的辩证统一：一切事物都是相互联系、运动发展、矛盾转化的。分析框架：看事物要看其内部结构(细胞)→能量流动→演化路径。`,
    tags: ['science-history', 'dialectics', 'methodology'],
  },
  {
    id: 'TC-001', bridge: 'Q01', layer: '工程技术', type: 'TC',
    title: '量变质变临界点检测',
    content: `从量变到质变的临界点识别工具：①跟踪关键参数的趋势斜率变化 ②检测系统响应的非线性跳变 ③识别"最后一根稻草"型触发事件。适用于技术突破预测、危机预警、改革窗口期判断。`,
    tags: ['quantitative-change', 'threshold', 'prediction'],
  },

  // ═══════════════════════════════════════════════════════════
  // Q02 社会科学 — 研究人类社会的结构与发展
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-002', bridge: 'Q02', layer: '基础学科', type: 'AX',
    title: '社会存在决定社会意识',
    content: `社会的物质生活条件决定社会思想上层建筑。分析社会现象时：先解剖经济基础（生产关系/生产力水平），再理解上层建筑（政治/法律/文化）。反例：脱离经济基础谈论政策效果。`,
    tags: ['historical-materialism', 'society', 'foundation'],
  },
  {
    id: 'SC-002', bridge: 'Q02', layer: '科学技术', type: 'SC',
    title: '政治经济学：生产关系与生产力',
    content: `生产力的发展水平决定生产关系的性质，生产关系反作用于生产力。当生产关系从促进转化为阻碍时，社会革命时代到来。分析企业/行业时：看技术变革是否与现有组织架构矛盾。`,
    tags: ['political-economy', 'productivity', 'relations'],
  },
  {
    id: 'TC-002', bridge: 'Q02', layer: '工程技术', type: 'TC',
    title: '社会主要矛盾分析法',
    content: `三步定位主要矛盾：①列出所有矛盾对 ②按"影响全局程度"排序 ③识别那个——解决了它其他矛盾就迎刃而解的。工具输出：主要矛盾陈述+次要矛盾链+矛盾转化条件表。`,
    tags: ['contradiction-analysis', 'priority', 'method'],
  },

  // ═══════════════════════════════════════════════════════════
  // Q03 数学科学 — 研究量与形式的科学
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-003', bridge: 'Q03', layer: '基础学科', type: 'AX',
    title: '万物皆数·关系即结构',
    content: `一切事物都有量的规定性，事物之间的关系可以用数学结构描述。分析要点：先识别可度量的关键变量，再建立变量之间的关系模型。反例：无法量化的事物不等于不存在，要用序数/分类替代。`,
    tags: ['mathematical-philosophy', 'quantification', 'foundation'],
  },
  {
    id: 'SC-003', bridge: 'Q03', layer: '科学技术', type: 'SC',
    title: '统计学与概率论',
    content: `统计思维：用样本推断总体，用概率描述不确定性。核心原则：①基率谬误——忽略先验概率 ②辛普森悖论——分组趋势与总体趋势相反 ③回归均值——极端值后趋向平均。适用于数据驱动决策。`,
    tags: ['statistics', 'probability', 'inference'],
  },
  {
    id: 'TC-003', bridge: 'Q03', layer: '工程技术', type: 'TC',
    title: '基率谬误检测器',
    content: `当分析报告说"准确率99%"时，自动追问：先验概率是多少？工具逻辑：P(真阳性) = P(病)×P(阳性|病) / [P(病)×P(阳性|病) + P(无病)×P(阳性|无病)]。自动标注：忽略基率的结论降信度一级。`,
    tags: ['bias-detection', 'bayesian', 'tool'],
  },

  // ═══════════════════════════════════════════════════════════
  // Q04 系统科学 — 研究系统的结构与行为
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-004', bridge: 'Q04', layer: '基础学科', type: 'AX',
    title: '整体大于部分之和',
    content: `系统具有涌现属性，不能通过孤立分析子系统来理解整体行为。分析时：①圈定系统边界 ②识别反馈回路 ③寻找涌现行为。反例：只分析各部门KPI无法理解公司整体竞争力。`,
    tags: ['emergence', 'holism', 'system-thinking'],
  },
  {
    id: 'SC-004', bridge: 'Q04', layer: '科学技术', type: 'SC',
    title: '控制论与反馈回路',
    content: `任何系统都由正反馈（放大/加速偏离）和负反馈（抑制/保持稳定）回路驱动。分析时的三问：哪些回路在主导当前行为？正负反馈的平衡点在哪儿？时滞多长？适用于组织/生态/经济系统分析。`,
    tags: ['cybernetics', 'feedback', 'system-dynamics'],
  },
  {
    id: 'TC-004', bridge: 'Q04', layer: '工程技术', type: 'TC',
    title: 'OCGS回路分析法',
    content: `开放复杂巨系统回路分析四步：①画系统边界和外部环境 ②列出所有关键变量和连接 ③标注正负反馈极性 ④找主导回路和延迟环节。输出：回路图+主导回路标识+干预点建议。`,
    tags: ['ocgs', 'loop-analysis', 'complex-system'],
  },

  // ═══════════════════════════════════════════════════════════
  // Q05 思维科学 — 研究认知与思维规律
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-005', bridge: 'Q05', layer: '基础学科', type: 'AX',
    title: '从感性认识到理性认识',
    content: `认识过程：感性认识（具体经验）→ 理性认识（抽象概念）→ 实践检验 → 再认识。认知工具不能跳过感性阶段直接推演。反例：没有数据支持的理论推演是空中楼阁。三层校验：经验是否符合？逻辑是否自洽？实践是否验证？`,
    tags: ['epistemology', 'cognition', 'practice'],
  },
  {
    id: 'SC-005', bridge: 'Q05', layer: '科学技术', type: 'SC',
    title: '认知科学与决策心理学',
    content: `人类认知的局限与优势：①认知偏差——确认偏误/锚定效应/可得性启发 ②双系统理论——系统1(快/直觉)与系统2(慢/分析) ③元认知——对自身思考过程的反思。分析时标注：当前推理用了哪个系统？存在哪些偏差风险？`,
    tags: ['cognitive-science', 'decision-making', 'bias'],
  },
  {
    id: 'TC-005', bridge: 'Q05', layer: '工程技术', type: 'TC',
    title: '三元认知推理框架',
    content: `用三值逻辑(+1支持/0中立/-1反对)替代二值对错判断。推理步骤：①对每个命题标注三元立场 ②检测立场之间的逻辑矛盾 ③计算整体可统一性 ④若不可统一则回溯前提假设。适用于复杂议题的辩证分析。`,
    tags: ['ternary-logic', 'reasoning', 'dialectical'],
  },

  // ═══════════════════════════════════════════════════════════
  // Q06 人体科学 — 研究人体结构与功能
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-006', bridge: 'Q06', layer: '基础学科', type: 'AX',
    title: '人体是开放复杂巨系统',
    content: `人体不是机械组合，而是多层次、多回路、多时间尺度的统一体。分析原则：①任何局部变化都会影响整体 ②有自修复和自适应的能力 ③心理和生理不可分割。反例：只治标不治本的治疗方案。`,
    tags: ['human-body', 'complex-system', 'holistic'],
  },
  {
    id: 'SC-006', bridge: 'Q06', layer: '科学技术', type: 'SC',
    title: '人因工程与认知负荷',
    content: `人因工程三原则：①认知负荷三段判据——负荷<能力时高效，负荷=能力时满负荷，负荷>能力时出错 ②注意残留——切换任务时前任务的注意力残留影响新任务 ③人因安全阀——在超过人体极限前必须有预警机制。`,
    tags: ['human-factors', 'cognitive-load', 'ergonomics'],
  },
  {
    id: 'TC-006', bridge: 'Q06', layer: '工程技术', type: 'TC',
    title: '注意力预算管理工具',
    content: `分析任何方案时评估注意力消耗：①该方案需要多少持续的注意力投入？②关键决策点是否分布在注意力低谷时段？③是否有注意残留风险？输出：注意力分配热力图+疲劳风险预警。`,
    tags: ['attention', 'energy-management', 'tool'],
  },

  // ═══════════════════════════════════════════════════════════
  // Q07 文学艺术 — 研究表达与审美
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-007', bridge: 'Q07', layer: '基础学科', type: 'AX',
    title: '形式与内容的辩证统一',
    content: `表达的核心法则：内容决定形式，形式反作用于内容。好的表达是内容准确+形式优美的统一。分析时：先明确要传达的核心信息（内容），再选择最合适的形式（结构/风格/媒介）。反例：华丽的空壳或粗糙的好内容。`,
    tags: ['aesthetics', 'expression', 'unity'],
  },
  {
    id: 'SC-007', bridge: 'Q07', layer: '科学技术', type: 'SC',
    title: '叙事学与修辞学',
    content: `叙事四要素：情节(因果链)、人物(行动者)、视角(谁在看)、时间(叙事的节奏)。修辞三路径：ethos(可信度)、pathos(情感)、logos(逻辑)。分析报告时：拆解叙事结构→识别修辞策略→评估可信度。`,
    tags: ['narratology', 'rhetoric', 'communication'],
  },
  {
    id: 'TC-007', bridge: 'Q07', layer: '工程技术', type: 'TC',
    title: '表达架构·三层打磨法',
    content: `任何输出按三层打磨：①内容层——核心信息是否完整准确？②架构层——逻辑链是否清晰？各部分比例是否合理？③美化层——语言是否精准？例子是否生动？节奏是否有变化？三元校验：内容×架构×美化 = 表达效果。`,
    tags: ['writing', 'structure', 'polish'],
  },

  // ═══════════════════════════════════════════════════════════
  // Q08 军事科学 — 研究对抗与策略
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-008', bridge: 'Q08', layer: '基础学科', type: 'AX',
    title: '知己知彼·百战不殆',
    content: `任何对抗分析必须同时了解自身和对手：自身——优势和劣势、资源和底线、战略目标；对手——意图和能力、行动模式、制约因素。不可偏废。反例：只分析自己不分析对手的战略注定失败。`,
    tags: ['strategy', 'adversarial', 'intelligence'],
  },
  {
    id: 'SC-008', bridge: 'Q08', layer: '科学技术', type: 'SC',
    title: '持久战三阶段论',
    content: `战略三阶段：防御阶段（保存实力/积累力量）→ 相持阶段（力量接近/局部反攻）→ 反攻阶段（全面反攻/夺取胜利）。每阶段的判断指标：力量对比、士气变化、国际态势。应用于竞争/谈判/改革场景的阶段判断。`,
    tags: ['protracted-war', 'strategy', 'phases'],
  },
  {
    id: 'TC-008', bridge: 'Q08', layer: '工程技术', type: 'TC',
    title: '五类根因分析法',
    content: `穿透表面原因直达结构根源的五类分析法：①历史根因——追溯事件的时间链 ②结构根因——解剖系统的约束条件 ③矛盾根因——定位核心矛盾对 ④认知根因——检查决策者的认知盲区 ⑤制度根因——分析规则和激励机制。`,
    tags: ['root-cause', 'analysis', 'diagnosis'],
  },

  // ═══════════════════════════════════════════════════════════
  // Q09 行为科学 — 研究人类行为规律
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-009', bridge: 'Q09', layer: '基础学科', type: 'AX',
    title: '行为是环境与基因的交互产物',
    content: `人类行为不是纯粹理性选择，而是遗传倾向、环境约束和认知模式共同作用的结果。分析行为时：①看清情境的力量（斯坦福监狱实验/米尔格拉姆实验）②识别激励结构 ③注意行为的非理性成分。反例：假设人是完全理性的分析框架。`,
    tags: ['behavior', 'environment', 'interaction'],
  },
  {
    id: 'SC-009', bridge: 'Q09', layer: '科学技术', type: 'SC',
    title: '社会心理学与群体行为',
    content: `群体八大现象：从众（阿希实验）、责任分散（旁观者效应）、群体极化、社会惰化、去个性化、群体思维、权威服从、社会助长。分析群体事件时：先识别哪些现象在起作用，再判断群体行为的理性程度。`,
    tags: ['social-psychology', 'group-behavior', 'influence'],
  },
  {
    id: 'TC-009', bridge: 'Q09', layer: '工程技术', type: 'TC',
    title: '激励结构反向工程',
    content: `从行为反推激励结构的工具：①列出所有参与者的实际行为（非宣称的目标）②问"在当前规则下，什么行为最有利？"③找规则设计的预期效果和实际效果的差距。输出：当前的"实际激励地图"+"建议规则调整"。`,
    tags: ['incentives', 'game-theory', 'design'],
  },

  // ═══════════════════════════════════════════════════════════
  // Q10 地理科学 — 研究空间与环境的科学
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-010', bridge: 'Q10', layer: '基础学科', type: 'AX',
    title: '空间是关系的载体',
    content: `地理空间不是背景板，而是塑造关系的主动力量。分析时问：①空间格局如何影响信息/资源/权力的分配？②地理约束是否正在被技术打破？③空间重构会带来哪些连锁反应？反例：忽视地理因素的全球化分析。`,
    tags: ['geography', 'space', 'spatial-relations'],
  },
  {
    id: 'SC-010', bridge: 'Q10', layer: '科学技术', type: 'SC',
    title: '经济地理学：集聚与扩散',
    content: `经济活动在空间上的双重运动：集聚效应（规模经济/知识溢出/劳动力池）vs 扩散效应（成本上升/拥挤/污染）。分析城市/产业时：判断当前处于集聚还是扩散阶段，两股力量的平衡点在何处，交通/通信成本变化如何影响平衡点。`,
    tags: ['economic-geography', 'agglomeration', 'spread'],
  },
  {
    id: 'TC-010', bridge: 'Q10', layer: '工程技术', type: 'TC',
    title: '空间锁定诊断工具',
    content: `诊断一个区域/城市是否陷入空间锁定的三步：①识别沉没成本——基建/产业布局/人口集聚的不可逆程度 ②评估路径依赖——现有空间结构是否阻碍转型 ③寻找解锁条件——什么外部冲击或内部变革能打破锁定。`,
    tags: ['spatial-lock', 'path-dependency', 'diagnosis'],
  },

  // ═══════════════════════════════════════════════════════════
  // Q11 建筑科学 — 研究人工环境的设计与建造
  // ═══════════════════════════════════════════════════════════
  {
    id: 'AX-011', bridge: 'Q11', layer: '基础学科', type: 'AX',
    title: '形式追随功能·功能塑造形式',
    content: `设计的第一性原则：形式服务于功能，但形式一旦确立又反过来约束和塑造功能。分析任何人工系统时：①当前形式是否还满足功能需求？②形式是否成了功能进化的障碍？③最小的形式改变能否带来最大的功能改善？反例：为美观牺牲功能的设计。`,
    tags: ['design-philosophy', 'form-function', 'architecture'],
  },
  {
    id: 'SC-011', bridge: 'Q11', layer: '科学技术', type: 'SC',
    title: '环境心理学：空间行为关系',
    content: `空间环境对人类行为的系统影响：①空间权力——布局反映权力结构（办公室/教室/法庭）②领地性——人对空间的主权意识 ③隐私调节——人需要根据情境调节社交距离。分析环境设计时：从人的行为需求倒推空间要求。`,
    tags: ['environmental-psychology', 'space-behavior', 'design'],
  },
  {
    id: 'TC-011', bridge: 'Q11', layer: '工程技术', type: 'TC',
    title: '蓝图式系统架构法',
    content: `从建筑蓝图借鉴的系统设计方法：①总图（Master Plan）——系统的整体架构视图 ②分层图（Layer Plan）——各层的接口和职责 ③节点详图（Detail Plan）——关键组件的内部设计。适用于软件/组织/流程的系统设计。输出：三层架构文档模板。`,
    tags: ['blueprint', 'system-design', 'architecture-framework'],
  },
];

// ═══════════════════════════════════════════════════════════════
// 写入 V2 数据库
// ═══════════════════════════════════════════════════════════════

function initDatabase() {
  const db = new DatabaseSync(V2_DB);

  // 创建知识卡表（如果不存在）
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_cards_v2 (
      card_id TEXT PRIMARY KEY,
      bridge_id TEXT NOT NULL,
      layer TEXT NOT NULL,
      card_type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      call_count INTEGER DEFAULT 0,
      confidence REAL DEFAULT 0.7,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      status TEXT DEFAULT 'active'
    );
    CREATE INDEX IF NOT EXISTS idx_cards_bridge ON knowledge_cards_v2(bridge_id);
    CREATE INDEX IF NOT EXISTS idx_cards_type ON knowledge_cards_v2(card_type);
    CREATE INDEX IF NOT EXISTS idx_cards_layer ON knowledge_cards_v2(layer);
  `);

  return db;
}

function insertCards(db) {
  const now = Date.now();
  let inserted = 0;
  let skipped = 0;

  const checkStmt = db.prepare('SELECT card_id FROM knowledge_cards_v2 WHERE card_id = ?');
  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO knowledge_cards_v2
      (card_id, bridge_id, layer, card_type, title, content, tags, call_count, confidence, created_at, updated_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'active')
  `);

  db.exec('BEGIN');
  try {
    for (const card of CARDS) {
      const existing = checkStmt.get(card.id);
      if (existing) {
        skipped++;
        continue;
      }
      insertStmt.run(
        card.id,
        card.bridge,
        card.layer,
        card.type,
        card.title,
        card.content,
        JSON.stringify(card.tags),
        0.7,
        now,
        now,
      );
      inserted++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  return { inserted, skipped };
}

function generateReport(inserted, skipped) {
  const lines = [
    '# 大成智慧学·十一桥三层认知卡体系',
    '',
    '> 生成时间: ' + new Date().toISOString(),
    '',
    '## 体系结构',
    '',
    '```',
    '马克思主义哲学',
    '    ↓ 十一座桥梁',
    '┌─────────────────────────────────────────┐',
    '│  每桥三层：基础学科 → 科学技术 → 工程技术  │',
    '│  每层三类：公理卡(AX) / 学科卡(SC) / 工具卡(TC) │',
    '└─────────────────────────────────────────┘',
    '    ↓ 三种使用方式',
    '感知环节 → 用卡拆解命题',
    '思考环节 → 用卡重组推理分析模型',
    '表达环节 → 用卡梳理（内容+架构+美化）× 叙事',
    '```',
    '',
    '## 桥系概览',
    '',
    '| 桥 | 名称 | 基础学科 | 科学技术 | 工程技术 |',
    '|---|---|---|---|---|',
    ...BRIDGES_ORDER.map(b => {
      const cards = CARDS.filter(c => c.bridge === b.id);
      const l1 = cards.find(c => c.layer === '基础学科');
      const l2 = cards.find(c => c.layer === '科学技术');
      const l3 = cards.find(c => c.layer === '工程技术');
      return `| ${b.icon} ${b.id} | ${b.name} | ${l1 ? l1.id + ' ' + l1.title : '—'} | ${l2 ? l2.id + ' ' + l2.title : '—'} | ${l3 ? l3.id + ' ' + l3.title : '—'} |`;
    }),
    '',
    '## 卡片清单',
    '',
    ...CARDS.map(c => [
      '---',
      '### [' + c.id + '] ' + c.title,
      '',
      '| 属性 | 值 |',
      '|---|---|',
      '| 桥 | ' + c.bridge + ' ' + BRIDGES[c.bridge].name + ' |',
      '| 层 | ' + c.layer + ' |',
      '| 类型 | ' + {AX: '公理卡', SC: '学科卡', TC: '工具卡'}[c.type] + ' (' + c.type + ') |',
      '| 标签 | ' + c.tags.join(', ') + ' |',
      '',
      c.content,
      '',
    ].join('\n')),
    '',
    '## 初始化结果',
    '',
    '| 指标 | 值 |',
    '|---|---|',
    '| 桥数 | 11 |',
    '| 层数 | 3（基础学科/科学技术/工程技术） |',
    '| 每层卡数 | 11张（每桥一张） |',
    '| 初始卡总数 | 33 |',
    '| 新增卡 | ' + inserted + ' |',
    '| 已存在 | ' + skipped + ' |',
    '| 缺额 | 66（33桥层×3类 - 33初始，通过龙门推理补录） |',
    '',
    '## 三环节使用法',
    '',
    '### 感知环节 — 拆解命题',
    '',
    '当遇到一个命题/问题时：',
    '1. 识别它涉及哪些桥（社会/经济/技术/心理...）',
    '2. 用对应桥的公理卡(AX)找到根本判断准则',
    '3. 用学科卡(SC)调用专业分析框架',
    '4. 用工具卡(TC)执行具体分析方法',
    '',
    '### 思考环节 — 重组推理分析模型',
    '',
    '当需要构建分析模型时：',
    '1. 从相关桥的学科卡(SC)中选择分析框架',
    '2. 用公理卡(AX)校验框架的前提假设是否成立',
    '3. 用工具卡(TC)填充分析的具体步骤',
    '4. 多桥共振：当涉及跨桥问题时，多桥卡片联合使用',
    '',
    '### 表达环节 — （内容+架构+美化）× 叙事',
    '',
    '当需要输出分析报告时：',
    '1. 内容层 — 用学科卡(SC)确保分析深度和准确性',
    '2. 架构层 — 用工具卡(TC)的结构化模板组织逻辑',
    '3. 美化层 — 用公理卡(AX)的洞见增强表达力度',
    '4. 叙事线 — 用Q07的工具卡(TC-007)串联整体表达',
    '',
  ];

  const reportDir = dirname(REPORT);
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });
  writeFileSync(REPORT, lines.join('\n'));
}

const BRIDGES_ORDER = Object.entries(BRIDGES).map(([id, b]) => ({ id, ...b }));

// ═══════════════════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════════════════

function main() {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║  大成智慧学·十一桥三层认知卡初始化      ║');
  console.log('╚══════════════════════════════════════════╝\n');

  console.log('📂 数据库:', V2_DB);
  console.log('');

  const db = initDatabase();
  const { inserted, skipped } = insertCards(db);
  db.close();

  console.log('── 初始化结果 ──');
  console.log('  桥数:             11');
  console.log('  层数:             3（基础学科/科学技术/工程技术）');
  console.log('  初始卡总数:       33');
  console.log('  新增:             ' + inserted);
  console.log('  已存在:           ' + skipped);
  console.log('  缺额（待龙门补录）: 66');
  console.log('');

  generateReport(inserted, skipped);
  console.log('📄 报告:', REPORT);
  console.log('');

  // 按桥打印摘要
  for (const b of BRIDGES_ORDER) {
    const bridgeCards = CARDS.filter(c => c.bridge === b.id);
    console.log(b.icon, b.id, b.name);
    for (const c of bridgeCards) {
      const typeIcon = { AX: '📜', SC: '📖', TC: '🔧' }[c.type] || '📄';
      console.log(`    ${typeIcon} [${c.id}] ${c.title} (${c.layer})`);
    }
  }
}

main();
