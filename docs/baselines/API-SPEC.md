# 昆仑镜 V4 API 规范

> **版本**: v1.0 · **状态**: 架构基线 (C0) · **日期**: 2026-07-18
> **范围**: 所有 HTTP API 必须遵循本规范，包括所有现有和未来的 Workspace 路由

---

## 1. 统一响应格式

所有 API 响应必须遵循统一的 `ApiResponse` 格式：

```typescript
// @studio/platform/api/response
export interface ApiResponse<T = unknown> {
  /** 请求是否成功 */
  success: boolean

  /** 响应数据（success=true 时必有） */
  data?: T

  /** 错误信息（success=false 时必有） */
  error?: ApiError

  /** 分布式追踪 ID */
  traceId: string

  /** 响应时间戳（ISO 8601） */
  timestamp: string

  /** API 版本 */
  version: string
}

export interface ApiError {
  /** 错误代码 */
  code: string

  /** 人类可读的错误消息 */
  message: string

  /** 详细的错误信息（可用于调试） */
  details?: unknown

  /** 验证错误明细（ValidationError 时使用） */
  validation?: ValidationDetail[]
}

export interface ValidationDetail {
  field: string
  message: string
  code: string
  value?: unknown
}
```

### 1.1 成功响应示例

```json
{
  "success": true,
  "data": {
    "id": "proj-123",
    "name": "品牌分析项目",
    "type": "geo",
    "status": "active"
  },
  "traceId": "trace-abc-123",
  "timestamp": "2026-07-18T10:00:00.000Z",
  "version": "1.0"
}
```

### 1.2 错误响应示例

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请求参数校验失败",
    "validation": [
      {
        "field": "name",
        "message": "项目名称不能为空",
        "code": "REQUIRED"
      }
    ]
  },
  "traceId": "trace-def-456",
  "timestamp": "2026-07-18T10:00:01.000Z",
  "version": "1.0"
}
```

---

## 2. 标准 HTTP 方法

| 方法 | 用途 | 幂等 | 请求体 | 响应 |
|------|------|------|--------|------|
| **GET** | 查询资源 | ✅ | 否 | 200 OK |
| **POST** | 创建资源 | ❌ | 是 | 201 Created |
| **PATCH** | 部分更新资源 | ❌ | 是 | 200 OK |
| **DELETE** | 删除资源 | ✅ | 否 | 204 No Content |
| PUT | 全量替换资源 | ✅ | 是 | 200 OK |

**规则：**
- 优先使用 PATCH 而非 PUT，除非确实需要全量替换
- PUT 仅在需要幂等创建/替换时使用（如 `PUT /api/v1/geo/claims/:id`）
- POST 用于创建非幂等资源，或执行动作（如 `POST /api/v1/geo/workflows/trigger`）
- DELETE 返回 204，不返回 body

---

## 3. 错误分类体系

所有错误必须使用以下标准化代码：

| 错误分类 | HTTP 状态码 | 错误代码 | 说明 |
|---------|-----------|---------|------|
| **ValidationError** | 400 | `VALIDATION_ERROR` | 请求参数校验失败 |
| **AuthError** | 401 | `AUTH_ERROR` | 未认证或 token 失效 |
| **PermissionError** | 403 | `PERMISSION_ERROR` | 无权限执行操作 |
| **NotFoundError** | 404 | `NOT_FOUND` | 请求的资源不存在 |
| **BusinessError** | 409 | `BUSINESS_ERROR` | 业务规则冲突 |
| **VersionConflict** | 409 | `VERSION_CONFLICT` | 乐观锁版本冲突 |
| **RateLimitError** | 429 | `RATE_LIMIT_EXCEEDED` | 请求频率超限 |
| **CapabilityError** | 502 | `CAPABILITY_ERROR` | AI 能力调用失败 |
| **ProviderError** | 503 | `PROVIDER_UNAVAILABLE` | Provider 不可用 |
| **InternalError** | 500 | `INTERNAL_ERROR` | 服务器内部错误 |

### 3.1 错误使用示例

```typescript
// ValidationError — 请求参数问题
throw new ValidationError('name', '项目名称不能为空', 'REQUIRED')

// AuthError — 认证问题
throw new AuthError('Token 已过期，请重新登录')

// BusinessError — 业务规则冲突
throw new BusinessError('该项目已被归档，无法执行分析')

// CapabilityError — AI 能力调用失败
throw new CapabilityError('LLM 调用超时', { provider: 'doubao', duration: 30000 })

// NotFoundError — 资源不存在
throw new NotFoundError('项目', 'proj-xxx')
```

---

## 4. 分页规范

### 4.1 Cursor 分页（推荐）

对于数据量大、实时性要求高的列表：

```typescript
// 请求
GET /api/v1/geo/claims?cursor=eyJsYXN0SWQiOiAiY2xhaW0tMTIzIn0=&limit=20

