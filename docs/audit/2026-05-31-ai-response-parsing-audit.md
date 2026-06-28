# AI 响应解析审计报告

**审计日期**: 2026-05-31  
**审计范围**: 影剧厂 AI 拆解→解析→前端渲染完整链路  
**审计工程师**: 第三方审查  

## 问题概述

前端显示的**角色卡片**中角色名被错误替换（如"社死现场"覆盖了"猪八戒"），**道具卡**显示为空。  
表面症状是"角色名不对"和"道具缺失"，根本原因是**后端对 AI 返回数据的解析/后处理逻辑存在多个竞态和覆盖 bug**。

---

## 架构总览

```
前端 ScriptAnalysisWorkspace.vue
  │ POST /api/v1/narrative/analyze-v2
  │   → narrative-llm.ts (analyze-v2 路由)
  │     → DeepSeek call → AI 返回 JSON
  │     → JSON 解析 + 字段补齐 + 启发式覆盖 ← ⚠️ 问题区
  │     → 返回给前端
  │
  │ 然后前端再触发（非阻塞）:
  │   POST /api/script/regenerate (section=props)
  │     → script-submit.ts → aigc-orchestrator.ts
  │       → agentDefs[6] (道具设计师) → narrativeGateway.execute()
  │         → DeepSeek call → AI 返回 JSON
  │         → runAgent() → JSON 解析 ← ⚠️ 问题区
  │
  │   POST /api/script/regenerate (section=scene)
  │     → 同上，agentDefs[2]
  │
  │   POST /api/script/regenerate (section=voice)
  │     → 同上，agentDefs[4]
  │
  │ 15 秒后 setTimeout reload 检查 ← ⚠️ 竞态区
```

---

## 发现的问题

### 🔴 问题 1：analyze-v2 路由中的启发式覆盖（已修复但需确认）

**文件**: `backend/src/routes/narrative-llm.ts`  
**行号**: ~485-501（原代码）  

AI 返回的角色名是正确的（`['猪八戒', '百花仙子', '嫦娥', '帅男仙', '二郎神杨戬']`），  
但代码用 heuristic 正则 `/([\u4e00-\u9fa5]{2,4})(?:说|道|问|答|喊|叫|走|来|去|看|听|站|坐|跑|跳|飞|追|望)/g`  
从剧本中匹配"动作词前的 2-4 字词"，然后**无条件覆盖** AI 返回的角色名。

- 正则中的 `走|来|去|看|听|站|坐|跑|跳|飞|追|望` 匹配了大量非角色名（如"社死现场"的"现场"匹配了"走"的变体、"精心画上"的"画上"匹配了"上"）  
- 严格模式应该是 `说|道|问|答|喊|叫` 这 6 个明确标识角色的动作词  
- 即使使用正则兜底，也应该**在 AI 返回空列表时才触发**，而不是无条件覆盖

**当前状态**: 已改为`仅 AI 返回空角色时兜底` + 正则缩减为 6 个动词。需用户验证。

---

### 🔴 问题 2：道具设计师 JSON 解析失败（数据库 PromptTemplate 缓存）

**文件**: `backend/src/prompts/agents/props-designer.txt`（未生效）  
**实际生效源**: `prisma.PromptTemplate` 表（数据库记录）  

`aigc-orchestrator.ts` 第 97-113 行的 `runAgent()` 从 PromptTemplate 数据库表读取 prompt：

```js
const dbTemplate = await prisma.promptTemplate.findUnique({
  where: { name: def.name },
})
if (dbTemplate?.content) {
  systemPrompt = dbTemplate.content.text  // ← 使用数据库内容
} else {
  systemPrompt = readFileSync(...)          // ← 仅数据库无记录时用 .txt 文件
}
```

数据库中的「道具设计师」prompt 第 4 条规则明确写着：  
**「文字/图案必须用双引号标注……如'锦盒盖面用金线绣有"百年好合"四字'」**  

这导致 AI 在 JSON 字符串值中插入双引号（如 `"款式描述": "…祥云纹和"囍"字图案"`），  
使 `JSON.parse` 在 `"囍"` 处断开，解析彻底失败。

同时 prompt 使用了 **"必须用英文双引号标注"** 的措辞，与"只输出严格 JSON" 的要求自相矛盾。

