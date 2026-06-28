# 六大导演智能体完整工作逻辑

> **系统身份：** 这 6 个 Agent 构成「导演智能层」（Director Intelligence Layer），
> 是剧本到画面的语义转换引擎。每个 Agent 独立调用 LLM，输出标准化结构，供下游编排使用。

---

## 全景：Agent 流水线

```
剧本输入
    │
    ▼
┌──────────────────┐
│ 1. 导演脑              │ ← 最高优先级，剧本全局理解
│   Director Brain       │
└────────┬─────────┘
         │
    ┌────┼────┬────┬────┐
    ▼    ▼    ▼    ▼    ▼
  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐
  │  │ │  │ │  │ │  │ │  │ ← 5 个 Agent 并行
  └┬─┘ └┬─┘ └┬─┘ └┬─┘ └┬─┘
   │    │    │    │    │
   ▼    ▼    ▼    ▼    ▼
   2. 角色导演   3. 分镜师   4. 氛围师   5. 节奏师
      Character    Cinematic   Scene       Story
      Director     Shot        Atmosphere  Rhythm
         │         │           │           │
         └────┬────┴────┬──────┘           │
              │         │                  │
              ▼         ▼                  ▼
          6. 连续性引擎 ←──────────────────┘
             Continuity + Review Engine
         │
         ▼
    最终 Prompt → 视频生成
```

---

## Agent 1: Director Brain（导演脑）

**文件：** `director/director-brain.agent.ts`
**行数：** 165 行
**角色：** 最高优先级的导演智能体

### 工作逻辑

```
输入: 原始剧本 text (最多 8000 字符)
输出: DirectorUnderstanding（导演理解报告）

流程:
  ① 构造 LLM system prompt — 提示 LLM 扮演资深电影导演+剧本分析师
  ② 指令要求输出 JSON，包含 6 个字段:
     - theme              ← 故事主题（一句话）
     - coreConflict       ← 核心冲突
     - emotionCurve       ← 情绪曲线（≥3 个节拍）
     - visualStyle        ← 视觉风格（色彩、灯光、运镜、参考）
     - cinematicLanguage  ← 镜头语言（≥2 个元素）
     - pacing             ← 节奏类型
     - keyScenes          ← 关键场景（≥2 个）
  ③ 调用 narrativeGateway.execute() — LLM call（timeoutTier: 'batch'）
  ④ 解析 LLM 返回的 JSON：
     - 先用 /```json ... ```/ 提取
     - 匹配失败直接用整个 content 解析
  ⑤ 防御性编程：
     - 每个字段有默认值
     - JSON.parse 失败 → 返回硬编码默认值（degrade 不崩溃）

关键设计:
  - narrativeGateway 处理所有 LLM 调用并发控制
  - degrade 时返回"解析中"等价数据，系统不中断
  - 最多 8000 字符截断，避免 token 超限
```

### 输出格式

```json
{
  "theme": "背叛与救赎",
  "coreConflict": "主角在忠诚与自保之间的道德挣扎",
  "emotionCurve": [
    { "beat": "开场受辱", "emotion": "愤怒", "intensity": 7, "duration": "short" },
    { "beat": "隐忍布局", "emotion": "压抑", "intensity": 5, "duration": "long" },
    { "beat": "高潮反击", "emotion": "爆发", "intensity": 10, "duration": "short" }
  ],
  "visualStyle": {
    "colorPalette": "cold_blue_to_warm_golden",
    "lighting": "noir_to_high_key",
    "cameraWork": "steadicam_escalating_to_handheld"
  },
  "pacing": "dynamic"
}
```

---

## Agent 2: Character Director（角色导演）

**文件：** `director/character-director.agent.ts`
**行数：** 162 行
**角色：** 角色视觉一致性守卫者

### 工作逻辑

