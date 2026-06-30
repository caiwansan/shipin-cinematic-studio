# KMKI Platform — Asset Center Specification v1.0

> **Version**: 1.0  
> **Status**: Draft  
> **Date**: 2026-07-20  
> **Constitution Alignment**: CONST-015 (Asset ownership), CONST-019 (Add-only evolution), CONST-024 (Single Owner Data)  
> **ADR Alignment**: ADR-013 (Single Owner Data), ADR-019 (Schema evolution)  
> **Blueprint Alignment**: Ch 6.2 (Asset Storage)  
> **Dependencies**: Identity Center (Auth), Event Bus  
> **Error Cascade Direction**: Asset Center failure → new executions complete but artifacts lost, existing assets readable from CDN  
> **Global Rule**: Runtime Center 永远不直接调用 Object Storage (S3/MinIO/OSS)。Runtime 通过 Asset API 完成所有产物读写。Asset Center 是平台唯一的对象存储抽象层。

---

## 1. Mission

全平台唯一的数据持久化平面。所有 Center、Workspace、Runtime 产生的对象（图片、视频、音频、Prompt、文档、Dataset、Knowledge Object、Execution Checkpoint、DAG Snapshot）统一通过 Asset Center 存取。提供 Version、Reference、Permission、Lifecycle、Search、CDN 等企业级能力。

## 2. Non-Responsibility

- 不执行业务逻辑
- 不运行 AI 推理
- 不管理 Provider
- 不感知 Workspace 的业务语义（Asset 只存对象，不解释业务含义）
- 不管理 Credential / Secret
- 不执行数据加工（Thumbnail 生成除外）

---

## 3. Core Data Models

### 3.1 ER Diagram

```
AssetObject (1) ──── (N) AssetVersion
     │                      │
     ├── AssetMetadata (1:1)│
     ├── AssetChecksum (1:1)│
     ├── AssetPermission (N)│
     ├── AssetReference (N) │
     ├── AssetThumbnail (0:1)
     └── AssetLifecycle (1:1)

AssetTag (N) ────── (N:N) AssetObject
```

### 3.2 AssetObject

```typescript
interface AssetObject {
  id: string                     // "ast_img_a1b2c3d4"
  type: 'image' | 'video' | 'audio' | 'document' | 'prompt' | 'data'
        | 'checkpoint' | 'snapshot' | 'knowledge' | 'dataset' | 'other'
  mime: string                   // "image/png" | "application/json" | ...
  size: number                   // bytes
  name: string
  description?: string

  // 存储
  storage: {
    backend: 'local' | 's3' | 'oss' | 'memory'
    bucket: string
    key: string
    cdnUrl?: string
  }

  // 元数据
  checksum: AssetChecksum
  metadata: AssetMetadata

  // 生命周期
  lifecycle: AssetLifecycle

  // 版本 & 引用
  latestVersion: number
  currentVersionId: string
  referenceCount: number

  // 权限
  ownerId: string                // workspaceId
  createdBy: string              // userId
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

### 3.3 AssetVersion

```typescript
interface AssetVersion {
  versionId: string
  assetId: string
  version: number                // 1, 2, 3...
  size: number
  storage: {
    backend: string
    bucket: string
    key: string
    cdnUrl?: string
  }
  checksum: AssetChecksum
  commitMessage?: string
  createdBy: string
  createdAt: Date
}
```

### 3.4 AssetMetadata

```typescript
interface AssetMetadata {
  // 系统元数据（自动填充）
  resolution?: { width: number, height: number }
  duration?: number              // 视频/音频时长（毫秒）
  format?: string                // "RGBA" | "YUV420p"
  codec?: string                 // "h264" | "aac"

  // 业务元数据（自定义）
  tags: string[]                 // ["scene1", "example"]
  custom: Record<string, any>    // { "prompt": "..." }
  source: string                 // "runtime.execution"
  sourceId: string               // sessionId / jobId

