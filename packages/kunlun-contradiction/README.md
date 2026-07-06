# @kunlun/contradiction

矛盾分析引擎 — 基于矛盾论的认知分析系统（L5 层）。

集成 8 个分析器，提供综合性的矛盾分析管线，识别对立面、推导统一条件、预测矛盾转化。

## 分析管线

```
输入 → 主矛盾定位 → 逐对分析 → 矛盾链分析 → 综合输出
         ↓              ↓
    PrincipalContradiction  AspectAnalyzer (矛盾方面)
                           UnityDeriver (对立统一)
                           QualitativeChangeDetector (量变质变)
                           NegationDetector (否定之否定)
                           TransformationPredictor (矛盾转化)
                           UnificationConditionsDeriver (统一条件)
```

## 安装

```bash
pnpm add @kunlun/contradiction
```

## 用法

```typescript
import { createContradictionEngine } from '@kunlun/contradiction';

const engine = createContradictionEngine();

const result = engine.analyzeSingle({
  thesis: '追求性能',
  antithesis: '保证成本',
  context: '系统架构设计中的经典权衡',
});

console.log(result.aspectAnalysis);
// { principalAspect: '性能', secondaryAspect: '成本', ... }

console.log(result.unityDerivation);
// 对立面在什么条件下可以统一

console.log(result.transformationPrediction);
// 矛盾可能如何转化
```

## 分析器

| 分析器 | 功能 |
|--------|------|
| `PrincipalContradictionLocator` | 从多组矛盾中定位主要矛盾 |
| `AspectAnalyzer` | 分析矛盾的主要方面和次要方面 |
| `UnityDeriver` | 推导对立面的统一条件 |
| `QualitativeChangeDetector` | 检测量变到质变的临界点 |
| `NegationDetector` | 检测否定之否定规律 |
| `TransformationPredictor` | 预测矛盾的转化方向 |
| `UnificationConditionsDeriver` | 推导矛盾统一的具体条件 |
| `ContradictionChainAnalyzer` | 分析多个矛盾之间的链式关系 |

## API

- `createContradictionEngine(config?)` — 创建矛盾分析引擎实例
- `engine.analyzeSingle(contradiction, history?)` — 分析单个矛盾对
- `engine.analyzeMultiple(contradictions, histories?)` — 批量分析
- `engine.getConfig()` / `engine.updateConfig(partial)` — 配置管理

## 测试

```bash
pnpm test
```

## 许可证

MIT
