
## R11 Phase 3A — Visualization Projection Layer 落地（2026-06-23 20:50）

```
backend/r11/ui/
├── r11-ui-service.ts                # 统一视觉投影层入口
├── view-models/
│   ├── structure.vm.ts              # 结构视图 VM（node/edge/fidelity）
│   ├── timeline.vm.ts               # 时间轴 VM（diff result 投影）
│   └── replay.vm.ts                 # 回放 VM（topo sort trace）
├── adapters/
│   ├── graph-view.adapter.ts        # SVG 布局投影（层级 top-down DAG）
│   ├── diff-view.adapter.ts         # timeline 渲染数据投影
│   └── replay-view.adapter.ts       # step-by-step 渲染数据投影
└── docs/
    └── phase3a-ui-design.md         # 设计文档（三视图结构）
```

### 三条铁律验证
- ✅ PASSIVE — 不做任何计算，只投影已有数据
- ✅ DERIVED — 所有数据来自 R11 ExecutionGraph / DiffResult / ReplayTrace
- ✅ NON-INTERPRETING — 无"异常/重要/bug"标注

### 测试结果
| 视图 | 状态 |
|------|------|
| GraphView — AgentGraph | 3 nodes, 2 edges, 220×470 layout ✅ |
| GraphView — ImageDAG | 4 nodes, 3 edges, 400×470 layout ✅ |
| Diff Timeline — agent v1→v2 | EQUAL=14, MODIFIED=2, ADDED=2 ✅ |
| Replay — AgentGraph | a1→a2→a3, deterministic(5×) ✅ |
| Fidelity — AgentGraph | 100% ✅ |
| Fidelity — ImageDAG | 100% ✅ |

### 下一步
Phase 3A 已完成技术层落地。前端 Vue 组件渲染（SVG 布局 + canvas 力导向）需要前端代码。
