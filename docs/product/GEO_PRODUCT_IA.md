# GEO Product IA v1.0
## Brand Knowledge OS — 信息架构与用户旅程

> 冻结日期：2026-07-19
> 版本：v1.0.0
> 约束来源：Product Principles / Product Vocabulary / Product Narrative

---

# 一、设计前提（Non-negotiable Context）

所有 IA 必须满足三件套约束：

### 1. 只有一个北极星

> Brand Health

所有路径最终必须回到：如何提升 Brand Health。

### 2. Workspace ≠ Console

IA 不允许出现系统结构、技术分层、Runtime 概念。

### 3. 用户只做三件事

```
Understand → Improve → Verify → Publish → Grow
```

---

# 二、信息架构（Information Architecture）

## GEO Workspace v1 IA

```
Workspace
│
├── 1. Health（品牌健康）       — 北极星入口
├── 2. Recommendations（推荐）  — 行动中心
├── 3. Verification（验证）     — 事实中心
├── 4. Publishing（发布）       — 分发中心
├── 5. Growth（成长）           — 趋势中心
└── 6. Knowledge（知识）        — 知识中心
```

---

# 三、页面职责定义（Page Intent）

## 1. Health（北极星入口）

**目标**：让用户 5 秒内知道品牌状态。

**内容结构**：
- Brand Health Score（唯一主指标）
- 6 个分解维度（Knowledge Coverage, AI Visibility, Trust, Freshness, Authority, Risk）
- 当前风险
- 今日变化（对比昨日）
- 下一步建议（入口 → Recommendations）

**回答的问题**：
- 我现在好吗？
- 比昨天好还是差？
- 需要做什么？

---

## 2. Recommendations（行动中心）

**目标**：AI 告诉用户"该做什么"。

**内容结构**：
- 优先级推荐列表（Top 3-5）
- 预期 Brand Health 提升
- 一键执行（Approve → Run）
- 影响解释（为什么推荐此项）

**回答的问题**：
- 我应该做什么？
- 做完会变好吗？

---

## 3. Verification（事实中心）

**目标**：证明"真的变好了"。

**内容结构**：
- Before / After 对比
- AI 可见性变化
- 覆盖率变化
- 证据链（隐藏技术细节，只展示结果）

**回答的问题**：
- AI 真的更理解我了吗？
- 改动有效吗？

---

## 4. Publishing（分发中心）

**目标**：把品牌知识推向外部世界。

**内容结构**：
- 发布目标（Website / CMS / AI Feed / Search Index）
- 发布状态（Pending / Live / Failed）
- 最近发布记录
- 发布影响（发布后 Health 变化）

**回答的问题**：
- 我的品牌已经被看到吗？
- 发布是否成功？

---

## 5. Growth（成长中心）

**目标**：看趋势，而不是单点状态。

**内容结构**：
- Brand Health 趋势图
- AI Visibility 趋势
- 历史优化记录
- 里程碑事件

**回答的问题**：
- 品牌是在变好还是变差？
- 长期趋势是什么？

---

## 6. Knowledge（知识中心）

**目标**：管理品牌"是什么"。

**内容结构**：
- Brand Description（品牌介绍）
- Key Statements（关键声明，原 Claim）
- Structured Knowledge（结构化信息）
- FAQ / Assets（常见问题与品牌资产）

**回答的问题**：
- AI 如何理解我的品牌？
- 我有哪些基础信息？

---

# 四、用户旅程（User Journey）

## 第一体验（First 30 Seconds）

```
进入 Workspace
  ↓
Health 页面
  ↓
看到 Brand Health = 82
  ↓
看到"建议优化 3 项"
  ↓
点击 Recommendations
  ↓
一键执行优化
  ↓
看到预期提升
```

## 日常循环（Daily Loop）

```
Health
  ↓
Recommendations
  ↓
Verification
  ↓
Publishing
  ↓
Growth
  ↓
回到 Health
```

## 成长循环（Growth Loop）

```
Knowledge
  ↓
Recommendations
  ↓
Publishing
  ↓
Verification
  ↓
Growth
  ↓
Brand Health 提升
```

---

# 五、核心设计逻辑（IA Rules）

## Rule 1 — Single Entry Point

用户只通过 **Health** 进入系统。

## Rule 2 — Linear Cognitive Flow

用户路径必须是：
```
Understand → Act → Verify → Publish → Grow
```
不允许跳跃设计。

## Rule 3 — No Parallel Complexity

禁止多入口优化路径、多 Dashboard、多评分体系。

## Rule 4 — Action Density Rule

每个页面必须满足：至少一个明确的下一个行动。

## Rule 5 — Return-to-Health Rule

所有路径最终必须回到 **Health**（Brand Health 更新）。

---

# 六、被移除的结构

以下页面/结构从 Workspace 中移除：

| 原结构 | 移除原因 | 归属 |
|--------|----------|------|
| System Control | 内部工程工具 | Studio |
| Execution Studio | 暴露 Runtime | Studio |
| Claim Tree | 技术概念 | Studio |
| Evidence List | 合并到 Verification | Verification |
| Timeline（独立） | 合并到 Growth | Growth |
| Report Page | 合并到 Health + Growth | — |
| System Lens | 内部调试 | Studio |
| System Metadata | 内部调试 | Studio |
| Knowledge Graph | 预留未完成 | Studio |
| History（独立） | 合并到 Growth | Growth |

---

# 七、被吸收的能力

| 原系统能力 | 新归属 |
|------------|--------|
| Claim / Evidence | Verification |
| Pipeline | Publishing |
| Runtime | Studio |
| Knowledge Graph | Knowledge |
| Timeline | Growth |
| Report | Health + Growth |
| Execution | Recommendations |

---

# 八、映射对照：产品叙事 → IA → 用户价值

| 叙事环节 | IA 页面 | 用户获得 |
|----------|---------|----------|
| Understand | Health | 品牌状态全貌 |
| Act | Recommendations | 明确的下一步 |
| Verify | Verification | 变化可信 |
| Distribute | Publishing | 品牌被看见 |
| Observe | Growth | 品牌在变好 |
| Manage | Knowledge | 品牌有根基 |

---

# 九、IA 冻结声明

> Product IA v1.0 defines the only valid structure of Brand Knowledge OS Workspace.
> All UI, routing, navigation, and page design must conform to this structure.
> Any deviation must be justified at Product Constitution level.
