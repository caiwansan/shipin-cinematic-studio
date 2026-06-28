# Phase E1.5 — ShotIR Deterministic Stabilization

> **当前状态：** Phase E1 成功，但处于 Hybrid Transitional State。
> 导演"在现场临时想镜头"——LLM 仍在决定 shot 结构（数量/排序/类型分配）。
>
> **目标：** 把 ShotIR 从 "LLM-assisted structure" 变为 "constraint-driven structure"。
> 导演"提前写好分镜脚本"——ShotIR 在 compileVideo() 之前就必须存在。

---

## ⚖️ 宪法原则

### 核心变更

```
E1 (当前):  shots = LLM generates structure + description
E1.5 (目标): shots = deterministic rules (structure)
               ↓
               LLM describes (phrasing only)
               ↓
               Guard validates
```

### ShotIR 定位变更

```
E1: ShotIR is a RUNTIME PATCH layer
    compileVideo() → if shots empty → injectShotIR() → compile()
                                              ↑ LLM decides everything

E1.5: ShotIR is a PRIMARY COMPILE ARTIFACT
    ShotIRCompiler(narrative) → PromptIR + shots[] → compileVideo()
    ↑ deterministic first, LLM assist second
```

---

## 🧩 三项修复

### 🧩 F1: ShotIR 必须成为 primary artifact

**禁止：**
```
if shots empty → generate shots    ❌ runtime patch
```

**改为：**
```
shots = ShotIRCompiler(narrative)   ✅ deterministic entry
```

**实施方式：**
- `buildShotIR()` 从 `async` 改为 `sync`（确定性创建 shot skeleton）
- shot 数量/排序/类型分配全部由 FactGrid v2 的规则引擎决定，不再走 LLM
- LLM 只在 skeleton 之上做 visualDescription 的措辞润色

### 🧩 F2: LLM 降级为 "descriptor only"

**LLM 只能做：**
- `visualDescription` 的措辞建议（"什么画面感"）
- `mood` 关键词 enrichment
- `lighting` / `camera` 的 phrasing suggestion

**LLM 不能做：**
- ❌ decide shot count（镜头数量由规则决定）
- ❌ decide shot structure（镜头顺序由规则决定）
- ❌ decide shot ordering（排序由叙事阶段决定）

**实施方式：**
- `determineShotStructure(factGrid)` → 纯规则引擎
- `enrichDescription(shotSkeleton)` → LLM（system prompt 告知"只改写措辞，不改变结构"）

### 🧩 F3: 移除 runtime injection logic

**必须移除：**
```
injectShotIRIntoPromptIR()    ❌ 运行时补丁
```

**替换为：**
```
ShotIRCompiler(narrative) → PromptIR
                             ↑ compileVideo() 收到的 PromptIR 已经含完整的 shots[]
```

**实施方式：**
- `injectShotIRIntoPromptIR()` 的功能整合到 `buildShotIR()` 中
- `compileVideo()` 不再有 pre-processing hook
- 调用方（`api-video-optimize.ts`）在调用 compile 前先调用 `buildShotIR()`

---

## 确定性 Shot 结构规则

### 规则 1: shot 数量

```
if 叙事长度 < 10字 → min 2 shots
if 叙事长度 < 30字 → min 3 shots
if 叙事长度 < 80字 → min 4 shots
else → min 5 shots (max 8)
```

### 规则 2: shot 类型分配

```
first shot → 总是 establishing
last shot  → 总是 transition
中间 shots:
  if 有 dialogue → 插入 dialogue shot
  if 有 action event → 插入 action shot
  if 有 characters → 至少 1 reaction shot
  else → 填充 detail shot
```

### 规则 3: shot 排序

```
1. establishing（场景建立）
2. dialogue / action（事件展开）
3. reaction / detail（细节补充）
4. transition（段落过渡）
```

### 规则 4: camera 分配

```
establishing → framing: wide, movement: push-in/static
dialogue     → framing: medium/close-up/over-shoulder, movement: static
action       → framing: full/medium, movement: track/handheld
reaction     → framing: close-up, movement: static/push-in
detail       → framing: extreme-close-up, movement: static
transition   → framing: wide, movement: pan/tilt/dolly-zoom
```

---

## 新的编译路径（最终形态）

```
narrative
    ↓
FactGrid v2 (确定性的实体/事件/场景/环境抽取)
    ↓
determineShotStructure() (确定性的 shot 数量/类型/排序)
    ↓
buildShotSkeleton() (确定性的 camera/lighting/duration 分配)
    ↓
enrichDescription() (LLM 仅做措辞润色——visualDescription wording)
    ↓
checkPreservationGuard() (验证——确定性的)
    ↓
PromptIR + shots[] (complete artifact，ready for compile)
    ↓
compileVideo() (pure deterministic, no pre-processing hook)
    ↓
VideoPromptSpec
```

---

## 文件变更计划

### 重构 `shotir-compiler.ts`

| 现有函数 | E1.5 变更 |
|---------|----------|
| `extractFactGridV2()` | 保持不变（已确定性） |
| `checkPreservationGuard()` | 保持不变（已确定性） |
| `buildShotIR()` | 重构：从 async LLM 改为 sync deterministic + optional LLM enrich |
| `buildShotIRSystemPrompt()` | 重写：prompt 只用于描述润色，不再给 shot 结构决策权 |
| `injectShotIRIntoPromptIR()` | 移除——功能合并到 `buildShotIR()` |

### `video-compiler.ts`

| 函数 | 变更 |
|------|------|
| `compileVideo()` | 恢复为 pure function（无 pre-processing） |
| `compileVideoWithShotIR()` | 移除——不再需要 |

### `api-video-optimize.ts`

| 变更 |
|------|
| 路由 handler 显式调用 `buildShotIR()` 然后 `compileVideo()` |
| PromptIR 在进入 compile 前就已经包含 shots[] |

---

## 验证标准（与 E0 共用）

| 指标 | 目标 | 对比 E1 |
|------|------|---------|
| Mutation Leakage | < 1% | LLM 不再决策结构，只润色措辞 → 预计更低 |
| Shot Coverage | > 80% | 确定性 shot 分配 → 100% 覆盖 |
| Fallback Dependency | < 10% | fallback 已不在 shot 生成路径中 |
| Determinism Rate | 100% | 相同 narrative → 相同 shot 结构（LLM 只影响措辞） |

---

## 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1 | 2026-06-24 | E1.5 稳定化规范。三项修复 + 确定性 shot 结构规则 + 新编译路径 |
