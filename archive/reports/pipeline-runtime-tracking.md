# Pipeline Runtime Integration — 子任务跟踪

## P0（立刻）

### P0-1: StoryGraph 接入叙事 Runtime
- [ ] 确认后端 narrative 端点（POST /api/narrative/generate-story）
- [ ] StoryGraph.vue 接入 API
- [ ] 保存故事输出到 pipelineStore
- [ ] build + deploy 验证

### P0-2: VideoComposition 接入合成 Runtime
- [ ] 确认后端 composite 端点
- [ ] VideoComposition.vue 接入 API
- [ ] build + deploy 验证

### P0-3: ExportPublish 视频列表数据源
- [ ] 添加 onMounted 拉取视频列表
- [ ] 接入导出端点
- [ ] build + deploy 验证

## P1 — pipelineStore 成为 SSOT

### P1-1: pipelineStore 接管 execution 组件状态
- [ ] 改造 ComponentCreation 为 runtime consumer
- [ ] 改造 SceneGeneration 为 runtime consumer
- [ ] 改造 VoiceGeneration 为 runtime consumer
- [ ] 改造 FrameProduction 为 runtime consumer
- [ ] 改造 DirectorStudio 为 runtime consumer
- [ ] 改造 ExportPublish 为 runtime consumer

### P1-2: Stage Dependency Graph
- [ ] 定义依赖关系
- [ ] sidebar 锁定机制
- [ ] 完成自动推进

### P1-3: pipeline persist
- [ ] localStorage 持久化 pipeline 状态
- [ ] 刷新恢复

## P2

### P2-1: 统一 output 层
### P2-2: 确认其余疑为空壳模块
### P2-3: SSE 超时保护改进
