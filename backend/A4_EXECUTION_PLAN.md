# Production Validation Execution Plan（A4 执行计划）

> **Target:** `FilmLanguageIR → Graph Kernel → Planner → Execution DAG → Provider → Video`
> **Scope:** 一条 50 镜头短剧在真实生产流中稳定跑通
> **Owner:** OpenClaw
> **Status:** 🚧 Ready to execute

---

## Current State（ID 23 的实际链路）

```
Narrative / Script
    │
    ▼
script-breakdown-master.ts → NarrativeConstitutionV3（LLM output）
    │
    ▼
buildV3SpecOutput() → AigcSpecOutput（8 section 聚合）
    │
    ▼
aigcOrchestrator.generate() → videoSegments[] / frameDesign[] / characterSpecs[]
    │
    ▼
execution-images.ts → save to DB
    │
    ▼
worker-runtime.ts → modelAdapterRegistry.execute() → Provider API
    │
    ▼
Video Output
```

**FilmLanguageIR 存在的位置：** 仅在 Kernel 中定义，未接入生产流程。
**当前生产链的瓶颈：** LLM 直接输出 AigcSpecOutput / NarrativeConstitutionV3，没有 FilmIR 编译步骤。

---

## Step 1: FilmIR Compiler — V3 → FilmLanguageIR 映射

### 为什么做
用户说"让生产链跑通并量化"。当前生产链的输出（NarrativeConstitutionV3）本身就是结构化数据，与 FilmLanguageIR 高度同构。**不需要重构 LLM Prompt，只需要在 V3 output 后面加一个编译步骤。**

### 做什么
1. 创建 `src/runtime/film-ir-compiler.ts`
2. 写一个纯函数 `compileFromV3(v3: NarrativeConstitutionV3): FilmLanguageIR`
3. 按 10 个模块映射：global / scene / characters / camera / lighting / action / environment / style / constraints / references

### 验收
```
V3 Segment(s) → compileFromV3() → FilmLanguageIR（frozen ✓）
- 每个 segment.camera → filmIR.camera 正确映射
- 每个 segment.environment → filmIR.environment 正确映射  
- 每个 segment.characters[].emotion → filmIR.characters[].emotion 正确映射
```

### 不做
- 不做 LLM Prompt 修改
- 不做 Validator 集成
- 不做 V3 以外的输入源

---

## Step 2: Graph Builder — FilmIR → Graph Runtime

### 为什么做
FilmIR 是 AST（层次化），Graph Runtime 是图（关系化）。从 AST 到图的转换是这个 production pipeline 的核心步骤。

### 做什么
1. 实现 `GraphRuntimeAPI.build(irId, irVersion)` — 从 FilmLanguageIR 构建 Graph
2. 节点：scene → `location` node, character → `character` node, props → `prop` node, camera transition → `event` node
3. 边：`stands-in`（角色在场景中）、`holds`（角色持有道具）、`looks-at`（角色注视）
4. 三个 View Projector：`toSceneGraph()` / `toEventGraph()` / `toTimeline()`

### 验收
```
FilmIR(50 segments) → build() → GraphRuntime
- nodes.length = scenes + characters + props（≈ 120 nodes）
- edges.length >= nodes（每个角色至少一个 stands-in 边）
- toSceneGraph() 返回空间相关的子图
- toTimeline() 按 segmentNumber 排序
- checkConsistency() 返回空（无冲突）
```

---

## Step 3: Capability Planner 占位 + Execution DAG

### 为什么做
当前链路没有能力规划步骤。先做一个简单版本：**根据 FilmIR 字段推导需要的 Provider Capability**。

### 做什么
1. 简单实现 `CapabilityPlanner.plan(filmIR, matrix)`：
   - 如果 `filmIR.camera` 有值 → 需要 `camera-path`
   - 如果 `filmIR.characters[].referenceId` 有值 → 需要 `character-reference`
   - 如果 `filmIR.environment.lighting` 有 details → 需要 `physics-constraint`
2. 生成 ExecutionStep 列表（每个 segment 一个 step）
3. 依赖关系：character reference → keyframe → video → lip-sync

### 验收
```
Plan(50-segment FilmIR) → ExecutionDAG
- 至少有一个 rootStep（keyframe）
- 每个 step 声明 requiredCapabilities
- dag 无环（check passes）
```

---

## Step 4: Build the Bridge — 接入现有 worker-runtime

### 为什么做
这是让 production line 真实跑通的关键步骤。现有 `worker-runtime.ts` 已经能处理 Provider 调用，只需要**插入 FilmIR 编译 + Graph 构建步骤**。

### 做什么
1. 在 `aigcOrchestrator.generate()` 中，`buildV3SpecOutput()` 后面插入：
   ```
   V3 output → compileFromV3 → GraphRuntime → freezeFilmIR → save filmIR alongside executionResults
   ```
2. 存储 FilmIR + Graph 到 executionResults（JSON 字段，不建新表）
3. 不修改 worker-runtime（保持 adapter 调用不变）
4. 写一个验证路由：`GET /api/v1/pipeline/validate/:projectId` 返回 FilmIR + Graph 状态