// 响应
{
  "success": true,
  "data": {
    "items": [ /* ... */ ],
    "pagination": {
      "cursor": "eyJsYXN0SWQiOiAiY2xhaW0tNDU2In0=",  // 下一页游标
      "hasMore": true,
      "limit": 20
    }
  },
  "traceId": "...",
  "timestamp": "...",
  "version": "1.0"
}
```

### 4.2 Page 分页（备选，适合小数据集）

```typescript
// 请求
GET /api/v1/geo/projects?page=1&pageSize=20

// 响应
{
  "success": true,
  "data": {
    "items": [ /* ... */ ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "traceId": "...",
  "timestamp": "...",
  "version": "1.0"
}
```

### 4.3 分页类型定义

```typescript
// @studio/platform/api/pagination
export interface CursorPagination {
  cursor: string   // base64 编码的游标
  hasMore: boolean
  limit: number
}

export interface PagePagination {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedResponse<T> {
  items: T[]
  pagination: CursorPagination | PagePagination
}
```

---

## 5. API 版本化

### 5.1 URL 前缀版本化

```
/api/v1/geo/projects        ← 当前版本（推荐）
/api/v2/geo/projects        ← 未来版本
```

### 5.2 版本化规则

| 规则 | 说明 |
|------|------|
| 主版本号变更 | 不向后兼容的 API 变更（v1 → v2） |
| 次版本号不变 | 新增字段、新增端点不触发版本变更 |
| 废弃策略 | 旧版本至少维护 6 个月，标记 `Deprecated` 响应头 |
| 迁移窗口 | 从废弃到移除至少 3 个月通知期 |

### 5.3 版本响应头

```http
GET /api/v1/geo/projects
Response:
  X-API-Version: 1.0
  X-API-Deprecated: true       ← v1 已废弃，建议迁移到 v2
  X-API-Sunset: 2027-01-18     ← v1 下线日期
```

---

## 6. 速率限制

### 6.1 标准限制

| 级别 | 速率限制 | 适用场景 |
|------|---------|---------|
| **全局** | 1000 req/min | 所有 API |
| **用户级** | 100 req/min | 按用户 ID |
| **IP 级** | 100 req/min | 未认证请求 |
| **能力调用** | 10 req/min | LLM/image/video 生成调用 |

### 6.2 速率限制响应头

```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1702886400
```

超出限制时返回 429：

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "请求频率超限，请稍后再试",
    "details": {
      "limit": 100,
      "remaining": 0,
      "resetAt": "2026-07-18T11:00:00.000Z"
    }
  },
  "traceId": "...",
  "timestamp": "...",
  "version": "1.0"
}
```

---

## 7. GEO 路由迁移规范

**所有现有的 GEO 路由必须在 C2 之前迁移到本规范。** 迁移清单：

### 7.1 当前违规状态

| 当前路由 | 问题 | 目标路由 |
|---------|------|---------|
| `/api/brand/geo/projects` | 含 `brand/` 前缀 | `/api/v1/geo/projects` |
| `/api/geo/projects?pageNo=1&size=20` | 非标准分页参数 | `/api/v1/geo/projects?page=1&pageSize=20` |
| `/api/geo/projects` 返回 `[{...}]` | 无统一响应格式 | 返回 `{ success, data, traceId, timestamp, version }` |
| `/api/geo/claims` 自定义错误格式 | 错误格式不统一 | 使用 `{ code, message, details }` 错误格式 |
| `/api/geo/workflows/execute` | 无版本前缀 | `/api/v1/geo/workflows/trigger` |

### 7.2 迁移后路由

```
请求:  GET /api/v1/geo/projects
响应:
{
  "success": true,
  "data": [
    { "id": "proj-1", "name": "项目A", "type": "geo", "status": "active" }
  ],
  "traceId": "trace-xxx",
  "timestamp": "2026-07-18T10:00:00.000Z",
  "version": "1.0"
}
```

### 7.3 迁移步骤

```
1. 更新所有路由路径: /api/brand/geo/* → /api/v1/geo/*
2. 封装所有响应为 ApiResponse 格式
3. 替换自定义错误为标准化错误代码
4. 更新分页参数为 page/pageSize 或 cursor/limit
5. 添加速率限制中间件
6. 添加版本响应头
7. 添加 traceId（从请求头或自动生成）
8. 删除旧路由（或保留 301 重定向到新路由）
9. CI 添加检查: 不允许出现 /api/brand/ 前缀路由
```

---

## 8. 各 Workspace 请求/响应示例

### 8.1 GEO Workspace

```typescript
// 创建项目
POST /api/v1/geo/projects
Request:  { "name": "品牌分析", "type": "geo", "metadata": { "targetUrl": "https://example.com" } }
Response: {
  "success": true,
  "data": {
    "id": "proj-123",
    "name": "品牌分析",
    "type": "geo",
    "status": "active",
    "metadata": { "targetUrl": "https://example.com" },
    "createdAt": "2026-07-18T10:00:00.000Z"
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}

// 获取 Claims 列表（Cursor 分页）
GET /api/v1/geo/projects/:projectId/claims?cursor=xxx&limit=20
Response: {
  "success": true,
  "data": {
    "items": [
      { "id": "claim-1", "title": "示例声明", "status": "verified" }
    ],
    "pagination": { "cursor": "next-cursor", "hasMore": true, "limit": 20 }
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}

// 启动质量分析
POST /api/v1/geo/workflows/trigger
Request:  { "workflowId": "geo.knowledge-quality", "projectId": "proj-123" }
Response: {
  "success": true,
  "data": {
    "executionId": "exec-456",
    "status": "running"
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}
```

### 8.2 Video Workspace

```typescript
// 创建视频项目
POST /api/v1/video/projects
Request:  { "name": "产品宣传片", "type": "video", "metadata": { "duration": 120, "format": "16:9" } }
Response: {
  "success": true,
  "data": {
    "id": "vid-proj-1",
    "name": "产品宣传片",
    "type": "video",
    "status": "draft",
    "createdAt": "2026-07-18T10:00:00.000Z"
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}

// 导入视频资产
POST /api/v1/video/assets
Request:  { "projectId": "vid-proj-1", "type": "footage", "url": "https://cdn.example.com/clip.mp4" }
Response: {
  "success": true,
  "data": {
    "id": "asset-789",
    "projectId": "vid-proj-1",
    "type": "footage",
    "status": "processing"
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}
```

### 8.3 Novel Workspace

```typescript
// 创建小说项目
POST /api/v1/novel/projects
Request:  { "name": "科幻小说", "type": "novel", "metadata": { "genre": "sci-fi", "wordCountGoal": 50000 } }
Response: {
  "success": true,
  "data": {
    "id": "novel-proj-1",
    "name": "科幻小说",
    "type": "novel",
    "status": "draft",
    "metadata": { "genre": "sci-fi", "wordCountGoal": 50000 }
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}

// 更新故事章节
PATCH /api/v1/novel/projects/:projectId/chapters/:chapterId
Request:  { "title": "新章节标题", "content": "章节内容..." }
Response: {
  "success": true,
  "data": {
    "id": "chapter-1",
    "title": "新章节标题",
    "wordCount": 3500,
    "updatedAt": "2026-07-18T10:00:00.000Z"
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}
```

### 8.4 PPT Workspace

```typescript
// 创建演示文稿项目
POST /api/v1/ppt/projects
Request:  { "name": "季度汇报", "type": "ppt", "metadata": { "theme": "corporate", "slideCount": 15 } }
Response: {
  "success": true,
  "data": {
    "id": "ppt-proj-1",
    "name": "季度汇报",
    "type": "ppt",
    "status": "draft",
    "createdAt": "2026-07-18T10:00:00.000Z"
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}

// 删除幻灯片（204 无响应体）
DELETE /api/v1/ppt/projects/:projectId/slides/:slideId
Response: 204 No Content
```

### 8.5 通用错误处理

```typescript
// 认证失败
GET /api/v1/geo/projects (无 token)
Response: {
  "success": false,
  "error": {
    "code": "AUTH_ERROR",
    "message": "未提供认证凭据"
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}

// 权限不足
PATCH /api/v1/video/projects/proj-xxx (非项目成员)
Response: {
  "success": false,
  "error": {
    "code": "PERMISSION_ERROR",
    "message": "您没有修改此项目的权限"
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}

// 资源不存在
GET /api/v1/novel/projects/non-existent
Response: {
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "项目不存在: non-existent"
  },
  "traceId": "...", "timestamp": "...", "version": "1.0"
}
```

---

## 9. 验证规则

```
□ 所有 API 响应是否使用 ApiResponse 统一格式？
□ success=false 时是否有 error 字段？
□ 是否使用了标准 HTTP 方法（优先 PATCH 而非 PUT）？
□ 错误代码是否使用标准分类？
□ 分页是否使用 cursor 或 page/pageSize 参数？
□ 路由是否使用 /api/v{version}/ 前缀？
□ 是否添加了速率限制和响应头？
□ 是否包含 traceId（自动生成或从请求头传递）？
□ GEO 路由是否已迁移到新规范（无 /api/brand/ 前缀）？
```

---

*API 规范确保昆仑镜平台前后端通信的一致性。统一的响应格式意味着前端可以一个 error handler 处理所有错误。*
*任何不符合本规范的 API 路由都是技术债务。所有 GEO 路由必须在 C2 前迁移完成。*
