# ER-03 Memory Intelligence Layer — Design Document

**Status**: DESIGN
**Date**: 2026-07-17
**Author**: OpenClaw (AI CTO Office)

---

## 1. 定位

ER-03 不是重新建设 Runtime Memory（Hermes 已具备）。

ER-03 是 **企业知识与 Agent 记忆关系的管理层**：

```
Enterprise Knowledge
        ↓
   Memory Intelligence
        ↓
   Agent Memory (Hermes)
        ↓
   Outcome → Experience → Optimization
```

---

## 2. 现有基础设施 (复用)

| 已有模型/服务 | 用途 | ER-03 角色 |
|---|---|---|
| `AgentMemory` (Prisma) | Agent 记忆存储 | 持久化层 |
| `AgentContextMemory` (Prisma) | 会话上下文 (shortTerm/workspace/knowledge/summary) | 上下文层 |
| `AgentMemoryRuntime` (内存) | 会话记忆 TTL 管理 | 运行时层 |
| `MemoryNamespaceService` | tenant/org/agent 路径隔离 | 隔离层 |
| `HermesProfileBinding` | Profile-per-Org | Runtime 绑定 |

---

## 3. ER-03 新增能力

### 3.1 Memory Classification (记忆分类)

```
MemoryInput
    ↓
Classifier
    ↓
┌─────────────────────────────────────┐
│ Short Term  │ Session │ Task       │
│ Business    │ Long Term           │
└─────────────────────────────────────┘
```

| 分类 | 生命周期 | 存储 | 用途 |
|---|---|---|---|
| Short Term | 单次会话 | AgentContextMemory (TTL) | 当前对话上下文 |
| Session | 单次会话 | AgentContextMemory | 会话完整记录 |
| Task | 任务周期 | AgentMemory (type=task) | 任务执行经验 |
| Business | 永久 | AgentMemory (type=business) | 企业业务知识 |
| Long Term | 永久 | AgentMemory (type=longterm) | 员工成长积累 |

### 3.2 Memory Governance (记忆治理)

```
Agent A (销售增长官):
  ✅ 允许: 销售经验、客户洞察、报价策略
  ❌ 禁止: 财务机密、人事信息

Agent B (财务分析官):
  ✅ 允许: 财务数据、报表分析
  ❌ 禁止: 客户名单、销售策略
```

治理规则:
1. **Role-Based**: 根据 Agent Role 自动分配记忆权限
2. **Org-Isolated**: 记忆严格按 organizationId 隔离
3. **Type-Scoped**: 每种记忆类型有独立访问控制
4. **Audit-Trail**: 记忆访问记录到审计日志

### 3.3 Memory → Outcome Bridge (记忆到成果)

```
Execution → Outcome → Experience → Memory
     ↑                                   ↓
     └──── Next Decision Optimization ←──┘
```

流程:
1. Agent 执行任务 → 产生 Outcome
2. Outcome 自动提取为 Experience
3. Experience 分类写入 Memory
4. 下次决策时，Memory 作为上下文注入

---

## 4. 架构设计

### 4.1 服务层

```
MemoryIntelligenceService (ER-03 主服务)
├── MemoryClassifier      — 分类引擎
├── MemoryGovernance      — 治理引擎
├── MemoryOutcomeBridge   — 成果桥接
└── MemoryQueryService    — 查询聚合
```

### 4.2 数据流

```
KunLunJing OS
│
├── Memory Input
│   ├── Agent Execution Result
│   ├── CEO Command
│   ├── Outcome Record
│   └── External Event
│
├── Memory Classification
│   ├── Short Term → AgentContextMemory (TTL)
│   ├── Task → AgentMemory (type=task)
│   ├── Business → AgentMemory (type=business)
│   └── Long Term → AgentMemory (type=longterm)
│
├── Memory Governance
│   ├── Role-Based Access
│   ├── Org Isolation
│   └── Audit Trail
│
├── Memory Retrieval
│   ├── By Session (上下文注入)
│   ├── By Task (经验复用)
│   └── By Business (知识查询)
│
└── Memory → Outcome
    ├── Execution → Outcome
    ├── Outcome → Experience
    └── Experience → Memory
```

---

## 5. API 设计

```
POST /api/enterprise/memory/classify     — 分类记忆
POST /api/enterprise/memory/govern       — 治理规则 CRUD
GET  /api/enterprise/memory/:orgId       — 查询记忆
POST /api/enterprise/memory/outcome-bridge — 成果桥接
GET  /api/enterprise/memory/:orgId/audit — 审计日志
```

---

## 6. 实施计划

### TASK-01: Memory Classification Engine
- 实现 MemoryClassifier
- 5 类记忆自动分类
- 复用 AgentMemory + AgentContextMemory

### TASK-02: Memory Governance Engine
- 实现 MemoryGovernance
- Role-Based 记忆权限
- 治理规则 CRUD API

### TASK-03: Memory-Outcome Bridge
- 实现 MemoryOutcomeBridge
- Outcome → Experience 自动提取
- 决策优化上下文注入

### TASK-04: Memory Query & Audit
- 实现 MemoryQueryService
- 记忆查询聚合
- 审计日志 API

---

*OpenClaw — Enterprise Engineering*
*ER-03 Memory Intelligence Layer — Design*
