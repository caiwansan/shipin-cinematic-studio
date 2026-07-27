# 影剧厂 Agent 工作方法审核报告

> 审核范围：所有专业 Agent 的 prompt 文件 + 编排逻辑 (aigc-orchestrator.ts) + 优化提示词路由 (optimize-video-prompt.ts)
> 审核日期：2026-05-25

---

## 一、整体架构（编排图）

```
用户提交故事文本
  │
  ▼
Phase 0: 剧情总指挥 (plot-supervisor.txt)
  │  └─ 输出：plotBlueprint（含角色/场景规划 + stateEvolution + scenes[].script）
  │
  ▼
Phase 1（并行）:
  ├── 角色设计师 (character-designer.txt)  → characterSpecs[]
  ├── 场景设计师 (scene-designer.txt)       → sceneSpecs[]
  └── 角色定妆师 (makeup-designer.txt)      → characterMakeupSpecs[]
  │
  ▼
Phase 2（并行）:
  ├── 声音设计师 (sound-designer.txt)       → voiceConfigs[]
  └── 画面设计师 (frame-designer.txt)       → videoSegments[] + frameDesign[] + videoProduction
  │
  ▼
Phase 3: 道具设计师 (props-designer.txt)   → propSpecs[]
  │
  ▼
Phase 4: 镜头/特效师 (director-of-photography.txt) → effectSpecs[] + actionSpecs[] + cameraSpecs[] + emotionSpecs[]
  │
  ▼
  动作优化 → CinematicIR 编译
  │
  ▼
  合并输出到 executionResults
```

另有独立路径：
- **优化提示词**：`POST /api/v1/optimize-video-prompts` → 调 video-prompt-optimizer.txt Agent → 输出 VP-IR（结构化视觉指令→视频模型）
- **单条优化**：`POST /api/v1/optimize-single-video-prompt` → 同上但单个 segment

---

## 二、各 Agent 逐项审核

### 1. 剧情总指挥 (plot-supervisor.txt)

**问题级别：⚠️ 中等**

- **prompt 过密**：7488 字符的 prompt 塞了海量约束（JSON schema + 规则表 + 输出要求），LLM 容易遗漏细节
- **stateEvolution 规则繁琐但 LLM 无法严格执行**："sceneRange 必须连续覆盖完整区间"、"每个场景必须标注所有出场角色的 variant"——理想正确但 LLM 在实际推理中经常遗漏角色或 scenerange 留空
- **scenes[].script 字段的输出稳定性**：新加的 script 字段需要 80-150 字剧本含对白，旧模型输出时容易截断或写成摘要不是剧本
- **建议**：引入 output validator，在 LLM 输出后程序化验证 sceneRange 连续性、角色 variant 必填性，不通过则重试或补全

### 2. 角色设计师 (character-designer.txt)

**问题级别：⚠️ 低-中**

- **"动作捕捉服"负面提示过于绝对**：服装提示中反复强调"禁止动作捕捉服"和"必须写剧情真实服装"，两边矛盾——实际上是要禁止 LLM 输出动作捕捉服，但 prompt 写法太像要求"禁止"后面的"必须"是两个独立规则了，容易混淆。建议重写成更明确的条件式
- **imagePrompt 表格格式的"面部五官"字段**：character-designer.txt 要求 11 字段含"时代风格"和"服装道具"，和 aigc-spec-system.txt 不一样（后者 8 字段且角色图允许穿紧身动作捕捉服）。两种 prompt 对角色图标准不一致。**需要统一**
- **stateEvolution 严格绑定**：要求精确匹配剧情总指挥的 variant 名 — 这是正确的，但需要剧情总指挥输出的 JSON 字段名一致（如 `variant` vs `name` 大小写）

### 3. 场景设计师 (scene-designer.txt)

**问题级别：⚠️ 低**

