# Sprint Brief A1.1 — Issue Graph

> **Epic**: Decision Intelligence (DI)
> **Sprint**: A1.1
> **里程碑**: GEO v1.1
> **目标**: 输入品牌状态，输出结构化的问题关系图（Issue Graph），作为整个 Decision Intelligence 的 Canonical Entity。

---

## 0. Issue — Canonical Entity

Issue 是整个 Decision Intelligence 的核心数据对象。A1.2 Impact Estimation、A1.3 Priority Engine、A1.4 Action Planner、A2 Verification 全部围绕同一个 Issue 运转。

### Issue 模型

```typescript
interface Issue {
  id: string
  kind: 'schema' | 'content' | 'authority' | 'technical' | 'unknown'
  title: string
  description: string
  severity: number          // 1-10
  confidence: number        // 0-1
  status: IssueStatus       // 见下文
  category: string          // 旧分类兼容字段
  source: string            // 'discovery' | 'explain' | 'verification' | 'knowledge_hub'
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

type IssueStatus = 'detected' | 'accepted' | 'in_progress' | 'resolved' | 'ignored'
```

**关键设计原则**：Platform 内只有一个 Issue。不存在 IssueType / IssueInstance / RecommendationIssue 三套模型。

### Issue Dependency

```typescript
interface IssueEdge {
  from: string    // issue id
  to: string      // issue id
  relationship: 'causes' | 'blocks' | 'duplicates' | 'related' | 'depends_on'
}
```

五种关系类型，比仅有 `depends_on` 更丰富。Graph 可视化、Explain、Recommendation 都直接消费。

### Root Cause Strategy

不把 root cause 识别算法写死到 Issue Entity 中：

```typescript
interface RootCauseStrategy {
  identify(nodes: IssueNode[], edges: IssueEdge[]): string[]  // return issue IDs
}

// 第一版
class GraphRootCauseStrategy implements RootCauseStrategy {
  // 入度 0 + severity 最大 → root cause（原逻辑外化为策略）
}

// 未来可扩展
// class AIRootCauseStrategy implements RootCauseStrategy { ... }
// class HybridRootCauseStrategy implements RootCauseStrategy { ... }
```

### IssueGraph 输出

```typescript
interface IssueGraph {
  brandId: string
  generatedAt: string
  nodes: Issue[]
  edges: IssueEdge[]
  rootCauses: string[]
  summary: {
    total: number
    critical: number
    major: number
    minor: number
    rootCauseCount: number
    longestChain: number
    severityDistribution: Record<string, number>
  }
  cachePolicy: {
    ttl: number                // ms
    invalidateOn: string[]     // 事件类型: 'scan_completed', 'issue_updated', 'knowledge_updated'
  }
}
```

---

## 1. 对应白皮书章节

GEO_PRODUCT_WHITEPAPER_V1.md — 第七章「Recommendation Engine」

## 2. 对应路线图阶段

GEO_PRODUCT_ROADMAP_V1.md — Phase 3「Decision Intelligence」

## 3. 产品蓝图

GEO_WORKSPACE_BLUEPRINT_V1.md — 页面：Brand Overview / Recommendation Tab

## 4. 用户价值

**用户问题**: "我看到了问题，但不知道哪些更重要、先做什么。"

**A1.1 解决的问题**: 把分散的发现项（Discovery Issues / Explain Findings / Verification Results / Knowledge Hub Signals）组织成一张**有关系的问题图**，而非平铺列表。

**验收指标**:
- 同品牌同状态，Issue Graph 结构稳定
- 每个 Issue 有唯一 kind + severity + confidence
- 依赖关系可视化（关系类型清晰）
- root cause 可追溯
- summary 与 graph 一致

## 5. 影响页面

- `BrandOverview.vue` — Recommendation Tab
- `DecisionIntelligenceSection.vue` (new)
- Dashboard — Mission 卡片可能引用 Issue summary

## 6. 影响 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/geo/recommendation/issues` | 生成本品牌 Issue Graph |
| GET | `/api/geo/recommendation/issues/:brandId` | 获取已缓存的 Issue Graph |
| GET | `/api/geo/recommendation/issues/:brandId/:issueId/dependencies` | 获取单个 Issue 的依赖链 |

## 7. 验收标准

### Decision Quality Gate

| # | 项目 | Pass/Fail |
|---|------|-----------|
| 1 | Issue Graph 无循环（DAG 验证） | ⬜ |
| 2 | 每个 Node 可追溯 Source | ⬜ |
| 3 | 每个 Root Cause 可解释（关联策略名） | ⬜ |
| 4 | Dependency 关系类型合法（5 种之一） | ⬜ |
| 5 | Summary 与 Graph 数据一致 | ⬜ |
| 6 | Issue Entity 不含平台特定字段 | ⬜ |
| 7 | 同样输入连续请求 3 次，Graph 结构完全一致 | ⬜ |

### 功能验收

| # | 项目 | Pass/Fail |
|---|------|-----------|
| 8 | Issue 包含至少 8 种 kind | ⬜ |
| 9 | 依赖关系可视化（dagre.js） | ⬜ |
| 10 | root cause 高亮显示 | ⬜ |
| 11 | 每个 Issue 点击可展开详情 | ⬜ |
| 12 | 无 Graph 时自动 fallback 到平铺列表 | ⬜ |

## 8. 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| AI 生成依赖关系不稳定 | 中 | 高 | A1.1 只用规则引擎建图，AI enrichment 作为未来可选项 |
| Issue Graph 过于复杂 | 低 | 中 | 限制 depth ≤ 3，节点数 ≤ 20 |
| 前端渲染 DAG 性能 | 低 | 低 | 使用 dagre.js 布局，后端返回扁平 edges |

