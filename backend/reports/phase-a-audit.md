# Phase A 完成审计报告（2026-06-25）

## 一、Phase A 四刀执行汇总

| 刀次 | Agent | 文件 | 改前模式 | 改后模式 | 状态 |
|-----|-------|------|---------|---------|------|
| 刀1 | ad-script | `ai-optimize-ad-script.ts` | story generator → shots+narrative | PromptIR.builder → {script, breakdown} | ✅ |
| 刀2 | shot optimizer | `ai-optimize-shot.ts` | scene reconstruction (narrative→shots) | shot parameter transformer (shots→shots) | ✅ |
| 刀3 | video prompt | `optimize-video-agent.ts` | narrative interpreter (text→VideoPromptSpec) | render spec builder (shots→VideoPromptSpec) | ✅ |
| 刀4 | frame prompt | `ai-optimize-frame-prompt.ts` | — | — | ⏳ |

### 数据库 PromptTemplate 变更

| Prompt 名称 | 改前 | 改后 |
|-------------|------|------|
| `script-template-v2` | 3 套 ad/promo/short 叙事模板 | 每套首行加 Invariant Rule |
| `director-of-photography` | 场景重建 prompt | **保留未删**（参考用），新 prompt `shot-transformer` |
| `shot-transformer` | **新增** | 纯 shot 参数优化，禁止生成新 shot |
| `video-prompt-designer` | 200 行电影摄影指导 | 被 `render-spec-builder` 替换 |
| `render-spec-builder` | **新增** | 字段映射器，禁止 narrative reconstruction |
| `video-optimize-user-prompt` | `{narrative}` 注入 | `{shots}` 结构化输入 |

### 删减统计

| 删除项 | 行数 | 文件 |
|--------|------|------|
| 硬编码 defaultPrompts (ad/promo/short) | ~90 行 | `ai-optimize-ad-script.ts` |
| `buildChineseNarrative()` + `EN_TO_CN_MAP` | ~100 行 | `optimize-video-agent.ts` |
| `director-of-photography` prompt | ~200 行（DB） | 被替换为 `shot-transformer` |
| `video-prompt-designer` prompt | ~200 行（DB） | 被替换为 `render-spec-builder` |
| **总计** | **~590 行** | |

### Temperature 变更

| Agent | 改前 | 改后 | 原因 |
|-------|------|------|------|
| ad-script | 0.6 | 0.3 | 确定性优先 |
| shot optimizer | 0.1 | 0.2 | 仍需微小创造力优化 camera/movement |
| video prompt | 0.4 | 0.2 | 降低自由生成倾向 |
| frame prompt | — | — | 第四刀再改 |

---

## 二、前端 VideoGenerationWorkspace.vue UI 审查报告

### 当前前端发送的请求（第 663-700 行）

```json
{
  "segmentNarrative": "文本剧情",
  "dialogue": "...",
  "effects": "...",
  "duration": 8,
  "firstFrameDesc": "首帧",
  "midFrameDesc": "中帧",
  "lastFrameDesc": "尾帧",
  "videoStyle": "3d"
}
```

### 实际消费的响应字段（前端代码逐行审查）

| 字段 | 前端消费位置 | Phase A 兼容性 | 备注 |
|------|-------------|---------------|------|
| `optimizedNarrative` | 第 706 行 → `updateSegmentField('narrative', ...)` | ✅ 兼容 | 现在来自 shots 描述 |
| `optimizedDialogue` | 第 709 行 → `updateSegmentField('dialogue', ...)` | ✅ 兼容 | 透传 |
| `optimizedEffects` | 第 713 行 → `updateSegmentField('effects', ...)` | ✅ 兼容 | 透传 |
| `optimizedFirstFrame` | 第 720 行 → `frameDescriptions.first` | ✅ 兼容 | 现在来自 shots[0].camera |
| `optimizedMidFrame` | 第 723 行 → `frameDescriptions.mid` | ✅ 兼容 | 空（同旧行为） |
| `optimizedLastFrame` | 第 727 行 → `frameDescriptions.last` | ✅ 兼容 | 现在来自 shots[last].camera |

### 风险：前端仍持 narrative authority

前端第 663 行仍发送 `segmentNarrative`。虽然后端有兼容层，但 **前端 UI 仍工作在 narrative 模式下**。具体表现：