- **prompt 过于简短**：仅 1833 字，约束不够全面。场景设计中"禁止出现人物"这条反复强调是正确的，但缺乏对场景风格、光线方向的约束引导
- **场景数量 2-5 个的默认值太低**：实战中有 8 个场景的故事，prompt 写"一般 2-5 个"会影响 LLM 的输出场景数
- **description 字段 50 字要求偏低**：场景对于后续视频生成重要，建议提升到 80 字以上

### 4. 角色定妆师 (makeup-designer.txt)

**问题级别：⚠️ 低**

- **和角色设计师高度重叠**：两个 Agent 都输出角色形象，一个叫 characterSpecs 一个叫 characterMakeupSpecs，区别是角色设计师的 imagePrompt 是表格格式，定妆师是 200-350 字纯文字描述。**价值存疑**——建议合并为一个 Agent，或者在 Phase 1 只保留一个
- **"紧身动作捕捉服"rule 已移除**：该 prompt 之前写过动作捕捉服，现在的版本已经修复为"穿着符合剧情的正式服装"，正确

### 5. 声音设计师 (sound-designer.txt)

**问题级别：❌ 严重**

- **voiceType 值域与实际系统不匹配**：prompt 中写死的 `zh_female_sweet | zh_male_deep | zh_female_gentle | zh_male_cheerful` 四个值在 aigc-spec-system.txt 的 JSON schema 里，但到 sound-designer.txt 的独立 prompt 里已经是另一套值了（`zh_male_deep / zh_male_warm / zh_male_calm / ...` 共 10 个值）。**两套 prompt 不同步**
- **更关键的问题**：当前系统后端已经统一使用 qwen3-tts-flash（阿里百炼同步 API），但所有 prompt 中的 voiceType 仍然是旧 CosyVoice/火山引擎的枚举值。**这些值在前端和后端 TTS 生成中可能已经失效**

### 6. 画面设计师 (frame-designer.txt)

**问题级别：⚠️ 低**

- prompt 只有 2447 字，约束简洁但有效
- **古风/仙侠的样式规则写得不错**：楷体竖排字幕、古风配乐的适配规则合理
- **videoSegments 的分段逻辑**：要求 3-6 段每段 5-8 秒，但实际故事中 8 个场景要压缩到 3-6 段，每段拼接多个场景——这需要 LLM 正确理解场景关联性，prompt 没有给出足够指导

### 7. 道具设计师 (props-designer.txt)

**问题级别：⚠️ 低**

- 22 个品类的道具分类体系比较详细，写实风格优先
- **输出格式的问题**：顶层 key 是 `props`，但 aigc-spec-system.txt 和编排器期望的是 `propSpecs`。有两个地方（main aigc-spec + orchestrator）做了兼容处理（`propRoot?.props || propRoot?.propSpecs`），说明这是一个已知的 schema 不一致
- **"场景"字段场景名 vs sceneId**：props-designer 要求填写 `scenes`（场景名数组），但剧情蓝图中的场景 ID 是数字 sceneId。下游合并时无法按场景名准确匹配

### 8. 镜头/特效师 (director-of-photography.txt)

**问题级别：⚠️ 低**

- 四个输出（effectSpecs / actionSpecs / cameraSpecs / emotionSpecs）工作量巨大，但 prompt 只有 2327 字，**可能输出过简**
- **actionSpecs 和情绪描述的交叉引用**：actionSpecs 有 `facialExpression` 字段，emotionSpecs 也有 `facialDesc`——这会导致 AI 把角色表情在两个地方各写一遍但可能不一致
- 缺少时间维度的约束：effectSpecs.duration 是数字但没有单位约定

### 9. 动作优化 (action-optimizer.txt)

**问题级别：⚠️ 中**

