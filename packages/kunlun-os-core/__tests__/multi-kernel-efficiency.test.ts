/**
 * 昆仑OS 多Pi架构效率测试
 * 测试共享层、工具去重、预取、缓存——不依赖真实LLM
 */
import { describe, it, expect } from 'vitest';
import { SharedCognitiveLayer, LLMResponseCache } from '../src/shared-layer.js';
import { CognitivePrefetcher, ToolDeduplicator, StreamReduceCollector, ConcurrencyController } from '../src/optimizations.js';

describe('多Pi架构效率测试', () => {
  // ═══════════════════════════════════════════════════════════
  // 共享认知层
  // ═══════════════════════════════════════════════════════════
  describe('SharedCognitiveLayer', () => {
    it('TokenManager 三池独立运作', () => {
      const layer = new SharedCognitiveLayer();
      const usage = layer.getTokenUsage();
      expect(usage.llm.total).toBe(128000);
      expect(usage.cache.total).toBe(50000);
      expect(usage.knowledge.total).toBe(100000);
    });

    it('分析缓存写入和命中', () => {
      const layer = new SharedCognitiveLayer();
      layer.cacheAnalysis('测试问题', { summary: 'test', contradictions: [] } as any);
      expect(layer.getCachedAnalysis('测试问题')).toBeDefined();
      expect(layer.getCachedAnalysis('不存在')).toBeUndefined();
    });

    it('分析缓存第二次命中（模拟deepAnalyze第二次调用）', () => {
      const layer = new SharedCognitiveLayer();
      layer.cacheAnalysis('性能和成本如何权衡', { summary: 's1' } as any);
      layer.cacheAnalysis('项目发展战略规划', { summary: 's2' } as any);

      expect(layer.getCachedAnalysis('性能和成本如何权衡')).toBeDefined();
      expect(layer.getCachedAnalysis('项目发展战略规划')).toBeDefined();

      const stats = layer.getStats();
      console.log(`  分析缓存: ${stats.analysisCache} 条目`);
      expect(stats.analysisCache).toBe(2);
    });

    it('记忆存储和查询', () => {
      const layer = new SharedCognitiveLayer();
      layer.writeMemory('这是关于性能优化的记忆');
      layer.writeMemory('这是关于成本控制的记忆');

      const results = layer.queryMemory('性能');
      expect(results.length).toBeGreaterThan(0);
      expect(layer.getStats().memories).toBeGreaterThanOrEqual(2);
    });

    it('LLM缓存命中节省Token', () => {
      const layer = new SharedCognitiveLayer();
      layer.cacheResponse('分析性能问题', '性能分析结果...', 500);
      layer.cacheResponse('分析成本问题', '成本分析结果...', 400);

      // 缓存命中
      const hit = layer.getCachedResponse('分析性能问题');
      expect(hit).toBe('性能分析结果...');

      // 未命中
      const miss = layer.getCachedResponse('分析安全问题');
      expect(miss).toBeNull();

      const stats = layer.llmCache.getStats();
      console.log(`  缓存条目: ${stats.entries}, 命中: ${stats.hits}`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 工具去重
  // ═══════════════════════════════════════════════════════════
  describe('ToolDeduplicator', () => {
    it('3个并发相同调用 → 只执行1次', async () => {
      const dedup = new ToolDeduplicator();
      let callCount = 0;
      const exec = async () => { callCount++; await new Promise(r => setTimeout(r, 10)); return 'result'; };

      await Promise.all([
        dedup.execute('read_file', { path: '/a.txt' }, exec),
        dedup.execute('read_file', { path: '/a.txt' }, exec),
        dedup.execute('read_file', { path: '/a.txt' }, exec),
      ]);

      expect(callCount).toBe(1); // 去重生效！
      console.log(`  3并发相同调用 → 实际执行 ${callCount} 次 (节省 67%)`);
    });

    it('3个不同调用 → 各执行1次', async () => {
      const dedup = new ToolDeduplicator();
      let callCount = 0;
      const exec = async () => { callCount++; return 'result'; };

      await Promise.all([
        dedup.execute('read_file', { path: '/a.txt' }, exec),
        dedup.execute('read_file', { path: '/b.txt' }, exec),
        dedup.execute('search', { query: 'test' }, exec),
      ]);

      expect(callCount).toBe(3);
    });

    it('缓存TTL内命中', async () => {
      const dedup = new ToolDeduplicator(1000);
      let callCount = 0;
      const exec = async () => { callCount++; return 'result'; };

      await dedup.execute('read_file', { path: '/x.txt' }, exec);
      const cached = await dedup.execute('read_file', { path: '/x.txt' }, exec);

      expect(cached).toBe('result');
      expect(callCount).toBe(1); // 缓存命中
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 认知预取
  // ═══════════════════════════════════════════════════════════
  describe('CognitivePrefetcher', () => {
    it('从分析结果构建预取上下文', () => {
      const shared = new SharedCognitiveLayer();
      shared.writeMemory('相关记忆内容1');
      shared.writeMemory('相关记忆内容2');

      const prefetcher = new CognitivePrefetcher(shared);
      const ctx = prefetcher.buildPrefetchContext('测试', {
        summary: '测试摘要',
        knowledgeCards: [{ id: 'AX-001', title: '', type: 'AX' }],
        contradictions: [],
        promptInjection: '',
        unifiability: 0, dominantAspect: 0, qualitativeState: -1,
      });

      expect(ctx.summary).toBe('测试摘要');
      expect(ctx.cardIds).toContain('AX-001');
    });

    it('格式化预取prompt包含所有关键信息', () => {
      const shared = new SharedCognitiveLayer();
      const prefetcher = new CognitivePrefetcher(shared);

      const prompt = prefetcher.formatPrefetchPrompt({
        summary: '分析发现3组矛盾',
        filePaths: [],
        cardIds: ['AX-001', 'SC-001', 'TC-001'],
        memoryIds: ['mem-1', 'mem-2'],
      });

      expect(prompt).toContain('共享认知上下文');
      expect(prompt).toContain('分析发现3组矛盾');
      expect(prompt).toContain('AX-001');
      expect(prompt).toContain('SC-001');
      expect(prompt).toContain('TC-001');
      expect(prompt).toContain('共享记忆');
      expect(prompt).toContain('知识卡片');
      console.log(`\n预取Prompt长度: ${prompt.length} 字符`);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 流式Reduce
  // ═══════════════════════════════════════════════════════════
  describe('StreamReduceCollector', () => {
    it('按序收集3个结果', async () => {
      const completed: number[] = [];
      const collector = new StreamReduceCollector(3, (done, total) => {
        completed.push(done);
      });

      // 模拟乱序到达
      collector.collect(2, 'result-3');
      collector.collect(0, 'result-1');
      collector.collect(1, 'result-2');

      const results = await collector.waitAll();
      expect(results).toEqual(['result-1', 'result-2', 'result-3']);
      expect(completed).toEqual([1, 2, 3]);
      console.log(`  流式收集完成顺序: ${completed.join(' → ')}`);
    });

    it('增量Reduce回调：每完成一个Worker就触发onPartialResult', async () => {
      const partialResults: Array<{ index: number; text: string }> = [];

      const collector = new StreamReduceCollector(3)
        .setPartialResultCallback((_done, _total, result, index, allResults) => {
          partialResults.push({ index, text: result });
        });

      collector.collect(2, 'C');
      collector.collect(0, 'A');
      collector.collect(1, 'B');

      expect(partialResults.length).toBe(3);
      expect(partialResults[0]).toEqual({ index: 2, text: 'C' });
      expect(partialResults[1]).toEqual({ index: 0, text: 'A' });
      expect(partialResults[2]).toEqual({ index: 1, text: 'B' });
    });

    it('getPartialResults 返回当前快照（未完成的为空串）', async () => {
      const collector = new StreamReduceCollector(4)
        .setPartialResultCallback(() => {});

      collector.collect(0, 'A');
      collector.collect(2, 'C');

      const snapshot = collector.getPartialResults();
      expect(snapshot).toEqual(['A', '', 'C', '']);
      expect(collector.completedIndices).toEqual(new Set([0, 2]));
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 并发控制
  // ═══════════════════════════════════════════════════════════
  describe('ConcurrencyController', () => {
    it('限制并发：max=2，5个任务 → 同时最多2个运行', async () => {
      const ctrl = new ConcurrencyController(2);
      let peak = 0;
      let running = 0;

      const task = async () => {
        running++;
        peak = Math.max(peak, running);
        await new Promise(r => setTimeout(r, 10));
        running--;
      };

      const tasks = Array.from({ length: 5 }, async () => {
        await ctrl.acquire();
        try {
          await task();
        } finally {
          ctrl.release();
        }
      });

      await Promise.all(tasks);
      expect(peak).toBe(2); // 最多2个并发
      console.log(`  5任务/max=2 → 峰值并发 ${peak} | 平均等待 ${ctrl.waiting > 0 ? 'yes' : 'no'}`);
    });

    it('maxConcurrency=3 时同时最多3个运行', async () => {
      const ctrl = new ConcurrencyController(3);
      let peak = 0;
      let running = 0;

      const tasks = Array.from({ length: 6 }, async () => {
        await ctrl.acquire();
        try {
          running++;
          peak = Math.max(peak, running);
          await new Promise(r => setTimeout(r, 5));
          running--;
        } finally {
          ctrl.release();
        }
      });

      await Promise.all(tasks);
      expect(peak).toBeLessThanOrEqual(3);
      console.log(`  6任务/max=3 → 峰值并发 ${peak}`);
    });

    it('active/waiting 状态正确追踪', async () => {
      const ctrl = new ConcurrencyController(1);
      expect(ctrl.active).toBe(0);
      expect(ctrl.waiting).toBe(0);

      // 获取槽位
      const p1 = ctrl.acquire();
      expect(ctrl.active).toBe(1);

      // 第二个请求应该排队
      const p2Promise = ctrl.acquire();

      // 让事件循环跑一下
      await new Promise(r => setTimeout(r, 5));

      expect(ctrl.active).toBe(1);
      expect(ctrl.waiting).toBe(1);

      await p1;
      ctrl.release();

      // 等待 p2 被唤醒
      await new Promise(r => setTimeout(r, 10));
      expect(ctrl.active).toBe(1);
      expect(ctrl.waiting).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // 综合效率统计
  // ═══════════════════════════════════════════════════════════
  describe('综合效率', () => {
    it('全栈效率报告', () => {
      const shared = new SharedCognitiveLayer();
      const prefetcher = new CognitivePrefetcher(shared);
      const dedup = new ToolDeduplicator();

      // 模拟一次完整 deepAnalyze 的资源使用
      shared.cacheAnalysis('测试问题', { summary: 's' } as any);
      shared.cacheResponse('prompt1', 'resp1', 500);
      const cached = shared.getCachedResponse('prompt1'); // 真正取缓存 → 命中+1
      expect(cached).toBe('resp1');
      shared.writeMemory('分析记忆');

      const stats = shared.getStats();

      console.log('\n═══════════════════════════════════════');
      console.log('  昆仑OS 多Pi架构效率报告');
      console.log('═══════════════════════════════════════');
      console.log(`  Token池: llm=${stats.tokens.llm.used ?? 0}/${stats.tokens.llm.total ?? 0} | cache=${stats.tokens.cache.used ?? 0}/${stats.tokens.cache.total ?? 0}`);
      console.log(`  LLM缓存: ${stats.llmCache.entries}条目 | ${stats.llmCache.hits}次命中 | 命中率${stats.llmCache.hitRate}%`);
      console.log(`  记忆条目: ${stats.memories}`);
      console.log(`  分析缓存: ${stats.analysisCache} | 命中率${stats.analysisHitRate}% | 模糊命中${stats.analysisFuzzyHits}`);
      console.log(`  Worker洞察: ${stats.sharedInsights}条`);
      console.log(`  工具去重: ${dedup.getStats().pendingCalls}进行中 | ${dedup.getStats().cachedResults}已缓存`);
      console.log('═══════════════════════════════════════');

      expect(stats.llmCache.hits).toBeGreaterThanOrEqual(1);
      expect(stats.analysisCache).toBeGreaterThanOrEqual(1);
      expect(stats.memories).toBeGreaterThanOrEqual(1);
    });
  });
});
