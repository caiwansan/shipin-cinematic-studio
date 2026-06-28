# Phase 3A — Graph Observability UI 设计稿

## 架构原则
- 三个视图，一个统一入口
- 不写后端路由 — 直接消费 R11Service
- 纯观测层 — 不侵入、不改变 execution graph
- 4 个 production adapter + R9 baseline 可直接渲染

---

## 视图一：Execution Graph Viewer

### 布局
```
┌─────────────────────────────────────────┐
│  Domain: [▼ agent-graph ▼]            │
│  View:  [Raw] [Normalized] [Diff]      │
│  [v] Show raw payload    [v] Labels    │
├─────────────────────────────────────────┤
│                                         │
│        ┌─────┐        ┌─────┐          │
│   ────▶│ a1  │────────│ a2  │───▶ a3   │
│        │writer│        │rvwer│    prod  │
│        └─────┘        └─────┘          │
│                                         │
│  Node Count: 3   Edge Count: 2          │
│  Adapter: AgentGraphAdapter v1          │
└─────────────────────────────────────────┘
```

### 交互
- 点击节点 → 显示 raw payload（domainId, type, raw 摘要）
- 悬停边 → 显示 edge type（flow/data/control/depends/version）
- Raw/Normalized 切换 → 对比投影前后结构
- 力导向布局（d3-force）或层级布局（dagre）

### 技术选型
- 纯前端渲染（Vue 3 + canvas/SVG）
- 数据来自 `r11Service.project(domain, rawGraph)`
- 轻量级：no d3 dependency if we use plain SVG

---

## 视图二：Diff Timeline

### 布局
```
┌─────────────────────────────────────────┐
│  Domain: [▼ agent-graph ▼]            │
│  Baseline: [R9 v1.0]  Current: [now]   │
├─────────────────────────────────────────┤
│                                         │
│  R9 v1.0 ●─────●─────●                  │
│          │writer│rvwer│producer         │
│          └─────┘─────┘                 │
│              │                          │
│              │ MODIFIED (a2)            │
│              ▼                          │
│  R9 v1.1 ●─────●─────●─────●           │
│          │writer│rvwer│prod │validator  │
│          └─────┘─────┘─────┘           │
│                                         │
│  Changes:                               │
│  ├─ ADDED:   a4 (validator)             │
│  ├─ REMOVED: a3 (producer)              │
│  └─ MODIFIED: 1 edge (flow→control)     │
│                                         │
│  Fidelity: 100%  |  Replay: stable      │
└─────────────────────────────────────────┘
```

### 交互
- 选择 baseline vs current → 自动 diff
- ADDED (绿) / REMOVED (红) / MODIFIED (黄) / EQUAL (灰)
- 点击变更项 → 定位到对应节点/边
- 时间轴模式：按 snapshot 时间线播放 graph 演化

---

## 视图三：Replay Inspector

### 布局
```
┌─────────────────────────────────────────┐
│  Domain: [▼ agent-graph ▼]            │
│  Iteration: 1/5   [◀] [▶]  Auto-play  │
├─────────────────────────────────────────┤
│                                         │
│  Step 1: a1 (writer)                    │
│    ↓ flow                               │
│  Step 2: a2 (reviewer)                  │
│    ↓ flow                               │
│  Step 3: a3 (producer)                  │
│                                         │
│  Trace Hash: abc123def456               │
│  Status: ✅ Deterministic (5/5 same)    │
├─────────────────────────────────────────┤
│  Divergence Detection                   │
│  No divergences across 5 iterations     │
└─────────────────────────────────────────┘
```

### 交互
- 逐步播放 node traversal
- highligh 当前 step 节点
- Divergence 标记（如果 replay 不一致）
- 多 iteration 叠加显示

---

## 统一入口

```
/director-os/r11           ← 主仪表盘（3 视图 tab）
/director-os/r11/graph     ← Graph Viewer
/director-os/r11/diff      ← Diff Timeline
/director-os/r11/replay    ← Replay Inspector
```

## 实现计划

| Step | 工期 | 产出 |
|------|------|------|
| 1 — Graph Viewer 骨架 | ~2h | Vue 组件 + d3-force/dagre 布局 |
| 2 — Raw/Normalized 切换 | ~1h | adapter projection toggle |
| 3 — Diff Timeline | ~2h | baseline vs current 可视化 |
| 4 — Replay Inspector | ~1.5h | step-by-step + divergence |
| 5 — Fidelity Heatmap | ~1h | 4 adapter 的健康仪表盘 |

总工期：约 7.5 小时（按之前 PPT 产出节奏估算）
