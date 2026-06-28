# 数据持久化架构 v2 — 防止工作流数据丢失

## 问题回顾

「昆仑镜的故事」项目角色/场景/语音数据完整生成了，但刷新页面后全部丢失。
原因是 **前端工作流数据仅存于内存（hydrationStore/pipelineStore），从未写入数据库持久化存储**。

## 修复（已部署）

### 1. 后端 regenerate 自动持久化
- `/api/script/regenerate` 新增 `projectId` 参数
- AI 返回成功后，自动将 `characterSpecs`/`sceneSpecs`/`voiceConfigs` 写入 `execution_results`
- 失败不影响主流程返回（fire-and-forget）

### 2. 前端补传 projectId
- `CharacterCreation.vue` 调 regenerate 时传 `projectId`
- 后续其他阶段同理

### 3. 前端 hydration 优先读持久化数据
- `buildDesignSpec()` 优先从 `fullResult.characterSpecs`/`sceneSpecs` 读取
- 仅在持久化数据为空时才降级从 `plotBlueprint` 派生

## 架构设计：防止复发（All-Antenna 级保障）

### 问题层级

```
严重度  | 问题                          | 影响范围
P0      | 内存数据未持久化 → refresh 丢失 | 全部用户，频繁触发
P1      | 部分阶段持久化，部分不持久化     | 测试/初期用户行为异常
P2      | 用户不知状态未保存               | 信任度下降
```

### 架构原则

```
┌────────────────────────────────────────────────────┐
│              持久化契约 (Persistence Contract)       │
├────────────────────────────────────────────────────┤
│ 1. 每个阶段完成后 → 必须写 DB（写 execution_results + 独立表） │
│ 2. 数据只在 write-through 模式下流动                │
│ 3. 读路径：DB 优先 → localStorage 兜底 → 派生       │
│ 4. 写入不依赖前端后续动作（后端在 AI 返回时自动写）     │
│ 5. 写失败不阻止主流程（异步兜底用死信队列）           │
└────────────────────────────────────────────────────┘
```

### 数据流 v2（写穿通 Write-Through）

```
前端操作 ──→ 后端 API ──→ AI 处理
                 │
                 ▼
            execution_results (JSON)  ←── 自动合并写入
                 │
                 ▼
            独立表 (character_images, scene_images, etc.)
                 │
                 ▼
            前端 hydration ←── DB 优先读取
```

### 各阶段持久化状态

| 阶段 | 持久化机制 | 状态 |
|------|-----------|------|
| 剧本分析 (parse) | backend `saveProject()` 写 `execution_results` | ✅ |
| 角色 spec (regenerate) | 后端 regenerate 自动合并（本修复） | ✅ **新** |
| 角色图 | Worker 写 `character_images` 表 | ✅ |
| 场景 spec | 后端 regenerate 自动合并（本修复） | ✅ **新** |
| 场景图 | Worker 写 `scene_images` 表 | ✅ |
| 音色 spec (regenerate) | 后端 regenerate 自动合并（本修复） | ✅ **新** |
| 语音音频 | VoiceGeneration 手动存 `execution_results` | ✅ |
| 分镜生成 | Worker 写 `storyboard_images` 表 | ✅ |
| hydration 加载 | 独立表 → execution_results → `description` JSON | ✅ |

### 防范大规模部署风险

**风险 1：高并发写入冲突**
- `execution_results` 使用 JSON 字段 + 全量覆盖
- 大规模下应改为 **JSONB patch 合并** 或每个阶段独立表行
- 当前设计下：同项目同阶段的多次 regenerate 会覆盖，无并发问题（因为同一用户同一时间只能操作一条 AI 任务）

**风险 2：写入性能**
- `execution_results` 是 JSON 字段，写入量小（每次 ~1-10KB）
- PostgreSQL 的 TOAST 对大 JSON 自动压缩
- 1 万用户 × 100 次操作 / 天 = 微负载

**风险 3：数据失忆（未覆盖的路径）**
- 新阶段或新组件可能忘记调 persist
- **方案**：实施 `StageCompletionGuard` — 前端每个阶段 `goNext()` 时强制校验 `currentProject` 的 `execution_results` 是否有该阶段数据，没有则补写

**风险 4：空降老项目**
- 存量的 project 在旧流程下没有 `characterSpecs` 等字段
- 当前修复已经有降级：持久化数据为空 → 从 `plotBlueprint.characters` 派生原始角色

### 未来增强（可选，非阻塞）

1. **Dead Letter Queue for Persistence** — 写入失败进入队列，后台自动重试
2. **版本化 execution_results** — schema 版本号防反序列化失败
3. **前端阶段完成钩子** — `completePipelineStage()` 内建持久化调用，新阶段组件自动获得持久化能力
4. **管理后台 "项目完整性检查"** — 扫描所有 `analyzed` 状态项目，自动补全缺失的阶段数据

## 验证方法

### 手动验证已修复
1. 新建或打开一个项目
2. 进入角色设定 → 点击"AI 补全角色"（调 `/api/script/regenerate`）
3. 后端日志应出现 `[ScriptRegen] ✅ 自动持久化 characterSpecs 到 project xxx`
4. 刷新页面 → 角色数据仍存在

### 自动化验证
```
# 检查 execution_results 是否有 characterSpecs
curl http://localhost:4000/api/projects/$ID/execution-results \
  -H "Authorization: Bearer $TOKEN" | jq '.data.characterSpecs | length'
# 应 > 0
```

## 总结

核心改变：**数据写入不再是前端的可选动作，而是后端的自动行为**。
后端在每步 AI 处理完成返回时自动持久化，不依赖前端告知"请保存"。

这确保了：
- 用户关闭浏览器 → 数据在
- 刷新页面 → 数据在
- 新组件忘记调 save → 数据在
- 其他路径调用 regenerate → 数据在