## 9. 回滚方案

Issue Graph API 默认返回空列表 → 前端 fallback 到平铺 Issue 列表模式（现有行为），不影响任何现有功能。

---

## Implementation Plan

### Backend

#### 文件结构

```
backend/src/services/geo/decision-intelligence/
├── issue-registry.ts        # 预定义 Issue kinds + 默认属性
├── issue-graph-builder.ts   # Signal → Issue → Graph pipeline
├── root-cause-strategies/
│   └── graph.strategy.ts    # GraphRootCauseStrategy
├── cache-policy.ts          # TTL + invalidation events
├── types.ts                 # Issue, IssueGraph, IssueEdge, etc.
└── routes.ts                # API endpoints
```

#### Issue Registry（>8 种 kind）

```typescript
// 预注册所有 Issue kinds (可扩展)
const ISSUE_REGISTRY = {
  missing_schema:        { kind: 'schema',     defaultSeverity: 8, description: 'Schema 缺失' },
  incomplete_schema:     { kind: 'schema',     defaultSeverity: 6, description: 'Schema 信息不完整' },
  low_coverage:          { kind: 'content',    defaultSeverity: 7, description: 'Knowledge Coverage 不足' },
  factual_conflict:      { kind: 'content',    defaultSeverity: 9, description: '事实性冲突' },
  outdated_content:      { kind: 'content',    defaultSeverity: 5, description: '内容过期' },
  authority_gap:         { kind: 'authority',  defaultSeverity: 6, description: '权威来源不足' },
  visibility_drop:       { kind: 'technical',  defaultSeverity: 7, description: 'Visibility 分数下降' },
  citation_missing:      { kind: 'content',    defaultSeverity: 4, description: '引用缺失' },
  schema_error:          { kind: 'technical',  defaultSeverity: 5, description: 'Schema 格式错误' },
  content_duplicate:     { kind: 'content',    defaultSeverity: 3, description: '内容重复' },
}
```

#### Issue Graph Builder Pipeline

```
collectSignals(brandId) → Signal[]
  │ 来源: Discovery Issues, Explain Findings, Verification Results, Knowledge Hub
  │
matchIssues(signals) → Issue[]
  │ 信号 → Issue 映射（信号匹配 Issue kind + 填充 severity/confidence）
  │
buildDependencies(issues) → IssueEdge[]
  │ 规则引擎: 按 kind 间已知依赖关系建边
  │ 关系类型: causes / blocks / duplicates / related / depends_on
  │
identifyRootCauses(GraphRootCauseStrategy) → string[]
  │ 策略外化, 当前策略: 入度 0 + severity 最大
  │
buildSummary(nodes, edges, rootCauses) → GraphSummary
  │ 统计: total/critical/major/minor/rootCauseCount/longestChain/distribution
  │
→ IssueGraph
```

#### Cache

- 默认 TTL: 1 小时
- 失效事件: `scan_completed`, `issue_updated`, `knowledge_updated`
- 实现: 简单 in-memory Map（后续可升级为 Redis）

### Frontend

#### `DecisionIntelligenceSection.vue`

- dagre.js DAG 布局
- root cause 节点高亮（红色边框 + ⚠️ 标识）
- 关系类型在边上标注（"causes" / "blocks"）
- 点击 Issue 展开: 描述 / 证据来源 / 依赖链
- 无 Graph → 显示平铺问题列表

### Verification

- **Graph Integrity**: DAG 验证（无循环）, Summary 一致性, Root Cause 可追溯
- **Stability**: 同输入 3 次输出一致
- **Performance**: Graph 生成 ≤ 3s
- **Regression**: 现有 GEO 功能不受影响

---

## Canonical Entity Rule

**后续 Sprint（A1.2～A4）不得重新定义 Issue、IssueGraph、Dependency 或 RootCause。**
如需扩展，只能向既有 Entity 增加可选字段，不得改变既有语义或拆分为新的平行模型。

禁止出现：
- `RecommendationIssue`（应直接使用 Issue + 扩展字段）
- `VerificationIssue`（同上）
- `PriorityIssue`（同上）

### Issue 演进路线

```
Issue v1.0 (A1.1)
├── 基础属性 (kind/severity/confidence/status/source)
├── Graph (nodes + edges)
├── Root Cause (strategy-based)
└── Status (detected/accepted/in_progress/resolved/ignored)

Issue v1.1 (A1.2-A1.4)
├── Expected Impact  ← A1.2 追加
├── Priority Score   ← A1.3 追加
└── Recommended Actions ← A1.4 追加

Issue v1.2 (未来)
├── Execution History
├── Feedback (accepted/ignored/completed/dismissed)
└── Learning Signals
```

## 与后续 Sprint 的关系

```
A1.1 Issue Graph ────────────────────── 本 Sprint
  │
  ├─→ A1.2 Impact Estimation   ── 消费 Issue Graph.nodes
  ├─→ A1.3 Priority Engine     ── 消费 Issue Graph.nodes + edges
  ├─→ A1.4 Action Planner      ── 消费 Priority Score + Issue
  ├─→ A1.5 DTO                 ── Issue 是核心模型之一
  └─→ A2 Verification v2       ── 验证 Issue 是否修复
```

A1.1 建好的 Issue Entity 和 IssueGraph 模型，后续所有 Sprint 都会直接 import，不需要重写。
