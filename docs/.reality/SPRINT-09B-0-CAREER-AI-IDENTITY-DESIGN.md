# Sprint-09B-0 Career AI Identity Design

> 镜心 —— 昆仑镜个人职业 AI 伙伴
>
> 冻结日期：2026-07-30
> 冻结人：掌柜

## 背景

Sprint-09A 完成 Career Agent Conversation Runtime Migration。后端统一了企业/个人 AI 的架构（Hermes Runtime + UserModelConfigV2），但前端产品身份出现差异：

```
企业端：
Carol / Alice / Bob → AI Employee（可购买、有名有姓、有岗位）

求职端：
AI求职顾问 / 我的AI职业助理 → AI Service（无名字、像工具）
```

Sprint-09A-R Reality Audit 确认技术层 5/5 Gate 通过，但暴露产品身份未冻结。

**本文件即为身份冻结构件。**

---

## 决策 01：求职 AI 独立于企业 AI Employee ✅

**结论：完全独立。**

| 维度 | 企业 AI Employee | 个人 AI Partner |
|------|-----------------|----------------|
| 服务对象 | 企业 HR/招聘方 | 求职者/个人 |
| 商业关系 | 企业购买岗位能力 | 个人订阅成长伙伴 |
| 品牌名 | Alice / Carol / Bob | 镜心 |
| 利益定位 | 帮企业招对人 | 帮个人找对路 |

**不共享：** Identity、Brand、Conversation Persona、Business Context、Data Permission、Memory Namespace

---

## 决策 02：品牌名称 ✅

**结论：镜心**

候选比较：

| 名称 | 评价 |
|------|------|
| Nova | ❌ 太泛，与昆仑镜无品牌连接 |
| 小镜 | ⚠️ 亲切，商业化长期偏弱 |
| 启明 | ⚠️ 好听但泛化 |
| **镜心** | ✅ 品牌绑定强，有产品哲学 |

### 命名哲学

昆仑镜的核心价值：**帮用户看见隐藏的信息，做更好的决策。**

```
镜：看见自己
心：理解自己
```

求职场景下，用户不知道：
- 自己真正的优势是什么
- 哪些岗位适合自己
- 为什么被拒绝
- 下一步如何成长

镜心要帮用户「看见」和「理解」——镜见自我，心向未来。

---

## 决策 03：定位描述 ✅

**结论：AI 职业伙伴，不做 AI 职业顾问。**

| 概念 | 问题 |
|------|------|
| AI 职业顾问 | 偏一次性咨询、偏专家服务、不体现长期陪伴 |
| AI 职业伙伴 | 长期陪伴、共同成长、有温度 |

完整定位文案：

> **镜心，是你的 AI 职业伙伴。**
>
> 帮助你认识自己、规划方向、寻找机会、提升竞争力。

企业侧维持：

> **Alice，AI 招聘策略顾问**

两者定位词不同——「伙伴」vs「顾问」，体现产品关系差异。

---

## 决策 04：免费体验边界 ✅

**结论：镜心作为获客入口，不做硬次数限制。**

### 免费用户（镜心基础版）

```
✅ 职业画像建立
✅ 基础岗位匹配
✅ 简历分析
✅ 基础面试建议
```

### VIP/高级职业会员（镜心 Pro）

```
✅ 长期记忆
✅ 职业成长路线
✅ 简历持续优化
✅ 模拟面试
✅ 薪资分析
✅ 主动提醒/规划
```

### 企业侧（AI Employee）

```
Alice / Carol / Bob / 面试教练
—— 按岗位购买
```

**原则：免费感受到价值 → 付费解锁深度能力。**

---

## 决策 05：共享 Runtime，不共享身份 ✅

**结论：技术层共享，产品层隔离。**

```
           Hermes Runtime
                │
                │
         ┌──────┴──────┐
         │              │
   企业 AI Employee  个人 AI Partner
         │              │
   Alice / Carol     镜心
    Bob / 面试教练    职业伙伴
```

