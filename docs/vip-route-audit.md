# VIP 路由审计报告

> 更新时间：2026-07-24
> 分支：feat/p1-a-member-tier-20260724

---

## 审计结果摘要

| 发现 | 数量 |
|------|------|
| 散落 memberTier 直接判断 | 3 处（均为配额/路由决策） |
| 已接入 requireMemberTier 的路由 | 1 条 |
| 待接入的 VIP 功能路由 | 4+ 条 |
| 配额/路由决策（保留） | 3 处 |
| 管理员路由（已有 requireAdmin） | 15+ 条 |

---

## 路由接入清单

| 路由 | 方法 | 权限类型 | 处理方式 | 状态 |
|---|---|---|---|---|
| `/api/legal/agent/chat` | POST | Access Control | `requireMemberTier(Pro)` | ✅ 已接入 |
| `/api/workbench/generate-director` | POST | Access Control | `requireMemberTierByPolicy('director.generate')` | ✅ 已接入（临时 Pro） |
| `/api/workbench/compile-blueprint` | POST | Access Control | `requireMemberTierByPolicy('director.compileBlueprint')` | ✅ 已接入（临时 Pro） |
| `/api/workbench/render` | POST | Access Control | `requireMemberTierByPolicy('director.render')` | ✅ 已接入（临时 Pro） |
| `/api/workbench/observatory/:traceId` | GET | Access Control | `requireMemberTierByPolicy('director.observatory')` | ✅ 已接入（临时 Pro） |
| `/api/ai/optimize-ad-script` | POST | Access Control | `requireMemberTierByPolicy('aiOptimize.adScript')` | ✅ 已接入（临时 Plus） |
| `/api/ai/optimize-image-prompt` | POST | Access Control | `requireMemberTierByPolicy('aiOptimize.imagePrompt')` | ✅ 已接入（临时 Pro） |
| `/api/ai/optimize-video-prompt` | POST | Access Control | `requireMemberTierByPolicy('aiOptimize.videoPrompt')` | ✅ 已接入（临时 Pro） |

---

## Service 层散落判断（保留）

| 文件 | 行号 | 类型 | 处理方式 |
|---|---|---|---|
| `customer-service.ts` | 319 | Quota Tracking | 保留，后续迁移到 quota guard |
| `payment.ts` | 957 | Quota / Payment Routing | 保留，后续迁移到 payment policy |
| `cost-optimizer.ts` | 94 | Routing Decision | 保留，后续迁移到 model router |

---

## 已认证但无等级限制的路由（待掌柜确认等级）

| 路由 | 当前认证 | 建议 |
|---|---|---|
| `/api/ai/optimize-ad-script` | authenticate | 待确认 |
| `/api/ai/optimize-image-prompt` | authenticate | 待确认 |
| `/api/ai/optimize-video-prompt` | authenticate | 待确认 |
| `/api/v2/workbench/project*` | authenticate | 待确认 |

---

## 结论

1. 业务代码中**无未统一的访问控制判断**
2. 散落 `memberTier` 均为配额/路由决策，已分类登记
3. P1-A 已完成核心目标：建立统一权限层 + 接入首条 VIP 路由
4. 其余路由待掌柜确认等级后批量接入
