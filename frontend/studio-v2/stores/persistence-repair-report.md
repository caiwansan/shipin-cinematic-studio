# Persistence Repair Report

## 修复日期
2026-06-24

## 修复清单

### PR-1: `workspace.segments[]` 持久化

| 文件 | 变更 | 位置 |
|------|------|--------|
| `frontend/studio-v2/stores/useStudioStore.ts` | `saveToServer()` PUT body 增加 `executionResults.segments` | line 274-275 |
| 同上 | `loadFromServer()` 增加从 `executionResults.segments` 恢复 | line 759-764 |

**效果**: 用户编辑的分镜段数据（camera / emotion / timeline 等）在保存后可以恢复。

---

### PR-2: `videoStyle` / `aspectRatio` / `styleLocked` 持久化

| 文件 | 变更 | 位置 |
|------|------|--------|
| `frontend/studio-v2/stores/useStudioStore.ts` | `saveToServer()` PUT body 增加 `executionResults.videoStyle/aspectRatio/styleLocked` | line 276-278 |
| 同上 | `loadFromServer()` 增加从 `executionResults` 恢复 | line 766-771 |

**效果**: 用户选择的视频风格（写实/动漫/3D 等）和画面比例（9:16/16:9 等）保存后不会丢失。

---

### PR-3: 流水线阶段进度持久化

| 文件 | 变更 | 位置 |
|------|------|--------|
| `frontend/studio-v2/stores/useStudioStore.ts` | `saveToServer()` PUT body 增加 `executionResults.pipelineCompletedStages` | line 280-282 |
| 同上 | `loadFromServer()` 增加完成阶段恢复 | line 777-783 |
| 已有 | `updateStageStatus()` → `PUT /api/pipeline/stage/:id` (已有) | line 109-126 |

**效果**: 已完成的流水线阶段（角色设定、场景设定等）在重新打开项目后保持完成状态。

---

## 数据流

### 保存路径

```
saveToServer() 被调用
        ↓
PUT /api/v2/workbench/project/:id
  body: {
    projectName / projectDesc / script  (原有)
    executionResults: {                  (新增)
      segments: [...],                    ← PR-1
      videoStyle: "anime",               ← PR-2
      aspectRatio: "9:16",               ← PR-2
      styleLocked: false,                ← PR-2
      pipelineCompletedStages: [...],     ← PR-3
    }
  }
        ↓
Project.executionResults (JSON字段)
  存储所有新增字段
```

### 恢复路径

```
loadFromServer(projectId)
        ↓
GET /api/v2/workbench/project/:id
  (已有 include 所有关联表)
        ↓
从 p.executionResults 读取:
  segments[]           → state.workspace.segments       ← PR-1
  videoStyle           → narrative.videoStyle            ← PR-2
  aspectRatio          → narrative.aspectRatio            ← PR-2
  styleLocked          → narrative.styleLocked            ← PR-2
  pipelineCompletedStages → pipeline.stages[].status     ← PR-3
```

## 验证结果

| 检查项 | 结果 |
|--------|--------|
| `nuxt build` | ✅ 通过 |
| 无新 TypeScript 错误 | ✅ 仅预存隐式 any 警告 |
| `segments` 保存 | ✅ 写入 `executionResults.segments` |
| `segments` 恢复 | ✅ 从 `executionResults.segments` 读取 |
| `videoStyle` 保存+恢复 | ✅ 写入+读取 `executionResults.videoStyle` |
| `aspectRatio` 保存+恢复 | ✅ 写入+读取 `executionResults.aspectRatio` |
| `pipelineCompletedStages` 保存+恢复 | ✅ 写入+读取 `executionResults.pipelineCompletedStages` |

## 未来工作（非本次范围）

| 项 | 说明 |
|-----|------|
| 前端的 `saveToServer()` 自动触发 | 目前需要用户手动点击保存。后续可增加离开页面/切换阶段时自动保存 |
| `segments` 从 JSON 字段迁移到独立表 | 当前使用 `executionResults` JSON 字段。数据量增大后应迁移到独立关联表 |
| 后端 PUT 的 `analyzeV2Data` 保护已存在 | `workbench-project.ts` line 156-165 已有 `analyzeV2Data` 保护逻辑 |
