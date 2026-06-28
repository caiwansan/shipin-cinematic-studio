# Runtime Governance Status — Execution Plane Lock Complete

**生成时间**: 2026-05-23 03:52  
**阶段**: Execution Plane Lock（执行面封锁完成）

## 系统状态矩阵

| 维度 | 状态 |
|------|------|
| Constitution 签署 | ✅ resolveRuntimeConfig + runtimeGateway + ESLint rule |
| Execution 收敛 | ✅ 核心路径（images.ts + worker-runtime.ts）已改为 context 注入 |
| Provider 自治 | ✅ aliyun-image.provider 收敛完成 |
| 运行时守卫 | ✅ runtimeGuard 已注册 Fastify hook（warn 模式） |
| 旧路径监控 | ✅ callProvider 入口有 Context 守卫检测 |

## 三阶段产出汇总

### Phase 1 — Constitution（6 文件，722 行）

| 文件 | 行数 | 功能 |
|------|------|------|
| `runtime/runtime-guard.ts` | 104 | Fastify 运行时守卫（preHandler + onResponse） |
| `runtime/resolveRuntimeConfig.ts` | 231 | 配置单入口（Input→User→Stage→Env） |
| `runtime/runtime-gateway.ts` | 299 | 执行单入口（LLM/Image/Video/TTS 路由） |
| `providers/provider.interface.v2.ts` | 83 | Provider V2 契约 |
| `providers/legacy-provider-adapter.ts` | 115 | 旧 provider 适配器 |
| `eslint-rules/no-process-env-in-provider.js` | 73 | 编译时层禁止 process.env |
| `backend/src/index.ts` (修改) | +3 | boot 时注册 runtimeGuard |

### Phase 2 — Convergence（2 文件改造，1 provider 收敛）

| 文件 | 改动 |
|------|------|
| `services/aliyun-image.provider.ts` | `getApiKey()` 从 RuntimeContext 读取，生产环境无 context 抛错；硬编码 resolvedModel 和 endpoint 移除 |
| `routes/images.ts` | `getImageProviderAndModel()` 重构为 `withRuntimeContext` 注入，3 个 provider 分支全部通过 context 传递 API Key/BaseUrl，不再写 `process.env` |
| `queue/worker-runtime.ts` | `callProvider()` 入口添加 RuntimeContext 守卫检测，无 context 时打印警告 |

## 当前执行面

```
Routes (images.ts  ✅ context注入)
Routes (tts.ts     ⚠️ withUserKey 模式，可接受)
     │
Queue (callProvider  ✅ context守卫)
     │
     ├── Gateway Path (v2) ──────────────────────────────┐
     │     runtimeGateway.execute()                      │
     │         ↓                                         │
     │     resolveRuntimeConfig() ← 唯一配置源           │
     │         ↓                                         │
     │     Provider V2 (Pure Execution Unit)              │
     └────────────────────────────────────────────────────┘
     
     └── Legacy Path (v1, 监控中) ───────────────────────┐
           provider.generate()                           │
               ↓                                         │
           process.env (allowed only in dev mode)        │
           RuntimeGuard ⚠️ 监控中                         │
           aliyun-image ✅ 已收敛，生产模式抛错            │
     └────────────────────────────────────────────────────┘
```

## 剩余旧路径（Class ②/③）

```
services/aliyun-video.provider.ts      — process.env fallback
services/volcengine-llm.provider.ts    — process.env + model fallback
services/siliconflow-tts.provider.ts   — process.env key read
services/aliyun-tts.provider.ts        — process.env key read
services/volcengine-image.provider.ts  — process.env + model fallback
routes/images.ts (siliconflowImageGenerate) — 内联 process.env
```

**注意**：以上旧路径已通过 `RuntimeGuard` 监控，生产环境可通过 `RUNTIME_GUARD=enforce` 硬拦截。

## 安全模式

`RUNTIME_GUARD=warn` (当前) — 仅监控，不拦截  
`RUNTIME_GUARD=enforce` — 所有非 Gateway 请求被阻止

## 备份

- 源码全备份: `/root/backup_before_runtime_fix_20260523_034455.tar.gz`
- 审计报告: `/root/.openclaw/workspace/reports/audit-report-20260523.md`