```
输入: 剧本 + DirectorUnderstanding（含 _storyConstitution）
输出: CharacterBible（角色视觉圣经）

流程:
  ① 接收 DirectorUnderstanding — 依赖上游
  ② 构造 LLM prompt，包含:
     - 剧本片段（前 4000 字符）
     - 导演理解（完整 JSON）
     - 特别强调 _storyConstitution.characterSpecs 为"原始规格"
  ③ 要求为每个角色输出：
     - faceFeatures / bodyType / height ← 外貌
     - hair / eyes / skinTone / distinguishingFeatures ← 细节
     - costume[] ← 每场戏的服装设计
     - visualSignature / consistentLookKeywords ← 可识别度
  ④ 解析 LLM 返回
  ⑤ 防御：每个字段有默认值，LLM 返回空 → characters: []

关键约束:
  - 角色跨场景必须视觉一致（由 downstream continuity engine 确保）
  - costume 按 scene 索引，不同场景不同服装但同角色
  - visualSignature 是下游注入 continuity 的关键
```

### 输出格式

```json
{
  "characters": [{
    "characterId": "char_001",
    "name": "林小北",
    "role": "protagonist",
    "faceFeatures": "鹅蛋脸，高颧骨，单眼皮",
    "distinguishingFeatures": ["左眉痣"],
    "costume": [
      { "scene": "开场", "outfit": "白色校服", "colors": ["#FFFFFF","#000000"] }
    ],
    "visualSignature": "白色校服，左眉痣，倔强的眼神"
  }]
}
```

---

## Agent 3: Cinematic Shot Agent（分镜师）

**文件：** `director/cinematic-shot.agent.ts`
**行数：** 116 行
**角色：** 镜头语言转化器

### 工作逻辑

```
输入: 剧本 + DirectorUnderstanding
输出: ShotDesignPlan（分镜头设计方案）

流程:
  ① 接收剧本 + DirectorUnderstanding
  ② 构造 LLM prompt，强调 _storyConstitution 中:
     - rhythmSpec   ← 节奏决定镜头时长
     - emotionSpecs ← 情绪决定景别选择
     - visualSpecs  ← 视觉风格决定构图
  ③ 要求输出 scenes[].shots[] 每个镜头包含:
     - shotType      ← 景别（11 种可选）
     - lens          ← 焦段（7 种可选）
     - cameraMotion  ← 运镜（15 种可选）
     - composition   ← 构图（9 种可选）
     - lighting      ← 灯光（9 种可选）
     - depthOfField  ← 景深
     - duration      ← 时长（秒）
     - description   ← 描述文本
     - narrativePurpose ← 叙事目的
  ④ 解析 + 默认值填充

关键设计:
  - 所有枚举在 share.types.ts 统一管理
  - 镜头语言类型全部标准化（LLM 只能选预定义值）
  - duration 默认 3 秒（短剧节奏）
```

### 输出格式

```json
{
  "scenes": [{
    "sceneId": "scene_001",
    "shots": [
      {
        "shotType": "wide",
        "lens": "35mm",
        "cameraMotion": "dolly_in",
        "composition": "rule_of_thirds",
        "lighting": "natural",
        "depthOfField": "medium",
        "duration": 4,
        "description": "林小北穿过校门，晨光从背后打来",
        "narrativePurpose": "建立场景 + 角色登场"
      }
    ]
  }]
}
```

---

## Agent 4: Scene Atmosphere Agent（氛围师）

**文件：** `director/scene-atmosphere.agent.ts`
**行数：** 111 行
**角色：** 世界观氛围设计师

### 工作逻辑

```
输入: 剧本 + DirectorUnderstanding
输出: SceneAtmosphereDesign（场景氛围设计）

流程:
  ① 接收剧本 + DirectorUnderstanding
  ② 构造 LLM prompt，强调 _storyConstitution 中:
     - sceneSpecs  ← 场景基本设定
     - visualSpecs ← 视觉风格约束
     - styleSpec   ← 美术风格方向
  ③ 要求每个场景输出:
     - timeOfDay    ← 时段（8 种枚举）
     - weather      ← 天气（7 种枚举）
     - temperature  ← 温度感（4 种枚举）
     - colorPalette ← 色彩体系（主/辅/强调色）
     - lightingDescription ← 灯光描述
     - spaceTexture ← 空间质感
     - keyProps     ← 关键道具
     - atmosphereVisualKeywords ← 氛围关键词（用于 prompt 注入）
  ④ 额外输出世界观色彩体系 worldColorSystem
```

