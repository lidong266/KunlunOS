# Pi-Kunlun v0.9.1 — 共享认知层 v2 改进

## 完成内容

### 1. 共享认知层 v2 重写 (`shared-layer.ts`: 582行)

**PromptNormalizer — 语义规范化引擎**
- 中英文停用词库（120+词）+ 标点统一化
- Jaccard token-overlap 相似度计算
- cacheKey() 生成规范化的缓存键

**LLMResponseCache — LRU + TTL 双向淘汰**
- 替换脆弱的 substring hash → PromptNormalizer 语义规范化
- LRU 淘汰（Map insertion-order）+ TTL 过期（默认 5min）
- 详细 CacheStats：hits/misses/hitRate/evictions/tokensSaved/fuzzyHits

**AnalysisCache — 精确 + 模糊匹配**
- 先精确 key 匹配，再 Jaccard 模糊匹配（阈值 0.5）
- "性能vs成本" ≈ "性能和成本的权衡" → 模糊命中
- 上限 200 条目，超出自动淘汰最旧

**缓存预热**
- `warmAnalysisCache()` / `warmLLMCache()` 预设高频查询模式
- 确保首次 deepAnalyze 调用即命中

### 2. 跨 Worker 知识共享 (`multi-kernel.ts`)

**Worker 结果发布到共享层**
- Map 阶段每个 Worker 完成后调用 `shared.publishWorkerResult()`
- 自动去重（同 workerId+query 只保留最新）
- 上限 50 条，超出淘汰最旧

**Reduce 阶段共享洞察注入**
- `getSharedInsights(query, 3)` 按语义相关性排序
- 将先完成 Worker 的关键发现注入 Reduce prompt

**关键发现提取**
- `extractKeyFindings()` 按句式优先级提取（"关键"/"核心"/"发现" 优先）

### 3. 成本收益

| 场景 | 改进前 | 改进后 | 节省 |
|------|--------|--------|------|
| N 个 Pi 并行 context | N × 2000 tokens | 1 × 2000 + N × 500 | (N-1) × 1500 tokens |
| 相似查询 LLM 调用 | 每次完整调用 | 模糊缓存命中 | 100% |
| 相同 prompt 重复调用 | 无缓存 | LRU 精确命中 | 100% |

## 验证结果

| 指标 | 结果 |
|------|------|
| 测试 | **874 tests / 36 files** 全部通过 ✅ |
| 构建 | 19 个包全部成功 |
| 回归 | 零回归 |

## 变更文件

- `packages/kunlun-os-core/src/shared-layer.ts` — 重写 (582行)
- `packages/kunlun-os-core/src/multi-kernel.ts` — Worker 发布 + 共享洞察 + extractKeyFindings
- `packages/kunlun-os-core/__tests__/multi-kernel-efficiency.test.ts` — API 适配
