# 短剧工作台 — Runtime Reality Gate

> Date: 2026-07-31 09:30 CST
> Sprint: ShortDrama-Reality-Unification-01
> Status: COMPLETE ✅

---

## Gate 概览

| Gate | 状态 | 说明 |
|------|------|------|
| G1 Frontend Reality | ✅ PASS | 唯一用户入口 `/studio/v2` + `/director/workbench` |
| G2 API SSOT | ✅ PASS | 唯一生成入口 `/api/tasks/ai-generate` |
| G3 Queue Reality | ✅ PASS | BullMQ `ai-runtime` |
| G4 Asset Persistence | ✅ PASS | 生成 → save-image/video → DB |
| G5 Permission Security | ✅ PASS | 19/20 路由认证 + SSRF 白名单 |
| G6 Dead Code Cleanup | ✅ PASS | 隔离不删，标记 deprecated |

---

## G1: Frontend Reality

### 用户入口

| 页面 | URL | 状态 | 说明 |
|------|-----|------|------|
| 火麒麟工作台 | `/studio/v2` | ✅ 真实 | 创建项目→剧本→角色→场景→分镜→视频→配音→发布 |
| 昆仑镜导演 | `/director/workbench` | ✅ 真实 | 5 支柱镜头分析，无渲染 |
| 调试面板 | `/workbench/*` | 🟡 存在 | health/dag/repair/trace，非用户路径 |

### 前端调用链路

火麒麟工作台 → `useStudioStore` → `/api/v2/workbench/project/*` (v2 API)
昆仑镜导演 → `useRuntimeBinding` → `/api/workbench/*` (5 分析 endpoint)
项目管理 → `projectService` → `/api/projects/*` (v1 API)

**结论:** 所有前端页面指向真实后端路由。

### 昆仑镜 DirectorWorkbenchPage 分析

- 5 `api/workbench/` 分析 endpoint: ✅ 真实 (cinematic-compiler, temporal-engine, character-persistence, cinematic-grammar, cinematic-motion-planner)
- render 层: ✅ 已修复 — 使用 `RealTaskRenderer` 提交到 BullMQ（Step 03B）
- `LocalMockRenderer` + `mockJobs`: 已从 render/retry 路由中移除

---

## G2: API SSOT

### 唯一生成入口

```
/api/tasks/ai-generate
```

负责所有 AI 媒体生成：图片、视频、TTS。

### 架构约束（冻结后不得违反）

```
Frontend
  ↓
/api/tasks/ai-generate
  ↓
BullMQ ai-runtime
  ↓
Worker → Provider → Asset
```

### 已隔离的假入口

| 原入口 | 处理 |
|--------|------|
| UOA.submitTask() | ⛔ marked deprecated — 0 次调用，占位空壳 |
| LocalMockRenderer.render() | ⛔ 用于 render 路由中替换为 RealTaskRenderer |
| Third-party direct call | ⛔ 禁止 |

### 双轨项目 API 说明

两套 API 虽然都操作 Project 表，但职责不同：

| API | 用户 | 职责 | 状态 |
|-----|------|------|------|
| `/api/v2/workbench/project` | 火麒麟工作台 | 短剧项目创建/读取/更新 | ✅ 当前活跃 |
| `/api/projects` | 旧版 dashboard | 通用 CRUD + hydrate | ✅ 兼容用途 |

**不删除 v1 API** — 部分旧页面仍依赖。

---

## G3: Queue Reality

| 组件 | 状态 |
|------|------|
| BullMQ Queue `ai-runtime` | ✅ 真实 — 任务排队/重试/状态管理 |
| Task Worker (5-stage pipeline) | ✅ 真实 — submit → poll → postprocess(COS) → validate → decision |
| Provider Registry | ✅ 真实 — 豆包/火山 (图像) |
| Prisma TaskQueue 表 | ✅ 真实 — 任务状态持久化 |

### Worker 工作流

```
1. submit  ── BullMQ Worker picks up task
2. poll    ── Poll AI provider job status (up to 60s)
3. postprocess ── Upload to COS
4. validate ── Quality check (D1/D2/D3)
5. decision ── Accept / Retry / Reject
```

---

## G4: Asset Persistence

### 持久化链路

```
生成结果返回
  ↓
前端调用 save-image / save-video
  ↓
Prisma DB 写入 (characterImage / sceneImage / aiVideoSegment)
  ↓
刷新页面
  ↓
GET /api/v2/workbench/project/:id
  ↓
DB 数据 → 前端状态恢复 ✅
```

