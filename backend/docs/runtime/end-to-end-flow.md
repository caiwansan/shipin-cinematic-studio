# 用户提交剧本到最终生成视频 — 系统完整运作路线

---

## 全景路径（文字版）

```text
用户提交剧本
     │
     ▼
[1] API 入口接收
     │
     ▼
[2] Production Loop 路由分发
     │
     ▼
[3] 编译 Storyboard（分镜）
     │
     ▼
[4] Render Intelligence 决策
     │  ├── 多维度评分
     │  ├── PolicySignal 转换（Phase 1B）
     │  └── PolicyAdapter 裁决（Phase 1C）
     │
     ▼
[5] 视频生成
     │  ├── 入队列（RenderQueue）
     │  ├── Provider 调用（Volcengine/Kling/Replicate）
     │  └── 返回视频 URL
     │
     ▼
[6] 查询结果
```

---

## 第1步：用户提交剧本

**入口：** HTTP API

```json
POST /api/production/compile
{
  "script": "一只小猫在阳光下打盹...",
  "projectId": "proj_xxx",
  "style": "动画风格"
}
```

**后端收到后做什么：**
- Fastify 路由 `registerProductionRoutes()` 接手
- 调用 `compileStoryboard()` 解析剧本 → 拆成镜头列表（StoryboardShot）

```
剧本 → [{ scene: "开场", prompt: "..." }, { scene: "展开", prompt: "..." }, ...]
```

---

## 第2步：Production Loop 路由分发

**之后进入哪条路线，取决于用户想要什么：**

| API 端点 | 行为 | 用户场景 |
|----------|------|----------|
| `/api/production/render` | 单镜头直接渲染 | 快速预览 |
| `/api/production/render-video` | 完整视频渲染（含排队状态） | 完整生成 |
| `/api/production/intelligence/execute` | **智能决策 + 渲染**（推荐路线） | AI 自动选最优 provider |
| `/api/production/render-router` | 路由层渲染（指定 provider 偏好） | 高级用户指定偏好 |

**视频生成走：** `/api/production/render-video` 或 `/api/production/intelligence/execute`

---

## 第3步：智能决策（关键路径）

`/api/production/intelligence/execute` 是最完整的路径，它经过三个核心层：

### 3a. RenderIntelligence.decide() ← 特征提取

```
输入: VideoPrompt { prompt, duration, width, height... }
       + RoutingConstraints { maxBudget, maxLatency, slaTier... }

流程:
  ① 获取所有可用 video provider（Volcengine, Kling, Replicate...）
  ② 对每个 provider 评分:
       score = quality(weight 0.4) + speed(weight 0.3) + cost(weight 0.3)
  ③ 按 SLA 约束过滤（超过预算/延迟的排除）
  ④ 按分数排序，取最优

输出: RouteDecision
  {
    chosenProvider: "volcengine",
    chosenModel: "doubao-seedance-2-0",
    confidence: 0.91,
    estimatedCost: 0.05,
    estimatedLatencyMs: 45000,
    reason: "Optimized score: 0.873...",
    alternatives: [{ provider: "kling", ... }]
  }
```

### 3b. PolicySignal 转换（Phase 1B）

RouteDecision → **PolicySignal**（标准化决策信号）

```
{
  provider_id: "volcengine",
  confidence: 0.91,
  confidence_detail: { raw: 0.85, boosted: 0.06, final: 0.91 },
  weights: { quality: 0.4, latency: 0.3, cost: 0.3 },
  effective_weights: { quality: 0.4, latency: 0.3, cost: 0.37 },
  latency_ms: 45000,
  meta: {
    decision_path: "normal",
    sla_tier: "balanced",
    fallback_chain: ["kling", "replicate"],
    model: "doubao-seedance-2-0"
  }
}
```

### 3c. PolicyAdapter 裁决（Phase 1C）

PolicyAdapter.evaluate() 用 4 条规则裁决：

```
规则 1 (priority 100): allow-high-confidence
  if confidence >= 0.85 → ALLOW（保持原决策）

规则 2 (priority 90): reroute-latency-miss
  if latency_ms > sla 阈值 → REROUTE（换 provider）

规则 3 (priority 80): fallback-low-confidence
  if confidence < 0.50 → FALLBACK（启用备选链）

规则 4 (priority 10): reject-no-path
  if fallback_chain 已空 → REJECT（使用 mock）
```

**典型结果：** `action: "allow"` — 保持 volcengine，进入生成阶段。

---

## 第4步：视频生成

**RenderIntelligence.execute() 执行时：**

