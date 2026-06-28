# Execution OS — 架构终碑

> **日期：2026-06-19**
> **状态：架构冻结（Architecture Freeze）**
> **下一阶段：产品化优化（Productization Phase）**

---

## 架构总览

```
Phase 1: Execution Kernel         — 造实（blueprint freeze → job state machine → render tick）
Phase 2: Execution Graph          — 建序（DAG Builder → Timeline → Render Adapter）
Phase 3: Execution Observatory    — 启智（节点/热力图/回放，零依赖启动）
Phase 4: Control Layer            — 操控（patch / retry / rewire / subtree extract）
Phase 5: Causal Consistency       — 自愈（失效传播 → diff检测 → 重算计划 → 自动修复）
Phase 6: Execution Memory         — 记忆（版本化存储 → 执行谱系 → 历史回放 → 因果解释）
Phase 7: Execution Intelligence   — 进化（成本模型 → DAG优化 → 自适应调度 → 蓝图进化）
Phase 8: Autonomous Director      — 自主（目标解析 → 故事板生成 → DAG构建 → 执行规划）
```

## 系统能力矩阵

| 能力 | 层级 | 状态 |
|------|------|------|
| 执行（Execution） | Phase 1 | ✅ 工业级 |
| 结构（Structure） | Phase 2 | ✅ 工业级 |
| 可见（Visibility） | Phase 3 | ✅ 工业级 |
| 干预（Intervention） | Phase 4 | ✅ 产品级 |
| 一致（Consistency） | Phase 5 | ✅ 产品级 |
| 记忆（Memory） | Phase 6 | ✅ 产品级 |
| 智能（Intelligence） | Phase 7 | ✅ 概念级 |
| 自主（Autonomy） | Phase 8 | ✅ 概念级 |

---

## 架构封顶声明

**当前架构已到达单智能体执行操作系统的结构上限。**

以下能力已隐含在现有架构中（通过 runtime 内协同，而非独立 agent identity）：
- Cost Agent → Phase 7 CostModel
- Planning Agent → Phase 7 DAGOptimizer
- Reasoning Agent → Phase 5 CausalConsistencyEngine
- Historian Agent → Phase 6 ExecutionMemoryLayer

**Multi-Agent Director Federation 已保留为设计层能力，不作工程实现。**

---

## API 端点全景

### 执行层
- `POST /api/workbench/render` — 渲染执行
- `POST /api/workbench/retry-node` — 局部重跑
- `POST /api/workbench/patch-node` — 运行时编辑

### 可观测层
- `POST /api/workbench/observatory/snapshot` — DAG + heatmap
- `POST /api/workbench/observatory/replay` — timeline 回放

### 因果层
- `POST /api/workbench/causal-check` — 因果影响检查（只读）
- `POST /api/workbench/causal-apply` — 因果影响 + 自动修复

### 记忆层
- `POST /api/workbench/memory-record` — 记录版本
- `GET /api/workbench/memory-history/:traceId` — 版本链
- `GET /api/workbench/memory-stats` — 全局统计

### 智能层
- `POST /api/workbench/intel-optimize` — DAG 自动优化
- `GET /api/workbench/cost-estimate/:traceId` — 成本预估

### 自治层
- `POST /api/workbench/auto-direct` — 从目标到执行方案

---

## 后续方向（产品化优化）

架构冻结后，工程质量提升不再走"加层"路线，而是走"提升生成质量上限"路线：

1. **Shot Prompt Compiler** — 直接影响画面质量的 prompt 编译链路
2. **Temporal Consistency Engine** — 镜头间连贯性（运动/光照/色调）
3. **Character Persistence System** — 角色跨场景一致性
4. **Cinematic Grammar System** — 镜头语言库（构图规则/运动规律）
5. **Motion Planning Enhancer** — 动态可信度优化

---

## 设计原则（终版）

1. **系统隐身，能力显性** — 用户不感知 Phase/Layer/Runtime
2. **BYOK 铁律不可更改** — 平台不提供任何大模型额度
3. **架构完整性不超过产品必要性** — 新增层须有可验证的产品收益
4. **单体智能已够用，多智能体是形式完备性追求** — 保留但不实现

---

*此碑不可修改。若需新增架构层，须重新评估"是否提升用户可见的视频质量"——否则一律不进。*
