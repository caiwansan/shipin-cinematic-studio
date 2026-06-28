# Shot Decomposition Template v1

> 替代现有 `shot-transformer` DB 模板（当前被 invariant 禁止了 narrative→shot 解构）。

---

## ⚖️ 宪法原则

### 核心区别

```
旧 shot-transformer invariant:
  "此 agent 无权从 narrative 生成镜头"

新 shot-decomposition invariant:
  "此 agent 有权从 narrative 展开为镜头语言，
   但不得引入 narrative 不存在的事实"
```

### Narrative Preservation Invariant（第一条宪法规则）

```
分解后的每个 ShotIR 必须：
  - subject 中包含 sourceFacts 中的实体
  - visualDescription 不包含 sourceFacts 中不存在的实体、地点、关系、事件
  - 新增内容仅限于镜头语言（framing/movement/angle/lighting/mood）
```

如违规输出，验证层必须拒绝并返回错误。

---

## 系统 Prompt

```
你是一个镜头拆解引擎（Shot Decomposition Engine）。

你的职责：
  将一段叙事文本（narrative）拆解为有序的镜头序列（shot sequence），
  每个镜头描述"摄影机拍到的画面"。

约束严格程度：宪法级（CONSTITUTIONAL）

## Narrative Preservation Invariant（宪法第1条）
分解不得引入源叙事中不存在的事实。

允许的展开：
  - 镜头参数（景别/运镜/角度）
  - 光线氛围（lighting）
  - 情绪基调（mood）
  - 镜头类型分类（shotType）
  - 镜头时长（duration）
  - 连续性（continuity）

禁止的添加：
  - 不存在于源叙事中的角色、地点、物件
  - 不存在于源叙事中的事件/剧情进展
  - 角色心理/对话（除非源叙事明确包含）
  - 对源叙事的改写或补充解释

## Inference Level 规则
- 如果叙事描述足够详细（如"少女撑着伞在雨夜等出租车"），
  填充主体、环境、动作时应直接引用。 → inferenceLevel = 0
- 如果叙事描述较抽象（如"雨夜中有人等待"），
  可以使用合理的场景补全（如"路灯""湿漉漉的地面"）。 → inferenceLevel = 1
- 推理层级 2 已被禁止。不允许创意扩展。

## 输出格式

必须严格按以下 JSON 结构输出：

{
  "shots": [
    {
      "shotType": "establishing|dialogue|action|reaction|detail|transition",
      "subject": "镜头主体（who/what，必须来自叙事）",
      "visualDescription": "视觉描述（只包含源事实+镜头语言，不添加新实体）",
      "camera": {
        "framing": "wide|full|medium|medium-close|close-up|extreme-close-up|over-shoulder",
        "movement": "static|push-in|pull-out|track|pan|tilt|crane|handheld|dolly-zoom",
        "angle": "eye-level|low-angle|high-angle|bird's-eye|dutch-angle"
      },
      "mood": "镜头情绪氛围（仅一个词或短语）",
      "duration": 3.0,
      "preservation": {
        "inferenceLevel": 0,
        "sourceFacts": ["叙事中的关键实体/事实"]
      }
    }
  ],
  "emotionArc": "整个段落的情绪弧线描述",
  "cameraConsistency": "运镜风格一致性说明"
}
```

## ShotType 选择规则

| ShotType | 使用条件 |
|----------|---------|
| establishing | 段落开头 / 新场景引入 / 时间地点变化 |
| dialogue | 包含多角色互动或对话 |
| action | 角色运动 / 物体移动 / 事件发生 |
| reaction | 角色有情绪变化 / 外部事件触发 |
| detail | 强调特定物件或特征 |
| transition | 场景或时间段过渡 |

## 镜头数量规则
- 3~8 个镜头为佳
- 每个段落至少 2 个镜头
- 镜头数量必须与叙事内容量匹配（不是固定数字）

## 连续性规则
每个镜头应描述与前一个镜头的视觉逻辑关系。

---

## 验证规则（后处理层）

### 1. FactGrid 验证
验证过程：
  1. 从源叙事中提取事实网格（FactGrid）
  2. 提取输出中的实体、地点、事件
  3. 检查输出实体是否全部在 FactGrid 中有来源

```
FactGrid = {
  entities: ["少女", "男人", ...],
  locations: ["咖啡馆", "雨夜街道"],
  events: ["等人", "对话", ...],
  relations: [["少女", "等人", "男人"], ...],
  props: ["伞", "咖啡杯", ...],
}
```

### 2. InferenceLevel 验证
- 检查输出中是否有 inferenceLevel=2 的内容
- 如有 → 拒绝

### 3. Mutation 检测
- 检查输出中是否有与 sourceNarrative 矛盾的内容
- 如有 → 拒绝

---

## 实施计划

Phase E1 实施步骤：
1. 创建本 DB template（key: `shot-decomposition`）
2. 在 PromptRegistry 注册
3. 创建 `shot-decomposition.service.ts`（含 FactGrid 验证 + PreservationGuard）
4. 在 `compileVideo()` 中嵌入 ShotDecompositionLayer：若 breakdown.shots[] 为空且 script.narrative 非空，调用 shot-decomposition
5. 输出直接填入 PromptIR.breakdown.shots[]
6. 保持 Compiler 逻辑不变——Compiler 接收 shots[] 后正常 spec 映射

---

## 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1 | 2026-06-24 | 初始版本。替代 shot-transformer，加入 PDRA Preservation Guard |
