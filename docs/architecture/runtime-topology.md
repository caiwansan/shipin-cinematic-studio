# Runtime Topology — 执行路径拓扑图

**生成日期**: 2026-05-30  
**状态**: DRAFT — 初步扫描，待团队补全  

**目标**: 列出系统中所有 execution entry point、dispatch point、retry path、queue writer、runtime mutation source 和 frontend runtime source。找出真正的 Runtime Authority。

---

## 一、Execution Entry Points（执行入口）

| # | 入口 | 文件路径 | 触发方式 | 创建的任务类型 |
|---|------|----------|----------|---------------|
| 1 | `/api/tasks/ai-generate` | `routes/tasks.ts` | HTTP POST | TaskModel（间接创建 VideoTask/PipelineJob） |
| 2 | `/api/images` | `routes/images.ts` | HTTP POST | Image generation task |
| 3 | `/api/videos` | `routes/videos.ts` | HTTP POST | Video generation task |
| 4 | BullMQ Queue Handler | `queue/queue-manager.ts` | Worker callback | VideoTask / storyboard generation |
| 5 | Scheduler tick | `scheduler/graph-scheduler.ts` | Timer tick | Job dispatch via scheduler |
| 6 | Worker runtime | `queue/worker-runtime.ts` | Queue consumer | Task execution |
| 7 | Agent execution | `agents/*.ts` | Direct call | AgentDef/AgentExecution create |
| 8 | Pipeline Job consume | 后端 routes 间接 | HTTP trigger | PipelineJob create/dispatch |
| 9 | Job Queue consumer | `queue/bull queue` | Redis consumer | Job consume/retry |

**问题**: 至少有 **9 个独立的 execution entry point**，没有统一的入口路由。

---

## 二、Dispatch Points（调度点）

| # | 点 | 位置 | 目标 | 方式 |
|---|----|------|------|------|
| D1 | `capability-dispatcher.ts` | `queue/` | 模型适配器 | 根据 capability 路由 |
| D2 | `resource-router.ts` | `scheduler/` | Worker | 资源分配 |
| D3 | `graph-scheduler.ts` | `scheduler/` | Graph 节点 | DAG 调度 |
| D4 | `agent-pool.ts` | `scheduler/` | Agent 实例 | Agent 调度 |
| D5 | `queue-manager.ts` | `queue/` | BullMQ | 队列调度 |
| D6 | provider resolver | `runtime-provider-resolver.ts` | Provider 适配器 | 根据 provider 路由 |
| D7 | `aggregation-layer.ts` | `scheduler/` | 聚合层 | 结果聚合与排序 |

---

## 三、Retry Paths（重试路径）

| # | 重试逻辑 | 位置 | 策略 |
|---|---------|------|------|
| R1 | BullMQ 内置重试 | `queue/` | 基于队列的重试 |
| R2 | `VideoTask.maxRetries` | Prisma Schema | 数据库级重试计数 |
| R3 | `AiTimeoutConfig` | DB 配置 | 超时 + 重试次数配置 |
| R4 | Circuit Breaker 重试 | DB schema + 代码 | 熔断后半开重试 |
| R5 | Worker runtime 异常重试 | `worker-runtime.ts` | 内部重试 |
| R6 | DeadLetterTask | DB | 死信队列 |

**问题**: 6 条独立的重试路径，没有统一的 retry authority。

---

## 四、State Mutation Sources（状态修改源）

| # | 修改 | 方式 | 位置 |
|---|------|------|------|
| S1 | `VideoTask.status` UPDATE | Prisma direct | 多处（routes / queue / scheduler） |
| S2 | `Project.executionResults` UPDATE | Prisma JSON | routes/pipeline |
| S3 | `PipelineJob.status` UPDATE | Prisma | pipeline job handlers |
| S4 | `PipelineStage.status` UPDATE | Prisma | pipeline stage handlers |
| S5 | `JobQueue.status` UPDATE | Prisma | job queue handlers |
| S6 | `AgentExecution.status` UPDATE | Prisma | agent handlers |
| S7 | Frontend Pinia store mutation | HTTP fetch → local set | Frontend composables |

**问题**: 至少 7 个分散的状态修改源，任何一处都可能引入不一致。

---

## 五、Queue Writers（队列写入点）

| # | 写入 | 位置 | 目标队列 |
|---|------|------|----------|
| Q1 | BullMQ add | routes | Video generation queue |
| Q2 | PipelineJob create | routes/pipeline | Pipeline job queue |
| Q3 | JobQueue create | agents | Job queue |
| Q4 | TaskQueue insert | routes | Unified task queue |
| Q5 | GPUTaskLog insert | gpu layer | GPU task log (log only) |

---

## 六、Frontend Runtime Sources（前端运行时源）

| # | 源 | 文件 | 问题 |
|---|----|------|------|
| F1 | Pinia store — project execution state | `stores/` | 前端持有执行状态 |
| F2 | Composable — deep watch on graph | `composables/` | 可能触发 watcher storm |
| F3 | Composable — auto dispatch on state change | `composables/` | 前端驱动执行 |
| F4 | Visual Graph — reactive execution nodes | `components/graph*` | Graph 作为执行层 |
| F5 | Timeline — reactive task creation | Nuxt pages | 交互触发 execution |
| F6 | runtime/ 目录 | `frontend/runtime/` | 运行时概念在前端 |
| F7 | kernel/ 目录 | `frontend/kernel/` | 内核概念在前端 |

---

## 七、Event Producers（事件生产者）

| # | 事件 | 来源 | 接收方 |
|---|------|------|--------|
| E1 | Task created | routes | Queue / DB |
| E2 | Task status changed | queue/scheduler | DB |
| E3 | Worker heartbeat | worker | DB |
| E4 | Execution log | Adaptor layer | DB |
| E5 | Sandbox log | Shadow execution | DB |
| E6 | Kernel event | kernel | DB |
| E7 | Replay frame | scheduler | DB |
| E8 | LLM trace | provider | DB |

**问题**: 所有事件直接写入 DB，没有统一的事件流管线。

---

## 八、初步结论

**当前系统没有唯一的 Runtime Authority。**

执行真相分布在：
- DB state（PostgreSQL 中的状态字段）
- Queue state（BullMQ/Redis 中的任务）
- Frontend state（Pinia store 中的 runtime 数据）
- Scheduler state（内存中的调度状态）

**建议的 "唯一 Runtime Authority" 候选**: `Runtime Core`（新建或从 kernel-v1 演化），需接管：
- 所有 execution entry point 的转发
- 所有 state mutation 的授权
- 所有 retry 的统一调度
- 所有 event 的集中生产

---

## 九、验证方式

1. 在任意时刻，对一个正在运行的任务，从所有可能的状态源读取其状态
2. 如果结果不一致，说明该路径尚未收敛到 Runtime Core
3. 全部一致 = 收敛完成

**当前验证结果**: 预计**所有状态源读数不一致**。