  // 索引
  indexFields: Record<string, string | number | boolean>
}
```

### 3.5 AssetChecksum

```typescript
interface AssetChecksum {
  algorithm: 'sha256' | 'md5'
  hash: string
  verifiedAt?: Date
}
```

### 3.6 AssetPermission

```typescript
interface AssetPermission {
  assetId: string
  type: 'public' | 'workspace' | 'user' | 'role'
  target: string                 // workspaceId | userId | roleName
  access: 'read' | 'write' | 'admin'
  grantedBy: string
  grantedAt: Date
  expiresAt?: Date
}
```

### 3.7 AssetReference

```typescript
interface AssetReference {
  referenceId: string
  assetId: string
  sourceType: string             // "execution_session" | "workspace" | "knowledge" | "prompt"
  sourceId: string
  relation: 'produced_by' | 'consumed_by' | 'referenced_by'
  createdAt: Date
}
```

### 3.8 AssetLifecycle

```typescript
interface AssetLifecycle {
  assetId: string
  status: 'active' | 'archived' | 'deleted' | 'purged'
  ttl?: number                   // 自动删除前的秒数
  archivedAt?: Date
  deletedAt?: Date
  retentionDays: number          // 保留天数（0 = 永久）
  policy: 'auto_delete' | 'manual'
}
```

### 3.9 AssetThumbnail

```typescript
interface AssetThumbnail {
  assetId: string
  thumbnails: ThumbnailVariant[]
}

interface ThumbnailVariant {
  size: 'small' | 'medium' | 'large'
  width: number
  height: number
  storage: {
    backend: string
    bucket: string
    key: string
    cdnUrl?: string
  }
}
```

### 3.10 AssetTag

```typescript
interface AssetTag {
  tagId: string
  name: string
  color?: string
  workspaceId: string
}
```

---

## 4. Core Modules (10 Registries)

### 4.1 Object Registry

**Responsibility**: Asset 对象创建、读取、删除。

```
ObjectRegistry
  ├── upload(create: CreateAsset, data: Buffer | Stream) → AssetObject
  ├── get(assetId) → AssetObject
  ├── getByChecksum(hash) → AssetObject[]
  ├── delete(assetId) → void
  ├── softDelete(assetId) → void
  ├── restore(assetId) → void
  └── uploadUrl(assetId) → string      # 预签名上传 URL
```

### 4.2 Version Registry

**Responsibility**: 版本管理。

```
VersionRegistry
  ├── createVersion(assetId, data, commitMessage?) → AssetVersion
  ├── listVersions(assetId) → AssetVersion[]
  ├── getVersion(assetId, version) → AssetVersion
  ├── getLatestVersion(assetId) → AssetVersion
  ├── restoreVersion(assetId, version) → AssetObject
  └── diffVersions(assetId, v1, v2) → { changes }
```

### 4.3 Metadata Registry

**Responsibility**: 元数据读写 + 索引字段管理。

```
MetadataRegistry
  ├── setMetadata(assetId, metadata) → void
  ├── getMetadata(assetId) → AssetMetadata
  ├── updateTags(assetId, tags) → void
  ├── setIndexField(assetId, key, value) → void
  ├── queryByMetadata(fields: Record<string, any>) → AssetObject[]
  └── queryByTag(tagName, workspaceId) → AssetObject[]
```

### 4.4 Reference Registry

**Responsibility**: 引用关系管理（谁引用了谁）。

```
ReferenceRegistry
  ├── addReference(ref: AssetReference) → void
  ├── getReferences(assetId) → AssetReference[]
  ├── getReferencedBy(assetId) → AssetReference[]
  ├── getAssetGraph(assetId) → { upstream: AssetReference[], downstream: AssetReference[] }
  └── removeReference(referenceId) → void
```

### 4.5 Permission Registry

**Responsibility**: ACL 管理。

```
PermissionRegistry
  ├── setPermission(assetId, permission) → void
  ├── getPermissions(assetId) → AssetPermission[]
  ├── checkAccess(assetId, userId, access) → boolean
  ├── removePermissions(assetId) → void
  └── getAccessibleAssets(userId, workspaceId, access) → string[]
```

### 4.6 Lifecycle Registry

**Responsibility**: TTL、归档、删除策略。

```
LifecycleRegistry
  ├── setLifecycle(assetId, lifecycle) → void
  ├── scheduleDeletion(assetId, deleteAt) → void
  ├── cancelDeletion(assetId) → void
  ├── processExpiredAssets() → { deleted: number, archived: number }   # 定时任务
  └── listExpiringAssets(days) → AssetObject[]
```

**Lifecycle Policy**:
```
For Asset with auto_delete policy:
  active → TTL 到期 → deleted (soft delete)
  → retentionDays 到期 → purged (物理删除)

