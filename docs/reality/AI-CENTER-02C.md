# Sprint-AI-CENTER-02C Hermes AI员工模型智能推荐层 — COMPLETE ✅

**Date:** 2026-08-01 23:15
**Gate:** 掌柜验收 02B PASS + 02C 指令（AI员工身份+业务场景+能力评分+成本策略 → 推荐模型组合；只建议不自动切换；不扩散短剧/小说/代码）

## 战略意义
02B「推荐 AI 大脑」→ 02C「为 AI 员工推荐 AI 大脑」：Hermes 架构连接点。
> AI员工（Alice/Bob/Carol）+ 模型推荐 + **角色约束** = AI员工模型智能编排的第一层。

## T01 AgentAIProfile 画像表（平台层 SSOT）
- 新表 `agent_ai_profile`：agentType(unique) / roleName / workspace / preferredCapabilities(六维) / avoidCapabilities / costPreference / reasonNotes
- seed 4 画像（掌柜定稿）：
  | agentType | 角色 | 权重 | 成本策略 | 推荐 |
  |-----------|------|------|---------|------|
  | recruiter | 招聘顾问 Alice | 中文35 推理30 质量20 成本15 | 均衡 | DeepSeek 92.7 |
  | interview | 面试专家 Bob | 推理40 质量40 中文20 | 质量优先 | **ChatGPT 93.6 + Claude 92.7** |
  | talent_analyst | 人才分析师 Carol | 中文35 推理25 质量20 成本20 | **成本优先** | DeepSeek 93.2 |
  | career_advisor | 职业助理 | 中文35 质量25 推理25 成本15 | 均衡 | DeepSeek 92.5 |

## T02 引擎（只建议，不自动切换）
```
GET /api/ai/agent-recommendation?agentType=recruiter&workspace=job
```
1. 画像 = AgentAIProfile[agentType]（无画像 → 回退场景权重，诚实标注 workspace_default，不伪造角色画像）
2. avoidCapabilities：维度权重 ×0.3（降低不硬排除 → 无空集）
3. costPreference：cost_priority → cost×1.6 / quality_priority → quality×1.6
4. 权重归一化 Σ=100 → score = Σ(cap × w) 0-100 可比
5. primary=top1 / secondary=top2；reasons = 角色化原因（reasonNotes）+ 成本策略说明

### 实测（生产域，全符合掌柜预期）
| 画像 | 🥇 | 🥈 | reasons |
|------|-----|-----|---------|
| 招聘顾问 | DeepSeek 92.7 | Kimi 88.7 | 中文招聘理解优秀·推理能力优秀·生成质量强 |
| 面试专家 | **ChatGPT 93.6** | **Claude 92.7** | 推理能力优秀（结构化面试分析）·生成质量强·质量优先策略 |
| 人才分析师 | DeepSeek 93.2 | 智谱 88.7 | 中文简历理解·数据分析推理强·成本优先策略 |
| 职业助理 | DeepSeek 92.5 | Kimi 88.7 | 中文职业建议·求职方案·推理能力 |
| content_creator（无画像） | DeepSeek 92.7 | — | source=workspace_default（诚实标注） |
| 非法参数 | 400 ✅ | | |

## T03 AI员工详情页（员工管理中心，无新页面）
AgentCapabilityCenter 每员工卡片新增 **🧠 AI大脑建议** 区块：
- 当前角色 / 🏆 推荐（DeepSeek 92.7分）/ 🔶 备选 / ✓ 原因 3 条 / 成本策略徽标
- 无画像员工 → 「基于场景默认权重」诚实标注
- [应用建议 → 配置企业模型] → model-settings（人工确认 → 已有 BYOK 配置，不自动切换）

## 验收（浏览器生产域实测全 PASS）
AI大脑建议渲染 ✅ 角色/推荐/分数/原因/成本徽标/应用按钮 ✅（demo 真实登录态）
截图：docs/reality/AI-CENTER-02C-agent-brain.png

## 边界（掌柜红线全守住）
✅ 只建议不自动切换 ✅ 不修改 Runtime ✅ 不修改 UserModelConfigV2 ✅ 不新增 Provider 体系（复用 AIProviderDirectory + workspaceAIWeight + AgentAIProfile）✅ 不扩散短剧/小说/代码（组件化后 03 统一复制）

## 复用价值
引擎与 02B 共享 buildReasons/getWeight/DIM_KEYS（导出复用），后续短剧导演/小说作者/编程助手 = 加画像行 + 复用组件，成本最低。

提交：`（见 git log）`
