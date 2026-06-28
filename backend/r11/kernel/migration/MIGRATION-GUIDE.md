# Migration Guide — 将 Execution Theory Kernel 接入新系统

---

## 概述

本指南说明如何将 Execution Theory Kernel 迁移到另一个 runtime / graph system / agent framework。

核心原则：**不动 kernel 公理，只换 system binding。**

---

## 迁移步骤（6 步）

### Step 1: 定义 Truth Source

**找到你的系统中最不可变的数据源。**

- 数据库表？日志流？commit history？event store？
- 该源必须满足：**快照后永不修改**

**R9 实现参考：**
- 昆仑镜：COS 资产 bucket（cobweb-ap-guangzhou）
- 产出：Asset table → 104 条验证记录 + snapshot JSON

**新系统绑定：**
```
你的系统 → 你的 truth source → snapshot → frozen
```

---

### Step 2: 实现 Adapter

**将你的系统原生 graph 数据结构 → ExecutionGraph。**

```typescript
// 你的实现需要：
class YourAdapter implements Adapter {
  domain = "your-domain";
  version = "v1.0.0";

  normalize(raw: YourRawData): ExecutionGraph {
    // 将你的 node/edge 结构映射为标准格式
  }
}
```

**验证：**
- 同一 raw 数据两次 normalize 产出相同的 ExecutionGraph
- 正确描述 nodeCount 和 edgeCount

---

### Step 3: 接入 Diff Engine

**比较两个快照的 ExecutionGraph，产出 DiffResult。**

```typescript
import { DiffEngine } from "../r11/diff/diff-engine";

const diff = new DiffEngine().compare(snapshotA.graph, snapshotB.graph);
// diff.entries → DiffEntry[] (EQUAL / MODIFIED / ADDED / REMOVED)
```

**验证：**
- 同图相减 → 全部 EQUAL
- 一次 node 变更 → 一条 MODIFIED
- 不产生语义错误的 diff

---

### Step 4: 接入 Replay Engine

**验证执行 Trace 的确定性。**

```typescript
import { ReplayEngine } from "../r11/replay/replay-engine";

const trace = replayEngine.replay(graph);
// trace.consistent → boolean
// trace.hash → deterministic
```

**验证：**
- 同 graph × 5 次 → 同 hash
- 不同 graph → 不同 hash

---

### Step 5: 接入 Observability + Drift

**建立 R11 四维观测。** （推荐接入顺序：Structure → Diff → Replay → Drift）

```typescript
const service = new R11Service();
service.registerAdapters([yourAdapter]);

// 每个周期：
service.snapshot("system-snapshot");
const diff = service.compare(fromId, toId);
const replay = service.replay(toId);
```

---

### Step 6: 接入 Governance + Causal（可选）

**当系统已稳定观测后，添加约束层。**

```typescript
const stability = new R11StabilityService();
const causal = new CausalTracer();

// policy
stability.driftPolicy.setPolicy("your-domain", {
  warnThreshold: 0.98,
  blockThreshold: 0.95,
  enabled: true,
});

// causal attribution
const report = causal.trace({
  projectionDrift: true,
  replayDrift: false,
  regression: true,
  fidelityDelta: -0.03,
  adapterVersionChanged: false,
  oldVersion: "",
  newVersion: "",
});
```

---

## 迁移核对清单

| 步骤 | 产出 | 验证信号 |
|------|------|---------|
| 1. Truth Source | 可冻结的快照 | 两次读取一致 |
| 2. Adapter | normalize() 纯函数 | 同入同出 |
| 3. Diff Engine | DiffResult | 同图全 EQUAL |
| 4. Replay Engine | 确定性 hash | 5 次运行同 hash |
| 5. Observability | R11 UI 工作 | 四视图显示正确 |
| 6. Governance | Policy + SLA 生效 | WARN/BLOCK 正确触发 |
| 7. Causal | 归因链正确 | drift → chain 映射可靠 |

---

## 迁移模式

### Pattern A: 全量迁移（推荐）
将 kernel 所有 9 个接口一次性接入。
- 适合：新系统从零构建
- 耗时：2-5 天
- 风险：低

### Pattern B: 渐进迁移
先接入 R9 + R10（truth + proof），稳定后逐步加 R11 → P4 → P5。
- 适合：已有系统改造
- 耗时：每层 0.5-1 天
- 风险：极低

### Pattern C: 只观测层
只接入 R11（observability），不加 governance/causal。
- 适合：系统已经稳定，只需要可见性
- 耗时：0.5-1 天
- 风险：接近零

---

## 不兼容检测

迁移过程中可能发现以下不兼容问题：

| 问题 | 症状 | 解决方案 |
|------|------|---------|
| 无不可变真相源 | snapshots 不一致 | 增加 event store / versioned table |
| 节点 ID 不稳定 | diff 产生大量 ADDED+REMOVED | 稳定 ID 生成策略 |
| 非确定性 replay | replay 每次 hash 不同 | 排查外部状态依赖 |
| BYOK 缺失 | AI 调用失败 | 接入用户密钥体系 |