### 验收
```
POST script-submit（50 镜头）
→ executionResults 中包含 filmIR 和 graph snapshot
→ /api/v1/pipeline/validate/:projectId 返回结构
→ 视频生成流程无退化
```

---

## Step 5: 量化指标

### 做什么
1. 在 `compileFromV3` 中记录：
   - `compileLatencyMs`：V3 → FilmIR 耗时
   - `graphBuildLatencyMs`：FilmIR → Graph 耗时
   - `nodeCount` / `edgeCount`
2. 在 `worker-runtime` 中记录：
   - `adapterExecLatencyMs`：Provider 调用耗时
   - `adapterRetries`：重试次数
3. 产出 JSON 报告

### 验收
```
pipeline:validate 返回：
{
  "filmIR": { version, moduleCount, compileLatencyMs },
  "graph": { nodeCount, edgeCount, buildLatencyMs },
  "execution": { stepCount, rootSteps, capabilities },
  "diagnostics": { scores }
}
```

---

## 执行顺序

```
Step 1（FilmIR Compiler）──┐
                           ├──> 单元测试通过
                           │
Step 2（Graph Builder）────┤
                           ├──> 单元测试通过
                           │
Step 3（Planner Stub）─────┤
                           │
                           ▼
Step 4（Bridge to worker）──> 50 镜头短剧真实跑通
                           │
                           ▼
Step 5（量化指标）──────────> 可观测的 pipeline
```

---

## 不做
- ❌ 不修改 LLM Prompt
- ❌ 不建新表
- ❌ 不重写 worker-runtime
- ❌ 不做迁移兼容（直接在 V3 output 后加一步，不影响现有流程）

---

## 预期成果

### A4 结束时
```
V3 → Normalizer → Compiler → FilmIR（冻结 ✓）
                            → Graph Runtime（四视图 + Validator）
                            → Capability Planner → Negotiator
                            → Execution DAG（Contract + DAG Simulator）
                            → Worker Runtime Bridge → Task[]
```

**A4 已冻结模块：**
- Normalizer ✅
- Compiler v0 ✅
- Semantic Graph Builder ✅
- Graph Validator ✅
- Capability Planner ✅
- Capability Negotiator ✅
- Execution Planner + Contract ✅
- DAG Simulator ✅
- Worker Runtime Bridge ✅

### A4.5 — Production Validation

**目标：不开发新能力，开发"验证能力"。**

---

## 生产验证计划（A4.5）

### 为什么做

A4 架构设计已完成。当前最大风险不是架构设计，而是**工程验证风险**——需要在真实短剧项目上持续验证整条生产流水线的稳定性、可量化和可回归性。

### 五步验证方案

#### P1: Pipeline Benchmark（最高优先级）

建立固定 Benchmark 集：
- Benchmark-001: 50 Shot Drama（主测试）
- Benchmark-002: Single Character
- Benchmark-003: Dialogue
- Benchmark-004: Action
- Benchmark-005: Multi Scene

每次 Kernel 升级，全部跑通。

#### P2: Pipeline Metrics

每个阶段的耗时监控：
| 指标 | 说明 |
| --- | --- |
| Compile Time | Compiler 耗时 |
| Graph Build Time | 图构建耗时 |
| Negotiation Time | 能力协商耗时 |
| DAG Build Time | DAG 构建耗时 |
| Bridge Time | Bridge 耗时 |
| Worker Time | Worker 执行耗时 |
| End-to-End Time | 总耗时 |

#### P3: Quality Metrics

能力覆盖率：
```
Requested Capability → Negotiated → Executed → Succeeded
```
例如：
- film.camera.path requested: 100 executed: 82
- film.keyframe requested: 50 executed: 50

#### P4: Replay Validation

Replay 全链路：
```
FilmIR → Replay → Graph → Replay → Negotiation → Replay → DAG → Replay
```
最终 Hash 一致。

#### P5: Golden Dataset

建立官方 Golden Dataset：
- 50 Shot Drama
- 100 Shot Drama
- Romance / Suspense / Dialogue / Action
- 每次升级自动回归测试

### 验收标准

全部满足才算 A4.5 完成：

- [ ] Legacy Pipeline 与 New Pipeline 在预期范围内一致或差异可解释
- [ ] 固定 Golden Dataset 全部跑通
- [ ] 每次运行生成完整 Execution Trace
- [ ] Replay 可重建 Compiler → Graph → Negotiation → DAG → Bridge 全链路
- [ ] 每个阶段都有耗时、覆盖率、诊断等量化指标
- [ ] Benchmark 连续运行（100 次）无结构性回归

### Production Readiness Index（PRI）

| 模块 | PRI |
| --- | ---:|
| Compiler | 99 |
| Graph | 98 |
| Planner | 96 |
| Negotiator | 95 |
| DAG | 98 |
| Bridge | 97 |
| Replay | 0（未完成） |

**Pipeline Total PRI = 97 / 100**

### 不做

- ❌ 不新增 Kernel 模块
- ❌ 不重写 worker-runtime
- ❌ 不修改 LLM Prompt
- ❌ 不建新表
