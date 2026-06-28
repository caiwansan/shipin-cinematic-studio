# Benchmark Constitution v1

> **Created:** 2026-06-29
> **Status:** ⏳ Draft — Review by 熊大
>
> 定义昆仑镜短剧系统的"一次标准生产验证"的完整规范。
> 任何新增 Provider、模型或能力扩展，必须通过本 Constitution 规定的全部验证才能视为生产就绪。

---

## 1. Dataset 分级

| 等级 | 内容 | 建议规模 | 用途 | CI 要求 |
| ---- | ---- | -------- | ---- | ------- |
| L0 | 单元验证 | 1 Shot | 单模块回归 | 每次提交 |
| L1 | Pipeline 验证 | 5 Shot | 全链路正确性 | 每次提交 |
| L2 | 集成验证 | 20 Shot | 生产场景验证 | 每日 |
| L3 | Production Benchmark | 50–100 Shot | 性能与稳定性基线 | 每次 Release |

### L0—单元验证
- 用途：快速验证单个 Pipeline Stage 不崩溃
- 运行时间预期：< 1s
- 必须通过：每次 `git commit`

### L1—Pipeline 验证
- 用途：验证 Compiler → Graph → Planner → Negotiator → DAG 全链路正确
- 运行时间预期：< 5s
- 必须通过：每次 `git commit`

### L2—集成验证
- 用途：覆盖多角色、多场景、多对话的典型短剧场景
- 运行时间预期：< 30s
- 必须通过：每日 CI

### L3—Production Benchmark
- 用途：性能基线、稳定性测试、长时间运行
- 运行时间预期：1–5 min
- 必须通过：Release 前

---

## 2. Dataset Schema

每个 Dataset 必须包含以下文件：

```
benchmarks/datasets/<level>-<id>/
├── input/
│   ├── narrative.json          # 原始剧本（NarrativeText / NarrativeConstitutionV1）
│   ├── v3.json                 # NarrativeConstitutionV3（LLM 解析结果）
│   └── expected-filmir.json    # 期望的 FilmLanguageIR（可选，用于断言）
├── metadata.yaml               # Dataset 元信息
├── expectations.yaml           # 预期指标
└── tags.yaml                   # 能力标签
```

### metadata.yaml

```yaml
id: L1-001
level: L1
name: Dialogue 5-shot
description: Five-shot short drama with two characters and basic dialogue.
shots: 5
characters: 2
capabilities:
  - film.character.reference
  - film.keyframe
  - film.render.shot
  - film.temporal.consistency
difficulty: basic
created: 2026-06-29
hash: sha256:<content-hash>
```

### expectations.yaml

```yaml
# 验收指标（见 §3）
compileSuccess: true
minSps: 0.8            # Semantic Preservation Score 最低值
minCapabilityCoverage: 0.7  # 能力覆盖率最低值
compilerDeterminism: 0.99   # Compiler Hash 一致率
maxPipelineDurationMs: 5000 # Pipeline 最大耗时（不含 Worker）
maxDriftCount: 0            # 架构漂移最大允许数
```

### tags.yaml

```yaml
# Capability Coverage Matrix
capabilities:
  film.character.reference: true
  film.keyframe: true
  film.camera.path: false
  film.render.shot: true
  film.physics.constraint: false
  film.lip.sync: false
  film.temporal.consistency: true
  film.lighting.control: false
  film.style.transfer: false
  film.spatial.layout: false
tags:
  - dialogue
  - two-characters
  - basic
```

---

## 3. 统一验收指标

所有 Benchmark 运行后必须导出以下指标：

| 指标 | 类型 | 说明 | L0 | L1 | L2 | L3 |
| --- | --- | --- | --- | --- | --- | --- |
| **Compile Success** | boolean | Compiler 是否成功 | ✅ | ✅ | ✅ | ✅ |
| **SPS** | float [0,1] | 语义保留率 | ✅ | ✅ | ✅ | ✅ |
| **Capability Coverage** | float [0,1] | Requested → Executed 比率 | ❌ | ✅ | ✅ | ✅ |
| **Compiler Determinism** | float [0,1] | Hash 一致率 | ✅ | ✅ | ✅ | ✅ |
| **Pipeline Duration** | ms | 各 Stage 累计耗时 | ✅ | ✅ | ✅ | ✅ |
| **Drift Count** | int | 架构漂移总数（应为 0） | ✅ | ✅ | ✅ | ✅ |