GC 执行频率: 每小时
```

### 4.7 Search Registry

**Responsibility**: 全文 + 元数据搜索。

```
SearchRegistry
  ├── indexAsset(asset: AssetObject) → void
  ├── search(query: string, filters) → AssetObject[]
  ├── searchByTags(tags: string[], matchAll) → AssetObject[]
  ├── searchBySource(sourceId: string) → AssetObject[]
  ├── searchByWorkspace(workspaceId, query) → AssetObject[]
  └── reindex(assetId) → void
```

### 4.8 Thumbnail Registry

**Responsibility**: 缩略图生成与管理。

```
ThumbnailRegistry
  ├── generate(assetId, sizes: ThumbnailSize[]) → AssetThumbnail
  ├── get(assetId) → AssetThumbnail
  ├── getUrl(assetId, size) → string
  ├── regenerate(assetId) → AssetThumbnail
  └── delete(assetId) → void

// 支持的图片类型: image/png, image/jpeg, image/webp
// 视频缩略图: 提取第一帧
// 其他类型: 返回默认图标
```

### 4.9 Checksum Registry

**Responsibility**: 去重 + 完整性校验。

```
ChecksumRegistry
  ├── verify(assetId) → { valid: boolean, expected: string, actual: string }
  ├── findByChecksum(hash, algorithm) → AssetObject[]
  ├── deduplicate(data: Buffer) → { existingAsset?: string, isDuplicate: boolean }
  └── batchVerify(assetIds[]) → AssetVerificationResult[]
```

### 4.10 CDN Registry

**Responsibility**: CDN URL 管理 + 预签名 URL。

```
CDNRegistry
  ├── getUrl(assetId) → string               # CDN URL
  ├── getSignedUrl(assetId, expiresIn) → string  # 带过期签名的 URL
  ├── getVersionUrl(assetId, version) → string
  ├── invalidateCache(assetId) → void
  └── getUploadUrl(assetId, expiresIn) → string  # 预签名上传 URL
