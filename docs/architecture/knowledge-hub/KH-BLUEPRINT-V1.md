# Knowledge Hub Blueprint v1 — Architecture Freeze

**版本**: v1.0
**状态**: FROZEN
**冻结日期**: 2026-07-22
**定位**: 平台级核心产品（Platform Capability）
**前身**: GEO KDP（Knowledge Distribution Plane，v0.2~v0.4，冻结为 Implementation History）

---

## A — Platform Vision

### 一句话定位
> **Create Once → Publish Everywhere → Monitor Everywhere**

### 不是
- 不是 CMS
- 不是 SEO 工具
- 不是 GEO 子功能

### 核心原则
1. **所有 Workspace 的输出都是 KnowledgePackage** — GEO 产出 Brand Knowledge，短剧产出 Story Knowledge，小说产出 Novel Knowledge，PPT 产出 Presentation Knowledge
2. **所有 Publishing 都经过同一个 Engine** — 页面不能直接调用 Adapter
3. **一次构建，多路分发** — 同一个 KnowledgePackage 可发布到网站/CMS/RSS/Knowledge Feed/API/Webhook
4. **可追溯** — 每个发布都有 Version + Audit Trail + 回滚能力
5. **Workspace 不拥有 Publishing** — Workspace 只用 Provider 告知"我有知识包"，Publishing Engine 负责发布

### 产品边界
| 包含 | 不包含 |
|------|--------|
| Canonical KnowledgePackage | 第三方平台提交 API（如 Google/Bing） |
| Publishing Pipeline | Credential 管理（Platform 统一提供） |
| Adapter Registry | Workspace 专属知识生成逻辑 |
| Review / Approval | 内容创作 |
| Distribution Queue | |
| Monitoring / Retry | |
| Export / API | |

---

## B — Domain Model

### 核心实体

```
KnowledgePackage (平台 Canonical)
├── Metadata
│   ├── id
│   ├── workspace     ← 来源工作台（"geo" / "novel" / "drama" / "ppt"）
│   ├── entityType    ← 实体类型（"brand" / "story" / "chapter" / "slide"）
│   ├── entityId      ← 实体 ID
│   ├── title
│   ├── description
│   ├── status        ← draft / review / approved / published / archived
│   └── version
├── Claims           ← 核心知识声明（标记为真/假的断言）
├── Evidence         ← 每个 Claim 的证据
├── Assets           ← 附件（图片/文档/JSON-LD）
├── Citations        ← 引用来源
├── Tags             ← 分类标签
├── Recommendations  ← 优化建议（仅 GEO 使用）
├── VerificationSnapshot  ← 验证快照
├── PublishingTargets      ← 发布目标列表
└── AuditTrail
```

### 关系

```
Workspace Provider
       │
       ▼ KnowledgePackage
       │       │
       ▼       ▼
   Publishing Engine → Manifest → Adapter → Delivery Record
       │
       ▼
   Monitoring
```

---

## C — Canonical Package

### KnowledgePackage Schema（平台级）

```typescript
interface KnowledgePackage {
  // ── Identity ──
  id: string
  workspace: 'geo' | 'novel' | 'drama' | 'ppt'
  entityType: string
  entityId: string
  title: string
  description: string
  version: string          // semver

  // ── Status Machine ──
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived'
  statusHistory: StatusChange[]

  // ── Content ──
  claims: KnowledgeClaim[]
  evidence: KnowledgeEvidence[]
  assets: KnowledgeAsset[]
  citations: Citation[]
  tags: string[]

  // ── Optional by Workspace ──
  recommendations?: Recommendation[]       // GEO
  storyBeats?: StoryBeat[]                // 短剧
  chapterOutline?: ChapterOutline[]        // 小说
  slideDeck?: SlideDeck[]                 // PPT

  // ── Verification ──
  verificationSnapshot?: VerificationSnapshot

  // ── Publishing ──
  publishingTargets: PublishingTarget[]
  publishedAt?: string
  publishedBy?: string

  // ── Audit ──
  createdAt: string
  createdBy: string
  updatedAt: string
  auditLog: AuditEntry[]
}
```

### 序列化格式
- JSON（内部 API）
- JSON-LD（结构化数据输出）
- Markdown（人工可读导出）
- Knowledge Feed（AI 消费格式）

---

## D — Publishing Pipeline

### 流程

