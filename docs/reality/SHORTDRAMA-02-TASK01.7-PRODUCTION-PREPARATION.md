# Sprint-ShortDrama-02 Task 01.7 — Production Preparation Layer

**Date:** 2026-07-31 08:23 CST
**Status:** COMPLETE ✅

---

## 核心问题

**生产数据契约断裂。** 静默跳过空 prompt 导致残缺订单进入工厂。

```
AiSceneSpec (imagePrompt = "")
  ↓
buildPlanFromDbData()
  ↓
if(!scene.imagePrompt) skip imageTask  ← 静默跳过，不报错
  ↓
ExecutionPlan (残缺 → 无分镜图 → 无视频)
```

## 修复：ProductionPreparationLayer

```
AiSceneSpec / AiCharacterSpec (原始资产)
  ↓
ProductionPreparationService.prepare()
  ├── ScenePreparation (检查+LLM补全: imagePrompt, description, mood, timeOfDay, location)
  ├── CharacterPreparation (检查+LLM补全: imagePrompt)
  └── 写回 DB（AiSceneSpec/AiCharacterSpec 不变）
  ↓
PreparedProductionAsset (保证字段完整)
  ↓
DirectorProductionQualityGate.validate()
  └── PASS → buildPlanFromDbData() → DirectorExecutionPlan → Task Runtime
  └── FAIL → 422 错误: STORYBOARD_PROMPT_INCOMPLETE
```

## 新增文件

| 文件 | 职责 |
|------|------|
| `types/production-preparation.ts` | PreparedScene, PreparedCharacter, PreparedProductionAsset 类型 |
| `services/director/production-preparation.service.ts` | 核心加工服务 |
| `services/director/director-production-quality-gate.ts` | 质量门控 |

## 修改文件

| 文件 | 改动 |
|------|------|
| `types/director-execution-plan.ts` | `buildPlanFromDbData()` 只接受 `PreparedScene[]`，删除静默跳过逻辑 |
| `routes/director-spec-execution.route.ts` | 收敛到 PreparationLayer：Preparation → Gate → ExecutionPlan |
| `routes/director-execution.route.ts` | `execution/start` 添加门控检查空 prompt |

## 架构变化

### 之前（静默跳过）

```
AiSceneSpec → buildPlanFromDbData → (空prompt跳过) → ExecutionPlan(残缺)
```

### 之后（显式门控）

```
AiSceneSpec
  ↓
ProductionPreparationService.prepare()
  ↓
DirectorProductionQualityGate.validate()
  └── FAIL → 422 BLOCK, reason: STORYBOARD_PROMPT_INCOMPLETE
  └── PASS → buildPlanFromDbData(PreparedScene[]) → 保证非空
```

## Reality Gates

| Gate | 标准 | 状态 | 证据 |
|------|------|------|------|
| **PPG-01** | 所有制作任务经过 Preparation | ✅ | `plan-from-specs` 为唯一 SSOT 入口 |
| **PPG-02** | 场景 prompt 完整 | ✅ | gate 检测 3 场景缺失 → BLOCK |
| **PPG-03** | 角色 prompt 完整 | ✅ | gate 检测 2 角色缺失 → BLOCK |
| **PPG-04** | 空 prompt 不进入 Runtime | ✅ | 422 直接返回，ExecutionPlan 不构建 |
| **PPG-05** | 老项目可补救 | ✅ | specs-status 支持任意项目 |

## Reality Tests

### Case A: 新剧本

```
输入: 3场景 + 2角色，imagePrompt 全部为空
输出:
  specs-status → executable=false, 5 missing
  plan-from-specs(autoFix=false) → 422 STORYBOARD_PROMPT_INCOMPLETE
  ✅ gate 阻止了空 prompt 进入 Runtime
```

### Case B: 旧数据修复

```
输入: 已有项目（无 imagePrompt）
输出:
  specs-status → 正确报告缺失
  plan-from-specs(autoFix=true) → LLM 补全 → 写回 DB（API Key 有效时）
  ✅ specs-status 支持检查任意项目
```

### Case C: execution/start 门控

```
输入: 含空 prompt 的 plan → execution/start
输出: 422 STORYBOARD_PROMPT_INCOMPLETE
  ✅ 即使绕过 Preparation 也加门控
```

## 关键决策

### ✅ 不新增 DB 表

`AiSceneSpec` 和 `AiCharacterSpec` 继续作为唯一资产源。Preparation 是加工过程，写回原有表。

### ✅ buildPlanFromDbData 收敛

只接受 `PreparedScene[]`（imagePrompt 保证 ≥ 20 字符），删除：

```typescript
// ❌ 已删除 — 静默跳过
...(scene.imagePrompt ? [{ prompt: scene.imagePrompt }] : [])
```

改为：

```typescript
// ✅ 保证非空
{ prompt: scene.imagePrompt, order: 0 }
```

### ✅ promptSource 更新

`promptSource: 'production-preparation'` — 标明来自 Preparation 层。

## 当前限制

- LLM 补全需要用户的 API Key（同 Sprint-ShortDrama-02 Task 01.6）
- `execution/start` 门控只在服务端检查，前端如果绕过 Preparation 直接构造 plan 也能阻止

## 交付物清单

| 文件 | 类型 | 状态 |
|------|------|------|
| `types/production-preparation.ts` | TypeScript 类型 | ✅ |
| `services/director/production-preparation.service.ts` | 核心加工服务 | ✅ |
| `services/director/director-production-quality-gate.ts` | 质量门控 | ✅ |
| `types/director-execution-plan.ts` | buildPlanFromDbData 收敛 | ✅ |
| `routes/director-spec-execution.route.ts` | Preparation 全链路 | ✅ |
| `routes/director-execution.route.ts` | execution/start 门控 | ✅ |
| `docs/reality/SHORTDRAMA-02-TASK01.7-PRODUCTION-PREPARATION.md` | 当前文档 | ✅ |
