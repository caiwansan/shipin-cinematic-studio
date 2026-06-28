# Runtime Observability Kernel

## 定位

这是 video-runtime v2 的 **观测入口统一层**。

不是新系统、不是新存储、不是新 DB 表。  
是**一个 facade**，把现有的 3 个观测通道桥接到统一的 interface 背后。

## 架构

```
Pipeline (CinematicVideoPipeline)
         │
         ▼
  RuntimeObservability (interface)
         │
         ▼
  RuntimeObservabilityImpl (bridge)
      ├────┬────┬────┐
      │    │    │    │
      ▼    ▼    ▼    ▼
   metrics  trace  trace.service  collector
   (滑动窗口) (span)  (时序步)     (1s 采样持久化)
```

## 设计原则

1. **Pipeline 零感知底层** — 只依赖 `RuntimeObservability` interface
2. **不新增存储** — 全部桥接到已有通道
3. **非阻塞** — 所有 record 调用都是 sync write to memory / fire-and-forget
4. **TraceCtx 是唯一钥匙** — 所有记录都带 (traceId, pipelineId, userId, projectId)

## 文件

| 文件 | 职责 |
|------|------|
| `types.ts` | Contract interface + 所有事件类型定义 |
| `index.ts` | Bridge 实现 + 全局单例 |

## TraceCtx 字段说明

- `traceId` — 全链路唯一 ID，创建于 pipeline 入口，贯穿所有步骤
- `pipelineId` — Pipeline 执行 ID
- `userId` / `projectId` — 业务维度

## 事件流

所有记录都通过 `RuntimeEvent` 统一事件模型触发，支持 `subscribeRuntimeEvents()` 订阅。
未来 timeline replay 或 flame graph 可视化就消费这个事件流。

## 已有通道映射

| Contract 方法 | observability/metrics | observability/trace | execution-trace/trace.service |
|---|---|---|---|
| recordMemorySample | ✔ recordRequest | ✔ addSpan | ✔ addStep |
| recordTempStorage | ✔ recordRequest | ✔ addSpan | ✔ addStep |
| recordFrameGenerated | ✔ recordRequest(provider) | ✔ addSpan(duration) | ✔ addStep |
| recordPartialSuccess | ✔ recordRequest | ✔ completeTrace | ✔ finishTrace/failTrace |
| recordFFmpegEvent | ✔ recordRequest(ffmpeg) | ✔ addSpan | ✔ addStep |

## 使用方式

```ts
import { runtimeObservability } from '../runtime-observability/index.js'
import type { TraceCtx } from '../runtime-observability/types.js'

const ctx: TraceCtx = {
  traceId,
  userId,
  projectId,
  pipelineId,
}

// 内存采样
runtimeObservability.recordMemorySample({
  phase: 'frame_gen',
  heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
  rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
  externalMb: Math.round(process.memoryUsage().external / 1024 / 1024),
}, ctx)

// 帧生成结果
runtimeObservability.recordFrameGenerated({
  frameIndex: 3,
  durationMs: 2500,
  success: true,
  provider: 'openai',
  model: 'dall-e-3',
  retryCount: 0,
}, ctx)

// Partial success
runtimeObservability.recordPartialSuccess({
  succeeded: 6,
  total: 8,
  succeededRatio: '6/8',
  failedIndices: [2, 5],
}, ctx)
```

## 与现有系统关系

| 系统 | 关系 |
|------|------|
| `video-runtime/runtime-metrics.ts` | ⚠️ 将被替代。新代码使用 `runtimeObservability` |
| `observability/metrics.ts` | ✅ 底层通道，保持不变 |
| `observability/trace.ts` | ✅ 底层通道，保持不变 |
| `execution-trace/trace.service.ts` | ✅ 底层通道，保持不变 |
| `observability/collector.ts` | ✅ 独立采集管道，不受影响 |
