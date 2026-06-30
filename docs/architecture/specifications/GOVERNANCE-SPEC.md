# KMKI Platform — Governance Specification v1.0

> **Version**: 1.0  
> **Status**: Draft  
> **Date**: 2026-07-20  
> **Purpose**: 定义 KMKI Platform 的架构治理体系。涵盖架构评审委员会、ADR 生命周期、Center 生命周期、例外管理、废弃管理、版本策略。  
> **Governing Docs**: Constitution v1.1, Blueprint v2.0, ADR v1.0, SDK v1.0, Template v1.0, Conformance v1.1  
> **Position**: 架构文档体系的顶层治理文档  

---

## 1. Architecture Board

### 1.1 职责

Architecture Board (ARB) 是 KMKI Platform 架构的最高决策机构，负责：

1. 审批所有 ADR
2. 审批新 Center 的创建
3. 审批架构例外（Conformance Exception）
4. 审批 API/Event 的废弃
5. 审批 v2.0 及以上的不兼容变更
6. 执行年度架构审计
7. 仲裁架构争议

### 1.2 组成

| 角色 | 人数 | 选举方式 |
|------|:----:|---------|
| 首席架构师 (Chair) | 1 | 创始人任命 |
| Center 架构师 | N | 每个 Center 1 位 |
| 平台工程师代表 | 2 | 轮值 |
| 产品代表 | 1 | 产品团队指定 |

所有 Center 架构师必须从 Center 的维护者中选举产生。首席架构师拥有否决权。

### 1.3 会议

| 频率 | 时长 | 议程 |
|------|:----:|------|
| 双周 | 60 分钟 | ADR Review + 新 Center 申请 + 例外评审 |
| 季度 | 120 分钟 | 平台健康检查 + 架构漂移审计 |
| 年度 | 全天 | 全平台架构审计 + 下一阶段规划 |

### 1.4 决策规则

| 决策类型 | 通过条件 | 可否决 |
|----------|:--------:|:------:|
| ADR 审批 | ≥ 2/3 多数 | 首席架构师 |
| 新 Center 创建 | ≥ 2/3 多数 | 首席架构师 |
| Conformance 例外 | ≥ 2/3 多数 | 首席架构师 |
| API/Event 废弃 | 简单多数 | — |
| v2.0 不兼容变更 | 全票通过 | 首席架构师 |

---

## 2. ADR 生命周期

### 2.1 ADR 状态

```
PROPOSED → REVIEWING → APPROVED → SUPERSEDED
            │                │
            └── REJECTED     └── IMPLEMENTED → DEPRECATED
```

| 状态 | 含义 |
|------|------|
| PROPOSED | 已提交 ADR，待评审 |
| REVIEWING | ARB 正在评审 |
| APPROVED | ARB 已通过，可以实施 |
| REJECTED | ARB 已拒绝，关闭 |
| IMPLEMENTED | 已在代码中落地 |
| SUPERSEDED | 被新的 ADR 替代 |
| DEPRECATED | 不再推荐使用 |

### 2.2 ADR 提交流程

```
开发者编写 ADR
  │
  1. PROPOSED → 提交 PR（含 ADR 文档）
  │
  2. ARB 评审（双周例会，或加急 1 个工作日）
  │
  3. 投票
  │
  ├── APPROVED → 合并 ADR → 进入 Implement 阶段
  │
  └── REJECTED → 记录拒绝原因 → PR 关闭
```

### 2.3 ADR 所需内容

每个 ADR 必须包含以下字段：

```
标题: 简明描述
状态: PROPOSED
日期: YYYY-MM-DD
作者: 姓名
受影响的 Center: 列表
Consequence: 对现有 Center 的影响
```

ADR 模板（存入 `docs/architecture/adr/TEMPLATE.md`）。

### 2.4 ADR 编号

```
ADR-NNN
  │
  └── 从 001 开始递增

已关闭的 ADR 编号不重复使用。
```

---

## 3. Center 生命周期

### 3.1 Center 状态

```
PLANNED → INCUBATING → STABLE → DEPRECATED → RETIRED
               │           │          │
               └── CANCELLED         └── ARCHIVED
```

| 状态 | 含义 | 必须满足 |
|------|------|----------|
| PLANNED | 已规划但未开始开发 | Specification v1.0 草案 |
| INCUBATING | 开发中或 Preview | Conformance ≥ Bronze |
| STABLE | 正式 Release | Conformance ≥ Silver |
| DEPRECATED | 标记废弃，不再建议新用户接入 | 废弃公告 + 3 个月通知期 |
| ARCHIVED | 代码仍在，但不再维护 | README 标记 ARCHIVED |
| RETIRED | 已从生产环境中移除 | 所有流量已迁移 |
| CANCELLED | 规划取消 | ADR 记录 |

### 3.2 新 Center 创建流程

```
1. 提交 Center Proposal（含 Specification 草案）
  │
  2. ARB 评审（双周例会）
  │
  ├── APPROVED → PLANNED → 开始开发
  │
  └── REJECTED → 记录原因 → 关闭
```

**Center Proposal 必须包含**:
- Mission（一句话职责）
- Non-Responsibility（明确不做什么）
- 至少 3 个 Registry 的初步定义
- 依赖的其他 Center
- 发布/订阅的事件列表
- Conformance Level 目标

### 3.3 Center 废弃流程

