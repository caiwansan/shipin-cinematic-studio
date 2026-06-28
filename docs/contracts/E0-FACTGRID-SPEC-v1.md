# FactGrid Extraction Specification v1

> FactGrid 是从叙事文本中提取事实网格的规范。
> 它是 PreservationGuard 的核心输入——决定了什么是"已知事实"，什么是"新实体/幻觉"。

---

## ⚖️ 宪法约束

FactGrid 的抽取必须是**纯确定性规则引擎**，不能使用 LLM。

原因：如果 Extraction 本身使用 LLM，那么 LLM 可能输出不存在的 entity，
导致 PreservationGuard 的验证基础被污染。

```
Extraction Layer: 规则引擎（rule-based, deterministic）
Validation Layer: 规则引擎（不能和 Extraction 共用同一个 LLM 实例）
Generation Layer: LLM（含 PreservationGuard 验证结果）
```

---

## FactGrid 结构

```typescript
interface FactGrid {
  entities: EntityFact[];    // 角色/人物实体
  locations: LocationFact[]; // 地点实体
  props: PropFact[];         // 物件实体
  events: EventFact[];       // 事件/动作
  relations: RelationFact[]; // 关系
  descriptors: Descriptor[]; // 修饰语
}

interface EntityFact {
  name: string;              // 原始名称
  normalized: string;        // 归一化形式
  type: 'character' | 'person' | 'group' | 'abstract';
  attributes: string[];      // 关联的修饰语
  source: string;            // 精确原文
  position: number;          // 在原文中的首次出现位置
}

interface LocationFact {
  name: string;
  attributes: string[];
  source: string;
}

interface PropFact {
  name: string;
  attributes: string[];
  source: string;
}

interface EventFact {
  description: string;       // 动作/事件描述
  actor?: string;            // 动作主体
  target?: string;           // 动作客体
  source: string;
}

interface RelationFact {
  subject: string;
  predicate: string;
  object: string;
  source: string;
}

interface Descriptor {
  term: string;
  appliesTo: string;       // 修饰哪个实体/地点/事件
  source: string;
}
```

---

## 抽取规则

### R1: 实体识别（基于词性+命名实体）

支持的语言：中文、英文

中文规则：
- 双字及以上名词短语
- 人名代词不作 entity（"他"、"她"、"它"、"他们"、"她们"）
- 地名实体保留
- 复合名词拆解

英文规则：
- 专有名词（大写开头的名词短语）
- 名词短语（冠词+形容词+名词）
- 代词不纳入

### R2: 事件识别

从动宾结构提取：
```
[主语] + [谓词] + [宾语]
```

示例：
```
"少女撑着伞"  →  Event: { actor: "少女", verb: "撑着", target: "伞" }
"两个人对话"  →  Event: { actor: "两个人", verb: "对话", target: null }
```

### R3: 场景属性提取

从介词短语和环境描述中提取：
```
"在雨夜"     →  Location: { name: "雨夜", attributes: [], source: "在雨夜" }
"在咖啡店"   →  Location: { name: "咖啡店", attributes: [], source: "在咖啡店" }
"深夜办公室" →  Location: { name: "办公室", attributes: ["深夜"], source: "深夜办公室" }
```

### R4: 修饰语关联

从定语/形容词提取修饰关系：
```
"雨夜" 修饰 "街道"  →  Location.attributes += "雨夜"
"红"   修饰 "伞"    →  Prop.attributes += "红"
```

### R5: 关系提取

从动词+连接词提取：
```
AB的关系：
"A在等B"   →  Relation: { subject: "A", predicate: "等", object: "B" }
"A和B对话" →  Relation: { subject: "A", predicate: "对话", object: "B" }
```

---

## 举例

### 示例 1: "少女在雨夜撑着伞等人"

```json
{
  "entities": [
    { "name": "少女", "normalized": "少女", "type": "character", "attributes": [], "source": "少女" }
  ],
  "locations": [
    { "name": "雨夜", "attributes": [], "source": "雨夜" }
  ],
  "props": [
    { "name": "伞", "attributes": [], "source": "撑着伞" }
  ],
  "events": [
    { "description": "撑着伞", "actor": "少女", "target": "伞", "source": "撑着伞" },
    { "description": "等人", "actor": "少女", "target": null, "source": "等人" }
  ],
  "relations": [],
  "descriptors": []
}
```

### 示例 2: "两个人站在路口"

```json
{
  "entities": [
    { "name": "两个人", "normalized": "人", "type": "group", "attributes": ["两个"], "source": "两个人" }
  ],
  "locations": [
    { "name": "路口", "attributes": [], "source": "路口" }
  ],
  "props": [],
  "events": [
    { "description": "站在路口", "actor": "两个人", "target": null, "source": "站在路口" }
  ],
  "relations": [],
  "descriptors": []
}
```

### 示例 3: "黑客在键盘上敲代码"

```json
{
  "entities": [
    { "name": "黑客", "normalized": "黑客", "type": "character", "attributes": [], "source": "黑客" }
  ],
  "locations": [],
  "props": [
    { "name": "键盘", "attributes": [], "source": "键盘" }
  ],
  "events": [
    { "description": "敲代码", "actor": "黑客", "target": null, "source": "敲代码" }
  ],
  "relations": [],
  "descriptors": []
}
```

---

## PreservationGuard 验证算法

```
输入: sourceNarrative, generatedShots[]
输出: Violation[]

步骤:
  1. 从 sourceNarrative 抽取 FactGrid（确定性规则）
  2. 从 generatedShots[] 中提取所有名词性实体名称
  3. 对每个 shot，检查 visualDescription/subject/environment 中的实体:
     a. 如果实体在 FactGrid.entities|locations|props 中存在 → 通过
     b. 如果实体是镜头语言专用词（framing/movement/angle 等）→ 通过
     c. 如果实体是常识环境元素（"天空","地面","路灯","墙面"）→ 检查 inferenceLevel
        - level=0: 不允许常识补全
        - level=1: 允许常见环境元素，但不得超过 3 个
     d. 否则 → Violation.UNKNOWN_ENTITY
  4. 检查 forbidden_output 在 visualDescription 中是否出现
  5. 检查事件: 是否有 FactGrid 中不存在的动作事件
```

### 允许的镜头语言词汇白名单（无需 FactGrid 验证）

```
- framing: wide, full, medium, medium-close, close-up, extreme-close-up, over-shoulder
- movement: static, push-in, pull-out, track, pan, tilt, crane, handheld, dolly-zoom
- angle: eye-level, low-angle, high-angle, bird's-eye, dutch-angle
- shotType: establishing, dialogue, action, reaction, detail, transition
- environment: 天空,地面,墙面,窗户,门,光线,影子,空气
- time: 白天,夜晚,黄昏,清晨,正午
```

---

## 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1 | 2026-06-24 | 初始规范。确定性规则引擎 + PreservationGuard 算法 |
