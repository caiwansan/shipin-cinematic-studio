# PQL v1.0 Architecture Freeze（AF-1）

## 状态

- **冻结类型**：接口冻结（Contract Freeze），非代码冻结
- **冻结范围**：六个核心 Contract
- **冻结日期**：2026-06-28
- **冻结版本**：PQL v1.0
- **解冻条件**：仅向后兼容扩展，不允许删除/破坏性修改

---

## Contract 1: CIR v1.0

### 冻结字段

```
cir-v1.ts（CirV1 类型）
  - version: string
  - scene: { title, environment, characters? }
  - characters: Array<{ id, name, alias, gender, age?, appearance, personality[], emotion, voiceGuide? }>
  - shots: Array<{ id, description, durationSeconds, characterIds[], actions[], dialogue[], camera, lighting?, audioCue?, narrativePurpose? }>
    - camera: { path?, motion?, composition?, scale?, angle?, focus? }
      - path: { type, startPosition?, endPosition?, smoothness? }
      - motion: { pattern, speedCurve? }
      - composition: { rule, subjectPosition?, lookRoomDirection?, headroom? }
      - focus: { target, depthOfField?, rackFocus? }
    - lighting: { keyLightDirection, colorTemperature, mood, continuity }
  - storyIntent: { story, cinematic, lighting?, visual? }
  - constraints: { maxDuration?, fps?, resolution? }
  - providerHints?: object
  - metadata: { generatedBy, sourceStoryId?, projectId?, createdAt }
```

### 冻结规则

- 允许新增可选字段（`?`）
- 禁止删除字段
- 禁止更改现有字段类型
- 禁止将必填字段改为可选

### 能力映射（Capability Registry ↔ CIR）

| Capability | CIR Field | 冻结状态 |
|---|---|---|
| CAMERA_PATH | camera.path | ✅ |
| CAMERA_MOTION | camera.motion | ✅ |
| CAMERA_COMPOSITION | camera.composition | ✅ |
| SHOT_SCALE | camera.scale | ✅ |
| SHOT_ANGLE | camera.angle | ✅ |
| CAMERA_FOCUS | camera.focus | ✅ |
| LIGHT_CONTINUITY | lighting | ✅ |
| OBJECT_PERSISTENCE | characters + characters[].appearance | ✅ |
| SPATIAL_RELATIONSHIP | shot + character 序列隐式 | ✅ |
| TEMPORAL_CONSISTENCY | shot 序列隐式 | ✅ |

---

## Contract 2: CCP v1.0

### 冻结管道

```
CIR → Semantic IR → Provider IR → Prompt Renderer → Prompt Optimizer
```

### 冻结类型

| 层 | 输入 | 输出 | 冻结规则 |
|---|---|---|---|
| Semantic IR | CIR（CirV1） | SemanticIR | 允许新增字段，禁止删除 |
| Provider IR | SemanticIR + ProviderCapability | ProviderIR | 允许新增 Provider，禁止改 IR 结构 |
| Prompt Renderer | ProviderIR | { prompt, negativePrompt } | Renderer 可升级，输出格式冻结 |
| Prompt Optimizer | Prompt | OptimizedPrompt | Optimizer 可扩展，输入输出冻结 |

### Capability Diff

`CompileReport.capabilityDiff` 格式冻结：
```yaml
supportedCapabilities: []
lostCapabilities: [{ capability, reason }]
```

---

## Contract 3: Evidence v1.0

### 冻结类型

| 类型 | 冻结字段 |
|---|---|
| EvidencePackage | videoId, sourceStoryId?, generatedAt, shots[], keyframes[], objectTracks[], cameraMotions[], lightingProfiles[], compositionProfiles[], sceneTimeline?, metadata |
| EvidenceRegistry | register() / get() / getEntry() / findBySourceCir() / recent() |
| ExpectedEvidence | shotScales, shotAngles, compositionRules, lightDirections, colorTemperatures, focusTargets, depthOfFields, shotCharacters |

### Evidence Diff 格式

```yaml
EvidenceDeviation:
  capability: string
  expected: string
  observed: string
  deviation: number (0-100)
  score: number (0-100)
  reason: string
```

---

## Contract 4: CapabilityReport v1.0

### 冻结格式

```yaml
CapabilityReport:
  capability: string
  evaluated: boolean
  score?: number
  confidence?: number (0-1)
  severity?: pass | minor | medium | major | critical
  expected?: string | number
  observed?: string | number
  deviations: DeviationDetail[]
    - dimension: string
    - expected: string | number
    - observed: string | number
    - delta: number
    - severity: info | minor | medium | major | critical
    - description: string
  recommendations: Recommendation[]
    - type: adjust | regen | add_constraint | remove_constraint | toggle_capability
    - capability: string
    - description: string
    - cirFieldPath?: string
    - suggestedValue?: string
    - priority: low | medium | high
  evidenceUsed: string[]
  reason?: string
```