**当前状态**: 数据库 prompt 已更新（英文双引号→中文「」引号）。  
**根因**: 系统同时存在两套 prompt 来源（数据库 + .txt 文件），数据库优先级更高但无版本管理，容易漏改。

---

### 🟡 问题 3：前端 analyze-v2 后的非阻塞副任务存在竞态

**文件**: `frontend/studio-v2/workspace/script-analysis/ScriptAnalysisWorkspace.vue`  
**行号**: ~270-350  

主流程 `analyze-v2` 完成后，前端**依次调用**三个非阻塞副任务：  
1. `analyzeScenes()` → `POST /api/script/regenerate (section=scene)`  
2. `analyzeProps()` → `POST /api/script/regenerate (section=props)`  
3. `analyzeVoices()` → `POST /api/script/regenerate (section=voice)`  

然后 15 秒后 `setTimeout` 执行 `loadFromServer(pid)` 从数据库重载。

**问题链**：
1. `analyzeScenes()` 成功后的 `.then()` 中 `loadFromServer()` **主动擦除了** narrative 中的 `videoSegments`、`dialogues`、`actions`、`voices` 等字段（因为 DB 中没有存这些字段）
2. 代码试图用快照 `_v2Snapshot` 恢复，但快照只保存了 `videoSegments`、`dialogues`、`actions`、`beats`、`props`、`emotionCurve`
3. 如果在 `loadFromServer` 到快照恢复之间，**前端 computed 触发了渲染**，就会出现数据不一致（角色名正确但场景数错误等）
4. 15 秒后的 `setTimeout` 又执行一次 `loadFromServer` + 快照恢复，进一步增加了竞态窗口

**建议**: 消除 `loadFromServer` 对 analyze-v2 结果的覆盖，或在 DB schema 中添加 `analyzeV2Data` 字段统一存取。

---

### 🟡 问题 4：`aigc-spec/save` 前端保存和 `loadFromServer` 的 schema 不一致

**文件**: `ScriptAnalysisWorkspace.vue` 第 305-345 行  

前端调用 `POST /api/aigc-spec/{pid}/save` 保存时，**转换了字段名**（如 `characterSpecs`, `sceneSpecs`, `voiceConfigs`）。  
然后 `loadFromServer` 重新加载时，按另一套 schema 解析，可能丢失或错位数据。

关键缺失：`aigc-spec/save` 没有保存 `videoSegments` / `dialogues` / `actions` 等 analyze-v2 核心字段，只保存了转换后的子集。

---

### 🔴 问题 5：道具设计师 prompt 中的独立 JSON schema 与主 analyze-v2 schema 不一致

- analyze-v2 prompt 中道具的 schema 字段名：`name`, `category`, `associatedScene`, `description`  
- props-designer prompt 中道具的 schema 字段名：`name`, `category`, `scenes`, `description`, `imagePrompt`  
- 后端 `runAgent()` 解析时提取 `raw.spec?.props || raw.spec?.propSpecs`  
- 前端 `analyzeProps()` 转换时用 `p.propName || p.name`  

三个地方对同一实体的字段名定义各不相同，增加了解耦风险和解析错误。

---

## 总结：优先级建议

| 优先级 | 问题 | 影响 | 修复建议 |
|--------|------|------|----------|
| P0 | #2 道具 prompt 双引号冲突 | 道具解析 100% 失败 | ✅ 已修（需验证） |
| P0 | #1 启发式覆盖角色名 | 角色名错乱 | ✅ 已修（需验证） |
| P1 | #3 副任务竞态 + loadFromServer 擦除 | 偶发数据不一致 | 统一使用 `executionResults.analyzeV2Data` 持久化 analyze-v2 完整结果，loadFromServer 时同时恢复 |
| P1 | #4 aigc-spec/save schema 不一致 | 刷新页面后部分字段丢失 | 在 project 表中增加 analyzeV2Data 完整存储，前后端统一 schema |
| P2 | #5 多套道具 schema | 未来维护隐患 | 统一 propRef schema |

**建议下一步**: 请重新点击"开始AI拆解"验证 P0 问题修复，确认角色名正确显示、道具列表有数据。
