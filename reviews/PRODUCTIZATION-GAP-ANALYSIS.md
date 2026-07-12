# Productization Sprint — FCV-1 Prerequisite

> **审计日期**: 2026-07-27（基于代码扫描 + `product-readiness-audit.md`）  
> **当前产品成熟度**: 6.8/10 — Power User Ready，非 New User Ready  
> **结论**: ⏸ FCV-1 待启动 — 必须先完成 Productization Sprint

---

## 问题分层

### P0 — 必须修复（阻塞 New User 独立完成 Journey）

| # | 问题 | 涉及页面 | 预期修复时间 |
|---|---|---|---|
| 1 | **KnowledgePage `handleStatementClick` 是 stub** — 用户点击声明项只有 console.warn，无任何 UI 响应 | `KnowledgePage.vue` | 半日 |
| 2 | **VerificationPage 首次加载空白** — 无 loading skeleton，无 error/empty 状态 | `VerificationPage.vue` | 半日 |
| 3 | **HealthPage ADI/Health 概念混用** — 页面标题与内容术语不一致，用户认知负担高 | `HealthPage.vue` | 半日 |
| 4 | **HealthPage Token 从 `localStorage` 硬编码** — SSR 不兼容，非安全方式 | `HealthPage.vue`, `useGeoProjectStore` | 半日 |
| 5 | **GrowthPage 伪图表** — CSS div 模拟趋势图，无法交互、不真实 | `GrowthPage.vue` | 1 日 |

### P1 — 重要（完成 Journey 但体验有损）

| # | 问题 | 涉及页面 | 预期修复时间 |
|---|---|---|---|
| 6 | GEOCreate 无 loading skeleton | `GEOCreate.vue` | 半日 |
| 7 | VerificationPage 使用废弃 `ExplainResult` 类型 | `VerificationPage.vue`, `explain.ts` | 半日 |
| 8 | MissionCard 绕过 service 层直接 fetch API | `MissionCard.vue` | 半日 |
| 9 | MissionCenter 异步竞态（regenerate 和 fetch 同时调用） | `MissionCenterShell.vue` | 半日 |
| 10 | KnowledgePage 编辑按钮无实际 UI | `KnowledgePage.vue` | 半日 |
| 11 | PublishingPage retryRecord 是 stub | `PublishingPage.vue` | 半日 |

### Product Experience — 产品化缺失（SaaS 感不足）

| # | 问题 | 影响 |
|---|---|---|
| 12 | 页面间缺少自然的"下一步"引导 | 用户完成当前页面后不知道去哪里 |
| 13 | 20 个页面中仅 8 个页面有 CTA，12 个页面孤立无推荐 | 工作流断裂感 |
| 14 | Workspace 整体仍像后台系统多于 SaaS 产品 | 认知负担高 |

---

## 修复 Sprint 估算

| 类别 | 任务数 | 预估时间 |
|---|---|---|
| P0 修复（阻塞 FCV） | 5 | 2-3 天 |
| P1 修复（体验保障） | 6 | 2-3 天 |
| 产品化引导（Next Step CTA） | 全局 | 1-2 天 |
| **合计** | **12** | **5-8 天** |

---

## GO/NO GO — FCV-1 启动条件

在以下条件全部满足前，不启动 FCV-1：

- [ ] P0 问题 #1-#5 全部修复
- [ ] P1 问题 #6-#11 全部修复
- [ ] 至少 80% 的页面底部有自然的下一步引导
- [ ] 无 stub 交互（console.warn → 真实 UI）
- [ ] 术语统一（ADI = Health Score，无三套叫法）

---

## 参考

- 完整审计: `audit/product-readiness-audit.md`（6.8/10）
- Phase C 装配验证: `reviews/PHASE-C-PRODUCT-REVIEW.md`
- FCV-1 测试方案: `reviews/FCV-1-TEST-PLAN.md`
- PMA v1: `reviews/PRODUCT-MATURITY-ASSESSMENT-v1.md`
