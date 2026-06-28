# VideoGenerationWorkspace 结构审计报告

## 基本信息
- **文件**: `frontend/studio-v2/workspace/video-generation/VideoGenerationWorkspace.vue`
- **大小**: 124,064 字节 (3630 行)
- **模板**: 519 行 (14.3%)
- **脚本**: 1,963 行 (54.1%)
- **样式**: 1,146 行 (31.6%)
- **函数**: 53 个

## 层分解

### 1. UI Layer（~500 行）
| 区域 | 功能 |
|------|---------|
| 片段编辑卡片 | 6 个 textarea（narrative/dialogue/effects/emotion/negativePrompt/镜头语言） |
| 角色/场景/道具参考图选择器 | 可点击的角色/场景缩略图网格 |
| 首帧/中帧/尾帧图片选择器 | 从已生成的图片中选择 |
| 帧提示词编辑区 | 每帧的 prompt + negativePrompt 编辑 |
| 视频生成控制区 | 模型选择、生成按钮、状态显示 |
| 视频合并区 | 合成按钮、进度显示 |

### 2. API Layer（20+ 端点调用）
| 端点 | 用途 |
|--------|---------|
| `POST /api/ai/optimize-video-prompt` | AI 优化视频描述 |
| `POST /api/ai/optimize-shot-script` | AI 优化镜头脚本 |
| `POST /api/ai/optimize-frame-prompt` | AI 优化帧提示词 |
| `POST /api/tasks/ai-generate` | 提交图片/视频生成任务 |
| `GET /api/tasks/:id/status` | 轮询任务状态 |
| `GET /api/tasks/:id/result` | 获取任务结果 |
| `POST /api/projects/segments/save` | 保存分段数据 |
| `GET /api/execution-images/characters/:pid` | 获取角色图片 |
| `GET /api/execution-images/scenes/:pid` | 获取场景图片 |
| `POST /api/video/merge/check/:pid` | 检查视频合并就绪状态 |
| `POST /api/video/merge/:pid` | 提交视频合并 |
| `GET /api/video/merge/status/:pid` | 轮询合并状态 |

### 3. State Layer（30+ 响应式变量）
| 变量组 | 数量 | 用途 |
|----------|-------|---------|
| `optimizedResults` | 1 | 每个片段的优化结果 |
| `segmentEditData` | 1 | 每个片段的编辑字段（5个 textarea） |
| `framePrompts` | 1 | 每帧的 prompt + negativePrompt |
| `generatedVideos` | 1 | 已生成的视频 URL |
| `frameDescriptions` | 1 | 首/中/尾帧描述 |
| `char/charImages/sceneImages/propImages` | 4 | 素材库数据 |
| `segmentCharImages/segmentSceneImages/segmentPropImages` | 3 | 每段已选素材 |
| `generating*/optimizing*/preview*` | ~10 | 各种加载/预览状态 |
| 其他 | ~10 | 模型选择、索引控制等 |

### 4. Store Layer
| 来源 | 耦合强度 |
|--------|----------------|
| `useStudioStore` | 强依赖: `state.workspace.segments`, `state.workspace.characters/scenes`, `state.workspace.narrative` 等 |
| `useSegmentRuntime` | **Director 耦合点**: 导入自 `workspace/director/useSegmentRuntime.ts` |

### 5. Prompt/Agent Layer
| 功能 | 实现方式 |
|--------|-------------|
| 视频描述优化 | fetch → `/api/ai/optimize-video-prompt` → 解析响应 → 回填编辑框 |
| 帧描述优化 | fetch → `/api/ai/optimize-frame-prompt` → 解析 JSON → 回填 |
| 图片生成 | fetch → `/api/tasks/ai-generate` → 轮询 → 显示结果 |
| 视频生成 | fetch → `/api/tasks/ai-generate` → 轮询 → 显示结果 |
| 视频合并 | fetch → 检查就绪 → 提交合并 → 轮询 → 显示结果 |

## 关键依赖耦合分析

```
VideoGenerationWorkspace (124KB)
  ├── useStudioStore (store 层) — 强 ✅
  ├── useSegmentRuntime (director/) — 弱 ✅
  │     └── SegmentRuntime types — 仅类型引用
  │     └── createEmptySegment — 仅工具函数
  │     └── TimelineFrame — 仅类型引用
  ├── DirectorAgent — ❌ 无直接引用
  ├── ExecutionEngine — ❌ 无直接引用
  ├── SegmentToPromptCompiler — ❌ 无直接引用
  └── shot-prompt-compiler — ❌ 无引用 (已删除)
```

## 重构建议

### 1. 拆分离: Store Layer → composable
`useVideoGeneration.ts` — 抽取 30+ 响应式状态 + 53 个函数中与 store 交互的部分

### 2. 拆分 API Layer → service
`video-generation-api.ts` — 抽取 20+ 个 fetch 调用为独立 API 服务

### 3. 保留的 Director 耦合
`useSegmentRuntime` 是弱耦合（仅类型 + 工具函数），无需为解耦而移动。但 `useSegmentRuntime` 物理位置在 `director/` 目录下容易引起误判，建议复制一份到 `video-generation/`。

### 4. 重构后文件结构建议
```
frontend/studio-v2/workspace/video-generation/
├── VideoGenerationWorkspace.vue  (UI ~500行)
├── useVideoGeneration.ts         (Store 层 ~500行)  
├── video-generation-api.ts       (API 层 ~300行)
└── refactor-plan.md
```

### 5. 当前耦合结论
VideoGenerationWorkspace 虽然 124KB，但其 **Director 的耦合是弱耦合**。它不调用 DirectorAgent/ExecutionEngine/SegmentToPromptCompiler 中任何一个。代码膨胀的原因是**职责过多**（视频描述编辑、帧图生成、视频生成、合并、素材管理全部塞在一个文件里），不是因为架构错误。