- **最长的单 prompt**：4214 字，结构清晰（动作动词词表 + 特效词表 + 镜头语言词表 + 表情触发词表 + 输出格式），词表思路好
- **问题：动作动词是英文但词表引用是中文**：prompt 是中文主体+英文动词。视频模型（wan2.7/百炼）对英文动词的理解取决于模型训练数据。如果百炼是在中文语料训练的，英文动词可能不生效
- **输出只有 5 行非结构化文本**：后端直接拿这个 5 行文本替换 narrativePurpose，替换后的字段格式不一致，有些下游逻辑可能依赖 JSON 格式

### 10. 视频提示词优化师 (video-prompt-optimizer.txt)

**问题级别：⚠️ 中-高**

- **全系统最长的 prompt**：11223 字，反复强调"时序化动作"、"可编译性"、"角色不重复外貌"、"空间关系明确"、"分镜角色唯一性"——这些全部是正确的约束，但 LLM 在 11223 字 prompt + 复杂 JSON schema 下**实际输出经常违反规则**
- **时序动作的"第 N 秒"约束**：要求 action.details 和 effects.description 按秒描述，但 prompt 没有定义时间对齐规则（如 8 秒的视频，第 1 到第 8 秒的编号如何与生成模型的对齐帧对应？）——这是一个输出格式与模型能力之间的 gap
- **"主要角色不重复外貌"规则**：这个判断本身是好的，但入口模糊——"已由角色设计定义过完整外貌"这个前提在 prompt 中不成立，因为 video-prompt-optimizer 拿到的输入是 JSON 格式的角色数据，不一定有完整的化身描述。容易导致 LLM 把"不重复"理解为"不写"，然后被生成模型认为"未定义角色外观"而胡乱生成
- **分镜角色唯一性规则**：prompt 中写"同一角色不能在同一分镜中以不同 variant 出现"——这是正确的铁律。但判断"剧本原文中该分镜对应的时间点应该出现的那个 variant"需要 LLM 理解整个故事时间线，目前没有可执行的算法保证

---

## 三、编排层问题 (aigc-orchestrator.ts)

### 3.1 串行依赖与并行执行的矛盾

| Phase | 依赖 | 并行 | 依赖正确性 |
|-------|------|------|-----------|
| 0 | 无 | 单线程 | ✅ |
| 1 | 依赖 Phase 0 的 plotBlueprint | ✅ 3 个 Agent 并行 | ⚠️ 角色/场景/定妆都看到完整的蓝图，没问题 |
| 2 | 依赖 Phase 1 的 char + scene + makeup | ✅ 声音+画面并行 | ✅ 两个作业看同一份 context |
| 3 | 依赖 Phase 1+2 | 单线程 | ✅ 有全量 context |
| 4 | 依赖 Phase 1+2+3 | 单线程 | ✅ 有全量 context |

核心问题是：**Phase 2 中 frame-designer 需要 charSpecs + sceneSpecs，但如果 charSpecs 按 variant 有多个条目，frame-designer 需要理解哪个 variant 对应哪个场景**——但在 contextJson 中只传了 `characters: charResult.spec`（数组），没有显式传递 plotBlueprint 的 `scenes[].characterVariants` 绑定关系。**这是数据传递缺失**

### 3.2 contextJson 构建过程

Phase 2 的 contextJson 包含了：
```js
JSON.stringify({
  plotBlueprint,         // ✅ 完整蓝图（含 scenes[].characterVariants）
  characters: charResult.spec,
  scenes: sceneResult.spec,
  characterMakeups: makeupResult.spec,
})
```
然后附加 `blueprintContext` 到 `agentContext`。这里有两个 context 在拼接（`contextJson + blueprintContext`），导致 plotBlueprint 出现两次。**两次给 LLM 可能造成混淆或不一致引用**。

### 3.3 错误边界

- 单个 Agent 失败时，编排器输出 `success: false` 阻断整个流程（Phase 1 角色/场景失败时确实 block）
- Phase 0 剧情总指挥失败时**日志 warning 但继续执行专业 Agent**——这意味着没有剧情蓝图时，下游角色/场景设计师在盲跑。这是**已知的降级路径**，但应该带 warning 提示给用户

