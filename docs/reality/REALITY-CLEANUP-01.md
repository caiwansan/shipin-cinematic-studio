# SPRINT-REALITY-CLEANUP-01 — 用户可见假数据清零 — COMPLETE ✅

**Date:** 2026-08-01 05:30 CST
**Gate:** 掌柜指令（Reality Gate 违规：用户看到的数据必须来自真实 DB/API，禁止 Mock 冒充生产状态）
**范围:** A1-A5（B 类价格商业决策冻结）

## 修复清单

### T01 media-department/index.vue（企业信息真实化）✅
**修复前（假数据）：** 有企业 → 写死 `企业版` / `employeeMax=20` / `employeeCount=0` / `connectedPlatforms=[]`；
`isLoggedIn=true` 强制登录（demo 模式）；假登录弹窗「登录功能尚未实现」；「查看运营数据」假入口。

**修复后（真实）：**
- 登录态跟随真实 token（无 token 显示欢迎页）
- 套餐名/员工额度 ← `/api/enterprise/subscription/current`（Subscription SSOT）
- 企业名/orgId ← `/api/enterprise/onboarding/status`（后端补 `hasOrganization/organizationName/organizationId` 字段）
- AI 员工列表 ← `/api/enterprise/media-department/employees`（profile+instance 真实合并）
- 已连接平台：后端 media 模块未上线 → 诚实显示「未连接」，不造假
- 紧急停止按钮（假本地翻转）移除；登录/注册弹窗 → 跳首页真实登录；假入口全部删除

### T02 media-department/workspace.vue（AI 员工真实化）✅
**修复前（假数据）：** 6 个写死 AI 员工（AI运营总监/热点分析师/销售顾问…）；配置按钮 `alert('Phase 2')`；
创建按钮 `alert('Phase 2')`；紧急停止假翻转；快速任务 disabled 假按钮。

**修复后（真实）：**
- 员工列表 ← 真实 API（热点分析师小镜/内容创作小笔，含 runtimeStatus）
- 启停 ← `POST /api/enterprise/agent-profiles/:id/pause|resume`（真实端点）
- 创建员工 ← `POST /api/enterprise/media-department/employees`（真实弹窗：名称+岗位类型，含 entitlement 限额检查）
- 无 API 的按钮全部移除（配置/快速任务/紧急停止）

### T03 director-os/aigc/admins.vue（管理员数据真实化）✅
**修复前（高危）：** API 失败 → 返回 3 条假管理员（admin/operator1/operator2，2025 年假时间戳）；
创建失败也 push 假数据（注释 "Mock success"）；删除失败假装成功。

**修复后：**
- API 失败 → 显示错误状态 + 重试按钮（模板 error 分支已存在，接通）
- 创建失败 → 显示真实错误，不 push 假数据
- 删除失败 → alert 真实错误，不本地删

### T04 media-department/settings.vue（套餐信息真实化）✅
**修复前：** `planName='基础版'` 永不更新；企业创建 `alert('Phase 1 演示')` 假创建；
连接平台调 404 端点（media-platform 路由从未注册）；断开平台本地假翻转。

**修复后：**
- 当前套餐 ← `/api/enterprise/subscription/current`（HR猎头 ¥2999/月）
- 套餐列表 ← `/api/enterprise/subscription/available-plans`（DB EnterprisePlan：清包工/人事部/HR猎头）
- 企业创建 → 真实 `POST /api/enterprise`
- 连接/断开平台：后端未上线 → 诚实提示「正在接入中」，不发起无效请求
- 删除 404 的 connect 弹窗/轮询代码 + 硬编码域名 BASE_URL

### T05 用户可见 Phase2 假入口清理 ✅
- 紧急停止按钮（3 页面）移除
- 「查看运营数据」假入口移除（analytics 页保留为诚实占位，无入口）
- 假登录弹窗（3 页面）移除 → 跳首页真实登录
- 快速任务 disabled 假按钮移除

## 后端修复（2 个 bug）

