/**
 * Pi-昆仑 V2 — pi 扩展入口
 *
 * 目标：替代且升级昆仑洞天 v6
 *
 * 核心能力：
 *   /kunlun analyze <query>   — 全链路分析管线（谛听→太一→天工）
 *   /kunlun tools              — 列出所有可用工具
 *
 * 独立工具（供 LLM 按需调用）：
 *   analyze_contradiction  — 矛盾分析
 *   plan_strategy          — 持久战策略
 *   run_spiral             — 实践螺旋
 *   scan_ecosystem         — 生态感知
 *   mcp_manage             — MCP 网关
 *   openclaw_plugins       — OpenClaw 插件管理
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { execSync } from 'node:child_process';

// ─── 昆仑引擎 ───
import { T_TRUE, T_UNKNOWN, T_FALSE } from '@kunlun/ternary';
import { createContradictionEngine } from '@kunlun/contradiction';
import { PracticeSpiralEngine } from '@kunlun/spiral';
import { ProtractedWarEngine } from '@kunlun/pw';
import { createEcosystemSensor } from '@kunlun/ocgs';
import { MCPGateway } from '@kunlun/subsystems';
import { TernaryMemoryModel, ResonantMemoryNetwork } from '@kunlun/subsystems';
import { TernarySecurityPipeline, TernaryRiskHeatmap } from '@kunlun/subsystems';
import {
  TernaryKnowledgeIndex, KnowledgeContradictionGraph,
  RelationType,
} from '@kunlun/subsystems';
import {
  TernaryDecisionTree, TernaryAlertManager, SkillGovernance,
} from '@kunlun/subsystems';

// ─── 持久化记忆（SQLite 后端） ───
import { PersistentMemoryStore } from './persistent-memory.ts';

// ─── Fork 桥接 ───
import { registerKunlunEngine } from '@earendil-works/pi-agent-core';
import type {
  KunlunEngine, AnalysisContext, AnalysisResult,
  ToolDecisionContext, BatchToolDecisionContext, ToolDecision,
} from '@earendil-works/pi-agent-core';

// ─── 日志 ───
import { log } from './logger.ts';

// ─── 性能基准 ───
import { recordPerf } from './perf.ts';

// ─── 冲突检测 ───
import { detectMemoryKnowledgeConflict, logConflict, formatConflictReport } from './conflict-detector.ts';

// ─── 龙门补录 ───
import { suggestDrafts, logDraft, formatDraftReport } from './dragon-gate.ts';

// ─── OpenClaw 插件管理 ───
import { OpenClawPluginManager, MCPClientPool, checkGateway, setupGateway, startGateway, addWeChatChannel, listPlugins } from '@kunlun/subsystems';

export default function (pi: ExtensionAPI) {
  // ── 引擎实例 ──
  let ce: any = createContradictionEngine();
  let se: any = new PracticeSpiralEngine();
  let pwe: any = new ProtractedWarEngine();
  let gw: any = new MCPGateway({ autoDiscover: false });

  // ── 归藏：持久化记忆（SQLite 后端 + 内存热缓存） ──
  const persistentMemory = new PersistentMemoryStore();
  const memory = new TernaryMemoryModel({ maxEntries: 500 });
  const resonance = new ResonantMemoryNetwork(memory);
  // 写计数，达到阈值时触发清理
  let writeCount = 0;
  const CLEANUP_INTERVAL = 50;

  // ── 记忆加载函数（会话启动时调用） ──
  const reloadMemories = () => {
    memory.reset();
    const allMemories = persistentMemory.getAll();
    for (const mem of allMemories) {
      const entry = memory.store(mem.content, mem.source, JSON.parse(mem.tags));
      entry.strength = mem.strength;
    }
    // 从 pi-hermes-memory 导入种子知识（仅首次）
    if (allMemories.length === 0) {
      const seeded = persistentMemory.seedFromHermesMemory();
      if (seeded > 0) {
        const seededEntries = persistentMemory.getAll().slice(-seeded);
        for (const mem of seededEntries) {
          memory.store(mem.content, mem.source, JSON.parse(mem.tags));
        }
      }
    }
    // 启动时执行一次清理
    try {
      const cleanupResult = persistentMemory.cleanup();
      const totalPurged = cleanupResult.fadedPurged + cleanupResult.duplicatesMerged;
      if (totalPurged > 0) {
        log.info('memory', `清理: 删除 ${totalPurged} 条, 剩余${cleanupResult.kept}`);
      }
    } catch (e) {
      log.catchError('memory', '启动清理', e);
    }
    return allMemories.length;
  };

  // 首次加载（模块初始化时）
  reloadMemories();

  // ── 琅嬛：知识图谱（关系/信度/矛盾检测） ──
  const knowledge = new TernaryKnowledgeIndex({ maxEntries: 1000 });
  const knowledgeGraph = new KnowledgeContradictionGraph(knowledge);

  // ── 镇岳三进制安全管线 ──
  const security = new TernarySecurityPipeline();
  const heatmap = new TernaryRiskHeatmap(security);

  // ── 镇熵：决策树 + 告警 ──
  const alertManager = new TernaryAlertManager();
  const skillGovernance = new SkillGovernance(new TernaryDecisionTree());

  // ── 引擎适配器 ──
  const engine: KunlunEngine = {

    // ════════════════════════════════════════════════════════
    // 1. 认知分析（自动注入每次 LLM 调用前）
    // ════════════════════════════════════════════════════════
    async analyze(ctx: AnalysisContext): Promise<AnalysisResult> {
      const _perfStart = Date.now();
      const _perfModules: string[] = [];
      const contradictions: Array<{ thesis: string; antithesis: string }> = [];
      let unifiability = 0;
      let dominantAspect = 0;
      let qualitativeState = -1;
      let strategy: string | undefined;
      let memoryContext: string | undefined;
      let ecosystemHealth: number | undefined;

      const lastUserMsg = [...ctx.messages].reverse().find(m => m.role === 'user');
      const queryText = lastUserMsg && 'content' in lastUserMsg
        ? (Array.isArray(lastUserMsg.content)
          ? lastUserMsg.content.map((c: any) => typeof c === 'string' ? c : c.text || '').join(' ')
          : String(lastUserMsg.content))
        : '';

      if (!queryText) {
        return { contradictions, unifiability: 0, dominantAspect: 0, qualitativeState: -1, summary: '无用户输入' };
      }

      // ── 镇熵路由：统一决策运行哪些认知模块 ──
      const routeCtx: Record<string, string> = {
        has_contradiction: String(/矛盾|冲突|vs|两难|权衡|取舍|困境/.test(queryText)),
        has_strategy: String(matchesStrategy(queryText) || /规划|发展|竞争|趋势|转型|升级|路线图/.test(queryText)),
        has_spiral: String(matchesSpiral(queryText) || /迭代|反思|复盘|回顾|经验|教训|优化/.test(queryText)),
        has_ecosystem: String(matchesEcosystem(queryText)),
        tool_count: String(ctx.tools.length),
      };
      const modules = decideCognitiveModules(routeCtx);
      if (modules.contradiction) _perfModules.push('矛盾');
      if (modules.strategy) _perfModules.push('策略');
      if (modules.spiral) _perfModules.push('螺旋');
      if (modules.ecosystem) _perfModules.push('生态');

      // ── ① 归藏 + 琅嬛：检索相关记忆与知识 ──
      const relatedMemories = memory.search(queryText).slice(0, 3);
      const relatedKnowledge = knowledge.search(queryText).slice(0, 3);
      const memoryParts: string[] = [];
      if (relatedMemories.length > 0) {
        memoryParts.push(...relatedMemories.map(m => `[记忆:${m.source}] ${m.content.slice(0, 80)}`));
      }
      if (relatedKnowledge.length > 0) {
        memoryParts.push(...relatedKnowledge.map(k => `[知识:${k.source}] ${k.content.slice(0, 80)}`));
        // 检测知识矛盾并注入
        const graphEdges = knowledgeGraph.detectContradictions();
        const relevantEdges = graphEdges.filter(e =>
          relatedKnowledge.some(k => k.id === e.sourceId || k.id === e.targetId)
        );
        if (relevantEdges.length > 0) {
          memoryParts.push(`⚠️ 检测到 ${relevantEdges.length} 组知识矛盾，需注意信息冲突`);
        }
      }
      if (memoryParts.length > 0) {
        memoryContext = memoryParts.join('；');
      }

      // ── ①b 谛听：联网搜索 ──
      try {
        const { searchWeb } = await import('./searcher.ts');
        const searchResult = await searchWeb(queryText, 3);
        if (searchResult.summary) {
          memoryContext = (memoryContext || '') + searchResult.summary;
          _perfModules.push('搜索');
        }
      } catch { /* 搜索降级: 联网不可用不影响主流程 */ }

      // ── ② 谛听：矛盾感知 ──
      const extracted = extractContradictions(queryText);
      contradictions.push(...extracted);

      if (contradictions.length > 0) {
        // 触发镇熵告警（矛盾预警）
        alertManager.alert('kunlun-analysis',
          `检测到 ${contradictions.length} 组矛盾`, T_UNKNOWN,
          { contradictions: contradictions.map(c => `${c.thesis} vs ${c.antithesis}`).join('；') },
        );
        try {
          const makeProp = (text: string) => ({
            statement: text, source: 'kunlun-engine' as any,
            confidenceTrit: 0 as any, supportingEvidence: [], opposingEvidence: [],
          });
          const pair = {
            id: `auto-${Date.now()}`,
            thesis: makeProp(contradictions[0].thesis),
            antithesis: makeProp(contradictions[0].antithesis),
            contradictionType: 'dialectical' as any,
            priority: 1, warPhaseAtDiscovery: 'stalemate' as any,
            discoverySource: 'agent_analysis' as any,
          };
          let result: any = null;
          try { result = ce.analyzeSingle(pair); } catch (e) { log.catchError('analyze', '矛盾分析', e); }
          unifiability = result?.analysis?.unifiability ?? 0;
          dominantAspect = result?.analysis?.dominantAspect ?? 0;
          qualitativeState = result?.qualitativeChange?.approachingThreshold ?? -1;

          // ── 持久战（由决策树控制） ──
          if (modules.strategy) {
            const pwCtx: any = {
              totalRuntime: 0, currentPhaseDuration: 0,
              phaseHistory: [],
              powerSnapshot: { ourStrength: 0.4, enemyStrength: 0.6 },
              activeContradictions: contradictions,
              spiralMetrics: { cyclesCompleted: 0 },
              criticalEvents: [],
            };
            try {
              const phase = await pwe.assessPhase(pwCtx);
              const labels: Record<string, string> = {
                defense: '🛡️ 防御阶段', stalemate: '⚔️ 相持阶段', counteroffensive: '⚡ 反攻阶段',
              };
              strategy = `策略阶段: ${labels[phase.currentPhase] ?? phase.currentPhase}`;
            } catch (e) { log.catchError('analyze', '持久战策略', e); }
          }

          // ── 实践螺旋（由决策树控制） ──
          if (modules.spiral) {
            try {
              const spiralCtx: any = {
                domain: queryText, hypothesis: queryText,
                environment: { type: 'simulation', constraints: [] },
                relatedContradictions: contradictions,
              };
              const sr = await se.engagePractice(spiralCtx);
              if (sr?.summary) {
                strategy = (strategy ? strategy + '；' : '') + `实践洞察: ${sr.summary}`;
              }
            } catch (e) { log.catchError('analyze', '实践螺旋', e); }
          }
        } catch (e) { log.catchError('analyze', '矛盾分析整体', e); }
      }

      // ── ③ 生态感知（由决策树控制） ──
      if (modules.ecosystem) {
        try {
          const sensor = createEcosystemSensor({ timeoutMs: 2000 });
          const scan = await sensor.scanEcosystem();
          ecosystemHealth = scan.ecosystemHealth;
        } catch (e) { log.catchError('analyze', '生态感知', e); }
      }

      // ── 即使无矛盾，策略/实践相关查询也触发分析 ──
      if (contradictions.length === 0 && modules.strategy) {
          try {
            const pwCtx2: any = {
              totalRuntime: 0, currentPhaseDuration: 0, phaseHistory: [],
              powerSnapshot: { ourStrength: 0.4, enemyStrength: 0.6 },
              activeContradictions: [], spiralMetrics: { cyclesCompleted: 0 },
              criticalEvents: [],
            };
            const phase = await pwe.assessPhase(pwCtx2);
            const labels: Record<string, string> = {
              defense: '🛡️ 防御阶段', stalemate: '⚔️ 相持阶段', counteroffensive: '⚡ 反攻阶段',
            };
            strategy = `策略评估: ${labels[phase.currentPhase] ?? phase.currentPhase}`;
          } catch (e) { log.catchError('analyze', '策略评估（无矛盾）', e); }
        }
        if (modules.spiral) {
          try {
            const sc2: any = {
              domain: queryText, hypothesis: queryText,
              environment: { type: 'simulation', constraints: [] },
              relatedContradictions: [],
            };
            const sr = await se.engagePractice(sc2);
            if (sr?.summary) {
              strategy = (strategy ? strategy + '；' : '') + `实践洞察: ${sr.summary}`;
            }
          } catch (e) { log.catchError('analyze', '实践螺旋（无矛盾）', e); }
        }

      // ── ④ 归藏 + 琅嬛：持久化存储本次分析 ──
      const summary = contradictions.length > 0
        ? `检测到 ${contradictions.length} 组矛盾，可统一性: ${['不可调和', '待分析', '可统一'][unifiability + 1]}`
        : strategy
          ? `策略分析: ${strategy.slice(0, 60)}`
          : '基础认知模式';
      const tags = contradictions.map(c => c.thesis).concat(strategy ? ['strategy'] : []);

      // 归藏：会话记忆 — 写入 SQLite 持久化 + 内存热缓存
      const memEntry = memory.store(
        `${queryText.slice(0, 100)} → ${summary}`, 'kunlun-analysis', tags,
      );
      // SQLite 持久化
      const pMem = persistentMemory.store(
        `${queryText.slice(0, 100)} → ${summary}`, 'kunlun-analysis', tags,
      );
      // 周期性清理
      writeCount++;
      if (writeCount >= CLEANUP_INTERVAL) {
        writeCount = 0;
        try {
          const cleanupResult = persistentMemory.cleanup();
          const totalPurged = cleanupResult.fadedPurged + cleanupResult.duplicatesMerged;
          if (totalPurged > 0) {
            log.info('memory', `周期清理: 删除 ${totalPurged} 条 (陈旧:${cleanupResult.fadedPurged}, 重复:${cleanupResult.duplicatesMerged}), 剩余:${cleanupResult.kept}`);
          }
        } catch (e) {
          log.catchError('memory', '周期清理', e);
        }
      }
      for (const m of relatedMemories) {
        memory.associate(memEntry.id, m.id);
        persistentMemory.associate(pMem.id, m.id);
      }

      // 冲突检测 + 龙门补录
      try {
        const { DatabaseSync } = await import('node:sqlite');
        const gateDb = new DatabaseSync((persistentMemory as any).dbPath);

        // 冲突检测
        const conflicts = detectMemoryKnowledgeConflict(
          gateDb,
          `${queryText.slice(0, 100)} → ${summary}`,
          tags,
        );

        // 龙门补录：分析后检查是否需要新建知识卡
        if (contradictions.length > 0 || strategy) {
          const bridgeId = tags.find(t => /^Q\d{2}$/.test(t)) || 'Q04';
          const drafts = suggestDrafts(
            gateDb, bridgeId, queryText,
            contradictions.length, !!strategy, ecosystemHealth !== undefined,
          );
          for (const draft of drafts) {
            if (draft.confidence >= 0.6) {
              logDraft(draft);
              log.info('dragon-gate', `${draft.bridgeId} ${draft.layer} 缺 ${draft.cardType}: ${draft.title}`);
            }
          }
        }

        gateDb.close();
        for (const conflict of conflicts) {
          logConflict(conflict);
          if (conflict.severity >= 3) {
            log.warn('conflict', conflict.description);
          }
        }
      } catch (e) {
        log.catchError('conflict', '检测冲突', e);
      }

      // 琅嬛：知识条目（带关系）
      const knowledgeEntry = knowledge.addEntry(
        `${queryText} → ${summary}`, unifiability as any, 'kunlun-analysis', tags,
      );
      // 建立知识关系：如果当前结论和之前的知识冲突，标记为 CONTRADICTS
      for (const k of relatedKnowledge) {
        const currentUnifiability = unifiability;
        if (k.classification === 1 && currentUnifiability === -1) {
          knowledge.addRelation(knowledgeEntry.id, k.id, RelationType.CONTRADICTS, 0.8);
        } else if (k.classification === -1 && currentUnifiability === 1) {
          knowledge.addRelation(knowledgeEntry.id, k.id, RelationType.CONTRADICTS, 0.8);
        } else if (k.tags.some(t => tags.includes(t))) {
          knowledge.addRelation(knowledgeEntry.id, k.id, RelationType.SUPPORTS, 0.5);
        }
      }

      // 记录性能基准
      try {
        recordPerf({
          ts: new Date().toISOString(),
          durationMs: Date.now() - _perfStart,
          contradictions: contradictions.length,
          modulesActivated: _perfModules.length,
          modules: _perfModules,
          hasStrategy: !!strategy,
          hasEcosystem: ecosystemHealth !== undefined,
          memoryDelta: tags.length > 0 ? 1 : 0,
          injectionLength: (summary || '').length + (strategy || '').length + (memoryContext || '').length,
        });
      } catch { /* perf 记录失败不干扰 */ }

      return {
        contradictions, unifiability, dominantAspect, qualitativeState,
        strategy, memoryContext, ecosystemHealth, summary,
      };
    },

    // ════════════════════════════════════════════════════════
    // 2. 工具决策（镇岳四层风控管线）
    // ════════════════════════════════════════════════════════
    async decideTool(context: ToolDecisionContext): Promise<ToolDecision> {
      const risk = security.evaluate(context.toolName, 'kunlun-agent', {
        toolName: context.toolName,
        args: JSON.stringify(context.toolArgs).slice(0, 200),
        contradictions: context.latestAnalysis?.contradictions.length
          ? String(context.latestAnalysis.contradictions.length) : '0',
      });

      if (risk.finalDecision === T_FALSE) {
        const reasons = risk.layerResults
          .filter(r => r.decision === T_FALSE)
          .map(r => r.reason);
        return {
          allowed: false,
          blockReason: `🔒 镇岳安全阻止: ${reasons.join('；')}`,
          suggestedAlternative: context.availableTools.find(t => t.includes('read') || t.includes('list')) || undefined,
        };
      }

      if (risk.finalDecision === T_UNKNOWN) {
        const analysis = context.latestAnalysis;
        if (analysis && analysis.contradictions.length > 0 && analysis.unifiability === -1) {
          const writeTools = ['write', 'edit', 'delete', 'remove', 'bash'];
          if (writeTools.some(t => context.toolName.includes(t))) {
            return {
              allowed: false,
              blockReason: `⚠️ 检测到不可调和矛盾（${analysis.contradictions.map(c => c.thesis + ' vs ' + c.antithesis).join('；')}），镇岳建议先分析再修改`,
              suggestedAlternative: context.availableTools.find(t => t.includes('read') || t.includes('search')) || undefined,
            };
          }
        }
      }

      return { allowed: true };
    },

    /**
     * 批量工具决策：全局优先级排序 + 互斥检测
     *
     * 优先级规则：
     *   read/list/search ≥ 5  (信息获取优先)
     *   bash/run ≥ 3          (执行类中等优先)
     *   write/edit/delete = 0 (修改类最后执行)
     *
     * 互斥检测：同一文件的 write/edit 互斥
     */
    async decideToolBatch(context: BatchToolDecisionContext): Promise<ToolDecision[]> {
      const toolMap = new Map(context.toolCalls.map((tc) => [tc.toolName, tc]));
      const analysis = context.latestAnalysis;

      // 第一轮：逐工具安全评估
      const raw: Array<{ toolName: string; base: ToolDecision }> = [];
      for (const tc of context.toolCalls) {
        const single = await this.decideTool!({
          toolName: tc.toolName,
          toolArgs: tc.toolArgs,
          availableTools: context.availableTools,
          latestAnalysis: analysis,
          tool: tc.tool,
        });
        raw.push({ toolName: tc.toolName, base: single });
      }

      // 第二轮：分配优先级
      const result = raw.map((r) => {
        let priority = 0;
        const name = r.toolName.toLowerCase();

        // 读写类工具优先级
        if (/^(read|list|search|ls|cat|get|fetch|find|rg|grep)/.test(name)) {
          priority = 8;
        } else if (/^(bash|run|exec|test)/.test(name)) {
          priority = 5 + (analysis?.contradictions.length ?? 0) > 0 ? 2 : 0;
        } else if (/^(edit|write|delete|remove|mv|cp|patch)/.test(name)) {
          priority = 2 - (analysis?.contradictions.length ?? 0);
          if (priority < 0) priority = 0;
        } else {
          priority = 3;
        }

        // 矛盾激烈时降低写类工具优先级
        if (analysis && analysis.contradictions.length > 2 && analysis.unifiability === -1) {
          if (priority < 3) priority = 0;
        }

        // 未阻止的工具
        if (r.base.allowed) {
          return { ...r.base, priority };
        }

        // 已阻止的工具：尝试找替代
        if (!r.base.suggestedAlternative) {
          // 默认替代：同类型的安全工具
          const alt = context.availableTools.find((t) => {
            const tl = t.toLowerCase();
            if (/^(read|list|search)/.test(name)) return tl.includes('read') || tl.includes('list');
            if (/^(write|edit|delete)/.test(name)) return tl.includes('read') || tl.includes('search');
            return false;
          });
          return { ...r.base, suggestedAlternative: alt };
        }

        return r.base;
      });

      return result;
    },  // ← 注意：decideToolBatch 是对象方法，用逗号分隔
  };

  // ── 注册引擎 ──
  registerKunlunEngine(engine);

  // ── TUI 可视化 ──
  // 定义 widget 状态，由 engine.analyze() 和 turn_end 事件共同维护
  let widgetState: {
    contradictions: number;
    unifiability: string;
    strategy?: string;
    health?: string;
    analysisSummary: string;
  } = { contradictions: 0, unifiability: '待分析', analysisSummary: '等待首次分析' };

  pi.on('session_start', async (_event: any, ctx: any) => {
    ce = createContradictionEngine() as any;
    se = new PracticeSpiralEngine() as any;
    pwe = new ProtractedWarEngine() as any;
    gw = new MCPGateway({ autoDiscover: false });
    registerKunlunEngine(engine);

    // 新会话：从 SQLite 重载记忆到热缓存
    const count = reloadMemories();
    log.info('memory', `会话启动: 加载 ${count} 条记忆`);

    // 扫描并启动 OpenClaw 插件（含微信官方插件）
    try {
      const gw = await checkGateway();
      if (!gw.running) {
        log.info('openclaw', 'OpenClaw 网关未运行，尝试初始化...');
        const setupOk = await setupGateway('local');
        if (setupOk) {
          const startOk = await startGateway();
          if (startOk) {
            log.info('openclaw', 'OpenClaw 网关已启动');
            // 添加微信通道
            const wx = await addWeChatChannel();
            if (wx.success && wx.qrcode) {
              log.info('openclaw', '微信通道已配置，扫码登录');
              console.log(wx.qrcode);
              if (wx.url) console.log('或访问:', wx.url);
            }
          }
        }
      }

      // 扫描插件
      const mcpPool = new MCPClientPool();
      const ocManager = new OpenClawPluginManager(mcpPool);
      const result = await ocManager.autoStart();
      if (result.started > 0) {
        log.info('openclaw', `启动 ${result.started} 个 OpenClaw 插件`);
      }
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          log.warn('openclaw', err);
        }
      }
    } catch (e) {
      log.catchError('openclaw', '插件扫描', e);
    }

    // 显示三元状态指示器
    try {
      if (ctx?.ui?.theme?.fg) {
        ctx.ui.setStatus('kunlun', ctx.ui.theme.fg('dim', '⚪ 三元待命'));
      }
    } catch { /* 非 TUI 模式静默 */ }
  });

  // turn_end 事件：分析完成后刷新 widget
  pi.on('turn_end', async (_event, ctx) => {
    try {
      // 从 fork 的 bridge 读取最新分析
      let analysis;
      try {
        // 动态导入避免编译时依赖
        const { getLatestAnalysis } = await import('@earendil-works/pi-agent-core');
        analysis = getLatestAnalysis();
      } catch { /* fork 未加载时跳过 */ }

      if (!analysis || analysis.contradictions.length === 0 && !analysis.strategy) {
        ctx.ui.setStatus('kunlun', ctx.ui.theme.fg('muted', '⚪ 常规模式'));
        return;
      }

      // 更新 widget 状态
      widgetState = {
        contradictions: analysis.contradictions.length,
        unifiability: ['不可调和', '待分析', '可统一'][analysis.unifiability + 1] || '未知',
        strategy: analysis.strategy,
        health: analysis.ecosystemHealth !== undefined
          ? ['衰退', '稳定', '繁荣'][analysis.ecosystemHealth + 1] || '未知'
          : undefined,
        analysisSummary: analysis.summary,
      };

      // 三元状态颜色
      const stateColor = analysis.unifiability === 1 ? 'success'
        : analysis.unifiability === -1 ? 'error'
        : 'warning';

      // 状态栏
      const contradictionsStr = analysis.contradictions.length > 0
        ? analysis.contradictions.length + '组矛盾'
        : '无矛盾';
      ctx.ui.setStatus('kunlun',
        ctx.ui.theme.fg(stateColor, '🔺 ' + contradictionsStr +
          ' · ' + widgetState.unifiability +
          (analysis.strategy ? ' · ' + analysis.strategy.slice(0, 20) : ''))
      );

      // 持久 widget 面板
      const lines: string[] = [];

      // 矛盾对列表
      if (analysis.contradictions.length > 0) {
        lines.push(ctx.ui.theme.fg(stateColor, '┌─ 三元认知分析 ─┐'));
        for (const c of analysis.contradictions.slice(0, 3)) {
          const icon = analysis.unifiability === 1 ? '⇄'
            : analysis.unifiability === -1 ? '⇌'
            : '↔';
          const col = analysis.unifiability === 1 ? 'success'
            : analysis.unifiability === -1 ? 'error'
            : 'warning';
          lines.push(ctx.ui.theme.fg(col, `  ${icon} ${c.thesis} ↔ ${c.antithesis}`));
        }
        if (analysis.contradictions.length > 3) {
          lines.push(ctx.ui.theme.fg('muted', `  ... +${analysis.contradictions.length - 3}组`));
        }

        const unifColors: Record<string, string> = {
          '可统一': 'success', '待分析': 'warning', '不可调和': 'error',
        };
        const label = ['不可调和', '待分析', '可统一'][analysis.unifiability + 1] || '未知';
        lines.push(ctx.ui.theme.fg(unifColors[label] || 'muted',
          `  ▶ 可统一性: ${label}`));
      }

      // 策略
      if (analysis.strategy) {
        lines.push(ctx.ui.theme.fg('accent', `  📋 ${analysis.strategy.slice(0, 50)}`));
      }

      // 生态健康
      if (analysis.ecosystemHealth !== undefined) {
        const healthLabels = ['⬇ 衰退', '➡ 稳定', '⬆ 繁荣'];
        const healthColors = ['error', 'warning', 'success'];
        const idx = analysis.ecosystemHealth + 1;
        lines.push(ctx.ui.theme.fg(healthColors[idx] || 'muted',
          `  🌿 生态: ${healthLabels[idx] || '未知'}`));
      }

      // 摘要
      if (analysis.summary && analysis.summary.length > 10) {
        lines.push(ctx.ui.theme.fg('muted', `  💬 ${analysis.summary.slice(0, 60)}`));
      }

      if (analysis.contradictions.length > 0) {
        lines.push(ctx.ui.theme.fg(stateColor, '└──────────────┘'));
      }

      ctx.ui.setWidget('kunlun-analysis', lines);
    } catch {
      // TUI 不可用或组件缺失时静默降级
    }
  });

  // turn_start 事件：归零状态显示
  pi.on('turn_start', async (_event, ctx) => {
    try {
      ctx.ui.setStatus('kunlun', ctx.ui.theme.fg('dim', '⚪ 分析中...'));
    } catch { /* 非 TUI 模式 */ }
  });

  // ════════════════════════════════════════════════════════════
  // 管线命令: /kunlun analyze <query>
  // ════════════════════════════════════════════════════════════

  pi.registerCommand('kunlun', {
    description: 'Pi-昆仑 V2 认知分析管线。替代昆仑洞天 v6。使用方法: /kunlun analyze <查询>',
    handler: async (args: string, ctx: any) => {
      const trimmed = (args ?? '').trim();

      if (trimmed === 'help' || trimmed === 'tools' || trimmed === 'oc' || trimmed === 'openclaw') {
        showHelp(ctx);
        return;
      }

      // OpenClaw 子命令
      if (trimmed === 'openclaw status' || trimmed === 'oc status') {
        await showOpenClawStatus(ctx);
        return;
      }
      if (trimmed === 'openclaw setup' || trimmed === 'oc setup') {
        await setupOpenClawGateway(ctx);
        return;
      }
      if (trimmed === 'openclaw weixin' || trimmed === 'oc weixin') {
        await setupWeChatChannel(ctx);
        return;
      }

      const query = trimmed.replace(/^(analyze|a)\s+/, '');

      if (!query) {
        showHelp(ctx);
        return;
      }

      ctx.ui.setStatus('kunlun', '🚀 昆仑认知管线运行中...');
      await runPipeline(query, ctx, ce, se, pwe);
      ctx.ui.setStatus('kunlun', undefined);
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// 管线: 谛听 → 太一 → 天工
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// OpenClaw 网关管理
// ═══════════════════════════════════════════════════════════════

async function showOpenClawStatus(ctx: any) {
  try {
    const { checkGateway, listPlugins } = await import('@kunlun/subsystems');
    const gw = await checkGateway();
    const plugins = await listPlugins();
    const lines: string[] = [];
    lines.push('╔════════════════════════════════════╗');
    lines.push('║  OpenClaw 网关状态                ║');
    lines.push('╚════════════════════════════════════╝');
    lines.push('');
    lines.push('网关: ' + (gw.running ? '🟢 运行中' : '🔴 未运行'));
    if (gw.url) lines.push('地址: ' + gw.url);
    lines.push('');
    lines.push('插件 (' + plugins.length + '):');
    for (const p of plugins) {
      lines.push('  ' + (p.enabled ? '✅' : '⏸️') + ' ' + p.name + ' v' + p.version);
    }
    lines.push('');
    lines.push('命令:');
    lines.push('  /kunlun openclaw setup  初始化+启动网关');
    lines.push('  /kunlun openclaw weixin  配置微信通道');
    ctx.ui.notify(lines.join('\n'), 'info');
  } catch (e) {
    ctx.ui.notify('❌ 获取状态失败: ' + (e instanceof Error ? e.message : e), 'error');
  }
}

async function setupOpenClawGateway(ctx: any) {
  ctx.ui.setStatus('kunlun', '🚀 初始化 OpenClaw 网关...');
  try {
    const { checkGateway, setupGateway, startGateway } = await import('@kunlun/subsystems');
    const gw = await checkGateway();
    if (gw.running) {
      ctx.ui.notify('🟢 OpenClaw 网关已在运行', 'info');
      return;
    }
    ctx.ui.notify('⏳ 初始化网关配置...', 'info');
    const setupOk = await setupGateway('local');
    if (!setupOk) {
      ctx.ui.notify('❌ 网关初始化失败', 'error');
      return;
    }
    ctx.ui.notify('⏳ 启动网关...', 'info');
    const startOk = await startGateway();
    if (startOk) {
      ctx.ui.notify('✅ OpenClaw 网关已启动', 'info');
    } else {
      ctx.ui.notify('❌ 网关启动失败', 'error');
    }
  } catch (e) {
    ctx.ui.notify('❌ 设置失败: ' + (e instanceof Error ? e.message : e), 'error');
  }
  ctx.ui.setStatus('kunlun', undefined);
}

async function setupWeChatChannel(ctx: any) {
  ctx.ui.setStatus('kunlun', '🚀 配置微信通道...');
  try {
    const { startGateway, addWeChatChannel } = await import('@kunlun/subsystems');
    await startGateway();
    ctx.ui.notify('⏳ 添加微信通道并生成二维码...', 'info');
    const wx = await addWeChatChannel();
    if (wx.success) {
      ctx.ui.notify('✅ 微信通道已配置，请用手机微信扫描二维码登录', 'info');
      if (wx.qrcode) {
        ctx.ui.setWidget('openclaw-weixin', wx.qrcode.split('\n'));
      }
      if (wx.url) {
        ctx.ui.notify('或访问: ' + wx.url, 'info');
      }
    } else {
      ctx.ui.notify('❌ 微信通道配置失败', 'error');
    }
  } catch (e) {
    ctx.ui.notify('❌ 配置失败: ' + (e instanceof Error ? e.message : e), 'error');
  }
  ctx.ui.setStatus('kunlun', undefined);
}

async function runPipeline(query: string, ctx: any, ce: any, se: any, pwe: any) {
  const startTime = Date.now();
  const lines: string[] = [];
  const bridge = detectBridge(query);

  lines.push(`${bridge.icon} 昆仑认知分析报告`);
  lines.push(`## ${query}`);
  lines.push(`${bridge.tone} · 激活桥: ${bridge.name}`);
  lines.push('');
  lines.push(`> 分析开始: ${new Date().toISOString()}`);
  lines.push('');

  // ─── Phase 1: 谛听 ──────────────────────────────────
  ctx.ui.notify('🔍 [谛听] 感知阶段: 收集信息...', 'info');
  lines.push(`🔍 **谛听 — 信息感知**`);
  lines.push('');
  lines.push('```');

  let searchResults: string[] = [];
  try {
    // 用 agent-reach 搜索
    const searchOut = execSync(`agent-reach search "${query}" --json 2>/dev/null`, {
      encoding: 'utf8',
      timeout: 15000,
    }).trim();
    if (searchOut) {
      const parsed = JSON.parse(searchOut);
      if (Array.isArray(parsed)) {
        searchResults = parsed.slice(0, 5).map((r: any) => r.title || r.snippet || '');
      }
      lines.push(`  [联网搜索] ${searchResults.length} 条结果`);
    }
  } catch {
    lines.push('  [联网搜索] 不可用，使用本地知识');
  }

  // 矛盾对提取
  const contradictions = extractContradictions(query);
  lines.push(`  [矛盾对提取] ${contradictions.length} 组`);
  lines.push('```');
  lines.push('');

  // ─── Phase 2: 太一 ──────────────────────────────────
  ctx.ui.notify('🧠 [太一] 认知阶段: 矛盾分析+战略推演...', 'info');
  lines.push(`🧠 **太一 — 认知分析**`);
  lines.push('');

  // 2a: 矛盾分析
  if (contradictions.length > 0) {
    for (const pair of contradictions) {
      const result = ce.analyzeSingle(pair);
      lines.push(`**矛盾对**: ${pair.thesis} vs ${pair.antithesis}`);
      if (result.analysis) {
        const a = result.analysis;
        lines.push(`- 可统一性: ${tritLabel(a.unifiability)}`);
        lines.push(`- 主导方面: ${a.dominantAspect === 1 ? '正题' : a.dominantAspect === -1 ? '反题' : '均势'}`);
        lines.push(`- 矛盾类型: ${a.contradictionType ?? '一般'}`);
      }
      if (result.qualitativeChange) {
        const q = result.qualitativeChange;
        lines.push(`- 质变状态: ${q.approachingThreshold === 1 ? '已质变' : q.approachingThreshold === 0 ? '⚠️接近临界' : '离临界尚远'}`);
      }
      if (result.recommendations?.length) {
        lines.push('- 建议:');
        for (const r of result.recommendations.slice(0, 3)) {
          lines.push(`  · ${typeof r === 'string' ? r : JSON.stringify(r)}`);
        }
      }
      lines.push('');
    }
  }

  // 2b: 持久战策略（如果 query 涉及战略/规划）
  if (matchesStrategy(query)) {
    lines.push(`**持久战策略**`);
    try {
      const pwCtx: any = {
        totalRuntime: 0, currentPhaseDuration: 0,
        phaseHistory: [],
        powerSnapshot: { ourStrength: 0.4, enemyStrength: 0.6 },
        activeContradictions: [],
        spiralMetrics: { cyclesCompleted: 0 },
        criticalEvents: [],
      };
      const phase = await pwe.assessPhase(pwCtx);
      lines.push(`- 当前阶段: ${phaseLabel(phase.currentPhase)}`);
    } catch { /* ignore */ }
    lines.push('');
  }

  // 2c: 实践螺旋（如果 query 涉及迭代/学习/反思）
  if (matchesSpiral(query)) {
    lines.push(`**实践螺旋**`);
    try {
      const practiceCtx: any = {
        domain: query, hypothesis: query,
        environment: { type: 'simulation', constraints: [] },
        relatedContradictions: [],
      };
      const result = await se.engagePractice(practiceCtx);
      lines.push(`- 实践结果: ${result.summary ?? '分析进行中'}`);
    } catch { /* ignore */ }
    lines.push('');
  }

  // 2d: 生态感知（如果 query 涉及系统/生态/架构）
  if (matchesEcosystem(query)) {
    ctx.ui.notify('🔎 [太一] 生态扫描...', 'info');
    lines.push(`**生态感知**`);
    try {
      const sensor = createEcosystemSensor({ timeoutMs: 3000 });
      const scan = await sensor.scanEcosystem();
      lines.push(`- 生态健康: ${tritLabel(scan.ecosystemHealth)}`);
      lines.push(`- 扫描源数: ${scan.stats?.sourcesScanned ?? 0}`);
    } catch { /* ignore */ }
    lines.push('');
  }

  // ─── Phase 3: 天工 — 综合研判 ───────────────────────
  ctx.ui.notify('📝 [天工] 表达阶段: 生成结构报告...', 'info');
  lines.push(`📝 **天工 — 综合研判**`);
  lines.push('');
  lines.push(bridge.separator);
  lines.push('');

  // 摘要
  lines.push('**摘要**');
  lines.push(`对「${query}」进行了多维度认知分析：`);
  const features: string[] = [];
  if (contradictions.length > 0) features.push(`矛盾分析(${contradictions.length}组)`);
  if (matchesStrategy(query)) features.push('持久战策略');
  if (matchesSpiral(query)) features.push('实践螺旋');
  if (matchesEcosystem(query)) features.push('生态感知');
  lines.push(`分析维度: ${features.join(' / ') || '基础认知分析'}`);
  lines.push('');

  // 核心论断
  lines.push(bridge.separator);
  lines.push('**核心论断**');
  if (contradictions.length > 0) {
    const c = contradictions[0];
    const r = ce.analyzeSingle(c);
    if (r.analysis) {
      lines.push(`主要矛盾「${c.thesis} vs ${c.antithesis}」的辩证关系: ${r.analysis.unifiability === 1 ? '可统一' : r.analysis.unifiability === -1 ? '不可调和' : '需更多信息'}`);
      if (r.recommendations?.length) {
        lines.push(`建议: ${typeof r.recommendations[0] === 'string' ? r.recommendations[0] : JSON.stringify(r.recommendations[0])}`);
      }
    }
  } else {
    lines.push(`「${query}」需要进一步分解为可分析的矛盾对以获得深入见解。`);
  }
  lines.push('');

  // 结论
  lines.push(bridge.separator);
  lines.push('**结论**');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  lines.push(`分析完成于 ${elapsed}s，涵盖 ${features.length} 个分析维度。`);
  lines.push('');

  // 质量 & 元信息
  lines.push(`> 昆仑洞天 v7 · ${bridge.name}桥 · 知彼知己，百战不殆。`);

  // ─── 输出 ───
  ctx.ui.notify(`✅ 分析完成 (${elapsed}s)`, 'info');
  ctx.sendMessage({
    customType: 'kunlun-analysis',
    content: lines.join('\n'),
    display: true,
    details: { query, elapsed, features },
  });
}

// ═══════════════════════════════════════════════════════════════
// 11桥检测（移植自 v6 天工）
// ═══════════════════════════════════════════════════════════════

const BRIDGES: Record<string, { icon: string; name: string; tone: string; separator: string; keywords: string[] }> = {
  Q02: { icon: '📊', name: '社会科学', tone: '数据驱动·逻辑严密', separator: '————————————————————', keywords: ['经济', '社会', '政策', '市场', '数据', '趋势', '分析'] },
  Q04: { icon: '🔷', name: '系统科学', tone: '结构化·层次分明', separator: '┌──────────────┐', keywords: ['系统', '架构', '生态', '结构', '组织', '复杂'] },
  Q03: { icon: '📐', name: '数学科学', tone: '量化·精确', separator: '· · · · · · · · · ·', keywords: ['量化', '计算', '算法', '模型', '指标'] },
  Q01: { icon: '🔬', name: '自然科学', tone: '实验证据·可重复', separator: '──────────────', keywords: ['物理', '化学', '生物', '实验', '科学'] },
  Q05: { icon: '🧠', name: '思维科学', tone: '认知分析·逻辑链', separator: '→ → → → → → →', keywords: ['思维', '认知', '逻辑', '推理', '哲学'] },
  Q08: { icon: '⚔️', name: '军事科学', tone: '战略分层·结论干脆', separator: '▬▬▬▬▬▬▬▬▬▬', keywords: ['战略', '竞争', '对抗', '策略', '持久战'] },
  Q11: { icon: '🏗️', name: '建筑科学', tone: '蓝图式·模块化', separator: '┊ ┊ ┊ ┊ ┊ ┊ ┊ ┊', keywords: ['设计', '架构', '工程', '构建', '实现'] },
};

function detectBridge(query: string): { icon: string; name: string; tone: string; separator: string } {
  const q = query.toLowerCase();
  let best = BRIDGES.Q04; // 默认系统科学
  let maxScore = 0;
  for (const b of Object.values(BRIDGES)) {
    const score = b.keywords.filter(k => q.includes(k)).length;
    if (score > maxScore) { maxScore = score; best = b; }
  }
  return best;
}

function extractContradictions(query: string): any[] {
  const pair = (t: string, a: string) => ({ thesis: t as any, antithesis: a as any });
  const pairs: any[] = [];

  // 匹配 "A vs B", "A 和 B 的矛盾", "A 与 B"
  const vsMatch = query.match(/(.+?)\s+(?:vs|VS|和|与|跟)\s+(.+?)(?:\s+的[矛盾冲突]|$|[，。])/);
  if (vsMatch) {
    pairs.push(pair(vsMatch[1]!.trim(), vsMatch[2]!.trim()));
    return pairs;
  }

  // 常见矛盾模式
  const patterns: [RegExp, string, string][] = [
    [/(?:既要|既要).*?(.+?).*?(?:又要|也要).*?(.+?)(?:$|[，。])/g, '', ''],
    [/(.+?)但(?:是)?(.+?)(?:$|[，。])/g, '', ''],
  ];

  // 通用矛盾对：如果 query 包含对比词
  const conflictWords = ['矛盾', '冲突', '两难', '权衡', '取舍', '困境', 'vs'];
  if (conflictWords.some(w => query.includes(w))) {
    // 尝试提取正反两面
    if (query.includes('性能') && query.includes('成本')) {
      pairs.push(pair('追求性能', '控制成本'));
    }
    if (query.includes('效率') && query.includes('质量')) {
      pairs.push(pair('提高效率', '保证质量'));
    }
    if (query.includes('创新') && query.includes('稳定')) {
      pairs.push(pair('鼓励创新', '保持稳定'));
    }
    if (query.includes('快') && query.includes('好')) {
      pairs.push(pair('快速交付', '高质量完成'));
    }
    if (query.includes('安全') && query.includes('便捷')) {
      pairs.push(pair('安全性', '便捷性'));
    }
    if (query.includes('开放') && query.includes('控制')) {
      pairs.push(pair('开放生态', '有效管控'));
    }
  }

  // 兜底
  if (pairs.length === 0) {
    pairs.push(pair(query, `${query}的反面/替代方案`));
  }

  return pairs;
}

function matchesStrategy(query: string): boolean {
  return /战略|规划|计划|持久战|阶段|发展|转型|升级/.test(query);
}

function matchesSpiral(query: string): boolean {
  return /学习|反思|迭代|改进|优化|复盘|实践/.test(query);
}

function matchesEcosystem(query: string): boolean {
  return /生态|系统|架构|平台|开源|插件|扩展|MCP/.test(query);
}

// ═══════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════

function showHelp(ctx: any) {
  ctx.ui.notify([
    '╔═══════════════════════════════════════════════╗',
    '║     Pi-昆仑 V7 · 认知分析管线                ║',
    '║     替代昆仑洞天 v6，全面升级                 ║',
    '╚═══════════════════════════════════════════════╝',
    '',
    '📋 命令:',
    '  /kunlun analyze <查询>   全链路分析',
    '  /kunlun <查询>           同上（简写）',
    '  /kunlun help             显示此帮助',
    '',
    '🔧 可用工具（对话中自然调用）:',
    '  analyze_contradiction  — 矛盾分析引擎',
    '  plan_strategy          — 持久战策略',
    '  run_spiral             — 实践螺旋',
    '  scan_ecosystem         — 生态感知',
    '  mcp_manage             — MCP 网关管理',
    '  openclaw_plugins       — OpenClaw 插件管理',
    '',
    '⚡ 示例:',
    '  /kunlun 分析一下这个架构的性能和可维护性矛盾',
    '  /kunlun a 这个项目应该优先做什么',
  ].join('\n'), 'info');
}

function tritLabel(t: any): string {
  if (t === 1 || t === T_TRUE) return '+1 (确认 ✅)';
  if (t === -1 || t === T_FALSE) return '-1 (否定 ❌)';
  return '0 (未知 ⚪)';
}

function phaseLabel(p: string): string {
  return p === 'defense' ? '🛡️ 防御阶段' : p === 'stalemate' ? '⚔️ 相持阶段' : '⚡ 反攻阶段';
}

// ═══════════════════════════════════════════════════════════════
// 镇熵：路由决策（取代零散 if-else）
// ═══════════════════════════════════════════════════════════════

/**
 * 基于上下文快速决定要运行的认知模块
 * 替代原有的零散 matchesStrategy() / matchesSpiral() 调用
 */
function decideCognitiveModules(ctx: Record<string, string>): {
  contradiction: boolean;
  strategy: boolean;
  spiral: boolean;
  ecosystem: boolean;
} {
  return {
    contradiction: ctx.has_contradiction === 'true',
    strategy: ctx.has_strategy === 'true' || ctx.has_contradiction === 'true',
    spiral: ctx.has_spiral === 'true' || ctx.has_contradiction === 'true',
    ecosystem: ctx.has_ecosystem === 'true' || parseInt(ctx.tool_count || '0') > 5,
  };
}