1. **编辑框**（第 400-440 行）：用户看到的仍是"剧情描述"文本框，不是 structured shots 编辑
2. **预览面板**：展示的是 narrative 文本，不是 render spec
3. **视频生成提交**（第 2117 行）：`/api/tasks/ai-generate` 发送 `narrative + optimizedShots`，后者来自 `optimizedResults` —— 实际已用 shot-transformer 输出

### 结论

前端在 Phase A 阶段是**安全的**（后端兼容层保证），但存在"前端 Narrative → 后端 PromptIR → 前端又写回 Narrative"的二次漂移风险。建议 Phase B 做前端的 PromptIR 适配。

---

## 三、PromptIR 对前端状态管理影响分析

### 当前数据流（Phase A 完成后的状态）

```
前端 narrative 编辑框
    ↓ segmentNarrative (flat text)
ad-script agent (PromptIR builder)
    ↓ { promptIR: { script, breakdown: { shots: [] } } }
shot-transformer agent
    ↓ optimizedShots[]
render-spec-builder agent
    ↓ VideoPromptSpec → prompt string
video model
```

### 字段收敛问题

| 字段 | 存在位置 | 问题 |
|------|---------|------|
| `segment.narrative` | 前端 store | flat text，去往 ad-script 和 video agent |
| `optimizedShots` | 前端 `optimizedResults[idx]` | 来自 shot-transformer，被 video agent 消耗 |
| `frameDescriptions.first/mid/last` | 前端 reactive | 现在来自 shots.camera，不是 narrative 重建 |
| `promptIR` | 不存在于前端 | 只在后端 ad-script 输出中使用，前端完全不知 |

### 建议的字段收敛方案（Phase B）

```typescript
// 前端 store 增加结构
interface SegmentIR {
  narrative: string          // 用户输入的原始文本（展示用）
  promptIR: {
    script: ScriptFragment
    breakdown: {
      shots: ShotFragment[]
      characters: CharacterRef[]
      scenes: SceneRef[]
    }
  }
  optimizedShots: ShotFragment[]  // shot-transformer 输出
  renderSpec: VideoPromptSpec     // render-spec-builder 输出
}
```

---

## 四、需要同步修改的 UI 字段（Phase B 计划）

| 优先级 | UI 元素 | 当前行为 | 目标行为（Phase B） |
|--------|---------|---------|-------------------|
| P1 | 剧情编辑框 | 用户输入 narrative 文本 | 用户输入仍保留，但下方增加 shots 预览卡片 |
| P1 | 视频 prompt 预览 | 显示 compiledPrompt 字符串 | 显示 VideoPromptSpec 结构化渲染 |
| P2 | 特效/对话/情绪面板 | 独立文本输入框 | 纳入 PromptIR.script 统一编辑 |
| P2 | negativePrompt | 独立输入框 | 从 PromptIR.script 读取 |
| P3 | AI 优化按钮 | "优化视频描述" → 调用 video agent | 改为"生成渲染规格" → 调用 render-spec-builder |

---

## 五、前后端字段收敛方案（Phase B）

### 目标

消除"前端 narrative → 后端 PromptIR → 前端又写回 narrative"的二次漂移链。

### 具体方案

1. **后端增加字段**：在 `/api/ai/optimize-video-prompt` 和 `/api/ai/optimize-shot-script` 响应中增加 `promptIR` 字段
2. **前端 store 增加**：`SegmentIR` 类型（见上）
3. **前端 UI**：编辑框下方增加结构化预览——显示 shots 数量、camera 类型、scene 列表
4. **旧 flat 字段逐步废弃**：`optimizedNarrative` → 只在展示回溯时使用

### 不阻塞当前

上述 plan 是 Phase B 内容。Phase A 已完成后端基础设施，前端零改动即可运行。

---

## 总结

Phase A 三刀完成，系统从 "text-flow paradigm" 迁移到 "schema-flow paradigm"。三个 agent 的 narrative reconstruction authority 已被剥夺。当前风险状态：

```
Phase A 前：
  narrative (reinterpret 4×) → shots (reinterpret 3×) → video prompt (reinterpret 2×) → frame prompt
  └── 方差 = σ²₁ + σ²₂ + σ²₃ + σ²₄ = 4个独立LLM随机构成封闭漂移系统

Phase A 后：
  ad-script (extract) → shots (transform params) → video prompt (assemble spec) → frame (TBD)
  └── 方差 = σ²₁ (仅 ad-script 有提取膨胀，shot/video 为确定性降级)
```
