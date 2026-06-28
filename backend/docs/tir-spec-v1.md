# TIR — Textual IR Language Spec v1
## 可编程叙事语言 — 导演语言语法规范

> TIR = Textual IR，是 DirectorIRGraph 的文本表示，也是 "Narrative Programming Language" 的语言表层。
> 
> JSON 只是 AST，TIR 才是语言。

---

## 1. 核心原则

### 1.1 Minimum Complete Language
TIR 必须能够表达"一个完整的电影结构"，但不能过度设计语法。够用即止。

### 1.2 IR = AST
TIR `.tir` 文件是源代码，parse 后得到 `DirectorIRGraph` 作为 AST。
三个编译 Pass 消费的是 AST，不是 TIR。

### 1.3 Three Things Only
TIR 只解决三个问题：
1. 表达 shot graph（时序/场景/镜头）
2. 表达 causal dependency（为什么）
3. 表达 narrative constraint（合法边界）

---

## 2. 语法概览

一个 TIR 文件是一个**场景块（scene block）**序列。

```
// — 单行注释
# 也是注释

scene "黄昏追逐" {
  // scene-level metadata
  @tension 0.7
  @location "城市天台"
  
  shot s1 "雨夜，男主冲上天台" {
    @tension 0.3
    @motion handheld_shake
    @grammar ws // wide shot
    @emotion anxiety
  }
  
  shot s2 "特写：男主握紧拳头" {
    @tension 0.6
    @motion slow_push
    @grammar cu // close-up
    @emotion anger
  }
  
  shot s3 "女主从背后出现" {
    @tension 0.8
    @motion static
    @grammar ms // medium shot
    @emotion surprise
    @constraint flag arc_peak=true
  }
  
  // causal edges
  s1 -> s2 { weight 0.6 causal }
  s2 -> s3 { weight 0.8 temporal }
  s1 ->> s3 { weight 0.4 semantic }
  
  // narrative constraints
  constrain s2 {
    forbid abrupt_peak
    must arc_role=build
  }
}
```

---

## 3. 词法规则

### 3.1 标识符
- `shot` 声明：`shot <name> "<description>"`
- name：小写字母 + 数字 + 下划线，如 `s1`, `wide_shot_2`
- description：双引号字符串

### 3.2 注释
```
// 单行注释
# 也是单行注释
```

### 3.3 修饰符（Annotations）
以 `@` 开头，描述 shot 的属性：
```
@key value
@key=value
```

多值：
```
@tags ["action", "climax"]
```

### 3.4 字符串
双引号：`"hello"`，支持转义 `\"` `\n` `\t`

### 3.5 数字
整数：`42`
浮点数：`0.618`
区间：`[0.3, 0.8]`

---

## 4. 顶层结构

```
file := { scene_block }

scene_block := "scene" string "{" { scene_stmt } "}"

scene_stmt :=
  | shot_decl
  | edge_decl
  | constrain_decl
  | annotation  // scene-level metadata
```

### scene block
每个 scene 是一个命名故事单元。

```
scene "开场" { ... }
scene "高潮" { ... }
scene "结尾" { ... }
```

---

## 5. Shot 声明

```
shot_decl := "shot" identifier string "{" { shot_stmt } "}"

shot_stmt :=
  | annotation
  | constraint_annotation
```

### 示例
```
shot s1 "黄昏长镜头" {
  @tension 0.5
  @motion slow_zoom
  @grammary ms // medium shot
  @emotion melancholic
  @character ["男主", "女主"]
  @duration 12s
}
```

### 内置 Annotation 键

| 键 | 类型 | 说明 |
|----|------|------|
| `@tension` | float [0,1] | 张力值 |
| `@motion` | identifier | 运镜类型 |
| `@grammar` | identifier | 镜头语法类型 |
| `@emotion` | identifier | 情感状态 |
| `@character` | string[] | 出镜角色 |
| `@duration` | string | 时长（"12s"） |
| `@location` | string | 场景位置 |
| `@tags` | string[] | 任意标签 |

---

## 6. Edge 声明（因果依赖）

### 6.1 基本语法
```
source -> target { options }
```

### 6.2 Edge 类型

```diff
+ temporal   →  时间先后（默认）
  causal     →  因果关系（权重传播）
- semantic   →  语义关联
- derivation →  派生关系
- narrative_constraint →  叙事约束
```

### 6.3 Syntax

```
// temporal（默认）
s1 -> s2

// causal，带权重
s2 -> s3 { weight 0.8 causal }

// 语义关联（虚线语义）
s1 ->> s3 { weight 0.4 semantic }

// 叙事约束
s1 ->> s3 { hard constraint rule_id=peak_protection }
```

### 6.4 Edge Options

