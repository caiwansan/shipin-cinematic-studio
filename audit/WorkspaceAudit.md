# Audit H: Workspace 审计 (WorkspaceAudit.md)

## 1. 工作台 (Workbench/Workspace) 清单

昆仑镜系统存在 **5 个独立工作台实现**:

### 1.1 HDZ 小说工作台

| 属性 | 值 |
|------|-----|
| 路由 | `/hdz/workspace/[id]` |
| 页面 | `frontend/pages/hdz/workspace/[id].vue` |
| 组件 | `frontend/components/hdz/` |
| 后端 | `backend/src/routes/hdz/` |
| 模型 | HdzProject, HdzChapter, HdzCharacter, HdzManuscript, HdzOutline etc. |

### 1.2 Studio-V2 工作台

| 属性 | 值 |
|------|-----|
| 位置 | `frontend/studio-v2/` |
| 子工作台 | advertisement, brand-geo, character-design, director, director-workbench, dubbing-render, final-render, music-generation, scene-design, script-analysis, storyboard, video-editor, video-generation |
| 后端服务 | `backend/src/services/` |
| 状态管理 | `frontend/studio-v2/stores/` + `composables/` |

### 1.3 GEO 工作台 (现行)

| 属性 | 值 |
|------|-----|
| 路由 | `/workspace/geo/` |
| 位置 | `frontend/workspaces/geo/` |
| 子模块 | BrandOverview, HealthPage, RecommendationsPage, DiscoveryPage, MissionControl, etc. |
| 后端 | `backend/src/services/geo/` |
| 状态管理 | 15 Pinia stores (useAdiStore, useDiscoveryStore etc.) |

### 1.4 Legacy Brand-GEO 工作台 (废弃)

| 属性 | 值 |
|------|-----|
| 位置 | `frontend/legacy/brand-geo/` |
| 状态 | 废弃但仍被引用 |
| 引用位置 | `frontend/legacy/brand-geo/BrandGEOWorkspace.vue` |

### 1.5 Legacy Brand-GEO V2 工作台 (部分废弃)

| 属性 | 值 |
|------|-----|
| 位置 | `frontend/legacy/brand-geo-v2/` |
| 状态 | 部分废弃 |
| 组件 | GeoPublish.vue, GeoWorkspaceV1.vue, composables |

## 2. Project/Task/Asset/Execution/Workflow 统一性

### 2.1 Project 模型碎片化

| 工作台 | Project 模型 | 表名 |
|--------|-------------|------|
| HDZ | `HdzProject` | hdz_project |
| GEO | `GeoProject` / `GEOProject` | geo_project |
| 通用 | `Project` | project |
| Studio | `Workflow` | workflow |
| 创作 | `DAGGraph` | dag_graph |

**问题**: 5 个不同的 Project 相关模型，无继承/关联关系。

### 2.2 Task/Execution 模型碎片化

| 工作台 | Task 模型 | Execution 模型 |
|--------|-----------|----------------|
| 通用 | `Task`, `TaskQueue` | `TaskExecution` |
| HDZ | `HdzAgentTask` | — |
| GEO | `GEOActionPlan` | `OptimizationExecution` |
| Platform | `WorkflowExecution` | — |
| Queue | `JobQueue` | — |

### 2.3 Asset 模型碎片化

| 工作台 | Asset 模型 |
|--------|-----------|
| 通用 | `Asset`, `UnifiedAsset`, `UserAsset` |
| 项目 | `WorkspaceAsset` |
| HDZ | — (直接在 Hdz 模型存储) |
| GEO | — (直接引用外部 URL) |
| Media | `VideoSegment`, `SceneImage`, `StoryboardImage`, `FrameImage` |

## 3. 工作台重复功能

| 功能 | 实现数量 | 工作台 |
|------|---------|--------|
| 项目管理 | 5 | 所有工作台 |
| Task 管理 | 4 | 通用/HDZ/GEO/Platform |
| 状态管理 (Store) | 5 | 每个工作台独立 |
| 自动保存 | 3 | Studio/GEO/Platform |
| 版本管理 | 3 | Studio/GEO/Platform |
| 导出/发布 | 4 | HDZ/Studio/GEO/Platform |
| AI 生成 | 4 | HDZ/Studio/GEO/Platform |

## 4. 建议

1. **统一 Project 模型**: 所有工作台使用统一的 `Project` 模型 + `type` 字段区分
2. **统一 Task 管理**: 使用 `platform/workflow` 作为统一调度层
3. **统一 Asset 管理**: 使用 `UnifiedAsset` 作为唯一资产模型
4. **治理现存遗留**: 删除 `legacy/brand-geo` 和 `legacy/brand-geo-v2`
5. **工作台插件化**: 将不同工作台作为插件注册到统一 Workbench 框架
