# Prompt 硬编码审查报告

审查日期：2026-06-02
审查范围：frontend/studio-v2/ (非 .nuxt)、backend/src/、shared/

---

## 严重违规（system prompt 硬编码）

以下为直接在代码中硬编码 system prompt 文本、或通过 `readFileSync` 从 `.txt` 文件读取（未走 DB PromptTemplate）的违规项。

### 1. backend/src/routes/narrative-llm.ts:69 — NARRATIVE_SYSTEM_PROMPT 硬编码

**类型**：硬编码 system prompt（const 变量）

**内容（前 100 字）**：
```
你是一个专业的电影叙事分析师。你的任务是把一段小说/故事文本拆解成可直接用于画面生成的结构化数据。你必须严格遵守以下规则：1. **叙事分解**：把叙事分解成原子事件序列...
```

**违反程度**：🔴 严重
**可迁移**：✅ 是，存入 DB PromptTemplate，通过 `getDbPrompt()` 读取（该函数已存在）
**被引用位置**：第 169 行（`systemPrompt: NARRATIVE_SYSTEM_PROMPT`）

---

### 2. backend/src/routes/narrative-llm.ts:707 — 角色视觉设计师 system prompt 硬编码

**类型**：硬编码 system prompt（内联字符串）

**内容（前 100 字）**：
```
你是一个专业的角色视觉设计师。根据角色描述，生成高质量的 AI 图片生成 prompt。

规则：
1. 返回 JSON：{ "imagePrompt": "中文 prompt（描述角色外貌、服装、气质、光线、构图、艺术风格）", "negativePrompt": "负面提示词" }
2. imagePrompt 用中文描述...
```

**违反程度**：🔴 严重
**可迁移**：✅ 是，存入 DB PromptTemplate

---

### 3. backend/src/routes/narrative-llm.ts:768 — 场景设计师 system prompt 硬编码

**类型**：硬编码 system prompt（内联字符串）

**内容（前 100 字）**：
```
你是一个专业的场景设计师。根据场景描述生成高质量的 AI 图片生成 prompt。返回 JSON：{ "imagePrompt": "中文 prompt，必须包含：环境描述、光线、色调、氛围、构图", "negativePrompt": "负面提示词" }。场景图中禁止出现任何人、动物、角色...
```

**违反程度**：🔴 严重
**可迁移**：✅ 是，存入 DB PromptTemplate

---

### 4. backend/src/routes/storyboards.ts:76 — 影视分镜师 system prompt 硬编码

**类型**：硬编码 system prompt（内联字符串 + 模板变量插值）

**内容（前 100 字）**：
```
你是一个专业的影视分镜师。根据用户的场景描述，生成 3~6 个分镜头。每个分镜必须包含以下字段：
- shotIndex: 序号（从0开始）
- sceneDescription: 该镜头的场景描述（中文，50字以内）
- cameraAngle: 镜头角度（全景/中景/近景/特写/俯拍/仰拍/过肩镜头）
...
```

**违反程度**：🔴 严重
**可迁移**：✅ 是（注意 prompt 中包含 `${charInfo}` 模板变量，需在 PromptTemplate 中用占位符标记）

---

### 5. backend/src/routes/ai-optimize-shot.ts:19 — 摄影指导 system prompt 从 txt 文件读取

**类型**：readFileSync 从 `.txt` 文件加载（宪法第6条要求从 DB 读取）

**代码**：`const SYSTEM_PROMPT = readFileSync(join(__dirname, '../prompts/agents/director-of-photography.txt'), 'utf-8')`

**文件内容（前 100 字）**：
```
你是一个世界顶级的电影摄影师/摄影指导（Director of Photography）。你掌镜的作品获得过多项国际大奖，对影视镜头语言有极深的造诣。你的核心信条是：每一个镜头都必须服务于叙事和情感传递。
```

**违反程度**：🔴 严重
**可迁移**：✅ 是，存入 DB PromptTemplate，参考 `getDbPrompt()` 模式改造

---

### 6. backend/src/director-v2/runtime/api-surface.ts:285-286 — 剧情总指挥 prompt 从 txt 文件读取

**类型**：readFileSync 从 `.txt` 文件加载（宪法第6条要求从 DB 读取）

**代码**：`readFileSync('/root/shipin-cinematic-studio/backend/src/prompts/agents/plot-supervisor.txt', 'utf-8')`