### 3.4 重试策略

每个 Agent 默认 1 次重试（共 2 次尝试）。JSON 解析失败时带错误反馈重试。LLM 调用异常时也重试。这个策略在当前模型稳定性下合理。

---

## 四、数据流问题

### 4.1 剧情脚本作为唯一事实源（剧情连贯性）

近期修改已在 plot-supervisor.txt 添加了 `scenes[].script` 字段，并在 `extractStoryFromProject()` 中优先输出 script 格式化的完整剧本。**这是正确的架构决策**。

**但存在问题**：
- 旧的 project 数据没有 `script` 字段（我们刚才手动跑脚本给百花仙子补了）
- 在 `optimize-video-prompt.ts` 中，`extractStoryFromProject()` 脚本 format 的 story 被截断到 `MAX_TEXT_LENGTH`（4000 字符）。8 个场景的剧本脚本 + 角色信息很容易超过 4000 字符，导致 LLM 看到不完整的剧情

### 4.2 两个数据源的存在

- **DB 关系表**（`aiCharacterSpec` / `aiFrameDesign` / `aiVideoSegment` 等）：optimize-video-prompt 路由从这些表读取
- **executionResults 中的 JSON**（`plotBlueprint` / `characterSpecs` 等）：orchestrator 输出写入这里

**两者不完全同步**。当用户重新触发统筹后，executionResults 更新但 DB 表不更新。优化提示词路由读的是 DB 表旧数据。这是**数据双写 bug**。

---

## 五、各 Agent 间输出格式冲突

| 字段名 | plot-supervisor | character-designer | scene-designer | frame-designer | 问题 |
|--------|----------------|-------------------|----------------|---------------|------|
| `sceneId` | number | N/A | `"scene_0"` (string) | N/A | 场景 ID 类型不统一 |
| `characters[].name` | `name` | `characterName` | N/A | N/A | 字段名不一致 |
| `props` vs `propSpecs` | N/A | N/A | N/A | N/A | 顶层 key 不统一 |
| `sceneName` vs `name` | `name` | N/A | `sceneName` | N/A | 场景名字段不统一 |
| `characterVariants` | `"角色名": "variant名"` | separate spec | N/A | N/A | 结构完全不兼容 |

**建议**：建立一个全局 JSON schema registry，所有 Agent 输出的 key 映射到统一标准。

---

## 六、总结风险矩阵

| # | 风险 | 级别 | 影响 |
|---|------|------|------|
| 1 | 声音设计师 voiceType 值域与实际 TTS 引擎不匹配 | ❌ 严重 | TTS 调用参数无效 |
| 2 | orchestator DB 表与 executionResults JSON 双写不同步 | ❌ 严重 | 优化提示词读到过期数据 |
| 3 | MAX_TEXT_LENGTH 4000 截断剧本导致分镜优化不完整 | ⚠️ 中 | 分镜提示词偏离剧情 |
| 4 | phase2 contextJson 中 plotBlueprint 重复传递 | ⚠️ 中 | LLM 混淆 |
| 5 | 角色设计师/定妆师两个 Agent 功能高度重叠 | ⚠️ 中 | 算力浪费，字段不一致 |
| 6 | storyExtract 的散称剧本文本截断 | ⚠️ 低-中 | 下游看到不完整剧情 |
| 7 | 场景数量 2-5 个的硬编码约束偏低 | ⚠️ 低 | LLM 少生场景 |
| 8 | video-prompt-optimizer 11223 字的 prompt 过长导致 LLM 遗漏约束 | ⚠️ 中 | 输出不符合期望 |
| 9 | 多个 Agent 的 JSON schema 不统一（sceneId 类型、字段名、顶层 key） | ⚠️ 低-中 | 拼装结果的兼容代码增多 |
| 10 | action-optimizer 输出非结构化 5 行文本破坏一致性 | ⚠️ 低-中 | 下游需特殊解析 |
