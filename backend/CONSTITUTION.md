# 昆仑镜项目宪法（Foundation Phase）

> 2026-06-29 | ID 23 | Foundation Phase 正式收官

## L1: 项目宪法（Constitution）

**为什么做昆仑镜：** 建立一个独立于任何视频模型的电影制作生产平台。

**长期目标：** 无论未来接入新模型、扩展到长片、多 Agent 协同，还是支持 3D、数字人、音频，底层架构保持稳定。

**核心原则：**
1. **Kernel 冻结** — Core Kernel 和 Graph Kernel 的接口不做破坏性变更
2. **Extension 演进** — 新能力在 Kernel 之上扩展，不修改 Kernel
3. **Execution 可替换** — Provider Adapter 只做字段映射
4. **Capability 优先** — 模块不感知 Provider，只感知能力
5. **SSOT** — FilmLanguageIR 是所有生产决策的唯一输入

## L2: 架构（Architecture）

### Core Kernel
- FilmLanguageIR（Canonical AST）
- Diagnostics
- Diff Engine
- Version Migration
- Snapshot
- ExecutionContext

### Graph Kernel
- Graph Runtime（Map<id, Node> + Edges）
- SceneGraphView / EventGraphView / TimelineView

### 分层原则
```
Kernel ← 不依赖
    ▲
Extension ← 可依赖 Kernel
    ▲
Execution ← 可依赖 Kernel + Extension
```

## L3: 治理（Governance）

- **ADR**：7 条已批准（见 `adr/`）
- **Architecture Patterns**：6 个已记录（见 `patterns/`）
- **Drift Detector**：5 条规则（2 条 Zero Tolerance + 3 条 Phase A warn）
- **Kernel Freeze**：A3.5 已冻结，见 `A35_KERNEL_FREEZE.md`
- **Compatibility Test**：kernel-compatibility.test.ts（14 个测试）

## L4: 能力（Capability）

A4+ 快速迭代的区域：
- SceneGraph / EventGraph / Timeline（完整实现）
- Constraint Engine
- Capability Planner
- Scheduler
- Provider Adapter（持续扩展）

## 研发节奏

| 阶段 | 节奏 | 焦点 |
|------|------|------|
| A2-A3.5 | Architecture First | 建立内核 |
| A4-A4.5 | Capability First | 增加电影制作能力 |
| A5+ | Production First | 围绕完整生产链迭代 |

## 测试体系

| 测试类型 | 作用 | 文件 |
|----------|------|------|
| 单元测试 | 模块正确性 | `*.test.ts` |
| Compatibility | Kernel API 契约稳定 | `kernel-compatibility.test.ts` |
| Drift | 架构治理规则 | `architecture-drift.test.ts` |
| Capability Regression | 电影制作能力不退化 | `capability-regression.test.ts`（A4 实现） |