```
1. Center 维护者提交 DEPRECATION 提案
  │
  2. ARB 评审
  │
  ├── APPROVED
  │   │
  │   3. 发布废弃公告（邮件 + Developer Center）
  │   4. 通知所有依赖此 Center 的 Workspace
  │   5. 设置 Center 状态 = DEPRECATED
  │   6. 3 个月后 → RETIRED
  │
  └── REJECTED → 继续维护
```

---

## 4. Conformance 例外管理

### 4.1 例外申请流程

```
开发者填写 Exception Request（模板见下）
  │
  ├── Rule ID 违反列表
  ├── 原因
  ├── 修复计划（含截止日期）
  │
  ▼
ARB 评审（下一个双周例会）
  │
  ├── APPROVED → 更新 ConformanceRecord.exceptions[]
  │               创建 Tech Debt Ticket（截止日期）
  │
  └── REJECTED → 必须修复后提交
```

### 4.2 Exception Request 格式

```json
{
  "centerName": "billing",
  "ruleIds": ["REG-004", "ARC-003"],
  "reason": "Legacy module not yet migrated to new SDK",
  "impact": "无法使用 CenterSDK，但不影响功能",
  "fixPlan": "Q3 Sprint 2 完成 CenterSDK 迁移",
  "deadline": "2026-09-30",
  "proposedBy": "billing-team",
  "reviewedBy": null,
  "status": "pending"
}
```

### 4.3 例外有效期

| 类型 | 最长有效期 | 可续期 |
|------|:---------:|:------:|
| 新 Center | 1 个月 | 否 |
| Legacy 迁移 | 3 个月 | 可续 1 次（需 ARB 批准）|
| 临时适配 | 1 个 Sprint | 否 |

---

## 5. API / Event 废弃管理

### 5.1 废弃流程

```
1. 开发者提交 DEPRECATION 提案（含 Rule ID）
  │
  2. ARB 评审
  │
  ├── APPROVED
  │   │
  │   3. 修改 API/Event Route: lifecycle = deprecated
  │   4. 添加 deprecation 注释
  │   5. 更新 OpenAPI Schema（标记 deprecated）
  │   6. 通知所有已知消费者
  │   7. ≥ 3 个月后 → lifecycle = removed
  │
  └── REJECTED → 继续维护
```

### 5.2 废弃公告要求

```
Subject: [KMKI] Deprecation Notice: {API/Event Name}
Body:
  - 什么 API/Event 将被废弃
  - 废弃日期
  - 移除日期（至少 3 个月后）
  - 替代方案
  - 迁移指南
```

---

## 6. 版本策略

### 6.1 平台版本号

```
{platform}.{center}.{patch}
   │         │         │
   │         │         └── Bugfix / 向后兼容
   │         │
   │         └── Center 级别不兼容变更
   │
   └── 平台级不兼容变更
```

| 版本示例 | 含义 |
|----------|------|
| v1.0.0 | Platform Baseline |
| v1.1.0 | Center 级别新增能力 |
| v1.1.1 | Bugfix |
| v2.0.0 | 不兼容变更（需全票 ARB）|

---

## 7. 与 Conformance 的集成

```
Conformance Check（每次 CI）
  │
  ├── Pass (≥ Silver) → 合并 PR
  │
  └── Fail
      │
      ├── 有 Exception？ → 检查 Exception 是否在有效期内
      │     ├── 有效 → 允许合并 + 记录
      │     └── 过期 → Block
      │
      └── 无 Exception → Block
```

### 7.1 Conformance + Drift + Governance 三者关系

```
Conformance Spec ← 定义 72 条规则
       │
       ├── CI 流水线 ← 自动执行
       │      │
       │      ├── 通过 → Center 进入生产
       │      ├── 有 Exception → 检查 Governance 记录
       │      └── 拒绝 → Block PR
       │
       ├── 年度审计 ← ARB 执行
       │      │
       │      ├── 检测 Architecture Drift (ADI)
       │      ├── 检查 Exception 是否过期
       │      └── 输出全平台健康报告
       │
       └── Governance ── 处理例外、废弃、仲裁
```

---

## 8. 年度架构审计

### 8.1 审计范围

每年由 ARB 执行一次全平台架构审计，覆盖：

1. 所有 Center 的 Conformance 评分
2. Architecture Drift Index 分析
3. 例外列表及是否在有效期内
4. 废弃清单（API/Event/Center）
5. 依赖方向验证
6. 事件兼容性验证
7. SDK 使用合规性

### 8.2 审计报告模板

```
# KMKI Platform — Annual Architecture Audit {Year}

## Executive Summary
- Platform Conformance Average: {score} ({level})
- Architecture Drift: {adi} ({status})
- Critical Issues: {count}

## Center Health
| Center | Score | Level | ADI | Issues |
|--------|:-----:|:-----:|:---:|:------:|

## Drift Analysis
- Improving Centers: {count}
- Stable Centers: {count}
- Drifting Centers: {count}
- Critical Drift Centers: {count}

## Active Exceptions
| Center | Rule ID | Deadline | Status |

## Deprecations
| API/Event | Removed By | Status |

## Recommendations
1. ...
2. ...
```

---

## 9. 争议仲裁

架构相关争议按以下层级升级：

```
争议双方 → Center Architect → ARB → Chief Architect → Final

每级评审时限: ≤ 5 个工作日
首席架构师的仲裁为最终决定。
```

---

> **Governance 不是流程文档。它是平台体系的自律机制。没有 Governance 的架构终将失序。**
