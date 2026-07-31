# SHORTDRAMA-RUNTIME-SSOT — 短剧工作台运行时唯一生产链冻结

- Sprint: ShortDrama-Reality-Recovery-01 / Phase 0
- 日期: 2026-07-31
- 状态: ✅ 冻结生效
- 验证方式: 代码级链路追踪（routes → queue → worker → provider → DB 回写）

---

## 1. 唯一生产执行链（冻结）

```
用户操作
  ↓
studio-v2（前端，只通过 API 交互）
  ↓
Backend API
  └─ POST /api/tasks/ai-generate   ← 唯一 AI 生成入口（冻结）
       ├─ resolveProviderFromUserConfig(userId, model, taskType)  ← BYOK 用户配置
       │    （Router 不决定 provider/Key/endpoint，零 fallback 零兜底）
       ├─ videoTask.create(status='queued', error={input 暂存})
       ├─ enqueueTask() → BullMQ Queue 'ai-runtime'
       │    └─ unifiedQueue.add(job, { attempts, backoff })
  ↓
BullMQ ai-runtime Worker
  └─ createWorkerPool(processors)  ← 单通用 Worker 内部分发
       ├─ image / video / tts / llm / export / frame
       └─ processor(payload) → callProvider()
            ├─ payload.runtime 显式传递（RuntimePayload）
            ├─ assertRuntimeIntegrity(runtime)
            ├─ governanceGate（成本治理，NON-BLOCKING）
            └─ modelAdapterRegistry.execute(runtime)  ← 真实 Provider 调用
  ↓
Provider（用户 BYOK 的 API Key / 平台配置）
  ↓
结果回写（Worker 完成回调）
  ├─ videoTask.status='completed'，error 合并 output
  ├─ video 任务: 下载到本地 → AiVideoSegment.videoUrl 回写
  └─ Asset 渠道（/api/projects/:id/assets）
```

**代码锚点（Phase 0 验证记录）:**

| 环节 | 文件:行 | 状态 |
|------|---------|------|
| 唯一入口路由 | `src/routes/ai-tasks.ts:60-160` | ✅ 已确认 |
| BYOK 路由 | `resolveProviderFromUserConfig`（ai-tasks.ts 调用） | ✅ 已确认 |
| 队列 | `src/queue/queue-manager.ts:91` `new Queue('ai-runtime')` | ✅ 真实 BullMQ |
| Worker | `src/queue/queue-manager.ts:171-203` `createWorker` | ✅ 真实 BullMQ Worker |
| Worker Pool | `src/queue/queue-manager.ts:313-341` 单通用 Worker 分发 | ✅ |
| 处理器注册 | `src/queue/worker-runtime.ts:1237-1249`（image/video/tts/llm/export/frame） | ✅ 真实 Provider |
| Provider 调用 | `src/queue/worker-runtime.ts:44-70` modelAdapterRegistry.execute + assertRuntimeIntegrity | ✅ |
| 启动 | `src/index.ts:1344-1350`（WorkerPool 启动，替代旧 mock-worker） | ✅ |
| 视频回写 | `src/queue/queue-manager.ts:204-240` AiVideoSegment.videoUrl | ✅ |

---

## 2. 冻结声明（禁止清单）

**禁止任何新功能：**

1. ❌ 直调 Provider（不经 ai-tasks → queue → worker 链）
   - 例外：`narrativeGateway`（LLM 分析类，走 ExecutionGraph + BYOK + 熔断/配额/tracing，已有独立统一层）—— 它是 **LLM 分析**的 SSOT，与 ai-runtime（**生成任务**）分层并存，互不替代
2. ❌ 新建 Queue / 新队列名（统一使用 'ai-runtime'）
3. ❌ 新建 fake taskId（占位不入队）
4. ❌ 新建 Mock Renderer / Mock Provider（生产路径禁止 mock）

**冻结后新增 AI 生成能力的正确姿势：**
- 生成类任务（图/视频/音频/帧）→ 必须走 `/api/tasks/ai-generate` → ai-runtime
- LLM 分析类 → 必须走 `narrativeGateway.execute()`
- 二者都不满足 → 先申请架构评审，禁止自行直连

---

## 3. 已识别旁路（不冻结，但必须标记 & 观察）

| 旁路 | 位置 | 引用状态 | 处置 |
|------|------|---------|------|
| UOA.ts `submitTask` 返回假 taskId | `src/agents/orchestrator/UOA.ts:139-145` | 无生产调用（仅 UOAShadow 引类型） | Phase 5 标记 @deprecated |
| mock-provider.ts `mockProviderCall` | `src/queue/mock-provider.ts:8` | 无引用 | Phase 5 标记 @deprecated |
| hdz/llm.client.ts 直连 fetch | `src/services/hdz/llm.client.ts` | 小说域在用（绕过统一层） | 记录在案，本 Sprint 不动，另行治理 |
| unifiedAIGateway | `src/services/unified-ai-gateway.ts` | 企业域在用 | 记录在案，短剧域禁止引入 |
| geo 自建栈 | `src/services/geo/*` | geo 域在用 | 记录在案，短剧域禁止引入 |

---

## 4. Reality Gate — Phase 0 冻结验证

| Gate | 要求 | 状态 |
|------|------|------|
| R0-1 | ai-generate 是唯一 AI 生成入口 | ✅ 代码确认（无其他生成路由） |
| R0-2 | 队列真实 BullMQ（非自研假队列） | ✅ `new Queue('ai-runtime')` + `new Worker` |
| R0-3 | Worker 调用真实 Provider（非 mock） | ✅ `modelAdapterRegistry.execute` + `assertRuntimeIntegrity` |
| R0-4 | 无生产路径引用 mockProviderCall | ✅ 全仓 grep 仅定义处 |
| R0-5 | 无生产路径引用 UOA 假 taskId | ✅ 仅 UOAShadow 引类型，无调用 |
| R0-6 | narrativeGateway 与 ai-runtime 分层清晰 | ✅ LLM 分析 vs 生成任务，互不替代 |

---

## 5. 观察窗口（Phase 5 再处理）

以下模块进入观察窗口，**禁止删除**，Phase 5 统一标记：

- `src/queue/mock-provider.ts`（等确认无生产引用后 deprecated）
- `src/agents/orchestrator/UOA.ts`（等确认调用方后 deprecated）
- `src/agents/aigc-spec-agent.ts` / `aigc-spec-agent-v2.ts`（deprecated 标注已在，等确认无调用后归档）
- `src/routes/storyboards.ts`（legacy，字段与 model 脱节，等 v2 链路确认后决策）
- `src/routes/workbench-director.ts`（未注册死路由）
- `src/routes/ai-optimize-storyboard.ts`（未注册死路由）

---

## 6. 冻结后现状

- ✅ 生产链可用（运行时验证：健康检查 / V2 API / aigc-spec load 正常）
- ⚠️ 已知缺陷（本 Sprint 后续 Phase 修复，不在本阶段动）:
  - videoTask.error 字段双重滥用（input 暂存 + output 容器）→ Phase 1/6 处理
  - 无归属校验（IDOR）→ Phase 6 安全止血
  - batch-create 无配额 → Phase 6
- 📌 本文件为冻结基准，后续任何修改不得突破上述链路

---

*Phase 0 完成 | 冻结生效 | 下一步: Phase 1 数据 SSOT*