```
KnowledgePackage (built by Workspace Provider)
         │
         ▼
   ┌─────────────┐
   │   Builder   │  ← 组装完整 Package（验证 Schema）
   └──────┬──────┘
          ▼
   ┌─────────────┐
   │   Review    │  ← 人工/自动审核
   └──────┬──────┘
          ▼
   ┌─────────────┐
   │  Approval   │  ← 批准/拒绝
   └──────┬──────┘
          ▼
   ┌─────────────┐
   │   Package   │  ← 调用注册的 Publisher（一个/多个）
   └──────┬──────┘
          ▼
   ┌─────────────┐
   │  Delivery   │  ← 实际分发到目标
   └──────┬──────┘
          ▼
   ┌─────────────┐
   │  Record     │  ← 记录发布结果
   └──────┬──────┘
          ▼
   ┌─────────────┐
   │  Monitor    │  ← 持续监控发布状态
   └─────────────┘
```

### Pipeline 接口

```typescript
interface PublishingPipeline {
  build(package: KnowledgePackage): Promise<KnowledgePackage>
  submit(package: KnowledgePackage): Promise<PackageJob>
  getStatus(jobId: string): Promise<JobStatus>
  cancel(jobId: string): Promise<void>
  retry(jobId: string): Promise<PackageJob>
}
```

---

## E — Registry

### Publisher Registry

```typescript
interface PublisherRegistry {
  register(name: string, publisher: Publisher): void
  get(name: string): Publisher
  getAll(): Publisher[]
  getByWorkspace(workspace: string): Publisher[]
}
```

### 注册规则
- 所有 Publisher 必须通过 `register()` 注册
- 不允许 `if-else` / `switch` 判断 Publisher 类型
- 新增 Publisher 无需修改 Pipeline 代码

---

## F — Adapter

### 适配器清单（当前）

| Adapter | 输入 | 输出 | 状态 |
|---------|------|------|------|
| Website Packager | KnowledgePackage | HTML 页面 | ✅ 现有 |
| Sitemap Packager | KnowledgePackage | XML Sitemap | ✅ 现有 |
| RSS Packager | KnowledgePackage | RSS Feed | ✅ 现有 |
| AI Feed Packager | KnowledgePackage | JSON Feed | ✅ 现有 |
| Knowledge Bundle Packager | KnowledgePackage | ZIP bundle | ✅ 现有 |
| Git Adapter | KnowledgePackage | Git Push | ✅ 现有 |
| HTTP Adapter | KnowledgePackage | HTTP POST | ✅ 现有 |
| Storage Adapter | KnowledgePackage | Object Storage | ✅ 现有 |

### 扩展方式

```typescript
interface Publisher {
  name: string
  workspace: string
  type: 'packager' | 'delivery'
  publish(package: KnowledgePackage, target: PublishingTarget): Promise<PublishResult>
  validate?(pkg: KnowledgePackage): ValidationResult
}
```

---

## G — Permission

### 三层权限

| 层级 | 可见范围 | 操作 |
|------|---------|------|
| 用户 | 自己创建的 Package | CRUD + Publish |
| Workspace | 同一工作台的所有 Package | Review + Approve |
| Admin | 全部 | 全部 |

### License / Entitlement
- 普通 VIP：基础发布（Website / RSS）
- 高级 VIP：全量发布（含 AI Feed / Git / API）

---

## H — Versioning

### 版本规则
- 格式：`MAJOR.MINOR.PATCH` (semver)
- MAJOR：Breaking changes（Schema 变更）
- MINOR：新增发布目标或字段
- PATCH：Bug fix / 非功能性变更

### 版本存储
- 每个 KnowledgePackage 保留版本历史
- 支持 `GET /:id/versions/:version` 回滚
- 发布记录通过 `PublishingRecord` append-only 存储

---

## I — Extension Points

### 可扩展的维度
1. **Publisher** — 新增发布目标（如 WordPress / Shopify / Notion / GitBook）
2. **Packager** — 新增打包格式（如 PDF / ePub / HTML）
3. **Delivery Provider** — 新增传输方式（如 FTP / WebDAV）
4. **Validator** — 自定义验证规则
5. **Monitor** — 自定义健康检查

### 不可扩展（需修改核心）
- Pipeline 流程
- Package Schema
- Registry 注册机制
- Permission 模型

---

## J — API

### REST Endpoints

