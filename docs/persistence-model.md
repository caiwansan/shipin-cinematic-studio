# Persistence Model（持久化模型）

> 描述 Runtime 中"状态如何被持久化和恢复"的完整机制。

---

## 1. 持久化层次

```
DB (PostgreSQL) — 真相源
  ├─ pipeline_stages     — Stage 状态 + output
  ├─ pipeline_jobs       — 任务执行状态
  ├─ character_images    — 角色图片
  ├─ scene_images        — 场景图片
  ├─ project             — 项目元数据
  └─ world_memory        — 世界记忆

Redis (BullMQ) — 队列临时状态
  └─ ai-runtime queue    — 等待/运行中的任务

localStorage — 前端缓存（仅 fallback）
  └─ pipeline-store-v3   — 最近的 stages 快照
```

## 2. 写入路径

### Stage 状态写入

```
setStageOutput / setStageStatus
  → persistPipeline()
     ├─ localStorage.setItem (同步，ms 级)
     └─ syncAllStagesToBackend() (异步)
         └─ PUT /api/pipeline/stage/:projectId/:stageKey
             └─ pipeline_stages.upsert
                 ├─ status, outputData, runtimeVersion
                 └─ 幂等
```

### Job / Task 写入

```
submitAiTask()
  → POST /api/v1/ai-tasks
  → Queue → Worker
  → pipeline_jobs 表（可选）
  → 结果 → 上传文件 / 更新 task status
```

## 3. 读取路径

### Stage 状态读取

```
hydratePipeline(projectId)
  → GET /api/pipeline/stages/:projectId
  └─ 后端逻辑:
      └─ prisma.pipelineStage.findMany({ where: { projectId } })
      └─ 按 STAGE_ORDER 排序返回
  ├─ 有数据 → 直接恢复 stages
  └─ 无数据 → localStorage fallback
```

### Stage 输出读取

各组件通过 `pipelineStore.stages[key].output` 读取 stage 的输出。
如果 localStorage 有数据但 DB 没有，组件读取 store 中的数据展示，
但不会反向写回 DB。

## 4. 存储格式

### pipeline_stages 表

```sql
project_id   UUID        -- 项目 ID
stage_key    String      -- character | scene | storyboard | voice | frame | director
status       String      -- pending | ready | blocked | processing | done | failed | skipped
output_data  JSON        -- stage 的输出数据
input_data   JSON        -- stage 的输入数据
reference_urls JSON     -- 参考图 URL 列表
runtime_version String  -- '0.4'
blocked_by   String      -- 阻塞依赖
error        String      -- 错误信息
started_at   DateTime
completed_at DateTime
```

### localStorage 格式（pipeline-store-v3）

```json
{
  "version": 3,
  "runtimeVersion": "0.4",
  "projectId": "...",
  "stages": {
    "story": { "status": "completed", "output": { ... } },
    "character": { "status": "completed", "output": { ... } },
    ...
  },
  "timestamp": 1700000000000
}
```

## 5. 恢复策略

| 场景 | 恢复路径 |
|------|----------|
| 页面刷新 | DB → stages 恢复 |
| DB 无数据 + localStorage 有 | localStorage fallback |
| DB 有数据 + localStorage 被清 | DB 完全恢复 |
| 浏览器切换 / 多设备 | DB 恢复（未来需一致性模型） |
| Worker 重启 | DB pipeline_stages 恢复 |
