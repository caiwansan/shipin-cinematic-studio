# PromptIR ↔ UI Binding Contract v1.0

> **Structural Invariance Contract** — 编译器与 UI 投影层的绑定契约  
> 类型: 系统宪法级约束  
> 范围: UI ↔ Compiler 一致性  
> 执行: Phase D 冻结期手动约束

---

## 1. 核心原则（三条硬约束）

### 1.1 Single Source of Truth（SSOT）
```
PromptIR = 唯一真实数据源
UI = projection layer（投影层）
```

**禁止：**
- UI 自己保存额外状态语义
- UI 推导 compiler 未定义字段
- UI 生成 implicit pipeline step

### 1.2 No New Semantics Rule（零语义扩展）
UI 只能：
- 编辑 PromptIR 已存在字段
- 组合展示字段
- 触发 compiler action

**禁止：** 新增步骤 / stage / hidden logic / UI 推导 execution order

### 1.3 Deterministic Mapping Rule（确定性映射）
```
PromptIR field → UI Component = 1:1 或 1:n（固定映射）
UI Component → PromptIR field = 1:1（必须唯一归属）
```

---

## 2. 字段绑定规范

### 2.1 Narrative Layer（Storyboard）
| PromptIR Field | UI Location | Rule |
|----------------|-------------|------|
| narrative | left storyboard | editable |
| dialogue | left storyboard | editable |
| effects | left storyboard | editable |
| emotion | left storyboard | editable |
| negativePrompt | left storyboard | editable |

> Storyboard = ONLY source of truth for semantic content

### 2.2 Asset Layer（Reference Asset Builder）
| PromptIR Field | UI Location | Rule |
|----------------|-------------|------|
| firstFramePrompt | middle asset builder | editable |
| lastFramePrompt | middle asset builder | editable |
| referenceImages | middle asset builder | editable |
| characterRefs | middle asset builder | editable |
| sceneRefs | middle asset builder | editable |

> Asset Layer = deterministic conditioning generator

### 2.3 Execution Layer（Compiler）
| PromptIR Field | UI Location | Rule |
|----------------|-------------|------|
| compileConfig | right panel | read-only |
| model selection | right panel | editable |
| duration | right panel | editable |
| compileTrigger | button | action only |
| generateTrigger | button | action only |

> Execution Layer = NO semantic editing allowed

---

## 3. 禁止映射 — UI 不允许绑定 PromptIR
- ❌ stage ordering
- ❌ pipeline steps
- ❌ "优化提示词"生成内容（LLM 派生字段）
- ❌ implicit frame logic
- ❌ shot-level execution logic

---

## 4. 防漂移规则

### 4.1 UI cannot infer execution graph
```
❌ UI → 推断"先生成首帧再编译"
✔ UI → 只提交 PromptIR，Compiler 决定 execution order
```

### 4.2 Asset generation is NOT pipeline step
首尾帧必须明确是 PromptIR conditioning field，不是 workflow stage。

### 4.3 UI state ≠ runtime state
```
UI state = editing state
runtime state = compiler execution state
```
禁止混用。

---

## 5. 结构映射图
```
┌──────────────────────┐
│     PromptIR AST     │
└─────────┬────────────┘
          │
    ┌─────┼─────┬──────┐
    │     │     │      │
Storyboard  Asset   Execution
Layer    Layer    Layer
(narrative) (frames) (compile/run)
    │     │     │      │
    └─────┴─────┴──────┘
    UI Projection Layer
```

---

## 6. 系统级防线
> UI must never become a second compiler.

## 7. 版本信息
```
Contract Version: PromptIR-UI-Binding-v1.0
Type: Structural Invariance Contract
Scope: UI ↔ Compiler consistency
Enforcement: manual + dev discipline (Phase D)
Created: 2026-06-24
```