---

## 4. Benchmark Fingerprint

每次运行生成不可变的 Benchmark Fingerprint：

```yaml
benchmarkRunId: run_20260629_001
datasetId: L1-001
fingerprint:
  compilerHash: sha256:<FilmIR JSON Hash>
  graphHash: sha256:<Graph JSON Hash>
  dagHash: sha256:<ExecutionDAG JSON Hash>
  executionTraceHash: sha256:<Trace JSON Hash>
metrics:
  compileSuccess: true
  sps: 0.95
  capabilityCoverage: 0.85
  compilerDeterminism: 0.995
  pipelineDurationMs: 2340
  driftCount: 0
stages:
  - stage: Compiler
    durationMs: 42
    warnings: 0
    errors: 0
  - stage: GraphBuilder
    durationMs: 15
    warnings: 0
    errors: 0
  - stage: CapabilityPlanner
    durationMs: 8
    warnings: 0
    errors: 0
  - stage: CapabilityNegotiator
    durationMs: 5
    warnings: 0
    errors: 0
  - stage: ExecutionPlanner
    durationMs: 3
    warnings: 0
    errors: 0
  - stage: Bridge
    durationMs: 1
    warnings: 0
    errors: 0
```

**Fingerprint 变更追踪规则：**
- Compiler Hash 变化 → 说明 Compiler 输出变化
- Graph Hash 变化但 Compiler Hash 不变 → 说明 Graph Builder 变化
- DAG Hash 变化但 Graph Hash 不变 → 说明 Planner/Negotiator/Planner 变化
- Trace Hash 变化但 DAG Hash 不变 → 说明 Bridge 变化

---

## 5. Benchmark Runner 规范

Runner 应支持分层执行：

```bash
# 只跑 Compiler → FilmIR
node run-benchmark.js --dataset L1-001 --stage compiler

# 跑 Compiler → Graph
node run-benchmark.js --dataset L1-001 --stage graph

# 跑 Compiler → Planner
node run-benchmark.js --dataset L1-001 --stage planner

# 全链路（含 Bridge，不含 Worker）
node run-benchmark.js --dataset L1-001 --stage full

# 全链路 + Worker
node run-benchmark.js --dataset L1-001 --stage production
```

Runner 输出必须包含：
1. Benchmark Fingerprint（可和前一天对比）
2. Pipeline Report（含所有 StageMetrics）
3. 与 Baseline 的差异对比（diff report）

---

## 6. Baseline 管理

初始 Baseline：**Production Baseline v1.0**

Baseline 存储在：
```
benchmarks/baselines/
├── v1.0/
│   ├── L0-001.fingerprint.yaml
│   ├── L1-001.fingerprint.yaml
│   └── ...
└── CURRENT (symlink → v1.0)
```

更新规则：
- 任何 Kernel 变更必须重新运行所有 Benchmark
- 如果 Fingerprint Hash 变化，判断是预期变更还是回归
- 只有通过 Code Review 后才能更新 Baseline

---

## 7. 暂不纳入的范围

以下内容暂时不属于 Benchmark Constitution：

- ❌ **视频质量自动评分**（美学评分、镜头评分）— 后续阶段增加
- ❌ **Provider 特定指标**（生成时间、成本）— A5 阶段增加
- ❌ **用户满意度**— 生产上线后增加
- ❌ **视觉风格一致性**— 需要领域模型支持后增加

---

## 8. Constitution 变更流程

修改此 Constitution 需：
1. 说明变更原因
2. 评估对现有 Golden Dataset 的影响
3. 更新所有受影响的 Dataset expectations.yaml
4. 熊大审批
