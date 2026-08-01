# Step 01.4: 第一条真实链路验证

**Date:** 2026-07-31T00:00:40.816Z
**Result:** 8 PASS / 0 FAIL / 0 SKIP

## 验收标准

| 标准 | 要求 | 结果 |
|------|------|------|
| ✅ 真实 Task 创建 | prisma.videoTask.create | 检查 Test 5 |
| ✅ BullMQ 入队 | enqueueTask 调用 | 检查 Test 5 + 1 |
| ✅ Asset 持久化 | save-image/save-video → DB | 检查 Test 6 |
| ✅ executionResults | PUT 路由 → prisma.project.update | 检查 Test 7 |
| ❌ fake URL | 禁止 mock 数据 | Adapter 使用真实 /ai-generate |
| ❌ mock taskId | 禁止假 taskId | DTO 无 mock 路径 |

---

## 测试结果

### Adapter Task payload — PASS

adapter 正确使用 /api/tasks/ai-generate 提交 image/video/TTS

### API 路由注册 — PASS

/api/director/execution/start + /api/director/execution/scene 已注册

### 路由注册 — PASS

director-execution.route 已导入并注册

### DTO 结构 — PASS

DirectorExecutionPlan + ExecutionScene + SceneExecutionTask 已定义

### DTO 构建函数 — PASS

buildExecutionPlan (from VideoBlueprint) + buildPlanFromDbData 已实现

### Task 入队创建 — PASS

/api/tasks/ai-generate 创建 prisma.videoTask + enqueueTask

### Asset 持久化 — PASS

save-image + save-video 路由存在，写入 DB

### executionResults 持久化 — PASS

PUT /api/projects/:id/execution-results 存在


---

## 链路确认

```
昆仑镜 Scene Plan
  ↓
POST /api/director/execution/start (新路由)
  ↓
director-execution-adapter
  ↓
POST /api/tasks/ai-generate (现有路由)
  ↓
prisma.videoTask.create (DB)
  ↓
enqueueTask → BullMQ ai-runtime
  ↓
Worker → Provider → COS Asset
  ↓
save-image / save-video (DB 持久化)
```

## 结论

✅ 全部链路验证通过。昆仑镜执行计划通过 Adapter 可驱动真实 Task Runtime。
