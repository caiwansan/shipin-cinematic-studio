# SPRINT-ADMIN-CLEANUP-02 — 后台管理瘦身 + CEO 经营驾驶舱 — COMPLETE ✅

**Date:** 2026-08-01 05:45 CST
**Gate:** 掌柜指令（后台从「工程控制台」→「商业运营后台」：管理商业对象，不替企业操作业务）
**范围:** T01 招聘后台裁剪 / T02 数据罗盘重构 / T03 Workspace 统一壳

---

## T01 求职招聘后台裁剪（25 页 → 5 页）✅

### 现状核查
- 导航已在之前 sprint 裁为 5 入口（admin-workspace-registry.ts），本次补齐治理缺口
- **12 个退役页面补 DEPRECATED 标记**（代码保留，URL 直链可达，业务数据归企业工作台）：
  岗位管理 / 候选人管理(+详情) / 面试管理 / 会话管理 / Campaign / 部门 / 审核队列(+详情) / 审计中心 / Runtime 监控 / 订阅管理
- **5 保留页全部真实 API 验证**：

| 页面 | 数据源 | 状态 |
|------|--------|------|
| 求职管家 Agent 配置 | `/api/admin/recruitment/agent-product`（求职管家 Career Agent） | ✅ 无 API Key 配置，模型策略=平台托管白名单（BYOK/企业配置/平台默认三态） |
| 套餐订阅管理 | `/api/admin/recruitment/plans` + `/subscriptions` | ✅ HR猎头等真实套餐 |
| AI Agent 管理 | `/api/admin/recruitment/agents` | ✅ 真实实例 |
| 企业用户管理 | `/api/admin/enterprises` | ✅ 真实企业 |
| 企业套餐授权 | `/api/admin/recruitment/authorization/grant` | ✅ 真实授权 |

### 边界确认（掌柜三入口原则已落地）
- 📊 数据罗盘：AI员工使用次数/Token/成本/成功率/企业活跃/收入/续费
- 🏢 企业招聘工作台（前台）：岗位/候选人/面试/招聘流程/AI员工/日报
- 🔧 本后台（5 页）：Agent 产品配置/套餐订阅/AI Agent/企业用户/企业套餐授权

---

## T02 数据罗盘 CEO 经营驾驶舱（第一屏 80%）✅

### 新端点
`GET /api/admin/dashboard/ecosystem` — 6 业务线真实聚合（30 天窗口）：
| 业务线 | 项目 | 调用 | 用户 | 成本 | 状态 |
|--------|------|------|------|------|------|
| 🎬 AI 短剧 | 71 | 602 | 3 | ¥12.78 | 运营中 |
| 💼 求职招聘 | — | 29 | 4 | ¥0.04 | 运营中（9 AI员工） |
| 🌎 GEO优化 | 9 | 0 | 0 | ¥0 | 运营中（无调用，诚实） |
| 📖 小说 / 🎵 音乐 / 🖼 电商 | — | — | — | — | **未上线（诚实显示，不填 0 伪装）** |

### 新组件
`WorkspaceEcosystemCard.vue` — 生态地图 6 线卡片（运营中/未上线徽标，项目/调用/用户/成本/AI员工）

### 布局重排（掌柜草图落地）
```
Row1: 时间范围控制栏
Row2: KPI 6 列（用户/企业/收入/VIP/AI员工/调用）
Row3: 用户增长 | 商业收入 | Agent 运营（3 列）
Row4: Workspace 生态地图（跨 2 列）| AI 健康
Row5: 实时事件条
```
**验收：1920×1080 首屏零滚动（scrollHeight=1080），全部 5 卡 + 生态地图 6 线首屏可见**

---

## T03 Workspace 后台统一壳 ✅

### 架构
```
🏭 Workspace工作台管理
 ├ 💼 求职招聘管理（5 页商业管理，已有）
 ├ 🎬 短剧工作台 → /admin/workspace/short-drama/{config,agents,data,users}
 ├ 🌎 GEO优化工作台 → /admin/workspace/geo/{config,agents,data,users}
```
- **统一壳页面** `pages/admin/workspace/[code]/[[tab]].vue`：配置/Agent/数据/用户 4 Tab
- **统一端点** `GET /api/admin/workspace/:code`：项目列表 + 调用/成本/用户/AI员工 聚合
- 未上线业务线（小说/音乐/电商/广告）**从导航隐藏**（registry 注释保留，业务真正上线再注册）——不在导航里留空壳占位
- 杜绝 `/admin/short-drama-xxx` 散页面模式（当前全仓 0 个）

### 各 Tab 内容
| Tab | 内容 |
|-----|------|
| 📊 数据 | 项目列表（真实 Project 表）+ 4 指标（项目/调用/用户/成本） |
| 🧠 Agent | 业务线 AI 员工资产（无则诚实提示归 AI Agent 管理） |
| ⚙️ 配置 | 平台级配置统一在「大模型管理」「AI Agent 管理」，业务线不重复配置 |
| 👥 用户 | 30 天去重调用用户概览（明细归会员管理） |

**验收：短剧 71 项目列表 / GEO 9 项目列表 / Agent Tab 诚实占位，3 页 PASS**

---

## 治理规则新增（冻结）

1. **后台一级导航冻结为 8 组**：数据罗盘/公共信息设置/VIP套餐管理/用户与权限/大模型管理/AI Agent管理/Workspace工作台管理/系统设置
2. **业务线后台必须走统一壳**（/admin/workspace/:code），禁止散页面（/admin/xxx-biz-xxx）
3. **未上线业务线不进导航**（不展示空壳占位），业务上线后再注册（三件套：前台 + Workspace Registry + Route Registry）
4. **业务线页面不重复配置平台能力**（模型/Provider/API Key/通道），统一归大模型管理

## 截图

`docs/reality/ADMIN-CLEANUP-02-dashboard-first-screen.png`（驾驶舱首屏）
`docs/reality/ws-shell-{short-drama-data,short-drama-agents,geo-data}.png`（统一壳）
`docs/reality/recruit-{index,config,plans,agents,enterprises,authorization}.png`（招聘 5 页）

## 提交

- T01: `a61d15da` 之后的 commit（12 页 deprecated 标记 + 验收）
- T02: 驾驶舱重构 commit
- T03: 统一壳 commit
