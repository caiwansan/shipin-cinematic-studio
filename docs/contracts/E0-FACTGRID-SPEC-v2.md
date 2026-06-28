# FactGrid Extraction Specification v2

> FactGrid v2 在 v1 的基础上新增了 Environment Completion Layer。
>
> 关键变化：原来是单层 `sourceFacts[]`，现改为三层结构：
> - **Explicit Facts**（原文直接存在的实体/事件）
> - **Implied Actions**（由动作直接推导的结果）
> - **Environment Completion**（场景环境的自然延伸）
>
> 这是为了响应陛下圣裁——"环境补全允许，剧情补全禁止，实体新增禁止"。

---

## ⚖️ 宪法约束

### 核心法则

```
Environment Completion ≠ Entity Injection
```

- **Environment Completion 允许**：氛围、光线、天气效果、地面纹理、声音
- **Entity Injection 禁止**：新实体（角色、物件、地点）、新关系、新事件、新动机、新因果

### 三层事实架构

```typescript
interface FactGridV2 {
  /** Level 0: 原文直接存在的事实 */
  explicit: ExplicitFacts;

  /** Level 1: 由动作直接推导 */
  impliedActions: ImpliedAction[];

  /** Level 1E: 由场景自然产生的环境补全 */
  environmentCompletion: EnvironmentFact[];

  /** 禁止实体白名单（生成的 shot 中不可出现的实体） */
  forbiddenEntities: string[];
}

interface ExplicitFacts {
  entities: EntityFact[];    // 角色/人物
  locations: LocationFact[]; // 地点
  props: PropFact[];         // 物件
  events: EventFact[];       // 事件
  descriptors: Descriptor[]; // 修饰语
}

interface ImpliedAction {
  action: string;            // 原文中的动作
  implied: string[];         // 该动作的自然推导结果
}

interface EnvironmentFact {
  category: 'weather' | 'lighting' | 'atmosphere' | 'sound' | 'texture' | 'time_effect';
  description: string;
  sourceScene: string;       // 来源于哪个场景描述词
}
```

---

## 三层抽取规则

### L0：Explicit Facts（字面实体）

与 v1 完全一致。

抽取方式：确定性规则引擎。

示例：
```
"少女在雨夜撑着伞等人"
→ entities: ["少女"], props: ["伞"], locations: ["雨夜"], events: ["撑着伞","等人"]
```

```
"两个人站在路口"
→ entities: ["两个人"], locations: ["路口"], events: ["站在路口"]
```

### L1：Implied Actions（动作推导）

从 Explicit Events 推导的自然动作结果。

| 原文事件 | 隐含动作（允许） | 禁止推导 |
|---------|----------------|---------|
| 等人 | 站立 | 在走 |
| 等人 | 凝视远方 / 低头 | 玩手机 |
| 撑着伞 | 被雨淋（从伞外溅到） | 去收伞 |
| 跑进教室 | 推门 | 跌倒了 |
| 骑自行车 | 踩踏板 | 闯红灯 |
| 敲代码 | 看屏幕 / 打字 | 入侵系统 |
| 关门走了 | 转身 / 脚步 | 去机场 |
| 端汤走过来 | 看路 / 慢慢走 | 烫到了 |
| 打开冰箱 | 看里面 / 伸手 | 拿啤酒 |
| 打车 | 招手 / 等车 | 去哪 |
| 下雨 | 躲雨 / 衣服湿了 | 被困（添加新事件）|

推导规则必须是确定性的（key-value 映射表 + 词向量匹配），不能用 LLM。

### 🌡️ Environment Budget Constraint（防泛化膨胀）

ShotIR 是 camera-constrained visual planner，不是世界生成器。
环境补全必须有预算上限，防止 "画面变丰满" 滑向 "世界被创造"。

### 预算规则

```typescript
interface EnvironmentBudget {
  /** 每个叙事段落的补全最大条目数 */
  maxItems: number;  // 默认: 3-5

  /** 优先级顺序（高到低） */
  priorityOrder: [
    'physical_surface',   // 物理表面（路面、积水、墙壁纹理）
    'light_behavior',     // 光的行为（反光、阴影、光晕）
    'weather_effect',     // 天气效果（雨滴、雾气、风动）
    'ambient_sound'       // 环境音（雨声、风声、车声）
  ];

  /** 每类最多条目数 */
  perCategoryLimit: number; // 默认: 2
}
```

### 正确场景

```
雨夜 → { rainDrops, wetRoad, reflections }
      ↑ 3 项，覆盖物理表面 + 光行为 + 天气效果
      ✅ 在预算内，信息充足不泛化
```

### 禁止场景

```
雨夜 → { rainDrops, wetRoad, reflections, cityLights, wind,
         crowds, cars, neonSigns, fog, soundscape, ... }
      ↑ 11 项，远超预算
      ❌ 泛化膨胀——从"环境补全"滑向"世界生成"
```