**文件内容（前 100 字）**：
```
你是一个专业的剧情总指挥，负责分析和构建故事的情节结构。【输出规则 — 严格 JSON】
```

**违反程度**：🔴 严重
**可迁移**：✅ 是，同时注意硬编码的绝对路径，应改为相对路径

---

### 7. backend/src/director-v2/constitution-compiler.ts:75 — ENRICH_SYSTEM_PROMPT 硬编码

**类型**：硬编码 system prompt（const 变量，超长 400+ 行内容）

**内容（前 100 字）**：
```
你是 Story Constitution Compiler。基于剧本和已有结构骨架，生成完整的导演宪法 JSON。你已经拿到剧本的结构骨架（coreTheme, emotions, characters等），现在需要：1. 填充视觉教义（色彩、灯光、运镜、构图）2. 填充节奏教义...
```

**违反程度**：🔴 严重
**可迁移**：✅ 是，存入 DB PromptTemplate

---

### 8. backend/src/agents/character.agent.ts:35 — 角色分析师 system prompt 硬编码

**类型**：硬编码 system prompt（const 变量）

**内容（前 100 字）**：
```
你是一位专业的剧本角色分析师。请从以下剧本中提取所有角色信息。对于每个角色，返回 JSON 格式：{ "characters": [ { "characterId": "唯一标识", "name": "角色名", "role": "protagonist|antagonist|supporting|minor", "appearance": { "gender": "性别"...
```

**违反程度**：🔴 严重
**可迁移**：✅ 是，存入 DB PromptTemplate

---

### 9. backend/src/agents/scene-image-prompt.agent.ts:39 — 场景图提示词工程师 system prompt 硬编码

**类型**：硬编码 system prompt（const 变量，超长）

**内容（前 100 字）**：
```
你是一位顶级 AI 文生图提示词工程师。你将收到每个场景的【场景图优化需求表单】，请按照标准 AIGC 提示词格式输出优化后的提示词。【标准 AIGC 提示词格式】每条场景图提示词必须包含以下要素...
```

**违反程度**：🔴 严重
**可迁移**：✅ 是，存入 DB PromptTemplate

---

### 10. backend/src/agents/aigc-spec-agent-v2.ts:94 — 六维拆解系统 prompt 硬编码

**类型**：硬编码 system prompt（const 变量，超长）

**内容（前 100 字）**：
```
你是一位顶级影视导演、编剧、摄影师、特效师。你的任务是读取用户提交的剧本和参数，严格按以下 schema 填充，不做任何额外创作。## 角色定义 你作为顶级影视导演、编剧、摄影师、特效师身份...
```

**违反程度**：🔴 严重
**可迁移**：✅ 是，存入 DB PromptTemplate

---

### 11. backend/src/agents/portrait-prompt.agent.ts:32 — 肖像提示词质量管理员 system prompt 硬编码

**类型**：硬编码 system prompt（const 变量）

**内容（前 100 字）**：
```
你是一位角色肖像提示词质量管理员。你将收到【角色肖像优化需求表单】，请检查生成的提示词是否满足以下标准的 AIGC 提示词格式要求：【标准格式要求】- 角色名 + 外貌描述（年龄、发色、面部特征、服装、体型）- 姿态: full body portrait...
```

**违反程度**：🔴 严重
**可迁移**：✅ 是，存入 DB PromptTemplate

---

### 12. backend/src/agents/aigc-spec-agent.ts:410 — AIGC 影视短剧制作规划师 user prompt 硬编码

**类型**：User prompt 模板硬编码（`return \`你是一个专业的 AIGC 影视短剧制作规划师...\``），但 system prompt 已从 DB 读取

**内容（前 100 字）**：
```
你是一个专业的 AIGC 影视短剧制作规划师。你的任务是根据故事文本，重新生成以下类型的规格数据：${LABELS[type] || type}。要求：1. 输出必须是严格有效的 JSON，不要任何额外文字或代码块标记...
```

**备注**：此处的 system prompt 角色定义被放在了 user prompt 中（而非 system message），实际 system prompt 已从 DB `aigc-prompt` 读取。
**违反程度**：🟡 中等（user prompt 模板）
**可迁移**：✅ 是，合并到 DB PromptTemplate 的 content 中

---

### 13. backend/src/agents/aigc-orchestrator.ts:368 — 分镜提示词优化专家 prompt 硬编码

