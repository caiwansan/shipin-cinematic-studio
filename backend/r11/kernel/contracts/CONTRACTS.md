# Contracts — Runtime-Neutral Interfaces

本契约将 R11 核心概念抽象为跨系统接口。
任何 graph system / agent framework / execution runtime 只要实现这些接口，即可接入 Execution Theory Kernel。

---

## 1. Graph Interface

```typescript
interface GraphNode {
  id: string;
  type: string;
  label: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

interface ExecutionGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: Record<string, unknown>;
}
```

### 实现要求
- `id` 必须在单个 graph 实例中唯一
- `type` 必须属于一个有限集合（domain-specific）
- `edges` 必须引用存在的 node id

---

## 2. Snapshot Interface

```typescript
interface Snapshot {
  id: string;
  timestamp: number;
  graph: ExecutionGraph;
  metadata: Record<string, unknown>;
}
```

### 实现要求
- `id` 必须在系统中全局唯一
- `timestamp` 必须是毫秒级 Unix 时间戳
- `graph` 必须是完整的 ExecutionGraph（不允许部分快照）

---

## 3. Diff Interface

```typescript
type DiffStatus = "EQUAL" | "MODIFIED" | "ADDED" | "REMOVED";

interface DiffEntry {
  nodeId: string;
  status: DiffStatus;
  before?: GraphNode;
  after?: GraphNode;
}

interface DiffResult {
  domain: string;
  entries: DiffEntry[];
  timestamp: number;
  leftSnapshotId: string;
  rightSnapshotId: string;
}
```

### 实现要求
- 必须使用冻结的四种 DiffStatus 语义
- 不得引入模糊匹配或语义相似度
- `before` 和 `after` 必须与对应的快照一致

---

## 4. Replay Interface

```typescript
interface ReplayStep {
  stepId: number;
  nodeId: string;
  action: string;
  timestamp: number;
}

interface ReplayTrace {
  id: string;
  steps: ReplayStep[];
  consistent: boolean;
  hash: string;
}
```

### 实现要求
- `consistent` 必须由确定性拓扑排序验证
- `hash` 必须基于结构字段（排除 meta.timestamp）
- 同输入必须产出同 hash

---

## 5. Adapter Interface

```typescript
interface Adapter {
  domain: string;
  version: string;

  // 将系统原始 graph 数据结构 → ExecutionGraph
  normalize(raw: unknown): ExecutionGraph;

  // 描述图结构
  describe(graph: ExecutionGraph): { nodeCount: number; edgeCount: number };
}
```

### 实现要求
- `normalize()` 必须是纯函数（同输入 → 同输出）
- `version` 必须是语义版本号
- 不允许在 `normalize()` 中访问外部状态

---

## 6. Drift Interface

```typescript
interface DriftDelta {
  domain: string;
  projectionDrift: boolean;
  replayDrift: boolean;
  fidelity: number;
}

interface DriftRecord {
  id: string;
  domain: string;
  timestamp: number;
  delta: DriftDelta;
}

interface DriftReport {
  records: DriftRecord[];
  regression: boolean;
  regressionDelta: number;
}
```

### 实现要求
- `fidelity` 必须在 [0, 1] 区间内
- `projectionDrift` 表示 graph 结构 hash 变化
- `replayDrift` 表示 replay trace hash 变化

---

## 7. Policy Interface

```typescript
type PolicyStatus = "OK" | "WARN" | "BLOCK";

interface PolicyConfig {
  domain: string;
  warnThreshold: number;
  blockThreshold: number;
  enabled: boolean;
}

interface PolicyDecision {
  status: PolicyStatus;
  fidelity: number;
  reason?: string;
}
```

### 实现要求
- `blockThreshold` > `warnThreshold` 是非法配置
- `status` 必须由纯阈值比较决定
- `enabled = false` 时始终返回 `OK`

---

## 8. SLA Interface

```typescript
interface SLAConfig {
  domain: string;
  baselineFidelity: number;
  driftBudget: number;
}

interface SLACheckResult {
  ok: boolean;
  deviation: number;
  baseline: number;
  current: number;
  budget: number;
}
```

### 实现要求
- `deviation = baseline - current`
- `ok = deviation <= budget`

---

## 9. Causal Interface

```typescript
type CausalNodeType = "adapter" | "graph" | "runtime" | "policy";

interface CausalNode {
  id: string;
  type: CausalNodeType;
  label: string;
}

interface CausalEdge {
  from: string;
  to: string;
  reason: string;
}

interface CausalTrace {
  rootCause: CausalNode;
  chain: CausalNode[];
  edges: CausalEdge[];
}

type CausalImpact = "high" | "medium" | "low";
```

### 实现要求
- 归因必须是确定性的（规则驱动，非 ML）
- `CausalNodeType` 必须属于上述枚举
- 不得引入自动修复逻辑

---

## 版本兼容性规则

| 接口 | 稳定版本 | 改动策略 |
|------|---------|---------|
| Graph | v1 | 向后兼容 |
| Snapshot | v1 | 可扩展 metadata |
| Diff | v1 | **冻结**（不改语义） |
| Replay | v1 | **冻结**（不改语义） |
| Adapter | v1 | 向后兼容 |
| Drift | v1 | 可扩展 delta 字段 |
| Policy | v1 | 可扩展 config 字段 |
| SLA | v1 | **冻结**（不改语义） |
| Causal | v1 | 可扩展链类型 |