### 输出格式

```json
{
  "scenes": [{
    "sceneId": "scene_001",
    "timeOfDay": "dawn",
    "weather": "clear",
    "colorPalette": ["#FFD700", "#87CEEB", "#8B4513"],
    "lightingDescription": "晨曦逆光，柔和金色",
    "keyProps": ["书包", "校门"],
    "atmosphereVisualKeywords": ["晨光", "校园", "希望"]
  }],
  "worldColorSystem": "成长叙事 — 从冷色走向暖色"
}
```

---

## Agent 5: Story Rhythm Agent（节奏师）

**文件：** `director/story-rhythm.agent.ts`
**行数：** 180 行
**角色：** 爆款短剧节奏引擎（最重要 Agent）

### 工作逻辑

```
输入: 剧本 + DirectorUnderstanding
输出: RhythmDesign（节奏设计方案）

流程:
  ① 接收剧本 + DirectorUnderstanding
  ② 构造 LLM prompt，包含 5 条短剧核心法则:
     - 每 15-30 秒一个钩子
     - 每 60-90 秒一个情绪爆点
     - 至少 2 个反转
     - 5 分钟内完成 setup → climax → release
     - 高潮强度 ≥ 9/10
  ③ 强调 _storyConstitution 中:
     - narrativeSpec  ← 叙事结构决定 beat 分布
     - emotionSpecs   ← 情绪曲线决定 intensity
     - rhythmSpec     ← 已有节奏参考
  ④ 要求输出 4 个核心结构:
     - structure    ← 幕结构（three_act / five_act / episodic）
     - beats[]      ← 节拍序列（phase 按 setup→tension→escalation→climax→release）
     - hooks[]      ← 钩子序列（timing 精确到秒）
     - reversals[]  ← 反转序列
     - pacingSummary ← 节奏摘要
  ⑤ 解析 + 防御默认值

关键设计:
  - beats 的 phase 是固定的 5 阶段，不能偏离
  - hooks 的 retensionScore 和 reversals 的 impact 都是 1-10 定量
  - pacingSummary 的 peakIntensity 是整个节奏的品质指标
  - 这是 downstream review engine 的节奏检查数据源
```

### 输出格式

```json
{
  "structure": { "type": "three_act", "description": "经典三幕" },
  "beats": [
    { "beatNumber": 1, "name": "受辱", "phase": "setup", "duration": 45, "intensity": 6 },
    { "beatNumber": 2, "name": "隐忍", "phase": "tension", "duration": 60, "intensity": 5 },
    { "beatNumber": 3, "name": "发现机会", "phase": "escalation", "duration": 30, "intensity": 7 },
    { "beatNumber": 4, "name": "反转", "phase": "climax", "duration": 40, "intensity": 10 },
    { "beatNumber": 5, "name": "新生", "phase": "release", "duration": 35, "intensity": 8 }
  ],
  "hooks": [
    { "hookNumber": 1, "timing": 20, "type": "action" },
    { "hookNumber": 2, "timing": 55, "type": "revelation" }
  ],
  "reversals": [
    { "reversalNumber": 1, "timing": 130, "type": "plot_twist", "impact": 9 }
  ]
}
```

---

## Agent 6: Continuity Engine + Review Engine（连续性引擎 + 审片）

### 6a. Continuity Engine（连续性引擎）

**文件：** `director/continuity.engine.ts`
**行数：** ~180 行
**角色：** 跨镜头视觉一致性守卫者

```
工作逻辑:

  ① registerCharacterBible(bible)
     → 将角色特征存入 activeCharacters Map
     → 后续每个镜头检查时引用

  ② registerSceneAtmosphere(design)
     → 将场景氛围存入 activeScenes Map

  ③ checkShotContinuity(shot, sceneId)
     → 与 lastShot 比较：
       相同 shotType + 相同 cameraMotion → 标记 shot_break
       景别跳跃 > 3 级 → warning
     → 检查 shot.lighting 与 scene 设定是否一致
     → 检查 char.consistentLookKeywords 是否在 shot.description 中出现
     → 返回 ContinuityReport

  ④ injectContinuity(description, characterId?, sceneId?)
     → 在 prompt 中注入 visualSignature + atmosphereVisualKeywords
     → 确保 LLM 生成的画面包含 continuity 锚点

  ⑤ reset() → 清空所有缓存状态

关键设计:
  - 状态性：activeCharacters / activeScenes / lastShot 都在 engine 内部维护
  - 非 LLM：全部用规则引擎，不调用 LLM（纯逻辑决策）
```