| 选项 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `weight` | float | 1.0 | 权重 [0,1] |
| `hard` | bool | false | 硬约束 |
| `rule_id` | string | — | 约束规则 ID |
| `type` | identifier | temporal | 边类型 |

---

## 7. Constrain 声明（叙事约束）

```
constrain_decl := "constrain" identifier "{" { constraint_rule } "}"

constraint_rule :=
  | "forbid" identifier
  | "must" identifier "=" string_or_number
```

### 示例
```
constrain s2 {
  forbid abrupt_peak
  must arc_role=build
}

constrain scene_1 {
  forbid forbidden_transition(peak→release_direct)
  must peak_positions=1
}
```

### 内置约束规则

| 规则 | 用法 | 说明 |
|------|------|------|
| `forbid abrupt_peak` | single | 禁止张力跳变 |
| `forbid <transition>` | single | 禁止特定转换 |
| `must arc_role=build\|peak\|release\|transition` | single | 必须扮演的弧线角色 |
| `must tension ∈ [min, max]` | range | 张力值必须在区间内 |
| `must arc_type=build_peak_release\|rise_fall\|flat_arc` | global | 弧线类型 |
| `must arc_type=constant_escalation\|rise_fall_release\|oscillating\|inverted_arc\|single_peak_with_plateau\|delayed_peak\|double_peak\|valley_arc` | global | 扩展弧线类型 |

---

## 8. Narrative Arc 修饰

全局弧线声明（可放在任意 scene block 之前）：

```
@arc build_peak_release
@max_tension_curve [0.3, 0.5, 0.8, 1.0, 0.7, 0.4, 0.2]
```

或等价地：
```
@arc {
  type build_peak_release
  max_tension [0.3, 0.5, 0.8, 1.0, 0.7, 0.4, 0.2]
  peak_positions [3, 4]
}
```

---

## 9. 完整示例

```
# film: "黎明追击"（aigc 短剧）
@arc build_peak_release
@max_tension_curve [0.2, 0.4, 0.7, 0.9, 0.6, 0.3]

scene "开场" {
  @location "废弃工厂"
  
  shot s1 "男主从昏迷中醒来" {
    @tension 0.2
    @motion static
    @grammar ws
    @emotion confusion
  }
  
  shot s2 "环顾四周" {
    @tension 0.3
    @motion slow_pan
    @grammar ms
    @emotion alert
  }
  
  s1 -> s2 { weight 0.7 causal }
  
  constrain s1 {
    must arc_role=build
  }
}

scene "对峙" {
  @location "工厂二楼"
  @tension 0.7
  
  shot s3 "反派出现" {
    @tension 0.7
    @motion quick_zoom
    @grammar cu
    @emotion shock
    @constraint flag arc_peak=true
  }
  
  shot s4 "对峙对话" {
    @tension 0.8
    @motion static
    @grammar ots // over-the-shoulder
    @emotion tension
  }
  
  s3 -> s4 { weight 0.9 temporal }
  s2 ->> s3 { weight 0.6 causal }
  
  constrain s3 {
    forbid abrupt_peak
  }
}

scene "终局" {
  @location "天台"
  
  shot s5 "男主反击" {
    @tension 0.6
    @motion handheld_shake
    @grammar ws
    @emotion determination
  }
  
  shot s6 "黎明到来" {
    @tension 0.3
    @motion slow_zoom
    @grammar extreme_ws
    @emotion relief
  }
  
  s5 -> s6 { weight 0.5 causal }
}

// 全局约束
constrain scene_1 {
  forbid forbidden_transition(build→peak_direct)
  must peak_positions=1
}
```

---

## 10. 设计边界（Minimal Complete）

### ✅ TIR v1 能表达（必须的）
- 多 scene 结构
- shot 声明 + 标注
- 因果/时序/语义边
- 叙事约束规则
- 弧线声明

### ❌ TIR v1 不覆盖（留给未来）
- 角色声明（不在 IR 层，在 character-persistence）
- 镜头参数（光圈/焦距/运动曲线 — 属于 cinematic-grammar）
- 模板/macro 语法（v2）
- 条件编译（v2）
- 类型检查/错误恢复（pass 层的事）

---

## 11. 工程计划（TIR → 系统）

```
Phase 1: TIR Syntax Spec v1         ← 你现在在这里 ✅
Phase 2: TIR → DirectorIRGraph Parser (tir-parser.ts)
Phase 3: DirectorIRGraph → TIR Serializer (tir-serializer.ts)
Phase 4: 集成到 API 层：POST /api/workbench/tir/parse + /api/workbench/tir/serialize
Phase 5: 前端 TIR 编辑器面板
Phase 6: Macro System v1 (TIR 模板 + 变量替换)
```

---

*Spec v1 — 2026-06-19*
*"导演不是写代码的，但导演系统是用语言编译出来的。"*
