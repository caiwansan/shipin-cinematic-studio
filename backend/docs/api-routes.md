# W1 标准化 API 路由映射

> 最后更新: 2026-05-19
> 目标: 所有新前端只调用 `规范路由`，旧路由保留 301 重定向 + 审计日志

## 路由域映射

| 域 | 规范前缀 | 路由文件 |
|---|---|---|
| **Workflow** | `/api/workflow/*` | `asset-registry.ts` |
| **AI** | `/api/v1/ai/*` | `ai-gateway.ts` |
| **Cards** | `/api/v1/cards/*` | `asset-cards.ts` |
| **Continuity** | `/api/v1/continuity/*` | `continuity.ts` |
| **System** | `/api/v1/system/*` | `control-plane-v2.ts`, `system-dashboard.ts`, `system-health.ts` |
| **Tenant** | `/api/v1/org`, `/api/v1/workspace`, `/api/v1/permissions/*` | `tenant.ts` |
| **Product** | `/api/v1/product/*` | `product.ts` |

## 已弃用的旧路由（过渡期保留）

| 旧路由 | 新路由 | 状态 |
|---|---|---|
| `/api/v1/system/health` | → `/api/v1/system/snapshot` | 保留但标记 |
| `/api/v1/jobs/:jobId` | → `/api/v1/product/job/:jobId` | 保留但标记 |

## 构建边界

```
允许的入口点:
  - src/index.ts (API Server)
  - src/jobs/ (Worker Server)

禁止:
  - src/scripts/* (直接脚本执行)
  - src/runtime/legacy/* (旧运行时)
  - src/archive/* (已废弃组件)
```
