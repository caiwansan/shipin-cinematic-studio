# SPRINT-MEDIA-BROWSER-WORKSPACE-01.1 Domain Boundary Fix — 业务域隔离修复

**Date:** 2026-08-02 21:45 CST
**Gate:** 掌柜战略指令（暂停 G2 扫码验证。Task08.1 Owner View 存在 AI Employee Domain 污染：展示了 Career Agent「用户AI职业助理」而非 Media AI Employee → 先做 Domain Boundary Fix）

## 问题根因（掌柜判断完全正确）

> 技术基础设施升级方向正确 ✅ ｜ 新媒体产品呈现方式错误 ⚠️

- 唯一 active 绑定：**Career Agent（f41b42ad「用户的AI职业助理」）→ 抖音 workspace b27a2e1e**
- `owner-view` API 无业务域过滤，全量返回 → 新媒体工作台展示「我的AI职业助理正在操作抖音」
- `media/overview` agents 查询无域过滤 → team 页同样会混入 career agent
- `BrowserWorkspace` / `EnterpriseAgentProfile` 均无 businessType 字段（overview 代码里 `businessType: true` 是 pre-existing 编译错误，证明该字段本应存在但从未建立）

## 修复内容

### Task 03：业务域隔离（模型层）
- `EnterpriseAgentProfile.businessType`（默认 career）：career / media / ecommerce / legal
- `BrowserWorkspace.businessType`（默认 media）
- migration：`prisma/migrations/sprint-media-browser-workspace-domain-boundary/migration.sql`
- 存量回填：career 域 23 个 profile（career_advisor/recruiter/interview/talent_analyst/talent_agent）、media 域 2 个（content_creator/hotspot_analyst）、workspace 全 media
- 索引：`(organization_id, business_type)` 组合索引

### Task 01：Owner View 数据源修复
- **双过滤**：workspace.businessType='media' + agent.profile.businessType='media'
- org 隔离：普通用户 organizationId + businessType；admin 超管仅按域隔离
- 返回 agent 增加 agentType/businessType；owner-view 支持 `?businessType=` 参数
- media/overview agents 两步查询（media profile id 白名单 → instance），修复 pre-existing 编译错误

### Task 02：补齐新媒体 AI 员工
- 创建 **Alice 新媒体运营主管**（media_operator / media 域）+ instance + 绑定抖音 workspace
- Career Agent 跨域绑定 **paused**（保留审计，不删除）

### Task 04：Owner View 产品呈现重设计
```
新媒体运营部门 · 我的 AI 员工
┌─────────────────────────────────┐
│ 👩 Alice        🟢 工作中        │
│   新媒体运营主管                  │
│   ● 新媒体运营部门                │
│ 工作电脑：🖥 douyin运营空间       │
│ 状态：RUNNING                    │
│ 最近动作：2 分钟前 · 正在读取粉丝/获赞指标 │
└─────────────────────────────────┘
```
- 标题/部门标识/「工作中」状态/工作电脑语言全对齐掌柜产品模型
- 禁止 Career/Recruitment Agent 混入

## 验收（13 项断言全 PASS）

| # | 断言 | 结果 |
|---|------|------|
| R0 | demo 登录成功 | ✅ |
| R1 | owner-view 全 media 域 | ✅ |
| R1 | 无 Career/Recruitment Agent 混入 | ✅ |
| R1 | 显示 Alice 新媒体运营主管 | ✅ |
| R1 | workspaceId + platform 明确 | ✅ |
| R1b | media/overview agents 无 career | ✅ |
| R2 | career agent-identity 接口 200 | ✅ |
| R2 | career 实例保留（23 个未删） | ✅ |
| R3 | workspace 列表可查 + 均有 businessType | ✅ |
| R4 | 跨域 career binding 已 paused | ✅ |
| R4 | active 绑定全为 media 域 agent | ✅ |

浏览器生产域实测：`docs/reality/DOMAIN-BOUNDARY-FIX-01-accounts.png`
脚本：`scripts/reality-check-domain-boundary-fix.cjs` ｜ `scripts/sprint-media-domain-boundary-fix.ts`

## 关键纪律
- 零删除：career agent / binding 全保留（paused 审计）
- 双保险过滤：workspace 域 + agent 域，防未来电商/法律 AI 串线
- 求职招聘工作台零影响（接口回归 200）

## 冻结清单（持续）
❌ 微信/淘宝真实接入 ❌ 渠道 API ❌ 商品/订单表 ❌ 假经营指标
⏸ 下一步：G2 真人授权验证（Alice 登录抖音）→ G3 持久化 → G4 Alice 读取数据