**类型**：内联硬编码（`callAgentLLM` 的第一个参数直接为 system prompt 字符串）

**内容（前 100 字）**：
```
你是一个 AI 分镜提示词优化专家。输出严格 JSON 格式的 storyboardSpecs 数组，每个元素包含 imagePrompt（优化后的中文正向提示词，>60字）和 negativePrompt（优化后的中文负向提示词）。不要输出任何其他内容。
```

**备注**：`aigc-orchestrator.ts` 中的其他 agent 均已从 DB PromptTemplate 读取，此处是唯一硬编码的例外。
**违反程度**：🔴 严重
**可迁移**：✅ 是，存入 DB PromptTemplate

---

## 中等违规（prompt 模板硬编码）

以下为代码中直接构造的 user prompt 模板（含较长中文 prompt 指令文本），应迁移到 DB。

### 14. backend/src/routes/narrative-llm.ts:170 — 分析故事文本 user prompt 模板

**类型**：User prompt 模板硬编码

**内容**：`请分析以下故事文本，严格按照 JSON schema 输出：\n\n${text.slice(0, 8000)}`

**备注**：system prompt 来自 DB 或硬编码(NARRATIVE_SYSTEM_PROMPT)，但 user prompt 中的指令模板可提取
**违反程度**：🟡 中等
**可迁移**：✅ 是，作为用户 message 模板存入 DB

---

### 15. backend/src/routes/narrative-llm.ts:723 — 角色 prompt 优化 user prompt 模板

**类型**：User prompt 模板硬编码

**内容**：
```
角色名: ${characterName || ''}
描述: ${description || ''}
性格: ${personality || ''}
服装: ${costume || ''}
当前 prompt: ${imagePrompt || ''}
故事背景: ${storyText.slice(0, 500)}
请生成优化后的图片生成 prompt（JSON 格式）。
```

**违反程度**：🟡 中等
**可迁移**：✅ 是

---

### 16. backend/src/routes/narrative-llm.ts:764 — 场景 prompt 优化 user prompt 模板

**类型**：User prompt 模板硬编码

**内容**：
```
场景名: ${sceneName || ''}
描述: ${description || ''}
故事背景: ${storyText.slice(0, 500)}
请生成详细的场景图片生成 prompt（JSON 格式），包含环境、光线、色调、氛围。
```

**违反程度**：🟡 中等
**可迁移**：✅ 是

---

### 17. backend/src/routes/ai-optimize-shot.ts:52 — 逐秒优化 user prompt 模板

**类型**：User prompt 模板硬编码

**内容（前 100 字）**：
```
请优化以下视频片段脚本，按逐秒输出优化结果。\n\n## 剧情描述\n${narrative}\n\n## 对话文本\n${dialogue}\n\n## 特效音效描述\n${effects}...
```

**备注**：system prompt 已从 txt 文件读取（违规项 #5）
**违反程度**：🟡 中等
**可迁移**：✅ 是

---

### 18. backend/src/services/optimization-engine.ts:115 — AI 内容优化助手 prompt 硬编码

**类型**：硬编码（内联返回）

**内容（前 100 字）**：
```
你是一个专业的 AI 内容优化助手${typeHint}。## 当前内容 ${JSON.stringify(rawContent, null, 2)}## 优化目标 ${target}## 要求 - 分析当前内容中的不足...
```

**违反程度**：🔴 严重（此 function 直接作为 system prompt 使用）
**可迁移**：✅ 是

---

### 19. backend/src/services/video-pipeline.engine.ts:59 — 视频镜头描述生成器 prompt 硬编码

**类型**：User prompt 硬编码

**内容**：
```
你是一个视频镜头描述生成器。请根据以下镜头内容生成一个适合传入 wan2.7-video 模型的视频描述提示词，包含场景、角色动作、镜头运动、光影等信息。\n\n${shotPrompt}
```

**备注**：此处作为 `{ role: 'user', content: ... }` 使用，但内容实质是 system prompt 指令
**违反程度**：🟡 中等
**可迁移**：✅ 是

---

### 20. frontend/studio-v2/workspace/storyboard/StoryboardWorkspace.vue:797 — AI 分镜图提示词工程师 prompt 硬编码

**类型**：Frontend 侧内联 hardcode

**内容（前 100 字）**：
```
你是一个专业的 AI 分镜图提示词工程师。
```