```

---

## 5. Public API

### 5.1 Upload & Download

```
POST   /api/asset/upload            → AssetObject       # 上传（multipart）
POST   /api/asset/upload-url        → { url }           # 预签名上传 URL
GET    /api/asset/:id               → AssetObject       # 获取元数据
GET    /api/asset/:id/data          → binary            # 下载对象
GET    /api/asset/:id/url           → { url }           # CDN URL
DELETE /api/asset/:id               → void              # 删除
PATCH  /api/asset/:id               → AssetObject       # 更新元数据
```

### 5.2 Version

```
POST   /api/asset/:id/versions      → AssetVersion      # 创建新版本
GET    /api/asset/:id/versions      → AssetVersion[]    # 版本列表
GET    /api/asset/:id/versions/:v   → AssetVersion      # 获取版本
POST   /api/asset/:id/versions/:v/restore → AssetObject # 恢复版本
```

### 5.3 Metadata

```
PATCH  /api/asset/:id/metadata      → AssetMetadata     # 更新元数据
GET    /api/asset/:id/metadata      → AssetMetadata     # 获取元数据
POST   /api/asset/:id/tags          → void              # 添加标签
DELETE /api/asset/:id/tags/:tag     → void              # 删除标签
```

### 5.4 Reference

```
POST   /api/asset/:id/references    → AssetReference    # 添加引用
GET    /api/asset/:id/references    → AssetReference[]  # 引用列表
GET    /api/asset/:id/referenced-by → AssetReference[]  # 被谁引用
DELETE /api/asset/:id/references/:refId → void          # 删除引用
```

### 5.5 Permission

```
POST   /api/asset/:id/permissions   → AssetPermission   # 设置权限
GET    /api/asset/:id/permissions   → AssetPermission[] # 权限列表
DELETE /api/asset/:id/permissions/:permId → void        # 删除权限
GET    /api/asset/:id/access/:userId → { access }       # 检查访问权限
```

### 5.6 Lifecycle

```
PATCH  /api/asset/:id/lifecycle     → AssetLifecycle    # 设置生命周期
GET    /api/asset/:id/lifecycle     → AssetLifecycle    # 获取生命周期
POST   /api/asset/:id/expire        → void              # 立即过期
POST   /api/asset/:id/restore       → void              # 恢复已删除
```

### 5.7 Search

```
GET    /api/asset/search?q=...&type=image&workspace=brand-geo → AssetObject[]
GET    /api/asset/search/tags?tags=scene1,example     → AssetObject[]
GET    /api/asset/search/source?type=execution&id=ses_abc → AssetObject[]
```

### 5.8 Thumbnail

```
POST   /api/asset/:id/thumbnails    → AssetThumbnail    # 生成缩略图
GET    /api/asset/:id/thumbnails    → AssetThumbnail    # 获取缩略图
GET    /api/asset/:id/thumbnails/:size → binary         # 下载缩略图
```

### 5.9 Checksum

```
POST   /api/asset/checksum/verify   → { valid, assetId }
POST   /api/asset/checksum/dedup    → { isDuplicate, existingAsset? }
```

### 5.10 Admin

```
GET    /api/asset/stats             → { totalAssets, totalSize, byType }
POST   /api/asset/lifecycle/process → { deleted, archived }
GET    /api/asset/health            → HealthStatus
```

---

## 6. Events

Asset Center 发布（Publisher）：

| Event | Payload | Guarantee | Subscriber |
|-------|---------|-----------|------------|
| `asset.created.v1` | `{assetId, type, size, ownerId}` | At Least Once | Observability |
| `asset.updated.v1` | `{assetId, changes}` | At Least Once | Observability |
| `asset.deleted.v1` | `{assetId, type}` | At Least Once | Observability, Runtime (cleanup artifact refs) |
| `asset.version.created.v1` | `{assetId, version, size}` | At Least Once | Observability |
| `asset.thumbnail.generated.v1` | `{assetId, sizes}` | At Most Once | Observability |
| `asset.storage.low.v1` | `{workspaceId, usage, quota}` | At Most Once | Billing Center |

Asset Center 订阅（Subscriber）：

| Event | Handler |
|-------|---------|
| `artifact.created.v1` | 自动将 Artifact 转换为 Asset（如 Artifact 需要长期保留）|
| `workspace.deleted.v1` | 标记该 Workspace 所有 Asset 为 deleted |
| `execution.completed.v1` | 可选：自动在 Asset Center 建立 Execution 与 Artifact 的引用关系 |

---

## 7. Internal Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Asset Center Service                        │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                    API Layer                              │ │
│  │  Upload / Download / Search / Permissions / Lifecycle    │ │
│  └──────────────────────┬──────────────────────────────────┘ │
│                         │                                    │
│  ┌──────────────────────┴────────────────────────────────┐   │
│  │                  10 Registries                          │   │
│  │                                                         │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │   │
│  │  │  Object    │ │  Version   │ │  Metadata │          │   │
│  │  │  Registry  │ │  Registry  │ │  Registry │          │   │
│  │  └────────────┘ └────────────┘ └────────────┘          │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │   │
│  │  │ Reference  │ │ Permission │ │ Lifecycle │          │   │
│  │  │  Registry  │ │  Registry  │ │  Registry │          │   │
│  │  └────────────┘ └────────────┘ └────────────┘          │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐          │   │
│  │  │  Search    │ │ Thumbnail  │ │ Checksum   │          │   │
│  │  │  Registry  │ │  Registry  │ │  Registry  │          │   │
│  │  └────────────┘ └────────────┘ └────────────┘          │   │
│  │  ┌────────────┐                                         │   │
│  │  │    CDN     │                                         │   │
│  │  │  Registry  │                                         │   │
│  │  └────────────┘                                         │   │
│  └──────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Worker Pool                             │ │
│  │  Thumbnail Generator | Checksum Verifier | GC Cleaner     │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Object Storage Abstraction Layer             │ │
│  │  S3Adapter | MinIOAdapter | OSSAdapter | LocalAdapter    │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Repository Layer                        │ │
│  │  AssetDAO | VersionDAO | MetadataDAO | RefDAO | ...      │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Public Contract

### 8.1 Upload Response

```json
{
  "success": true,
  "data": {
    "id": "ast_img_a1b2c3d4",
    "type": "image",
    "mime": "image/png",
    "size": 1523400,
    "storage": {
      "backend": "s3",
      "bucket": "kmki-assets",
      "cdnUrl": "https://cdn.kmki.ai/ast_img_a1b2c3d4.png"
    },
    "checksum": { "algorithm": "sha256", "hash": "abc..." },
    "latestVersion": 1,
    "referenceCount": 0,
    "lifecycle": { "status": "active", "retentionDays": 90 }
  },
  "traceId": "kmki-20260720-a1b2c3d4"
}
```

### 8.2 Download

```
GET /api/asset/ast_img_a1b2c3d4/data
→ 200
Content-Type: image/png
Content-Length: 1523400
Content-Disposition: attachment; filename="ast_img_a1b2c3d4.png"
ETag: "abc..."
```

### 8.3 Error

```json
{
  "success": false,
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Asset ast_img_xxx not found",
    "detail": "Asset may have been deleted or expired"
  },
  "traceId": "kmki-20260720-a1b2c3d4"
}
```

### 8.4 HTTP 状态码

| Code | 含义 |
|------|------|
| 200 | 成功 |
| 201 | 上传成功 |
| 400 | 校验失败（文件过大/类型不支持）|
| 401 | 认证失败 |
| 403 | 权限不足（无权读写该 Asset）|
| 404 | Asset 不存在 |
| 409 | 版本冲突 |
| 413 | 文件过大 |
| 429 | 限流 |
| 500 | 对象存储错误 |

---

## 9. Failure Mode

| 场景 | 行为 |
|------|------|
| 对象存储不可用 | Upload 失败，Download 依赖 CDN（CDN 仍可服务）|
| 数据库不可用 | Asset 元数据不可查，但 CDN URL 仍可用 |
| Thumbnail 生成失败 | 返回默认缩略图，异步重试 |
| Checksum 不匹配 | 标记 Asset 为 `corrupted`，发布告警 |
| CDN 不可用 | 返回原始存储 URL（S3/MinIO 直连）|
| 去重失败 | 不进行去重，直接新存 |
| 引用关系丢失 | Asset 仍可访问，引用关系重新建立 |

---

## 10. Recovery

| 场景 | 恢复步骤 |
|------|---------|
| 对象存储恢复 | 检查所有 pending upload → 重试失败 → 恢复写入 |
| 数据库恢复 | 从存储扫描重建元数据索引 |
| CDN 恢复 | DNS 自动切换，CDN URL 重新可用 |
| 数据损坏 | 从 Checksum Registry 找到完整版本 → 恢复 |

---

## 11. Storage Backend 抽象

```
StorageBackend (Interface)
  ├── put(bucket, key, data) → { etag, size }
  ├── get(bucket, key) → Stream
  ├── delete(bucket, key) → void
  ├── exists(bucket, key) → boolean
  ├── list(bucket, prefix) → string[]
  ├── copy(fromBucket, fromKey, toBucket, toKey) → void
  ├── getSignedUrl(bucket, key, expiresIn, operation) → string
  ├── getBucketMetrics(bucket) → { objectCount, totalSize }
  └── health() → { status, latency }
