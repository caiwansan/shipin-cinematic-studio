# Recovery Model（恢复模型）

> 描述 Runtime 在各类故障发生后如何恢复到一致状态。

---

## 1. 恢复层次

| 层次 | 故障类型 | 恢复机制 | 数据源 |
|------|---------|----------|--------|
| L1 | 前端刷新/崩溃 | hydratePipeline(projectId) | DB pipeline_stages |
| L2 | DB 无数据 | localStorage fallback | localStorage v3 |
| L3 | Queue / Worker 崩溃 | PM2 自动重启 + DB 恢复 | DB + Queue |
| L4 | Provider 调用失败 | Provider fallback 链 | api-router.service.ts |
| L5 | 数据库停机 | 无法恢复（需要 DB 运维） | — |

## 2. L1: 前端刷新

```
用户刷新页面
  → StudioPage.vue onMounted
  → pipelineStore.hydratePipeline(projectId)
  → GET /api/pipeline/stages/:projectId
  ├─ 200 + 数据 → 恢复 stages
  │   └─ 各 stage 展示已完成状态
  └─ 无数据 → localStorage fallback
      └─ 只恢复，不反向写 DB
```

特性：
- 刷新后进入正确的 stage（或 work-universe）
- 已完成 stage 的数据保持可见
- 运行中的 stage 需要重置

## 3. L2: DB 无数据

```
hydratePipeline(projectId)
  → DB 返回空数组
  └→ localStorage.getItem('pipeline-store-v3')
      ├─ 有数据 → 恢复 stages
      │   └─ 只读模式（不写回 DB）
      └─ 无数据 → 返回 false，用户进入初始页
```

安全规则：localStorage 数据永远不会主动写回 DB，除非：
- DB 明确为空
- 用户触发了某个操作（如"同步到云端"）
- 有版本一致性校验通过

## 4. L3: Queue/Worker 崩溃

```
PM2 自动重启 Worker
  → Worker 重新注册处理器
  → Queue 继承 Redis 中的未处理 jobs
  → Worker 继续消费队列
  └─ DB pipeline_jobs 表中状态不一致的处理：
      ├─ 运行中的 job → 超时后重新入队
      └─ 已完成的 job → 返回缓存结果
```

## 5. L4: Provider 失败

```
callProvider(provider, payload)
  ├─ 成功 → 返回结果
  └─ 失败（余额不足/403/超时）
      └→ apiRouter.selectProvider(type, payload) — 下一个
          ├─ 成功 → 返回结果
          └─ 所有 Provider 失败 → 返回最终错误
```

Provider fallback 链：
- image: 百炼 → 火山引擎 → openai → siliconflow
- tts: siliconflow → 火山引擎
- video: 火山引擎

## 6. 恢复测试方法

```
# 模拟 DB 无数据
curl -X DELETE http://localhost:4000/api/v1/pipeline/stages/:projectId

# 模拟 Provider 失败（断开网络或修改 key）
# Worker 会自动 fallback

# 模拟前端崩溃
# 关闭浏览器标签页 → 重新打开 → 验证 hydrate

# 模拟 Queue 崩溃
pm2 stop api-server && pm2 start api-server
```
