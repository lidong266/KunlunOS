# @kunlun/ternary

三进制类型系统 — Pi-Kunlun 的数学底座（L0 层）。

提供三值逻辑（+1/0/-1）的类型定义、运算、状态机和决策树，作为整个认知基础设施的数学基础。

## 核心概念

| 值 | 常量 | 语义 |
|----|------|------|
| `1` | `T_TRUE` | 真 / 确认 / 强化 / 肯定 |
| `0` | `T_UNKNOWN` | 未知 / 待验证 / 中立 |
| `-1` | `T_FALSE` | 假 / 否定 / 消退 / 反对 |

## 安装

```bash
pnpm add @kunlun/ternary
```

## 用法

```typescript
import { T_TRUE, T_UNKNOWN, T_FALSE, tritFromBoolean, K3, TernaryLogic } from '@kunlun/ternary';

// 基本转换
tritFromBoolean(true);   // 1
tritFromBoolean(false);  // -1 (注意：不是 0)

// K3 运算（三进制数学）
K3.add(1, 1);     // 2
K3.sign(-5);      // -1
K3.clamp(5);      // 1

// 三元逻辑
TernaryLogic.and(1, 0);   // 0
TernaryLogic.or(-1, 1);   // 1
TernaryLogic.not(0);      // 0
```

## API

- `Trit` — 三进制基本类型 (`1 | 0 | -1`)
- `Tryte` — 三进制字节（3 个 Trit）
- `K3` — K3 运算器（add / sign / abs / clamp）
- `TernaryLogic` — 三值逻辑门（and / or / not / xor）
- `TernaryStateMachine` — 三态状态机
- `TernaryComparator` — 三值比较器（返回 Trit）
- `TernaryDecisionTree` — 三叉决策树
- `TernaryIndex` — 三值索引

## 测试

```bash
pnpm test  # 8 test files, 全部通过
```

## 许可证

MIT