**违反程度**：🟡 中等（前端直接传给后端，system prompt 应服务端控制）
**可迁移**：✅ 是，此 prompt 应由后端控制（从 DB 读取），前端仅传参数

---

### 21. frontend/studio-v2/workspace/storyboard/StoryboardWorkspace.vue:815 — 请根据段落描述 指令硬编码

**类型**：Frontend 侧 user 指令硬编码

**内容**：`请根据段落描述和已有的提示词，输出优化后的正向提示词和负向提示词。`

**违反程度**：🟡 中等（前端直接构造 AI 指令）
**可迁移**：✅ 是，移入后端 DB

---

## 轻微违规（prompt 片段）

### 22. backend/src/director-v2/runtime/api-surface.ts:286 — 硬编码绝对路径

**类型**：文件路径硬编码

**代码**：`readFileSync('/root/shipin-cinematic-studio/backend/src/prompts/agents/plot-supervisor.txt', 'utf-8')`

**违反程度**：🟢 轻微（路径硬编码 vs 环境变量/相对路径）
**可迁移**：✅ 是（同时应改为 DB 读取）

---

### 23. backend/src/agents/aigc-spec-agent.ts:410 — TYPE_CONTENT 中内联的 prompt 片段

**类型**：prompt 模板变量在代码中定义

**代码**：`const LABELS: Record<string, string> = { character: '角色形象规格...', scene: '场景图规格...', storyboard: '视频段落规划...' }`

**违反程度**：🟢 轻微（这些是变量，不是完整 prompt）
**可迁移**：可以考虑，但优先级低

---

### 24. backend/src/routes/script-submit.ts:319 — 道具优化 user message 模板

**类型**：User prompt 模板硬编码

**代码**：
```typescript
const userMsg = existingProps.length > 0
  ? `请优化以下道具的 imagePrompt 视觉描述词。现有道具：${JSON.stringify(...)}${projectContext}`
  : `请从以下故事中提取所有出现的道具：\n${storyText}${projectContext}`
```

**备注**：system prompt 已从 DB 读取，user message 模板可考虑迁移
**违反程度**：🟢 轻微
**可迁移**：🟡 可选（user message 模板通常变化较大）

---

## 已合规（从 DB 读取的 prompt）

以下为已遵循宪法第6条、从 DB PromptTemplate 读取的 prompt，值得借鉴：

| 文件名 | DB PromptTemplate 名称 | 读取方式 |
|--------|----------------------|----------|
| `backend/src/routes/narrative-llm.ts` | `六维数据拆解分析` | `getDbPrompt('六维数据拆解分析')` |
| `backend/src/routes/narrative-llm.ts` | `aigc-prompt` | `getDbPrompt('aigc-prompt')` |
| `backend/src/routes/script-breakdown.ts` | `六维数据拆解分析` | `getAnalyzeV2Prompt()` |
| `backend/src/routes/script-submit.ts` | `道具设计师` | `prisma.promptTemplate.findUnique({ where: { name: '道具设计师' } })` |
| `backend/src/agents/aigc-spec-agent.ts` | `aigc-prompt` | `prisma.promptTemplate.findUnique({ where: { name: 'aigc-prompt' } })` |
| `backend/src/agents/aigc-orchestrator.ts` | 各 agent name | `prisma.promptTemplate.findUnique({ where: { name: def.name } })` |
| `backend/src/agents/portrait-prompt.agent.ts` | `imagePromptTemplates` 表 | `prisma.imagePromptTemplates.findUnique()` |

---

## 建议迁移清单

### 🚨 高优先级（立即迁移，严重违规 #1-#13）

