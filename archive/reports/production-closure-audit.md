# Production Closure Audit — 火麒麟 AI 短剧生产闭环验收

**审计时间**: 2026-05-14 23:10 CST
**审计范围**: frontend → backend → runtime → storage → export 全链路
**测试数据**: "未来赛博城市中的失忆女警察发现自己其实是AI人格备份"

---

## 1. 系统真实成熟度

**评级: Prototype → Minimal Alpha Production（混合态）**

具体分类:

| 层 | 成熟度 | 说明 |
|----|--------|------|
| Pipeline UI | Demo | 侧栏按钮全但无流程强制顺序 |
| Inspiration Input | Alpha Production | 有真实 API 调用、项目创建、AIGC Spec 保存 |
| Story/Graph | Demo | StoryGraph 组件存在，但无 API 调用(零帧交互) |
| Character Creation | Alpha | 有 API 调用、图片生成、保存、DB 持久化 |
| Scene Generation | Alpha | 同上 |
| Storyboard Production | Alpha | 有 API、DB 存储 |
| Voice Generation | Alpha | 有 API、DB 存储 |
| Frame Production | Alpha | 有 API、DB 存储 |
| Director Studio | Alpha | 有 API、DB 存储 |
| Video Composition | **Demo/空壳** | 组件存在、Template 渲染，**零 API 调用、零业务逻辑** |
| Export Publish | Alpha | 有完整的后端导出服务(collect→package→upload→DB) |
| Job Queue | Production Ready | BullMQ + Redis，重试、backoff、TTL |
| Export Runtime | Alpha | 有完整 collect→zip→store→manifest 管线 |
| Auth | Production Ready | JWT + Pinia store + localStorage persist |
| Hydration Store | Alpha | unified Single Source of Truth，but 接入不完全 |
| SSE/Runtime | Alpha | 存在 SSE 端点 + EventEmitter 转发 |
| State Recovery | **Prototype** | 仅 auth token persist，pipeline/execution 状态不恢复 |

---

## 2. TOP 10 断裂点（按严重度排序）

### 🔴 CRITICAL

#### 1. `StoryGraph.vue` — 零网络交互（纯 UI 空壳）
- 文件 455 行，`grep fetch/api/http` 零结果
- NarratveCanvas 也未连接到后端
- **断裂**: 输入灵感 → 故事生成 → 下一步角色创作的依赖链完全断裂
- **影响**: 用户填写「灵感」后无法真正生成故事骨架

#### 2. `VideoComposition.vue` — 零网络交互（纯 UI 空壳）
- `grep fetch/api/http` 零结果
- 视频合成环节依赖的 `composite` 模块无后端端点映射
- **断裂**: DirectorStudio 生成视频片段后 → 合成完整视频的关键步骤不可执行

#### 3. 工作流无流程强制（用户可任意跳转）
- `activeModule` 仅靠 `selectModule()` 切换，无依赖检查
- 用户可以在未完成角色创建的情况下直接跳转到「生成视频」
- 无 stage-validation 层，每个步骤不知道自己处于流水线的第几步
- **断裂**: 没有「上一步完成才能下一步」的自动约束

#### 4. 状态恢复机制不完整
- 刷新页面后：auth restored ✅、project hydration store 已实现 ✅
- 但 pipelineStore 不持久化（刷新后回到 idle）
- execution 子组件各自从 `localStorage.getItem('current_project_id')` 读项目 ID
- hydration store 的 `hydrateProject` 需手动调用，各组件各自独立加载
- **断裂**: 刷新后 pipeline 进度丢失、组件需重新初始化，无统一恢复入口

#### 5. Export 有后端但前端 videos 数据源不明
- `ExportPublish.vue` 的 `videos` list 是 `ref<VideoItem[]>([])`，初始为空
- 无 `onMounted` 时 load 数据的逻辑（缺少 `fetch('/api/export/video-list')`）
- **断裂**: 用户进入导出页面时看不到任何可导出的视频，只有空状态

### 🟠 HIGH

#### 6. 多源状态冲突
- `projectHydrationStore` 声称是 Single Source of Truth
- 但 execution 子组件通过 `localStorage.getItem('current_project_id')` 独立读取
- `frameKeyResults/segmentLoading/videoResults` 等执行状态存在多份独立副本
- **断裂**: 刷新或路由切换后各组件状态不一致

#### 7. 数据依赖链无类型安全传递
- Inspiration → Character → Scene → Storyboard → Voice → Frame → Director 每一步
- 输出格式没有在 type level 定义依赖关系
- `executionResults` 字段存储 JSON blob（any），无 schema 验证
- **断裂**: 任何 API 格式变更导致下游静默崩溃

#### 8. SSE/Polling 双路线但无超时保护
- ExportPublish downloadVideo 中同时使用 SSE + polling
- 但 `polling` interval **永不停止**（除非 completed/failed）
- 如果 EventSource 断连且 polling API 返回 pending 无限循环
- **风险**: zombie polling connection

