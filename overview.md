# KunlunOS 微内核利用率优化 — v4 迭代总结

## 改了什么

### 1. 并发控制 (ConcurrencyController)
- **文件**: `packages/kunlun-os-core/src/optimizations.ts`
- 新增 `ConcurrencyController` 类：Promise 信号量模式
- 防止 Map 阶段子任务数 > Worker 数时，同时发起过多 LLM 请求
- `mapReduce` 新增 `options.maxConcurrency` 参数，默认 = workers 数量
- 返回 `concurrencyStats`（max/peak/avgWaiters）方便监控

### 2. 流式增量 Reduce (StreamReduceCollector v2)
- **文件**: `packages/kunlun-os-core/src/optimizations.ts`
- `StreamReduceCollector` 新增 `setPartialResultCallback()` 方法
- 每完成一个 Worker 立即触发回调，而非等全部完成
- 新增 `getPartialResults()` 获取当前快照
- 新增 `completedIndices` 属性追踪完成进度

### 3. 跨 Worker 知识传递（mapReduce 核心改进）
- **文件**: `packages/kunlun-os-core/src/multi-kernel.ts` → v3 → v4
- `mapReduce` 新增 `options.partialReduce`（默认 `true`）
- Worker 完成后立即通过 `StreamReduceCollector.onPartialResult` 发布洞察到共享层
- 后续 Worker 在 `acquire()` 槽位后，自动从共享层获取已完成的洞察并注入 prompt
- 实现了真正的跨核知识传递：先完成的分析结果直接提升后完成的分析质量

## 架构变化

```
v3: subTasks.map(fn) → Promise.all → 全部并发 → collector.waitAll → Reduce

v4: subTasks.map(fn) → ConcurrencyController.acquire()
     │                    ├─ 获取共享洞察(partialReduce)
     │                    ├─ Worker执行
     │                    ├─ collector.collect → onPartialResult → publishWorkerResult
     │                    └─ ConcurrencyController.release()
     └─ collector.waitAll → Reduce（上下文已预构建）
```

## 测试结果

- **新增测试**: 6 项（ConcurrencyController x3 + StreamReduceCollector x2 + 增量Reduce x1）
- **全量测试**: 879 tests / 36 files 全部通过
- **构建**: 核心代码零类型错误（fork 的 `agent-harness.ts` 有预存类型问题，与此无关）

## 收益量化

| 指标 | v3 | v4 | 提升 |
|------|----|----|------|
| 并发控制 | 无（全部同时发） | 信号量限流 | 防止 LLM 过载 |
| 流式Reduce | 等全部完成再汇总 | 完成即注入 | Reduce 上下文预构建 |
| 跨核知识传递 | 仅 Reduce 阶段可见 | Map 阶段实时共享 | 后完成 Worker 可参考先完成结果 |
| 可观测性 | 仅 elapsed | + concurrencyStats | 峰值/平均排队可监控 |