```
POST   /api/knowledge-hub/packages          — 创建 Package
GET    /api/knowledge-hub/packages           — 列表
GET    /api/knowledge-hub/packages/:id       — 详情
PUT    /api/knowledge-hub/packages/:id       — 更新
DELETE /api/knowledge-hub/packages/:id       — 删除
POST   /api/knowledge-hub/packages/:id/submit   — 提交审核
POST   /api/knowledge-hub/packages/:id/approve  — 批准
POST   /api/knowledge-hub/packages/:id/reject   — 拒绝
POST   /api/knowledge-hub/packages/:id/publish  — 发布
POST   /api/knowledge-hub/packages/:id/retry    — 重试
POST   /api/knowledge-hub/packages/:id/rollback — 回滚

GET    /api/knowledge-hub/jobs                — 发布任务列表
GET    /api/knowledge-hub/jobs/:id            — 任务详情

GET    /api/knowledge-hub/publishers          — 已注册 Publisher 列表
POST   /api/knowledge-hub/publishers/register — 注册 Publisher

GET    /api/knowledge-hub/targets             — 发布目标列表
POST   /api/knowledge-hub/targets             — 创建目标

GET    /api/knowledge-hub/history             — 发布历史
```

### API 规范
- 统一 `{ success: boolean, data: T, error?: string }` 信封
- 分页：`page` / `pageSize`
- 所有 GET 免登录（只读），POST/PUT/DELETE 需认证

---

## K — Workspace Integration

### Provider 模式

每个 Workspace 提供一个 Provider：

```typescript
interface KnowledgeProvider {
  workspace: string
  buildPackage(entityId: string): Promise<KnowledgePackage>
  canBuild(entityId: string): boolean
}
```

### 接入方式

```
GEO Workspace
  └── GeoKnowledgeProvider      ← now in geo/provider/
        └── buildPackage(brandId) → KnowledgePackage（含 Claims / Evidence）

Knowledge Hub
  └── Publishing Pipeline
        └── GeoKnowledgeProvider.buildPackage() → 发布
```

### 现有 Provider
| Workspace | Provider | 状态 |
|-----------|----------|------|
| GEO | GeoKnowledgeProvider | Phase 1 |
| 短剧 | StoryKnowledgeProvider | 待开发 |
| 小说 | NovelKnowledgeProvider | 待开发 |
| PPT | PresentationKnowledgeProvider | 待开发 |

---

## L — Migration

### 为什么迁移
KDP 原本是 GEO 的子平面（Knowledge Distribution Plane），随着 Knowledge Hub 升级为平台级产品，需要从 GEO 中解耦出来。

### 三阶段迁移

#### Phase 1（Compatibility）— 当前
```text
Knowledge Hub (新建)
    └── Adapter → Geo KDP（现有，物理复制）
GEO KDP（保持不动）
```

策略：将 KDP 代码复制到 `platform/knowledge-hub/`，GEO 端通过兼容层访问。

#### Phase 2（Provider）— 下一 Sprint
```text
Knowledge Hub
    └── GeoKnowledgeProvider（GEO 适配层）
GEO KDP（标记 @deprecated）
```

GEO 不再直接调用 KDP，改为通过 Provider 接入 Knowledge Hub。

#### Phase 3（Remove）— 完成
```text
Knowledge Hub（唯一实现）
GEO KDP（删除）
```

### 迁移清单
| 阶段 | 文件操作 | 状态 |
|------|---------|------|
| Phase 1 | 复制 `geo/kdp/` → `platform/knowledge-hub/` | ⬜ 待执行 |
| Phase 1 | 新增 `GeoKDPAdapter` 兼容层 | ⬜ 待执行 |
| Phase 1 | 验证 GEO 端无感知 | ⬜ 待执行 |
| Phase 2 | 新增 `GeoKnowledgeProvider` | ⬜ 待执行 |
| Phase 2 | GEO 路由改调用 Provider | ⬜ 待执行 |
| Phase 2 | 添加 `@deprecated` 标记 | ⬜ 待执行 |
| Phase 3 | 删除 `geo/kdp/` 目录 | ⬜ 待执行 |
| Phase 3 | 更新 import 引用 | ⬜ 待执行 |
| Phase 3 | 冻结 KDP 文档 | ⬜ 待执行 |

---

## 签署

**冻结状态**: FROZEN
**版本**: v1.0
**冻结日期**: 2026-07-22
**前身文档**: `docs/architecture/geo/KDP-ARCHITECTURE-BRIEF.md`（冻结为 Implementation History）

### 后续 Gate
- **Architecture Gate** → 沿用 GEO 模式
- **Publishing Gate**（新增）→ 所有发布必须经过 Publishing Engine
- **Knowledge Integrity Gate**（新增）→ Schema 校验 + 引用可追溯 + Version 可回滚

### Sprint 规划
- **KH1**: Canonical Package（Model + Builder + Repository）
- **KH2**: Publishing Engine（Pipeline + Registry + Adapter Framework）
- **KH3**: Review & Approval（Draft → Review → Approve）
- **KH4**: Distribution（Website/CMS Adapter + Export + API + Webhook）
- **KH5**: Monitoring（Status + Health + Retry + Metrics）
