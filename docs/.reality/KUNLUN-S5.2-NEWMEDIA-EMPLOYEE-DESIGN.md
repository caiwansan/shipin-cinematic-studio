# KUNLUN-S5.2-NEWMEDIA-EMPLOYEE-DESIGN.md

> S5.2 第三 AI Employee 商品 — 新媒体运营 AI Employee（Phase A Design Freeze）
> 日期: 2026-08-06 12:05 (CST) | 状态: ✅ **审计完成 + 设计冻结, 待掌柜批准实施**
> 依据: 掌柜 S5.1 验收裁决（方案 A: 第三个 Employee 优先于 Marketplace; 先审计新媒体可否去浏览器自动化仍成商品）
> 定位: **完成 3 Employee Portfolio（招聘/短剧/新媒体）, 为 Marketplace 铺路**

---

## 0. 审计结论（实证）

### 1) media-department 现状
- 工作台 5 页: index / workspace / analytics / employees / settings —— 完整新媒体部门工作台
- **EnterpriseAgentProfile 员工档案模型已存在**（role/agentType/businessType/goal/knowledgeScope/tools/permissions/capabilities/kpiMetrics/runtimeStatus + media-department/employees CRUD）
- 员工档案基础设施 = 新媒体员工的「身份底座」已有

### 2) 新媒体内容能力（非浏览器域, 可商品化基础）
| 现有资产 | 域 | 商品化可用性 |
|---|---|---|
| ai-optimize-ad-script | 广告文案/脚本优化 | ★★★ content.draft 的先例（文案生成能力已验证） |
| ai-generate-ad-video | 视频生成（用户 BYOK 视频模型） | ★★ 不属 Skill LLM 域（视频模型路由, 保持外置） |
| script-breakdown / script-submit | 脚本拆解/提交 | ★★ 内容生产链 |
| admin-posts | 帖子管理 | ★ 管理域, 非岗位能力 |

### 3) 浏览器自动化冻结影响（掌柜核心问题）
```
media-platform.ts: 22 路由, 27 处 browser 引用（accounts/cookies/browser-launch/navigate/save-session...）
→ 全部排除（自动发布/自动登录/自动私信/浏览器自动化 = 冻结域）
→ 新媒体员工 Skill 只做「岗位能力」: 内容策划/内容生成/运营分析
→ 输入输出 = 文本/JSON, 零平台操作
结论: ✅ 去掉浏览器自动化依赖后, 新媒体仍可成为商品（商品化的是岗位能力, 不是平台操作）
```

## 1. 商品定位（Identity）

```
code:            def-newmedia-ops
name:            新媒体运营 AI Employee
description:     帮助运营团队完成内容策划→内容生成→运营分析（不触达平台操作）
capabilities:    ["content.strategy", "content.draft", "ops.analysis"]
组件 Skill def（F1 同构 Alice/短剧）:
  def-content-strategist    [content.strategy]
  def-content-copywriter    [content.draft]
  def-ops-analyst           [ops.analysis]
```

## 2. Capability List（3 Skill 契约）

### NM-01 content.strategy（内容策划）
```
输入: { brand: string(品牌/账号定位), topic: string?(选题方向), goal: "engagement"|"conversion"|"awareness"(默认 engagement) }
输出: { strategy: string, pillars: [{ theme, reason }], calendar: [{ title, platform, day, format }] }
契约: LLM JSON 契约; calendar 条目 ≤10（AI 输出治理）
```

### NM-02 content.draft（内容生成）
```
输入: { topic: string, tone?: string, format: "post"|"article"|"video_script"(默认 post), length?: number(默认 200, ≤1000) }
输出: { title: string, body: string, hashtags: string[], cta: string }
契约: LLM JSON 契约; body 长度受控
```

### NM-03 ops.analysis（运营分析）
```
输入: { metricsText: string(运营数据文本, 用户提供), question?: string }
输出: { insights: string[], recommendations: string[], risks: string[] }
契约: LLM JSON 契约; 纯分析, 不触达数据源/平台
```

## 3. Runtime 接入（复用模板, 零新基础设施）

```
Desktop（AI 员工区块自动发现 def-newmedia-ops）
  → Entitlement Gate（capabilityCodes 加 code）
  → executeSkillPlan（orchestrator 零改动）
  → Hermes Tool Sandbox（+3 薄工具: content.strategy / content.draft / ops.analysis）
  → 内部路由（x-internal-token 门禁）→ unifiedAIGateway.invokeAI（唯一入口, 禁 narrativeGateway 直连）
  → 纯函数解析器（newmedia-parser.ts, 零 LLM）
  → deliverNewMediaAssets → 每任务 3 JSON（复用 Asset+UserAsset, 零新表）
```

## 4. Asset Contract

```
content-plan.json      # NM-01 输出（策略/内容支柱/排期）
content-drafts.json    # NM-02 输出（标题/正文/话题标签/CTA）
ops-analysis.json      # NM-03 输出（洞察/建议/风险）
```

## 5. Reality Gate（NM1-NM6）

| # | 关卡 | 验证 |
|---|---|---|
| NM1 | Identity | def-newmedia-ops 唯一 + Desktop 可发现 |
| NM2 | Skill Boundary | 3 组件 Skill 授权 + 路由门禁 + Parser 单测 |
| NM3 | Runtime | 全链真实执行（3 Skill source=real; 禁浏览器自动化 ✅） |
| NM4 | Asset | 3 JSON 创建 + Asset/UserAsset + URL |
| NM5 | Commercial | 未授权拒 / 授权执行（多员工授权: 3 员工共存的 capabilityCodes） |
| NM6 | 双回归 | Alice + 短剧导演 全链无影响 |

## 6. 边界（冻结确认）

✅ 允许: 新 AgentDefinition / 新 Skill / 新 Prompt Contract / 新 Asset 类型
❌ 禁止: 自动发布 / 自动登录平台 / 自动私信 / 浏览器自动化 / 平台数据爬取 / 新 Runtime / 新权限体系 / narrativeGateway 直连 / Marketplace / Memory / Loop

## 7. 结论

```
新媒体去掉浏览器自动化后仍可商品化 ✅
→ 3 Employee Portfolio（招聘/短剧/新媒体）: 三个完全不同业务域
→ Marketplace 前置（3+ 稳定员工 + 统一审核）推进 3/3
→ 下一步（批准后）: S5.2 Phase B 最小实现（同 S5.1 模式）
```