### 6b. Review Engine（审片）

**文件：** `director/review.engine.ts`
**行数：** 216 行
**角色：** 自动审片系统

```
工作逻辑:

  reviewShotPlan(shots, rhythmDesign, continuityReport)
    初始化: score = 100

    ── 镜头检查 ──
    遍历每个 shot:
      - shotType === 'medium' (默认值) → score -= 3, 标记 minor
      - cameraMotion === 'static' (默认值) → score -= 1, 标记 suggestion
      - lighting === 'natural' (默认值) → score -= 2, 标记 minor
      - 自动修复：构造带摄影语言的 prompt 修正

    ── 节奏检查 ──
      - hooks < 3 → score -= 10, 标记 major
      - bo 强度 < 3 → score -= 5, 标记 minor
      - 缺少高潮强度 ≥ 8 → score -= 15, 标记 critical

    ── 连续性检查 ──
      - continuityReport.warnings > 3 → score -= 8

    ── 判定 ──
      score >= 80 → "质量良好"
      score >= 60 → "需修复部分问题"
      score < 60  → "需重新设计"

    ── 输出 ──
      shotsToRegenerate[] ← critical 问题的镜头标记重生成

  autoFixPrompt(original, issues)
    非 LLM：字符串拼接
    - 添加 'Cinematic' 前缀
    - 添加 'professional cinematic lighting'
    - 添加 'consistent visual style'

关键设计:
  - 纯规则引擎：审片不调用 LLM，全部是 if-else 判定
  - autoFix 只是字符串拼接，不重新生成 LLM
  - critical + major 区分："通过但需修复" vs "不通过"
```

---

## Agent 协作时序

```
1. Director Brain 先跑（必须）
   ↓ 产出 DirectorUnderstanding

2. 其他 5 个 Agent 并行（可并行）
   ├── Character Director → CharacterBible
   ├── Cinematic Shot    → ShotDesignPlan
   ├── Scene Atmosphere  → SceneAtmosphereDesign
   ├── Story Rhythm      → RhythmDesign
   └── Continuity Engine → 注册 Bible + Atmosphere（非 LLM）

3. Review Engine 汇总检查
   ─ 对比 rhythmDesign + continuityReport → ReviewResult
   ─ 标记 shotsToRegenerate

4. Prompt Compiler 编译
   ─ 将 shot design + continuity 注入 → 最终生成 prompt
```

---

## 六 Agent 角色对照表

| # | Agent | 类比 | 输入 | 输出 | 是否 LLM | 关键约束 |
|---|-------|------|------|------|----------|---------|
| 1 | Director Brain | 总导演 | 剧本 | 导演理解报告 | ✅ | 最多 8000 字符 |
| 2 | Character Director | 造型指导 | 剧本 + 导演理解 | 角色视觉圣经 | ✅ | 跨场景一致性 |
| 3 | Cinematic Shot | 摄影指导 | 剧本 + 导演理解 | 分镜头方案 | ✅ | 枚举值受限 |
| 4 | Scene Atmosphere | 美术指导 | 剧本 + 导演理解 | 场景氛围设计 | ✅ | LLM 驱动的美术设计 |
| 5 | Story Rhythm | 剪辑师 | 剧本 + 导演理解 | 节奏方案 | ✅ | 短剧 5 法则 |
| 6a | Continuity Engine | 场记 | 角色 Bible + 场景 | 连续性报告 | ❌ | 纯规则引擎 |
| 6b | Review Engine | 审片人 | 镜头 + 节奏 + 连续性 | 审片报告 | ❌ | 纯规则引擎 |
