# WORKSPACE-DOMAIN-MATRIX.md

> **状态：冻结 — 实施过程中禁止变更**
> **创建：2026-07-21 | CTO 批准：STUDIO-ARCH-03**

---

## 一、能力归属矩阵（冻结）

| 能力 | 归属 | 模型/模块 | 变更限制 |
|------|------|-----------|----------|
| **Project 项目管理** | Core | `Project` | 禁止按领域拆分 |
| **CreativeBrief 创意输入** | Core | `CreativeBrief` | 禁止新增列，领域字段走 JSON |
| **ProductionPlan 制作方案** | Core | `ProductionPlan` | 禁止按领域拆分 |
| **Asset 资产管理** | Core | `Asset` | 禁止按领域拆分 |
| **VideoTask 视频任务** | Core | `VideoTask` | 禁止按领域拆分 |
| **Task Queue 任务队列** | Core | `pipeline-jobs.ts` | 禁止复制 |
| **NarrativeGateway AI网关** | Core | `narrative-gateway.ts` | 禁止按领域复制 |
| **Model Router 模型路由** | Core | `ai-router.service.ts` | 禁止拆分 |
| **Cost Engine 成本计算** | Core | `AiModel` 定价 | 禁止按领域复制 |
| **Team/团队协作** | Core | `StudioProjectMember` | 禁止按领域复制 |
| **RBAC 权限** | Core | `authorizeProjectOwner` | 禁止新建第二套 |
| **Export 导出** | Core | `StudioExport` | 禁止按领域复制 |

---

## 二、领域专属能力（按 Workspace 归属）

### 🎬 短剧工作台 (SHORT_DRAMA / SHORT_VIDEO)

| 能力 | 归属模块 | 状态 |
|------|----------|------|
| Stage 序列: script→character→scene→storyboard→video→music→final | `workspace-config.ts` | ✅ |
| episodeCount / sceneCount / shotCount | `ProductionPlan` 字段 | ✅ |
| 多角色/多场景 AI prompt | `workspace-config.ts` | ✅ |
| Director Progress（7阶段映射） | `DirectorProgress.vue` | ✅ |

### 🎵 音乐工作台 (MUSIC / MV)

| 能力 | 归属模块 | 状态 |
|------|----------|------|
| Stage 序列: music-generation | `workspace-config.ts` | 🆕 |
| style / mood / bpm / instruments / lyrics | `CreativeBrief.creativeParams` JSON | 🆕 |
| 歌词→音乐 两阶段 | `MusicGenerationWorkspace.vue` | ✅ 已有 |
| Suno/Mureka/Music15 提供商 | `/api/music/generate` | ✅ 已有 |

### 📢 广告工作台 (AD)

| 能力 | 归属模块 | 状态 |
|------|----------|------|
| Stage 序列: storyboard→video-generation | `workspace-config.ts` | 🆕 |
| script / aspectRatio / shotCount / totalTime | `CreativeBrief.creativeParams` JSON | 🆕 |
| 脚本优化→分镜→视频 三阶段 | `AdvertisementWorkspace.vue` | ✅ 已有 |
| 品牌资产/商品/营销 | v0.2+ 预留 | ⏳ |

---

## 三、数据模型边界（冻结）

### 3.1 禁止新增模型

不建 `MusicProject`, `AdProject`, `MusicAsset`, `AdAsset` 等。所有领域复用 Core 模型。

### 3.2 CreativeBrief 字段冻结

```
已存字段（禁止删除/改类型）：
  id, projectId, userId, raw_input, genre, target_audience, duration,
  style, ai_summary, ai_raw_output, created_at

新增 JSON 扩展（唯一允许的扩展点）：
  creativeParams Json?
    音乐: { mood, bpm, instruments: [] }
    广告: { aspectRatio, shotCount }
    短剧: { episodeCount, sceneCount }

禁止：新增 mood / bpm / instruments 等独立列
```

### 3.3 ProductionPlan 字段冻结

```
已存字段（禁止删除/改类型）：
  id, projectId, brief_id, plan_data, episode_count, scene_count,
  shot_count, estimated_cost, project_name, project_type, created_at, updated_at

领域差异通过 plan_data JSON 承载
禁止：新增 music_tracks / ad_shots 等独立列
```

---

## 四、路由冻结

### 4.1 当前路由（禁止删除）

| 路径 | 工作台 | 状态 |
|------|--------|------|
| `/studio/v2` | 短剧 | ✅ 保持 |

### 4.2 新增路由（批准）

| 路径 | 工作台 | 状态 |
|------|--------|------|
| `/workspace/music` | 音乐 | 🆕 启用 |
| `/workspace/ad-create` | 广告 | 🆕 启用 |
| `/workspace/:type/:projectId` | 统一入口 | 🆕 未来 |

---

## 五、实施禁止清单

| 禁止项 | 原因 |
|--------|------|
| ❌ 新建 `MusicPipeline`, `AdPipeline` | 复用 Core Pipeline |
| ❌ 添加 `creative_briefs.music_params` 列 | 走 JSON `creativeParams` |
| ❌ 新建 `MusicAsset`, `AdAsset` 表 | 复用 Core `Asset` |
| ❌ 复制 `StudioExport` 为 `MusicExport` | 复用 Core Export |
| ❌ 新建领域权限中间件 | 复用 `authorizeProjectOwner` |
| ❌ 按领域拆分 Model Router | 复用统一 Model Router |
| ❌ 复制 `CostCenter.vue` 为 `MusicCostCenter` | 复用 Core 成本引擎 |
| ❌ 新增 `MusicProjectMember` 表 | 复用 `StudioProjectMember` |

---

## 六、允许清单

| 允许项 | 文件 |
|--------|------|
| ✅ `workspace-config.ts` 领域配置 | 新建 |
| ✅ `WorkspaceShell.vue` 布局选择器 | 新建 |
| ✅ `MusicWorkspaceLayout.vue` 音乐布局 | 新建 |
| ✅ `AdWorkspaceLayout.vue` 广告布局 | 新建 |
| ✅ `/workspace/music.vue` 页面 | 新建 |
| ✅ `workspace/ad-create.vue` 页面 | 新建 |
| ✅ 导航栏解除 disabled | 修改 |
| ✅ `CreativeWorkflowResolver` | 新建（Phase 3） |
| ✅ `CreativeBrief.creativeParams` JSON | 扩展列（Prisma） |

---

## 七、扩展性预留

未来增加新领域时，仅需：

1. 在 `workspace-config.ts` 添加新配置条目
2. 新建一个 Layout 包装器
3. 新页面使用 `WorkspaceShell`
4. **零 Core 变更**

```
v0.1: 短剧 + 音乐 + 广告
v0.2: + 游戏视频 + 课程视频 + 动画
  → 全部复用 Core，零新模型
```

---

> **本文件一经冻结，任何实施变更必须更新此 Matrix 并重新审批。**