### 🟡 MEDIUM

#### 9. 大量已归档 composable 残留引用（3 个已修复，可能还有更多）
- 已发现 `segmentLoading/frameKeyResults/frameLoading/videoResults/videoLoading` 5 个未定义变量
- 从 archive 恢复的 `WorkUniverse.vue` 和 `MusicFactory.vue` 可能还有其他引用
- **风险**: 子组件在 archive sessions 中，新 ref 声明只是临时填补

#### 10. pipelineStore 与 execution 组件完全脱节
- `pipelineStore.ts` 定义了完整的 6 阶段状态机（planning→generating→rendering→compositing→exporting）
- 但 execution 组件完全不知道 pipeline 的存在
- `advanceTo/setProgress/completeStage` 从未被任何组件调用
- **断裂**: pipelineStore 是"孤岛"，没有驱动任何实际流程

---

## 3. "假闭环"模块清单

| 模块 | 状态 | 理由 |
|------|------|------|
| **StoryGraph** | 🚫 空壳 | 0 网络调用，仅 UI layout |
| **NarrativeCanvas** | 🚫 空壳 | 只是 StoryGraph 的容器 |
| **VideoComposition** | 🚫 空壳 | 0 网络调用，无业务逻辑 |
| **CostumeSystem** | ⚠️ 未确认 | 未深入审查，有 API 调用可能性低 |
| **CivilizationPanel** | ⚠️ 未确认 | 疑为旧 OMS 关联组件 |
| **DramaStudio** | ⚠️ 未确认 | 名字暗示旧 rendering 系统 |
| **AnalyticsCenter** | ✅ 可能真实 | 需进一步审查 |
| **MusicFactory** | ⚠️ 未确认 | 刚从 archive 恢复 |
| **PreviewPublishStudio** | ⚠️ 未确认 | 疑为旧 publish UI |
| **AgentCenter** | ⚠️ 未确认 | 名字暗示旧 agent 模块 |
| **UniverseEngineV4** | ⚠️ 未确认 | 宇宙控制室，需要审查 |
| **SeriesIntelligenceDashboard** | ⚠️ 未确认 | 批量分析模块 |

---

## 4. Runtime 架构评分

| 维度 | 评分 (1-10) | 说明 |
|------|-------------|------|
| 状态一致性 | **4/10** | 多源冲突，store 和 localStorage 混用 |
| 恢复能力 | **3/10** | 仅 auth 可恢复，pipeline/execution 不可恢复 |
| 调度能力 | **7/10** | BullMQ 队列完善，但前端未接入 queue status |
| 扩展能力 | **6/10** | 后端架构支持横向扩展，前端仍是单体 SPA |
| 并行能力 | **5/10** | 后端 worker 可并行，但前端无并行流程编排 |
| 导出能力 | **6/10** | 后端 export-runtime 完整，但前端导出 UI 数据源断裂 |

**总分**: 31/60 (**零星级 Alpha**)

---

## 5. 真实结论

### 是否已具备"AI短剧工业生产系统"雏形？

**部分具备，但不足以称为"生产系统"。**

### 已经真正具备的：
1. ✅ **后端工厂管线**: BullMQ 队列 + Worker + 重试 + 超时 + fallback
2. ✅ **导出管线**: collectAssets → buildPackage → store → manifest
3. ✅ **Prisma Schema 完整**: Project→AiCharacterSpec→AiSceneSpec→VideoTask→ExportTask
4. ✅ **Auth+BYOK**: 用户认证 + 私有 API Key 注入
5. ✅ **showrunner worker**: Narrative Understanding → Emotional Engine → Blueprint → Strategy → Orchestration
6. ✅ **hydration store**: unified 项目数据加载

### 最关键的两个断裂点必须修复才能称为"生产系统"：

1. **StoryGraph/VideoComposition 空壳** — 一个在入口端（无法生成故事骨架），一个在出口端（无法合成视频），中间再强也没用
2. **无流程编排** — 用户可以点任何按钮，但系统不会阻止 AI 在"无角色设定"时生成角色图片（会出假图或报错）

### 建议的 Phase A 收尾工作顺序：

```
P0: StoryGraph 接入后端 API（故事生成端断裂修复）
P0: VideoComposition 接入后端 API（视频合成端断裂修复）
P0: ExportPublish onMounted 拉取 video list（导出数据源修复）
P1: pipelineStore 接入 execution 组件（流程强制 + 进度跟踪）
P1: 页面刷新恢复当前工作流状态（localStorage persist pipeline store）
P2: 删除或确认其余"疑为空壳"模块
P2: 统一 hydration store 为所有组件的唯一数据源
P3: SSE 超时保护 + polling 终止条件改进
```
