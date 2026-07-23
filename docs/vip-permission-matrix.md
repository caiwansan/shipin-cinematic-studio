# VIP 权限矩阵

> 更新时间：2026-07-24
> 分支：feat/p1-a-member-tier-20260724

---

## 已接入路由

| 功能模块 | 路由 | Free | Plus | Pro | Enterprise | 权限类型 | 确认状态 | 备注 |
|---|---|---:|---:|---:|---:|---|---|---|
| 法律顾问聊天 | `/api/legal/agent/chat` | ❌ | ❌ | ✅ | ✅ | Access Control | **已确认** | `requireMemberTier(Pro)` |
| 导演方案生成 | `/api/workbench/generate-director` | ❌ | ❌ | ✅ | ✅ | Access Control | 临时策略 | `requireMemberTierByPolicy('director.generate')` |
| 分镜编译 | `/api/workbench/compile-blueprint` | ❌ | ❌ | ✅ | ✅ | Access Control | 临时策略 | `requireMemberTierByPolicy('director.compileBlueprint')` |
| 视频渲染 | `/api/workbench/render` | ❌ | ❌ | ✅ | ✅ | Access Control | 临时策略 | `requireMemberTierByPolicy('director.render')` |
| 执行天文台 | `/api/workbench/observatory/:traceId` | ❌ | ❌ | ✅ | ✅ | Access Control | 临时策略 | `requireMemberTierByPolicy('director.observatory')` |
| 广告脚本优化 | `/api/ai/optimize-ad-script` | ❌ | ✅ | ✅ | ✅ | Access Control | 临时策略 | `requireMemberTierByPolicy('aiOptimize.adScript')` |
| 图片提示词优化 | `/api/ai/optimize-image-prompt` | ❌ | ❌ | ✅ | ✅ | Access Control | 临时策略 | `requireMemberTierByPolicy('aiOptimize.imagePrompt')` |
| 视频提示词优化 | `/api/ai/optimize-video-prompt` | ❌ | ❌ | ✅ | ✅ | Access Control | 临时策略 | `requireMemberTierByPolicy('aiOptimize.videoPrompt')` |

---

## 配额/路由决策（保留，不接入）

| 文件 | 行号 | 类型 | 说明 |
|---|---:|---|---|
| `customer-service.ts` | 319 | Quota Tracking | free/basic 配额追踪 |
| `payment.ts` | 957 | Quota / Payment | 推荐人校验 |
| `cost-optimizer.ts` | 94 | Routing Decision | 成本优化路由 |

---

## 管理员路由

所有 `/api/admin/*` 路由已有 `requireAdmin`，无需额外接入。

---

## 统计

| 类别 | 数量 |
|------|------|
| 已接入 requireMemberTier / requireMemberTierByPolicy | 8 |
| 临时策略（pendingConfirmation） | 7 |
| 配额/路由决策（保留） | 3 |
| 已确认等级 | 1 |
