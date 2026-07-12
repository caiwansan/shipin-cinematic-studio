# Audit O: 性能审计 (PerformanceAudit.md)

## 1. N+1 查询检测

### 1.1 循环中的数据库查询

| 文件 | 行号 | 模式 | 风险 |
|------|------|------|------|
| `services/geo/services/geo-report-v2.service.ts` | 396 | `for...of` 循环 | MEDIUM |
| `services/geo/runtime/golden/scenario-resolver.ts` | 8 | `for...of` 循环 | MEDIUM |
| `services/geo/verification/verification.repository.ts` | 159 | 循环查 DB | HIGH |
| `routes/pipeline.ts` | 169-178 | 4次顺序查询 | MEDIUM |

### 1.2 顺序查询可合并

| 文件 | 行号 | 查询 | 优化建议 |
|------|------|------|---------|
| `routes/pipeline.ts:169-178` | 4次 findMany | 用 Promise.all 并行化 |
| `routes/admin-prompt-telemetry.ts:160-163` | 2次 findMany | Promise.all |
| `routes/sms-auth.ts:186-208` | 连续 findFirst | 单条查询 |

## 2. 重复请求

### 2.1 前端重复 API 调用

| 页面 | API 调用 | 频率 |
|------|---------|------|
| `BrandOverview.vue` | `/api/geo/brands/:id/*` 连续6次 | 页面加载时 |
| `HealthPage.vue` | 多个独立 fetch | 页面加载时 |
| `pages/community/index.vue` | 列表查询 | 每页 |

### 2.2 无缓存策略

| 数据 | 缓存策略 | 问题 |
|------|---------|------|
| Project 列表 | 无缓存 | 每次页面加载请求 |
| AI 模型列表 | 无缓存 | 频繁请求 |
| 用户信息 | 内存缓存 | 刷新后重新请求 |
| 会员信息 | 无缓存 | 每次页面加载请求 |

## 3. 冗余调用

### 3.1 不必要的数据查询

| 位置 | 问题 |
|------|------|
| `routes/projects.ts` | 可能查询不需要的字段 |
| `routes/scenes.ts` | 可能查询全部场景而非分页 |

### 3.2 无分页的查询

| 文件 | 表 | 查询方式 | 风险 |
|------|-----|---------|------|
| `routes/scenes.ts` | SceneImage | findMany 无 take | 全表扫描 |
| `routes/projects.ts` | Project | findMany 无 take | 全表扫描 |
| `routes/asset/` | Asset | 可能无分页 | 全表扫描 |

## 4. 数据库性能 (无索引)

### 4.1 全表扫描

因为所有 324 个表均无自定义索引:
- 任何 `WHERE email = ?` → 全表扫描
- 任何 `ORDER BY createdAt` → 全表扫描
- 任何 `WHERE userId = ?` → 全表扫描

此问题在 DatabaseAudit 中详细说明，但对性能影响是全局性的。

## 5. Redis 使用

### 5.1 Redis 连接管理

| 实例 | 文件 | 池化 |
|------|------|------|
| Queue Redis | `queue/redis.ts` | 单例 |
| State Redis | `utils/redis-state.ts` | 单例 |

两个独立 Redis 客户端未共享连接池。

### 5.2 Redis 缓存使用不足

当前 Redis 主要用于:
- BullMQ 队列
- 分布式状态

未使用 Redis 作为:
- 查询缓存 (DB 查询结果缓存)
- API 响应缓存
- Session 存储

## 6. 建议

1. **索引加全**: 所有外键和查询字段加索引 (参见 DatabaseAudit)
2. **N+1 消除**: 循环中查询改为批量查询或 JOIN
3. **前端请求合并**: 批量请求使用 `Promise.all` 合并
4. **添加缓存**: 
   - Redis 缓存常用查询
   - 前端缓存组件数据
5. **分页强制**: 所有 `findMany` 添加 `take`/`skip`
6. **DB 连接池优化**: 配置合适的连接池大小
