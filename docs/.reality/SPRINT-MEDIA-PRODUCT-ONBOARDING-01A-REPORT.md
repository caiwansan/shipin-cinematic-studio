# SPRINT-MEDIA-PRODUCT-ONBOARDING-01A-REPORT — CEO 驾驶舱产品化（SaaS 价值地图）

**Date:** 2026-08-02 05:10
**Gate:** 掌柜战略指令（UX-01~03 是「造产品」，本 Sprint 让产品具备 SaaS 销售能力——免费用户看到完整产品价值地图 → 理解能力 → 愿意订阅 → 解锁 AI 员工 → 开始运营闭环）
**范围:** 01A 只做首页 CEO 驾驶舱 + AI 员工价值展示 + 渠道资产中心（不扩散）
**原则:** 展示价值而非隐藏 · 所有数字真实 · 免费/订阅边界清晰 · 架构红线零违反

---

## 0. 结论

✅ **Sprint-MEDIA-PRODUCT-ONBOARDING-01A COMPLETE** — 首页从「已经设计好的运营中心」升级为「可销售、可理解、可转化的 SaaS 产品首页」。G1-G8 全 PASS。

## 产品定位落地

```
AI 新媒体运营中心（首页新结构，自上而下 = 价值地图）
① CEO 驾驶舱 · 部门状态卡（未激活 / 0/5 员工 / 0/4 渠道 / 0/0 任务）
② 我的 AI 团队（5 员工价值全展示 · 🔒 订阅解锁）
③ 渠道资产中心（微信/抖音/小红书/视频号 4 平台蓝图）
④ 健康度 + KPI（免费运营基础设施）
⑤ 今日时间轴 + 行业智能（免费）
⑥ 最近执行 + 今日成本（免费）
```

核心转变：**免费用户不再看到「空白等待接入」，而是看到「完整的未来部门」**——团队是谁、能干什么、需要什么、怎么解锁，一屏讲清。

## 交付明细

### ① CEO 驾驶舱 · 部门状态卡（新）
- AI 新媒体运营部 + 真实状态（未激活/已部署/运行中，由 agents 真实计算）
- 团队 0/5、渠道 0/4、今日任务 0/0 —— 全部真实计数（EnterpriseAgentInstance / mediaPlatformAccount 守卫式计数 / AgentSchedule+AgentOutcome）
- 无数据 → 等待激活/未连接（禁 mock）

### ② 我的 AI 团队（订阅入口，价值不隐藏）
- 免费用户完整看到 5 名编制员工：Alice 运营总监 / Bob 内容策划 / Carol 内容生产 / David AI 客服 / Eve 数据分析
- 每卡：头像 + 角色 + 岗位职责 + 🔒 订阅解锁
- 点击 → **AI 员工订阅说明弹窗**：5 员工职责 + 每人的业务价值（「不再为今天发什么发愁」「私信秒回」「每周自动复盘」）+ 订阅后路径（自动部署 → 绑定账号 → 自动执行 → 成果回流）
- 弹窗 CTA 引导真实下一步：「先去连接公众号 →」（01C 将替换为真实商业入口）
- 已部署态兼容：有 agents 时自动切换为真实员工状态列表

### ③ 渠道资产中心（4 平台蓝图）
- 微信公众号 / 抖音 / 小红书 / 视频号 —— 对齐掌柜蓝图（替换旧 3 平台条：微博/知乎移除）
- 全部未连接（真实）+「连接账号后，AI 员工才能开始运营」+ 免费用户可手动管理渠道
- accounts.vue 多平台规划同步对齐（抖音/小红书/视频号）

### 后端（唯一改动）
- overview 端点新增 `channels: { connected, total: 4, platforms }` 字段
- **守卫式计数**：mediaPlatformAccount 表存在 → 真实 active 计数；未落地 → 诚实返回 0（见关键发现 #2）
- 驾驶舱数据源保持 overview 单一 SSOT

## 免费 / 订阅边界（产品语义）

| 能力 | 免费用户 | AI 员工订阅用户 |
|------|---------|----------------|
| 工作台访问 + CEO 驾驶舱 | ✅ | ✅ |
| 渠道管理（手动） | ✅ | ✅ |
| 内容流程 / 数据查看 | ✅ | ✅ |
| 我的 AI 团队（查看价值） | ✅ | ✅ |
| AI 员工部署与自动运营 | 🔒 订阅解锁 | ✅ 自动部署 5 员工 |
| AI 私信/客服/数据分析 | 🔒 | ✅ |

商业逻辑：**不是不给看，而是让用户看到价值再购买**。订阅入口 01C 接入 Commerce Authority 真实流程。

## Reality Gate

| Gate | 要求 | 结果 |
|------|------|------|
| G1 | 用户第一次进入理解产品 | ✅ 产品名/部门/状态/计数全可见（浏览器实测） |
| G2 | 免费价值清晰 | ✅ 健康度/KPI/时间轴/行业智能/免费渠道管理标注 |
| G3 | AI 员工价值清晰 | ✅ 5 员工全展示 + 订阅解锁标识 + 说明弹窗（职责+价值+路径） |
| G4 | 所有占位真实无 mock | ✅ 0/5、0/4、0/0 全部真实计数；渠道平台为产品蓝图占位（非假数据） |
| G5 | 不影响其他 Workspace | ✅ 仅 3 文件（index.vue / accounts.vue / overview 端点） |
| G6 | 用户体系复用 | ✅ 0 命中 MediaUser，继续 Kunlun Identity |
| G7 | 模型体系复用 | ✅ 0 命中 MediaModelConfig，继续 User/Org Model Config → Unified Resolver |
| G8 | Build 生产验证 | ✅ Nuxt build PASS + 生产域浏览器实测（G1-G4 + 弹窗交互全通过） |

## 关键发现（供掌柜决策）

1. **mediaPlatformAccount 表不存在**：media-platform.service.ts 的账号模型是未落地的死代码（schema 未建）。新媒体渠道连接的真实数据模型待 Sprint-MEDIA-01 落地。本次 overview 用守卫式计数保持诚实（0/4 是真实——当前无连接能力）。
2. **EnterpriseChannelAccount = 企业微信客服线**（channelType 默认 wechat_work），与新媒体公众号/抖音渠道语义不同，不可混用计数。
3. **01A 完成「价值地图展示」**；01B（内容生产车间 + AI 私信空间）与 01C（免费/订阅商业表达 + 真实订阅入口）待掌柜指令推进。

## 冻结清单（持续）

❌ 不建 MediaPlan/MediaSubscription ❌ MediaUser ❌ MediaModelConfig ❌ mock ❌ 平台托管 Key
✅ 商业体系：Commerce Authority → EnterpriseSubscription → EnterpriseEntitlement（扩展等商业验证）
⏸ 01B / 01C / Sprint-MEDIA-01 微信接入

**锚点**：`frontend/pages/workspace/media/index.vue`、`accounts.vue`、`backend/src/routes/enterprise-readonly.routes.ts`、截图 `audit-screenshots/ONBOARDING-01A-{home,modal}.png`