### 共享层

```
UserModelConfigV2
resolveRuntimeConfig
CareerConversationOrchestrator
Task Engine (EnterpriseAgentTask)
EnterpriseOutcome
Audit Trail (agentAuditTrail)
```

### 隔离层

```
Agent Identity (EnterpriseAgentProfile vs 独立 Profile)
Conversation Persona (招聘策略 vs 成长陪伴)
Memory Namespace
Business Context (企业 tenant vs 个人 userId)
Data Permission (企业隔离 vs 个人私有)
```

---

## 镜心 → Career Agent 接入路径

现有后端链路已就绪，前端只需：

### 步骤 1：Identity 注册

在 `enterprise_agent_profile` 或新的个人 AI Profile 表中创建镜心身份：

```typescript
{
  name: '镜心',
  title: 'AI 职业伙伴',
  role: 'career_partner',
  type: 'personal', // vs 'enterprise'
  capabilities: ['career_plan', 'resume_analyze', 'job_search', 'interview_prepare'],
  description: '帮助你认识自己、规划方向、寻找机会、提升竞争力'
}
```

### 步骤 2：前端品牌替换

`/workspace/job` 页面：

```
页面标题: 🎯 镜心 · 职业伙伴
身份标签: 镜心 / AI 职业伙伴
品牌标识: 昆仑镜 × 镜心
```

### 步骤 3：Conversation Persona 更新

Career Agent system prompt 增加镜心 persona：

```
你是镜心，用户的 AI 职业伙伴。
你的职责是帮助用户认识自己、规划职业方向、寻找机会、提升竞争力。
你温暖而不煽情，专业而不冰冷，像一位真正关心用户成长的朋友。
你不是招聘方，你站在用户这边。
```

### 步骤 4：商业权益对接

免费/付费 gate 在 Task 执行前判定（复用现有 capability gate 架构）：

```typescript
// 免费用户 —— 基础任务通过
if (userTier === 'free' && ['career_plan', 'resume_analyze'].includes(taskType)) {
  return allow; // 基础能力免费
}

// 高级任务 —— 检查订阅
if (userTier === 'free' && ['salary_analysis', 'mock_interview'].includes(taskType)) {
  return deny('PREMIUM_FEATURE'); // 需要升级
}
```

---

## 架构总图

```
                  昆仑镜 AI 人才生态
                         │
              ┌──────────┴──────────┐
              │                     │
           企业侧                 个人侧
              │                     │
     ┌────────┼────────┐            │
     │        │        │            │
   Alice    Carol     Bob         镜心
 招聘策略   招聘专员  AI面试官    AI职业伙伴
              │                     │
         ─────┴───────      ───────┴───────
         Hermes Runtime    Hermes Runtime
         UserModelConfig   UserModelConfig
         Task Engine       Task Engine
         Outcome           Outcome
         Audit             Audit
              │                     │
         Enterprise DB          Personal DB
         (tenant隔离)          (用户私有)
```

---

## Sprint 执行顺序

```
Sprint-09B-0   ← 现在（身份冻结）
 Career AI Identity Design
 ↓
Sprint-09B-1
 镜心 Identity 接入 Career Agent
（前端品牌替换 + Persona 更新）
 ↓
Sprint-09B-2
Platform AI Gateway
（免费用户模型兜底）
 ↓
Sprint-09C
商业化验证
（付费 gate + 订阅入口 + 价值闭环）
```

---

## 引用

- [Sprint-09A Reality Gate 报告](../workspace/SPRINT-09-09A-COMPLETION.md)（待确认路径）
- [Sprint-11D Capability Runtime Commerce Foundation](../../MEMORY.md#sprint-11d-capability-runtime-commerce-foundation--complete-)
- [Recruitment AI Employee Reality Gate v1](../../MEMORY.md#recruitment-ai-employee-reality-gate-v1--pass-)

---

> **本文件为产品宪法级冻结构件。五个决策改动需掌柜本人确认。**
> 🏮