```
RouteDecision → RenderQueue.enqueue(prompt) → 返回 job
               ↓
          RenderQueue 内部:
               ↓
  ① RenderQueue.process()
     → 从队列取 job
     → 标记 status: "generating"
     → eventBus 发射 render.video_completed 事件
               ↓
  ② 调用 provider.generate(job.prompt)
     → volcengine.video 适配器接手
     → 调用火山引擎视频生成 API（OpenAI 兼容接口）
     → 持续轮询生成状态
               ↓
  ③ 生成完成
     → 标记 status: "completed"
     → 填充 job.output (含视频 URL)
     → 发射完成事件
```

**如果失败：** fallback 状态机接管（Phase 1D）

```
失败 → classifyError()
  ├── auth_blocked → 换下一个 provider
  ├── timeout → 重试当前 provider（最多 3 次 BullMQ）
  └── fatal → DLQ（死信队列）

FallbackPolicy.next(signal, context)
  → 按 fallback_chain 顺序尝试下一个 provider
  → 全部失败 → mock 兜底
```

---

## 第5步：用户查询结果

```
GET /api/production/render-video/:jobId
→ { status: "completed", output: { url: "https://..." } }
```

---

## 完整时序图

```
用户                    API                    RenderIntelligence     PolicyAdapter     RenderQueue     Provider(Volcengine)
 │                      │                          │                     │                │                │
 │ POST /intelligence/  │                          │                     │                │                │
 │ execute {script...}  │                          │                     │                │                │
 │─────────────────────>│                          │                     │                │                │
 │                      │                          │                     │                │                │
 │                      │ renderIntelligence.decide()                     │                │                │
 │                      │─────────────────────────>│                     │                │                │
 │                      │                          │ 评分所有 provider    │                │                │
 │                      │<─────────────────────────│                     │                │                │
 │                      │                          │                     │                │                │
 │                      │ convertRouteDecisionToSignal()                  │                │                │
 │                      │───────────────────────────────────────────────>│                │                │
 │                      │ PolicySignal             │                     │                │                │
 │                      │                          │                     │                │                │
 │                      │ policyAdapter.evaluate() │                     │                │                │
 │                      │────────────────────────────────────────────────>│                │                │
 │                      │                          │                     │                │                │
 │                      │<───── allow/fallback/reject ──────────────────│                │                │
 │                      │                          │                     │                │                │
 │                      │ renderIntelligence.execute()                   │                │                │
 │                      │─────────────────────────>│                     │                │                │
 │                      │                          │                     │                │                │
 │                      │                          │ RenderQueue.enqueue()               │                │
 │                      │                          │─────────────────────────────────────>│                │
 │                      │                          │                     │                │                │
 │                      │                          │                     │                │                │
 │<──── { jobId } ─────│                          │                     │                │                │
 │                      │                          │                     │                │                │
 │                      │                          │                     │                │                │
 │                      │                          │  RenderQueue 轮询处理                │                │
 │                      │                          │                     │                │                │
 │                      │                          │                     │       provider.generate()        │
 │                      │                          │                     │─────────────────────────────────>│
 │                      │                          │                     │                │                │
 │                      │                          │                     │                │  火山引擎 API    │
 │                      │                          │                     │                │   轮询...        │
 │                      │                          │                     │                │<────────────────│
 │                      │                          │                     │                │                │
 │                      │                          │                     │                │  completed +    │
 │                      │                          │                     │                │  video URL      │
 │                      │                          │                     │                │                │
 │ GET /render-video/   │                          │                     │                │                │
 │ :jobId               │                          │                     │                │                │
 │─────────────────────>│                                                                    │                │
 │<── { url: "..." } ──│                                                                    │                │
```

---

## 涉及的文件清单

| 阶段 | 文件 | 作用 |
|------|------|------|
| API 入口 | `production-loop/api.ts` | 注册所有 /api/production/* 路由 |
| 剧本编译 | `production-loop/prompt-compiler.ts` | 剧本 → 分镜（StoryboardShot） |
| 智能决策 | `production-loop/render-intelligence.ts` | 评分、选 provider、带 fallback 执行 |
| 决策信号 | `core/policy-signal/policy-signal.types.ts` | PolicySignal 数据结构定义 |
| 信号适配 | `core/policy-signal/render-intelligence-adapter.ts` | RouteDecision → PolicySignal |
| 策略裁决 | `core/policy-adapter/policy-adapter.ts` | 4 条规则裁决决策 |
| 回退状态机 | `core/policy-adapter/fallback-state-machine.ts` | 确定性 fallback 路径 |
| 渲染队列 | `production-loop/render-queue.ts` | 视频生成排队、轮询 |
| Provider 接口 | `production-loop/video/video-provider.ts` | 统一 provider 接口抽象 |
| Volcengine 适配 | `production-loop/video/volcengine.video.ts` | 火山引擎视频生成实现 |
| 事件总线 | `production-loop/event-bus.ts` | 全链路事件发射（决策/失败/完成） |
| Provider 包装器 | `core/provider-wrapper/volcengine/*.wrapper.ts` | 拦截层（Phase 1A） |