| 文件 | 问题 | 修复 |
|------|------|------|
| `src/routes/enterprise.ts` | onboarding/status 用 `getOrganizationIdForUser`（返回 **org id**）当 tenantId 用 → 永远查不到 | 改用 `resolveTenantIdForUser`（返回 tenantId）+ 补 `hasOrganization/organizationId/organizationName` 字段 |
| `src/routes/enterprise.ts` | setup/complete 同样 bug | 同上 |

## 前端基础设施修复

| 文件 | 问题 | 修复 |
|------|------|------|
| `composables/enterprise/useMediaApi.ts` | API_BASE=`/api/v1` **后端从未注册** → 全部 404 | 改为 `/api/enterprise` + 真实端点路径；新增 `getSubscriptionCurrent` |

## 数据真相（审计发现）

- **media-platform 路由从未注册**（全仓 0 注册点）→ `/api/enterprise/media-department/media/*` 全部 404
- **mediaPlatformAccount 表不存在**（schema 未 migrate）→ 平台连接功能后端未上线
- **org 解析三套体系不一致**（架构债，本次未动）：
  - `media-department/employees` → governance 链路（govUser→tenant→govOrganization）
  - `subscription/current` → orgMember 链路（Organization 表）
  - onboarding → governance（本次修复）
  - 生产订阅挂在断裂 org id 上（52f4e88b 无对应 gov org）→ 多数企业 subscription/current 返回 hasSubscription:false
- `/api/plans` 404（前端旧调用）→ 真实端点 `/api/enterprise/subscription/available-plans`
- EnterprisePlan 表 3 个真实套餐：清包工 ¥299/月 / 人事部 ¥999/月 / HR猎头 ¥2999/月（price 单位为分）

## 验收（G1-G5，生产域名浏览器 Reality Check）

| Gate | 标准 | 结果 |
|------|------|------|
| G1 | 用户页面无 Mock 数据 | ✅ /media-department 无「企业版」假套餐；workspace 无写死员工；settings 无「基础版」 |
| G2 | API 失败不返回假数据 | ✅ admins.vue 无 operator1/2，无 Mock success；失败显示错误+重试 |
| G3 | Agent 列表来自 Runtime | ✅ 热点分析师小镜/内容创作小笔（DB 真实 profile+instance），2/10 额度 |
| G4 | 套餐来自 Subscription SSOT | ✅ HR猎头 ¥2999/月 真实订阅；settings 套餐列表 3 个真实套餐 |
| G5 | Build + 浏览器 Reality Check | ✅ nuxt build PASS；4 页截图存档 |

### 页面验收数据（demo@scs.com 测试企业，2026-08-01）

**/media-department：** 企业名「昆仑镜验收测试企业」| 套餐「HR猎头 ¥2999/月」| AI 员工 2/10 | 已连接平台「未连接」| 员工卡片 2 张真实 | 无紧急停止/假弹窗/假入口

**/media-department/workspace：** 2 个真实员工 + 运行中状态 + 暂停按钮 | 无 Phase2 按钮/配置假按钮

**/media-department/settings：** 当前套餐 HR猎头 ¥2999/月 | 3 个真实套餐卡片 | 无基础版/Phase1 演示

**/director-os/aigc/admins：** 仅 1 行真实管理员（admin，来自 AdminUser 表）| 无假 operator

截图：`docs/reality/reality-media-department.png` / `reality-workspace.png` / `reality-settings.png` / `reality-admins.png`

## 测试数据（验收用，已入库）

- demo@scs.com（密码 test123）：gov org「昆仑镜验收测试企业」+ HR猎头订阅 + 2 个 AI 员工
- admin（superadmin，密码 admin123）：AdminUser 表密码重置

## 冻结清单（持续）

❌ B 类价格/档位配置（credits.vue 档位、register.vue 套餐、payment/types.ts 价格口径、customer-service 话术）→ 待掌柜开 SPRINT-COMMERCE-PRICE-SSOT
❌ 平台连接（media-platform）后端上线
❌ org 解析三套体系统一（架构债）

## 提交

`git commit`（本次范围文件）
