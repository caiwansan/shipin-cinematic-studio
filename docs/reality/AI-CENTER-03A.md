# Sprint-AI-CENTER-03A AI团队协作编排观察层 — COMPLETE ✅

**Date:** 2026-08-01 23:50
**Gate:** 掌柜指令（AI-CENTER-03 拆层第一步：先让系统知道「一个任务需要哪些 AI 员工协作」，只展示不自动执行）

## 战略意义
> 从「AI工具」→「AI员工平台」的关键一步：让用户看到**不是一个人在 AI 工作，而是一支 AI 团队在协作**。

AI员工闭环再进一步：
```
身份 Identity + 能力 Capability + 运行 Runtime
+ 模型 Brain Recommendation (02C) + 团队协作 Workflow Observation (03A)
```
03A = 观察层；03B Hermes 任务执行连接、03C 自动化调度（掌柜路线图后续）

## T01 AgentWorkflowTemplate 表（观察层 SSOT）
- `agent_workflow_template`：id/name/businessType/taskType/agents(JSON [{agentType,order,task}])/status
- seed 3 招聘任务模板（有序协作 + 职责叙述）：
  | 任务 | 协作链 |
  |------|--------|
  | 招聘高级前端工程师 | ①Alice 生成招聘策略 → ②Carol 搜索匹配人才 → ③Bob 执行面试评价 |
  | 招聘高级后端工程师 | 同上链 |
  | 校园招聘管培生 | ①Alice 校招策略 → ②Carol 批量筛简历 → ③Bob 结构化面试 |

## T02 API（纯 GET，零写操作）
```
GET /api/ai/agent-workflow-templates?businessType=job        → 列表（任务名+agentCount）
GET /api/ai/agent-workflow-templates/:taskType               → 详情：有序团队 + 角色 + 模型建议
```
- 团队每员工模型 = **02C 共享引擎 recommendForAgentType()**（画像权重，角色约束不丢失）
- 响应含 `boundary: {autoExecute:false, autoCreateTask:false, autoConsumeToken:false, autoSwitchModel:false}`（红线显式声明）
- 404 无模板 → 404 ✅

### 实测（生产域，角色约束在团队卡片正确呈现）
```
招聘高级前端工程师 AI团队
1. 招聘顾问    [DeepSeek] 92.7分 — 生成招聘策略（岗位画像 + JD + 渠道建议）
2. 人才分析师  [DeepSeek] 93.2分 — 搜索匹配人才（渠道候选人 + 技能匹配 + 分析报告）
3. 面试专家    [OpenAI ChatGPT] 93.6分 — 执行面试评价（面试题 + 评估 + 录用建议）
```
（修复过程：初版 recommendFor 误用场景权重导致 Bob 也显示 DeepSeek → 重构为 02C 共享引擎，Bob 恢复 GPT ✅）

## T03 前端（员工管理中心，无新页面）
Summary 下方新增 **🧠 团队协作建议** 区块：
- 徽标「观察层 · 仅建议」+ 副标题「系统只识别与建议，由你确认发起」
- 3 任务卡片：数字流水线（①Alice·DeepSeek 92.7 — 生成招聘策略 → ②Carol... → ③Bob·ChatGPT 93.6 — 执行面试评价）
- [创建任务 → 职位管理] → 跳 /workspace/enterprise/jobs **人工发起**（不自动创建任务）

## 红线（掌柜全守）
✅ 只识别 ✅ 只编排建议 ✅ 只展示
❌ 不自动调用 Hermes（API 无执行链）❌ 不自动创建任务（按钮跳人工页）
❌ 不自动消耗 Token（零 LLM 调用）❌ 不自动切换模型（沿用 02C 只建议）
代码证据：03A/02C 路由写操作数 = 0（全 GET）

## 验收（浏览器生产域实测全 PASS）
团队协作建议区块 ✅ 观察层徽标 ✅ 3 任务卡片 ✅ ①Alice②Carol③Bob 职责 ✅ ChatGPT 模型徽标 ✅ 创建任务按钮 ✅
截图：docs/reality/AI-CENTER-03A-workflow.png

## 技术备注
- db push 被历史 drift 阻止（ai_provider.id 类型变更，禁 force-reset）→ 手工 SQL 建表
- 新表字段必须 @map snake_case（Prisma 默认 camelCase 列名，02C 表全 @map 是正确范式）

提交：`（见 git log）`
