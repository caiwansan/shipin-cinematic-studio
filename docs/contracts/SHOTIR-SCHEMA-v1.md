# ShotIR Schema v1

> **ShotIR 是 PromptIR 的下层语义展开。**
>
> PromptIR 是"剧本层"——记录"发生了什么"。
> ShotIR 是"分镜层"——记录"怎么拍"。
>
> 系统目前缺的不是剧本（PromptIR 已完整），而是导演（ShotIR 不存在）。

---

## ⚖️ 宪法级约束

### Narrative Preservation Invariant（叙事守恒律）

```
ShotIR 不得引入源 narrative 中不存在的事实。
```

**允许的展开：**
- 镜头语言（景别、运镜、角度、光线）
- 节奏参数（时长、剪辑方式）
- 表现力补充（情绪基调、氛围）

**禁止的突变：**
- 新增角色、地点、关系、事件
- 推断剧情进展（如"角色内心独白"）
- 替换或改写 narrative 中的事实描述
- 补全"缺失的剧情逻辑"

### 验证方式

每个 ShotIR 节点记录 `preservation.sourceFacts`，生成后验证 inferenceLevel+事实不冲突。

---

## 类型定义

```typescript
type ShotType =
  | 'establishing'   // 建立镜头——交代环境/时间/氛围
  | 'dialogue'       // 对话镜头——角色交流
  | 'action'         // 动作镜头——角色行动/运动
  | 'reaction'       // 反应镜头——角色表情/情绪回应
  | 'detail'         // 细节镜头——特定物件/特征的强调
  | 'transition'     // 转场镜头——场景/段落过渡

type Framing =
  | 'wide'           // 全景
  | 'full'           // 全身
  | 'medium'         // 中景
  | 'medium-close'   // 中近景
  | 'close-up'       // 特写
  | 'extreme-close-up' // 极端特写
  | 'over-shoulder'  // 过肩

type CameraMovement =
  | 'static'
  | 'push-in'        // 推
  | 'pull-out'       // 拉
  | 'track'          // 跟
  | 'pan'            // 摇
  | 'tilt'           // 俯仰
  | 'crane'          // 升降
  | 'handheld'       // 手持
  | 'dolly-zoom'     // 滑动变焦

type CameraAngle =
  | 'eye-level'
  | 'low-angle'
  | 'high-angle'
  | 'bird\'s-eye'
  | 'dutch-angle'

type InferenceLevel =
  | 0  // 字面——100% 来自 sourceNarrative，无任何添加
  | 1  // 隐含——从叙事中合理推导（如"雨夜"→"雨伞","湿润地面"）

interface ShotIR {
  /** 镜头标识 */
  shotId: string;

  /** 源叙事文本（引用 PromptIR.script.narrative） */
  sourceNarrative: string;

  /** 镜头类型 */
  shotType: ShotType;

  /** 主体对象（who/what is in frame） */
  subject: string;

  /** 视觉描述（what the audience sees） */
  visualDescription: string;

  /** 相机参数 */
  camera: {
    framing: Framing;
    movement?: CameraMovement;
    angle?: CameraAngle;
  };

  /** 光线氛围 */
  lighting?: string;

  /** 情绪基调 */
  mood?: string;

  /** 镜头时长（秒） */
  duration?: number;

  /** 连续性信息 */
  continuity: {
    previousShotId?: string;
    nextShotId?: string;
  };

  /**
   * 叙事守恒护栏
   *
   * 旧系统没有做这个检验，导致 LLM 可以自由发明剧情。
   * Phase E 强制要求每个 ShotIR 记录事实来源。
   */
  preservation: {
    /** 推理层级 0=字面 / 1=隐含 */
    inferenceLevel: InferenceLevel;

    /**
     * 从源叙事中提取的事实关键词。
     * 例如 narrative="少女在雨夜等待" -> ["少女", "雨夜", "等待"]
     *
     * 验证规则：shot 中出现的非镜头术语实体必须在 sourceFacts 中有来源。
     */
    sourceFacts: string[];
  };
}

interface ShotIRGraph {
  /** 所属段落的 PromptIR script narrative */
  sourceNarrative: string;

  /** 镜头序列 */
  shots: ShotIR[];

  /** 全局情绪弧线 */
  emotionArc?: string;

  /** 运镜风格一致性 */
  cameraConsistency?: string;

  /** 验证结果 */
  validation: {
    passed: boolean;
    violations: PreservationViolation[];
  };
}

interface PreservationViolation {
  type: 'UNKNOWN_ENTITY' | 'UNKNOWN_LOCATION' | 'UNKNOWN_RELATION' | 'NARRATIVE_MUTATION' | 'INFERENCE_LEVEL_EXCEEDED';
  detail: string;
  shotId: string;
}
```

