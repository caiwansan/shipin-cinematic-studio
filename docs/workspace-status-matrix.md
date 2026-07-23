# 工作台状态矩阵

> 审计时间：2026-07-24
> 替代散落的 `enabled: false`，统一使用 `status` 字段

---

## 状态说明

| 状态 | 含义 | 首页展示 | 路由访问 | 待处理 |
|---:|---|---|---|---|
| `stable` | 正式版，完整功能 | ✅ | ✅ | 否 |
| `beta` | 公测版，功能完整但可能存在 bug | ✅ | ✅ | 否 |
| `preview` | 预览版，部分功能未开放 | ✅ | ✅ | 否 |
| `hidden` | 隐藏，半成品不展示 | ❌ | ❌ | 是 |
| `deprecated` | 即将下线 | ❌ | ⚠️提示 | 是 |

---

## 矩阵（共 14 工作台）

| # | 工作台 | ID | 完成度 | 状态 | 首页展示 | 路由可访问 | 权限等级 | 备注 |
|---:|---|---|---:|---|---:|---:|---:|---|
| 1 | 法律工作台 | legal | 90% | `stable` | ✅ | ✅ | Pro | 13 个路由，功能最完整 |
| 2 | 企业工作台 | enterprise | 85% | `stable` | ✅ | ✅ | - | 大型 B2B 模块，30+ 数据表 |
| 3 | GEO 知识图谱 | geo | 80% | `stable` | ✅ | ✅ | - | 品牌知识运营、评分体系 |
| 4 | 知识中枢 | knowledge-hub | 80% | `stable` | ✅ | ✅ | - | 平台级知识中枢，插件方式注册 |
| 5 | 小说公开阅读 | novel-public | 75% | `stable` | ✅ | ✅ | - | 公开小说阅读入口 |
| 6 | 积分商城 | mall | 85% | `stable` | ✅ | ✅ | - | 独立电商模块，积分兑换 |
| 7 | 平台通用工作台 | platform-workspace | 85% | `stable` | ✅ | ✅ | - | 通用 CRUD 工作区级 |
| 8 | 导演工作台 | director | 70% | `beta` | ✅ | ✅ | Pro（临时） | AI 短剧全流程，BYOK |
| 9 | 求职招聘 | job | 55% | `preview` | ✅ | ✅ | - | MVP 求职者端 |
| 10 | 电商图片 | ecom-image | 50% | `preview` | ✅ | ✅ | - | 项目 CRUD + AI 分析/生成 |
| 11 | 媒体部门 | media-department | 45% | `preview` | ✅ | ✅ | - | 内部媒体部门管理 |
| 12 | 音乐工作台 | music | 35% | `hidden` | ❌ | ❌ | - | 半成品，无独立数据表 |
| 13 | 小说写作 | hdz | 40% | `hidden` | ❌ | ❌ | - | 混沌珠独立工作台 |
| 14 | 语音工作台 | voice | 30% | `hidden` | ❌ | ❌ | - | 音色管理子模块 |

---

## 状态分布

| 状态 | 数量 | 工作台 |
|---:|---:|---|
| `stable` | 7 | legal, enterprise, geo, knowledge-hub, novel-public, mall, platform-workspace |
| `beta` | 1 | director |
| `preview` | 3 | job, ecom-image, media-department |
| `hidden` | 3 | music, hdz, voice |
| `deprecated` | 0 | - |
| **合计** | **14** | |

---

## 首页隐藏清单（`hidden` 状态）

| 工作台 | 原因 | 完成度 |
|---|---|---|
| 音乐工作台 | 半成品，无独立数据表 | 35% |
| 小说写作 | 混沌珠独立工作台，半成品 | 40% |
| 语音工作台 | 非完整独立工作台，仅音色管理 | 30% |

---

## 预览版提示（`preview` 状态）

| 工作台 | 提示文案 |
|---|---|
| 求职招聘 | 预览版，部分功能未开放。 |
| 电商图片 | 预览版，部分功能未开放。 |
| 媒体部门 | 预览版，部分功能未开放。 |

---

## 策略配置路由

P1-A 已接入 8 条 VIP 路由，详情见 `docs/vip-route-audit.md`

| 路由 | Policy Key | 等级 | 确认状态 |
|---|---|---:|---|
| /api/legal/agent/chat | legal.agent.chat | Pro | ✅ 已确认 |
| /api/workbench/generate-director | director.generate | Pro | 临时策略 |
| /api/workbench/compile-blueprint | director.compileBlueprint | Pro | 临时策略 |
| /api/workbench/render | director.render | Pro | 临时策略 |
| /api/workbench/observatory/:traceId | director.observatory | Pro | 临时策略 |
| /api/ai/optimize-ad-script | aiOptimize.adScript | Basic | 临时策略 |
| /api/ai/optimize-image-prompt | aiOptimize.imagePrompt | Pro | 临时策略 |
| /api/ai/optimize-video-prompt | aiOptimize.videoPrompt | Pro | 临时策略 |

---

## 待掌柜确认

| # | 问题 |
|---|---|
| 1 | 导演工作台 4 条路由是否维持 Pro？ |
| 2 | AI 优化类 3 条路由是否维持当前临时等级？ |
| 3 | `optimize-ad-script` 的 `Basic` 是否为正式会员等级？（MemberTier.Basic=1，已验证合法） |
| 4 | 3 个 `preview` 工作台是否调整为 `hidden` 或维持 `preview`？ |