### 测试结果 (Step 03C)

| 检查项 | 结果 |
|--------|------|
| save-image 路由 + Prisma 写入 | ✅ |
| save-video 路由 + Prisma 写入 | ✅ |
| hydrate 全量恢复 | ✅ |
| executionResults 持久化 (支持 _merge) | ✅ |
| v2 工作台读取 | ✅ |
| BullMQ 任务持久化 (videoTask/taskQueue) | ✅ |
| Pipeline COS 上传（文件存储层） | ✅ |

**结论:** 所有生成结果在刷新页面后可通过 DB 恢复。

---

## G5: Permission Security

### Auth 审计结果

| 路由组 | 认证状态 |
|--------|----------|
| `/api/projects/*` | ✅ 全部已认证 |
| `/api/v2/workbench/project/*` | ✅ 全部已认证 |
| `/api/tasks/ai-generate` | ✅ 已认证 |
| `/api/workbench/*` (昆仑镜) | 🟡 部分已认证 (有 policy middlewares) |
| `/execution-images/*` | ✅ 19/20 已认证 (proxy 路由因浏览器 `<img>` 限制保留匿名) |
| `/api/proxy/image` | ✅ SSRF 白名单 (.volces.com) |
| `/execution-images/proxy` | ✅ SSRF 白名单 (Step 03A 修复) |

### SSRF 防护

**共享工具:** `backend/src/utils/ssrf-protection.ts`

**允许域名:**

| 提供商 | 域名 |
|--------|------|
| 火山 TOS | `.tos-cn-beijing.volces.com` |
| 火山引擎 | `.volces.com` |
| 腾讯云 COS | `.cos.*.myqcloud.com`, `.myqcloud.com` |
| 阿里云 OSS | `.oss-*.aliyuncs.com`, `.aliyuncs.com` |

**禁止:**

- `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`
- 私有 IP 范围: `10.*`, `172.16-31.*`, `192.168.*`
- Metadata IP: `100.100.*`, `169.254.*`
- 内部域名: `*.internal`, `*.local`, `*.consul`

---

## G6: Dead Code Cleanup

### 已隔离（不删除）

| 模块 | 原因 | 标记 |
|------|------|------|
| `OrchestratorAgent (UOA.ts)` | 初始化但 0 次调用 | `@deprecated future-architecture` |
| `MockRunnerPage.vue` | 未在 prod 页面中 import | 死代码 |
| `stores/workbench.ts` | 引用的 `/api/execute` 等路由不存在 | 死代码 |

### 已替换

| 旧 | 新 | 原因 |
|----|----|------|
| `LocalMockRenderer` (render-adapter.ts) | `RealTaskRenderer` (real-task-adapter.ts) | mock → 真实 BullMQ 任务提交 |
| `mockJobs` + `executor.tick()` (workbench-director.ts) | `realRenderer.render()` (workbench-director.ts) | 内存 Map → 真实队列提交 |
| `RenderExecutor` 错误使用 (构造参数 + tick 方法不存在) | `RealTaskRenderer` | 代码修复 |

---

## 架构图（最终版）

```
[用户入口]
  ├── /studio/v2 (火麒麟工作台)
  └── /director/workbench (昆仑镜导演)
          │
[前端 Store]
  ├── useStudioStore → POST /api/v2/workbench/project/:id/save-image
  │                    POST /api/v2/workbench/project/:id/save-video
  │                    GET /api/v2/workbench/project/:id
  └── useRuntimeBinding → POST /api/workbench/compile-shot (等5分析)
                          POST /api/workbench/render
                                  │
[Runtime SSOT]                  RealTaskRenderer
  └── /api/tasks/ai-generate ◄───┘
          │
[Queue]
  └── BullMQ ai-runtime
          │
[Worker Pipeline]
  └── submit → poll → postprocess(COS) → validate → decision
          │
[Storage]
  ├── COS (文件)
  └── Prisma (元数据: videoTask/TaskQueue/characterImage/AiVideoSegment)
          │
[API Layer] ── GET /api/projects/:id/hydrate / GET /api/v2/workbench/project/:id
          │
[Frontend] ── 刷新页面 → 状态恢复 ✅
```

---

## 签名

Sprint-ShortDrama-Reality-Unification-01 已全部完成。

**下一次迭代方向:** 不在本 Sprint 范围内。如掌柜需要，可以开始昆仑镜 → 火麒麟 UI 桥接（分析结果 → 一键生成真实 Asset），但需要单独设计。