### Budget 与 inferenceLevel 的关系

| Budget 状态 | inferenceLevel | 含义 |
|-------------|---------------|------|
| 未超限 | 1 | 正常环境补全 |
| 超限 | 1 | ⚠️ 即使 inferenceLevel 正确，也因过载而被限制 |
| 未超限 | 0 | 普通字面模式 |
| 超限 + 含 entity | ❌ | Entity Injection + Overload = 双重违规 |

### 超限处理

如果 LLM 输出的环境补全条目超过 `maxItems`：
1. 按 priorityOrder 保留高优先级条目
2. 丢弃超限部分
3. 记录 `OverloadWarning` 到 preservation 审计日志

## L1E：Environment Completion（环境补全）

从场景描述词推导的环境自然元素。

| 场景词 | 环境补全（允许） | 新增实体（禁止） |
|-------|----------------|----------------|
| 雨夜 | 雨滴、积水、湿路面、反光、雨声、衣服被雨打湿 | 伞、雨衣、出租车 |
| 夕阳 | 金色光线、长影子、暖色调 | 太阳眼镜、防晒霜 |
| 深夜办公室 | 台灯光、窗外黑暗、键盘声、显示器光 | 加班牌、咖啡 |
| 咖啡店 | 咖啡香气、杯碟声、暖光 | 拿铁、（特定品牌） |
| 公园 | 树影、鸟鸣、草地、长椅 | 秋千、乒乓球台 |
| 海边 | 海浪声、海风、沙滩、地平线 | 贝壳、渔船 |
| 教室 | 日光灯、黑板、桌椅、书本 | 考试卷、粉笔字内容 |
| 手术室 | 无影灯、消毒水味道（隐含）、金属器械盘 | 手术刀（具体物件）、病人 |
| 路口 | 红绿灯、车辆驶过、路灯 | 站牌、地标建筑 |
| 街道 | 店铺招牌、行人、灯光 | 店名、商品牌 |

**核心原则：**
- 环境补全只补"场景中应该有"的东西，不补"故事需要中"的东西
- 环境补全必须是**共知事实**（任何在该场景中的合理认知），不是**剧情道具**
- 同一场景词的环境补全是固定的，不受 narrative 上下文影响

---

## PreservationGuard v2 验证算法

```
输入: sourceNarrative, generatedShots[]
输出: Violation[]

步骤:
  1. 从 sourceNarrative 抽取 FactGridV2（确定性规则）
     - 抽取 Explicit Facts
     - 从 Explicit Events 推导 Implied Actions
     - 从 Locations 推导 Environment Completion
  2. 从 generatedShots[] 中提取所有名词性实体
  3. 对每个实体进行分类验证:

     if 实体在 Explicit Facts.entities|locations|props 中:
       → ✅ 通过（L0 级事实）
     
     elif 实体在 Implied Actions 的推导列表中:
       → ✅ 通过（L1 动作推导）
     
     elif 实体在 Environment Completion 的列表中:
       → ✅ 通过（L1E 环境补全）
     
     elif 实体是镜头语言白名单词:
       → ✅ 通过（技术术语）
     
     elif 实体在 forbidden_entities 中:
       → ❌ Violation.UNKNOWN_ENTITY（符合红队测试预期）
     
     elif 实体是"隐含实体"（需要剧情推断）:
       → ❌ Violation.NARRATIVE_MUTATION
     
     else:
       → ⚠️ Warning.UNRECOGNIZED_ENTITY（需人工审查）
```

### 镜头语言白名单（无需验证）

相机参数、剪辑术语、通用环境词。

（与 v1 相同，补充：色温、对比度、景深、焦距、帧率）

---

## 红队测试更新

新增测试（基于 v2 规则）：

| ID | Narrative | 允许 | 禁止 | v2 判定 |
|----|-----------|------|------|---------|
| RC-013b | 少女在雨夜等人 | 雨滴、湿路面、水洼、反光 | 伞、雨衣、前男友 | 🔒 |
| RC-014b | 老人坐在长椅上 | 阳光/树荫、拐杖（如果不显眼）、落叶 | 退伍军人帽、拐杖（如果特写） | 🔒 |
| BC-025b | 黑客在键盘上敲代码 | 显示器、键盘声、屏幕反光 | 入侵银行、破解系统 | 🔒 |

注意：RC-014b 中"拐杖"在大景别中作为背景道具允许，但在特写中作为主体出现禁止——因为特写赋予意义。

---

## 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v3 | 2026-06-24 | 新增 Environment Budget Constraint（防泛化膨胀）。企业圣裁后系统认知对齐：ShotIR 是 camera-constrained visual planner，不是世界生成器。 |
| v2 | 2026-06-24 | 三层架构（Explicit + ImpliedActions + Environment Completion）。对应陛下圣裁。 |
