# 审查报告：AI 拆解剧本后六维数据未渲染

**日期**: 2026-06-01  
**项目**: shipin-cinematic-studio  
**审查人**: Clawdbot (第三方审查)  
**状态**: 待修复 → 已修复  

---

## 概述

一条完整的数据链断裂：AI 六维数据已正确写入 DB（`execution_results` 的 `analyzeV2Data` 字段），但**从未被同步到前端的唯一数据源**（`ai_character_specs` / `ai_scene_specs` / `ai_video_segments` 独立表），导致 `loadFromServer` 读出来是空的，六个维度组件不渲染。

## 数据流现状

```
regenerate → executionResults.videoSegments ✅ (写入了 DB)
           → executionResults.analyzeV2Data  ✅ (热修复补上了)
           → ai_character_specs / ai_scene_specs ❌ (从未写入)
                ↓
loadFromServer 只读独立表 → characters=[], scenes=[] → 六维组件空白
```

## 发现的问题

### 🔴 问题 1 — regenerate 路由缺少 artifact-sync

- **位置**: `script-submit.ts:197-370` (POST /api/script/regenerate)
- **原因**: regenerate 路由只写了 `executionResults`（JSONB），没有调用 `syncArtifactsFromExecution()` 将结果同步到独立表。对比 `/api/script/submit`（第 171-178 行）有 artifact sync，但 regenerate 复制粘贴时漏了。
- **影响**: 前端 `loadFromServer` 只从独立表读角色/场景，三个表都是 0 条 → 六维空白。
- **修复**: 在 regenerate 持久化之后添加 `syncArtifactsFromExecution` 调用。

### 🔴 问题 2 — loadFromServer 的唯一真相源是独立表

- **位置**: `useStudioStore.ts:283-555`
- **原因**: `loadFromServer` 只从 `prisma.project.findUnique({ include: { aiCharacterSpecs, aiSceneSpecs, aiVideoSegments } })` 读取，完全不读 `executionResults.analyzeV2Data`。
- **影响**: 即使 `executionResults` 有完整的 analyzeV2Data，前端也永远不会渲染它。
- **修复**: 在 regenerate 中补充 artifact-sync（一次写入独立表，双方都可见）。

### 🔴 问题 3 — artifact-sync 不读 analyzeV2Data.normalized

- **位置**: `artifact-sync.service.ts:40-50`
- **原因**: `syncArtifactsFromExecution` 的 `const plotBP = executionResults.plotBlueprint || executionResults` 只从顶层找 `scenes`/`characters`。analyzeV2Data 的六维结构在 `analyzeV2Data.normalized.characters` 里，不在顶层。
- **影响**: 即使 regenerate 调了 artifact-sync，也找不到数据。
- **修复**: artifact-sync 增加 fallback 到 `analyzeV2Data?.normalized`。

### 🟡 问题 4 — heuristic characters 是乱码字符串

- **原因**: `runAnalyzeV2Snapshot` 的 heuristic fallback 生成的 characters 是从剧本原文截取的字符串片段（如"才会想起"）。
- **修复**: heuristic fallback 返回空数组。

### 🟡 问题 5 — 六维只依赖 storyboard section

- **原因**: `sectionKeyMap` 中 `storyboard → 'videoSegments'`，只有 storyboard regenerate 才会触发 analyzeV2Data。
- **修复**: 六维生成条件放宽为 `!analyzeV2Data` 即触发。

### 🟢 建议 6 — 考虑统一真相源

- **建议**: 长期统一为单真相源（要么全部独立表，要么全部 executionResults）。

## 修复记录

| # | 类型 | 文件 | 修复内容 | 状态 |
|---|------|------|---------|------|
| 1 | 🔴 | `script-submit.ts:regenerate` | 添加 `syncArtifactsFromExecution` 调用 | ✅ |
| 3 | 🔴 | `artifact-sync.service.ts` | 增加 `analyzeV2Data.normalized` fallback | ✅ |
| 4 | 🟡 | `normalize-narrative-spec.ts` | heuristic fallback 返回空数组代替垃圾角色名 | ✅ |
| 5 | 🟡 | `script-submit.ts:analyzeV2` | 六维生成条件放宽为 `!analyzeV2Data`（不限 storyboard） | ✅ |

## 验证

在修复后重新对项目 `eec77143-66b4-4ad2-a810-93119303958f` 调 regenerate storyboard，
独立表中出现数据即可确认修复生效。