---

## InferenceLevel 详细定义

| 层级 | 含义 | 允许 | 禁止 |
|------|------|------|------|
| 0 | 字面 | 仅重述 narrative 中的事实 | 任何推理、联想、补充 |
| 1 | 隐含 | 从叙事中合理推导的环境/情绪/物件的补充 | 添加无来源的新实体、新关系 |

**举例：**

```
Narrative: "少女在雨夜撑着伞等人"

InferenceLevel 0 允许:
  - "少女" → subject
  - "雨夜" → environment
  - "撑伞" → action
  - "等人" → action/context

InferenceLevel 1 允许:
  - "雨滴落在伞面" → 雨中场景的自然延伸
  - "湿润的地面" → 雨夜环境的合理推断
  - "路灯下" → 夜间场景常见的合理背景元素

两个层级都不允许:
  - "在东京" → 新地点
  - "等男朋友" → 新关系
  - "被甩了" → 新剧情
  - "拿刀" → 新物件
  - "发抖" → 如果叙事没写
```

---

## ShotType 选择指南

| ShotType | 适用场景 | 典型镜头语言 |
|----------|---------|-------------|
| establishing | 段落/场景开头，交代环境 | wide + static/push-in |
| dialogue | 角色之间有对白 | medium/close-up + over-shoulder |
| action | 角色运动、物体移动 | full/medium + track/handheld |
| reaction | 角色情绪回应 | close-up + static/push-in |
| detail | 强调关键物件/细节 | extreme-close-up + static |
| transition | 场景/时间过渡 | wide + pan/tilt/dolly-zoom |

---

## 到 Worker 的映射路径（Phase E2 详细）

```
ShotIR.shotType ──────────────→ video-prompt: shot type keyword
ShotIR.camera.framing ────────→ video-prompt: framing spec
ShotIR.camera.movement ───────→ video-prompt: camera motion
ShotIR.camera.angle ──────────→ video-prompt: camera angle
ShotIR.subject ───────────────→ video-prompt: character/person reference
ShotIR.visualDescription ─────→ video-prompt: primary visual prompt
ShotIR.lighting ──────────────→ video-prompt: lighting spec
ShotIR.mood ─────────────────→ video-prompt: atmosphere/mood
ShotIR.duration ──────────────→ video-prompt: shot timing
ShotIR.preservation ──────────→ PDRA compliance check (meta)
```

---

## 与 PromptIR 的关系

```
PromptIR
├── script
│   ├── narrative  ──────────────────────────────── ShotIR.sourceNarrative
│   ├── dialogue
│   └── emotion
│
└── breakdown
    ├── characters[]
    ├── scenes[]
    │
    └── shots[] ← ⭐ ShotIR 的主阵地
         ├── second          ───→ ShotIR.shotIndex
         ├── camera          ───→ ShotIR.camera.framing
         ├── movement        ───→ ShotIR.camera.movement
         ├── action          ───→ ShotIR.visualDescription
         ├── subject         ───→ ShotIR.subject
         ├── environment     ───→ ShotIR.camera.environment
         ├── effect          ───→ ShotIR.camera.effect
         ├── expression      ───→ ShotIR.camera.expression
         └── dialogue        ───→ ShotIR.camera.dialogue
```

注意：PromptIR.breakdown.shots[] 的字段集**足够**承载 ShotIR 的展开结果。
Phase E1 的实施方式是**填充 existing Shot 结构**，而非创建新结构。

---

## 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v1 | 2026-06-24 | 初始版本。基于 Phase A CompiledPrompt 遗产 + PDRA 护栏 |
