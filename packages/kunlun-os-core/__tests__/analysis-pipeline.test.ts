/**
 * 昆仑OS 分析效果测试
 */
import { describe, it } from 'vitest';
import { KunlunOS } from '../src/kunlun-os.js';

const queries = [
  '性能和成本如何权衡',
  '项目发展战略规划',
  '微服务架构 vs 单体架构的取舍',
  'AI安全与效率的矛盾',
  '企业数字化转型的挑战',
];

describe('昆仑OS 认知分析管线', () => {
  let os: KunlunOS;

  beforeAll(async () => {
    os = new KunlunOS({ verbose: false });
    await os.start();
  });

  afterAll(() => {
    os.stop();
  });

  for (const query of queries) {
    it(`分析: ${query}`, async () => {
      const analysis = await os.injectCognition(
        [{ role: 'user', content: query }],
        'You are a helpful assistant.',
      );

      console.log('\n' + '='.repeat(70));
      console.log(`📝 查询: ${query}`);
      console.log('='.repeat(70));

      // 十一桥路由
      if (analysis.bridge) {
        console.log(`📍 桥: ${analysis.bridge.icon} ${analysis.bridge.name} (${analysis.bridge.id})`);
        console.log(`   公理: ${analysis.bridge.axiom}`);
      }

      // 知识卡片
      const cards = analysis.knowledgeCards || [];
      if (cards.length > 0) {
        console.log(`📚 知识卡片 (${cards.length}):`);
        for (const c of cards) {
          console.log(`   ${c.id} [${c.type}] ${c.title}`);
        }
      }

      // 矛盾感知
      console.log(`⚡ 矛盾: ${analysis.contradictions.length}组`);
      for (const c of analysis.contradictions) {
        console.log(`   ${c.thesis} ↔ ${c.antithesis}`);
      }

      const unifLabel = analysis.unifiability === 1 ? '✅ 可统一' : analysis.unifiability === -1 ? '❌ 不可调和' : '⚪ 待分析';
      console.log(`🔗 可统一性: ${unifLabel}`);

      const aspectLabel = analysis.dominantAspect === 1 ? '正题主导' : analysis.dominantAspect === -1 ? '反题主导' : '均势';
      console.log(`⚖️  主导方面: ${aspectLabel}`);

      // 综合集成
      if (analysis.synthesis) {
        console.log(`🧠 综合集成: ${analysis.synthesis.stance} (置信度: ${analysis.synthesis.confidence})`);
      }

      // 天工渲染
      if (analysis.rendered) {
        console.log(`🎨 天工信度: ${analysis.rendered.overallConfidence}`);
        console.log(`   ${analysis.rendered.summary}`);
      }

      // 策略
      if (analysis.strategy) {
        console.log(`🎯 策略: ${analysis.strategy}`);
      }

      console.log(`📋 摘要: ${analysis.summary}`);

      // 验证基本输出
      expect(analysis.bridge).toBeDefined();
      expect(analysis.summary).toBeDefined();
      expect(analysis.promptInjection).toBeDefined();
      expect(analysis.promptInjection.length).toBeGreaterThan(0);

      console.log('\n--- Prompt注入 ---');
      console.log(analysis.promptInjection);
    });
  }
});
