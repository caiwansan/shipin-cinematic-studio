# Session Handoff — 2026-06-24 Architecture Freeze Baseline

## 冻结生效时间
2026-06-24 20:30 CST

## 下一会话入口任务
```
TASK-WORKBENCH-PERSISTENCE-ROUNDTRIP-001
```

## 已验证事实（后续不要再回到这些问题）

| 事实 | 状态 |
|------|--------|
| `PromptTemplate → PromptRegistry → NarrativeGateway → Adapter → Model` 是唯一生产链路 | ✅ 已证实 |
| `DirectorRuntime` / `SegmentToPromptCompiler` / `ExecutionEngine` 不是生产链路 | ✅ 已冻结 |
| `shot-prompt-compiler.ts` 已删除（0 引用, 195行, 74规则） | ✅ 已清理 |
| `Storyboard` Pipeline 已恢复（可见+可达+可持久化） | ✅ 已完成 |
| `Prompt Debt` 真实比例 11% 活跃（非原判55%） | ✅ 已修正 |

## 本轮产出文件

### 审计产出
- `frontend/studio-v2/stores/state-truth-map.json`
- `frontend/studio-v2/stores/save-flow-map.md`
- `frontend/studio-v2/stores/reload-flow-map.md`

### 修复产出
- `frontend/studio-v2/stores/persistence-repair-report.md` (PR-1~PR-3)

### 规划产出
- `frontend/studio-v2/workspace/video-generation/refactor-plan.md`

## P1-D 测试准备

### 测试对象（四个修复点）
1. `workspace.segments` — 分镜段编辑数据
2. `videoStyle` — 视频风格偏好
3. `aspectRatio` — 画面比例偏好
4. `pipelineProgress` — 流水线完成状态

### 测试流程
```
1. 创建项目 → 修改四项 → 手动保存
2. 导出 before.json (state snapshots)
3. 关闭浏览器 → 重新登录 → 打开同一项目
4. 导出 after.json
5. 生成 diff.json
```

### 判定标准
```
Diff = Ø  → 通过
Diff ≠ Ø  → 失败, 定位具体未恢复字段
```

## 注意事项
- 验证前确保已有用户登录（或创建一个测试账号）
- 项目ID会实时变化, before/after 对比时需要对同一项目
- 使用浏览器 DevTools 执行 `JSON.parse(JSON.stringify(state))` 导出快照

---

## 新增待办（冻结后识别的产品问题）

### Issue 1: 角色图音色生成不可用
- **类型**: 产品功能缺陷
- **位置**: Character Design Workspace → 音色生成按钮
- **关注点**: 按钮→API→TTS Provider→落库→回显播放 链路是否正常
- **建议任务**: `TASK-VOICE-GENERATION-AUDIT-001`
- **优先级**: P1

### Issue 2: 道具设计栏目删除
- **类型**: 产品收敛
- **依据**: 道具设计不参与 Storyboard→VideoGeneration→Prompt 生产链路
- **建议任务**: `TASK-PROPS-WORKSPACE-REMOVAL-001`
- **执行顺序**: 引用图→Pipeline→Sidebar→Renderer→Store→删除
- **优先级**: P2

## 会话关闭后任务队列

```
P0    TASK-WORKBENCH-PERSISTENCE-ROUNDTRIP-001
P1    TASK-VOICE-GENERATION-AUDIT-001
P2    TASK-PROPS-WORKSPACE-REMOVAL-001
P3    VideoGenerationWorkspace Refactor
```