| # | 文件 | 当前方式 | 建议目标 | 备注 |
|---|------|---------|---------|------|
| 1 | `backend/src/routes/narrative-llm.ts:69` | const 硬编码 | DB PromptTemplate `叙事分析_v1` | 最长、最核心的 system prompt |
| 2 | `backend/src/routes/narrative-llm.ts:707` | 内联字符串 | DB PromptTemplate `角色视觉设计师` | |
| 3 | `backend/src/routes/narrative-llm.ts:768` | 内联字符串 | DB PromptTemplate `场景设计师` | |
| 4 | `backend/src/routes/storyboards.ts:76` | 内联字符串（含模板变量） | DB PromptTemplate `影视分镜师` | 需处理 `${charInfo}` 占位符 |
| 5 | `backend/src/routes/ai-optimize-shot.ts:19` | readFileSync txt | DB PromptTemplate `摄影指导` | 参考 `getDbPrompt()` 模式 |
| 6 | `backend/src/director-v2/runtime/api-surface.ts:285-286` | readFileSync 绝对路径 | DB PromptTemplate `剧情总指挥` | 同时修复绝对路径问题 |
| 7 | `backend/src/director-v2/constitution-compiler.ts:75` | const 硬编码 | DB PromptTemplate `宪法编译器` | 超 400 行，优先迁移 |
| 8 | `backend/src/agents/character.agent.ts:35` | const 硬编码 | DB PromptTemplate `角色分析师` | |
| 9 | `backend/src/agents/scene-image-prompt.agent.ts:39` | const 硬编码 | DB PromptTemplate `场景图提示词工程师` | |
| 10 | `backend/src/agents/aigc-spec-agent-v2.ts:94` | const 硬编码 | DB PromptTemplate `六维拆解_v2` | |
| 11 | `backend/src/agents/portrait-prompt.agent.ts:32` | const 硬编码 | DB `imagePromptTemplates` 或 PromptTemplate | |
| 12 | `backend/src/agents/aigc-spec-agent.ts:410` | 内联 user prompt | DB PromptTemplate `AIGC规格重生成` | 与 system prompt 合并 |
| 13 | `backend/src/agents/aigc-orchestrator.ts:368` | 内联字符串 | DB PromptTemplate `分镜提示词优化专家` | 唯一硬编码的 agent |

### ⚠️ 中优先级（#14-#21，user prompt 模板）

| # | 文件 | 建议 |
|---|------|------|
| 14 | `narrative-llm.ts:170` user prompt | 提取 `请分析以下故事文本...` 模板 |
| 15 | `narrative-llm.ts:723` user prompt | 提取角色 prompt 模板 |
| 16 | `narrative-llm.ts:764` user prompt | 提取场景 prompt 模板 |
| 17 | `ai-optimize-shot.ts:52` user prompt | 提取逐秒优化模板 |
| 18 | `optimization-engine.ts:115` | 迁移整个 prompt |
| 19 | `video-pipeline.engine.ts:59` | 迁移 user prompt |
| 20 | `StoryboardWorkspace.vue:797` | 移除前端 prompt，后端控制 |
| 21 | `StoryboardWorkspace.vue:815` | 同上 |

### 🟢 低优先级（#22-#24）

| # | 文件 | 说明 |
|---|------|------|
| 22 | `api-surface.ts:286` | 绝对路径改为 `__dirname` 或 DB |
| 23 | `aigc-spec-agent.ts` LABELS 字典 | 可保留在代码中 |
| 24 | `script-submit.ts:319` | user message 模板，可选迁移 |

### 📋 总计

| 类别 | 数量 |
|------|------|
| 严重违规（system prompt 硬编码） | 13 处 |
| 中等违规（prompt 模板硬编码） | 8 处 |
| 轻微违规（prompt 片段） | 3 处 |
| 已合规（从 DB 读取） | 7 处（值得借鉴） |
| **总计需迁移** | **24 处** |

---

## 总结

1. **后端 agents/ 目录最为严重**：`character.agent.ts`、`scene-image-prompt.agent.ts`、`aigc-spec-agent-v2.ts`、`portrait-prompt.agent.ts` 共 4 个 agent 的 SYSTEM_PROMPT 全部硬编码为 const 变量。
2. **`aigc-orchestrator.ts` 有 1 处例外**：其他 agent 已从 DB 读取，仅「分镜提示词优化」agent 硬编码。
3. **`narrative-llm.ts` 有 3 处硬编码**：NARRATIVE_SYSTEM_PROMPT + 角色/场景设计师的 2 个内联 prompt。
4. **`readFileSync` 有 2 处**：`ai-optimize-shot.ts` 和 `api-surface.ts`（硬编码绝对路径）。
5. **`constitution-compiler.ts` 的 ENRICH_SYSTEM_PROMPT** 体积最大（400+ 行），应优先迁移。
6. **前端 `StoryboardWorkspace.vue`** 有 2 处硬编码，prompt 逻辑应由后端掌控。
7. **`routes/` 目录下的 `.txt` 文件**（aigc-prompt.txt, analyze-v2-prompt.txt, aigc-spec-prompt.txt）以及 `prompts/aigc-spec-system.txt` 未被代码引用，为死文件，建议清理。