```

---

## 12. Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `asset_total` | Gauge | type | Asset 总数 |
| `asset_storage_bytes` | Gauge | type, backend | 存储用量 |
| `asset_upload_count` | Counter | type | 上传次数 |
| `asset_upload_size_bytes` | Histogram | type | 上传大小分布 |
| `asset_download_count` | Counter | type | 下载次数 |
| `asset_download_latency_ms` | Histogram | type | 下载延迟 |
| `asset_thumbnail_generation_count` | Counter | size | 缩略图生成次数 |
| `asset_dedup_rate` | Gauge | — | 去重率 |
| `asset_version_count` | Gauge | — | 版本数 |
| `asset_cdn_hit_rate` | Gauge | — | CDN 命中率 |

---

## 13. Health Endpoint

```typescript
GET /health → {
  status: 'healthy' | 'degraded' | 'down',
  checks: {
    database: { status: 'ok' | 'error', latency: number },
    storage_backend: { status: 'ok' | 'error', latency: number },
    cdn: { status: 'ok' | 'degraded' | 'down', latency: number },
    thumbnail_worker: { status: 'ok' | 'error' }
  },
  stats: {
    totalAssets: number,
    totalSize: string,           // "1.2 TB"
    byType: { image: number, video: number, document: number },
    cdnHitRate: number
  }
}
```

---

## 14. SLO

| SLI | Target |
|-----|--------|
| Upload latency (P95, <10MB) | < 500ms |
| Upload latency (P95, <100MB) | < 2s |
| Download latency (P95, CDN hit) | < 100ms |
| Download latency (P95, CDN miss) | < 500ms |
| Version creation latency P95 | < 200ms |
| Search query latency P95 | < 300ms |
| Thumbnail generation latency P95 | < 2s |
| Dedup check latency P95 | < 100ms |
| Availability (per month) | 99.95% |

---

> **Runtime doesn't know S3 exists. Runtime calls Asset API. Asset Center handles the rest.**
