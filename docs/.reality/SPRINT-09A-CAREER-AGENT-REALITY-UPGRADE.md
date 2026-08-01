# Sprint-09A: Career Agent Reality Upgrade

**Gate:** 掌柜 2026-07-30 签署
**产品宪法:** Single Model Authority | AI Employee Runtime | Task → Outcome → Audit

## 目标

让 Alice 从第二条孤立路径，成为整个求职工作台的唯一智能入口。

## 执行顺序

```
09A-01 Model Authority Fix
 ↓
09A-05 Conversation Runtime Migration
 ↓
09A-10 Capability Binding
 ↓
09A-15 Audit Outcome Gate
```

## 保护规则

1. **ModelSettingsModal 不应有 career_agent 分支** — 能力筛选是展示层过滤，不能改变存储目标。最终只允许 UserModelConfigV2 成为运行时来源。
2. **Task 类型边界** — EnterpriseAgentTask 只用于 AI 工作任务（profile_extraction, career_plan 等），普通系统动作（收藏岗位、改头像）不创建 AgentTask。
3. **API 不变** — 前端只知道"和职业顾问聊天"，POST /api/job/chat 保持不动。

## Alice Reality Gate（验收标准）

用户完成一次完整流程，数据库必须且只能看到：

```
EnterpriseAgentTask    1 条
EnterpriseOutcome      1 条
AuditEvent            ≥1 条
```

模型调用来源：UserModelConfigV2，provider/model 与用户设置一致。