### EvaluationSummary 格式

```yaml
EvaluationSummary:
  scores: Record<string, number>
  confidence: Record<string, number>
  dimensions:
    worldConsistency: number
    cinematicQuality: number
    physicsReality: number
    storyAlignment: number
  overall: number
  evaluatedAt: string
```

---

## Contract 5: CIR Patch v1.0

### 冻结格式

```yaml
FieldPatch:
  path: string
  from?: string | number | boolean
  to: string | number | boolean

PatchSection:
  type: safe | recommended | experimental
  confidence: number (0-1)
  targetCapability: string
  fields: FieldPatch[]
  reason: string
  expectedGain?: string
  risk?: string

OptimizationResult:
  videoId: string
  evidenceId: string
  patches: PatchSection[]
  validation: PatchValidation
    - valid: boolean
    - errors: string[]
    - warnings: string[]
    - affectedCapabilities: [{ capability, expectedChange, direction }]
  summary:
    - totalPatches
    - safePatches / recommendedPatches / experimentalPatches
    - overallConfidence
    - autoApplicable: boolean
```

### 禁止

- Patch 中**不得包含 prompt、negativePrompt、videoPrompt 字段**
- Patch 的路径必须指向 **CIR 字段**，不能指向 Provider Prompt

---

## Contract 6: Capability Registry v1.0

### 冻结条目

当前 Wave 1 + Wave 2 共 17 项（覆盖 55%）：

| Capability | Wave | CIR 映射 | Evidence 依赖 | 评估器 | Patch 策略 |
|---|---|---|---|---|---|
| CAMERA_PATH | W1 | camera.path | cameraMotions, shots | — | MotionPatchStrategy |
| CAMERA_MOTION | W1 | camera.motion | cameraMotions | CameraMotionEvaluator | MotionPatchStrategy |
| OBJECT_PERSISTENCE | W1 | characters[].appearance | objectTracks, keyframes | ObjectPersistenceEvaluator | RegenPatchStrategy |
| SPATIAL_RELATIONSHIP | W1 | shot 序列隐式 | objectTracks | — | — |
| TEMPORAL_CONSISTENCY | W1 | shot 序列 | shots | — | — |
| LIGHT_CONTINUITY | W2 | lighting | lightingProfile, keyframes | LightingEvaluator | LightingLockPatchStrategy |
| CAMERA_COMPOSITION | W2 | camera.composition | compositionProfile, keyframes | CompositionEvaluator | CompositionPatchStrategy |
| SHOT_SCALE | W2 | camera.scale | shots | ShotScaleEvaluator | ScalePatchStrategy |
| SHOT_ANGLE | W2 | camera.angle | shots | ShotAngleEvaluator | — |
| FOCUS_CONTROL | W2 | camera.focus | keyframes | FocusEvaluator | FocusPatchStrategy |
| （其余 Wave 2 子能力） | W2 | — | — | — | — |

### 新增规则

- Wave 3/4 只新增不修改
- 新增时必须声明：CIR 字段 / Evidence 依赖 / Evaluator / Patch 策略
- 禁止更改已有 Capability 的字段映射

---

## 兼容性测试

所有 Contract 冻结后，未来任何变更必须通过以下测试：

1. **Schema 向后兼容测试**：v1.1 必须能读取 v1.0 的所有字段
2. **Capability 注册兼容测试**：新增 Capability 不影响已有 Capability
3. **CIR 解析兼容测试**：v1.0 CIR 在 v1.1 解析器中必须正常工作
4. **Evidence Package 兼容测试**：旧 Evidence 在新引擎中必须可读
5. **CapabilityReport 兼容测试**：旧 Report 在新 CEE 中必须可消费
6. **Patch 兼容测试**：旧 Patch Plan 在新 COE 中必须可应用

---

## Manifest

```
PQL v1.0 Manifest
├── Contract 1: CIR v1.0          → cir-v1.ts, CIR_V1_SPEC.md
├── Contract 2: CCP v1.0          → ccp-types.ts, ccp-compiler.ts
├── Contract 3: Evidence v1.0     → vep-types.ts, vep-evidence-diff.ts
├── Contract 4: CapabilityReport  → cee-types.ts
├── Contract 5: CIR Patch v1.0    → coe-types.ts
├── Contract 6: Capability Registry → benchmarks/capabilities/
├── Schema Compatibility Tests     → （见文末）
└── AF-1 冻结声明                  → 本文件
```

---

## 冻结后的开发规则

1. **Field additions only** — 只加字段，不改字段
2. **New Evaluators only** — 只加评估器，不改 CEE Engine
3. **New Strategies only** — 只加策略，不改 COE Engine
4. **New Provider Compilers only** — 只加 Compiler，不改 CCP 架构
5. **No Prompt anywhere** — CIR / CCP / VEP / CEE / COE 均不产生 Prompt
6. **All changes must pass compatibility tests**
7. **Manifest 必须同步更新**
