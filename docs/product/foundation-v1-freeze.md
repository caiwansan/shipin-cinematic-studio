# GEO Foundation v1 Freeze

| 里程碑 | 状态 | 日期 |
|--------|------|------|
| **Foundation v1 Freeze** | ✅ **FREEZED** | 2026-07-04 |
| Sprint 1A (Packaging) | ✅ RC 通过 | P1A-001 ~ P1A-005 |
| Sprint 2A (Distribution Core) | ✅ RC 通过 | P2A-001 ~ P2A-005 |
| Sprint 2B (Distribution API) | ✅ RC 通过 | P2B-001 ~ P2B-003 |
| Sprint 3A (Evidence Architecture) | ✅ Architecture Freezed | 10 项决策冻结 |
| Sprint 3B (Evidence Engine) | ✅ RC 通过 | P3B-001 ~ P3B-003 |

**Foundation 覆盖范围：** Knowledge → Packaging → Distribution → Evidence

---

## 1. 已冻结的 Contract

### 1.1 KnowledgeObject Contract

**定义位置：** `backend/src/services/geo/runtime/knowledge/KnowledgeObjectSchema.ts`

```
KnowledgeObjectData {
  id                  string
  projectId           string
  topic               string?
  status              KOStatus
  confidence          number?
  qualityScore        number?
  provenance          KOProvenance?
  entities            EntitySnapshot[]
  relations           RelationSnapshot[]
  claims              ClaimSnapshot[]
  evidence            EvidenceSnapshot[]
  citations           CitationSnapshot[]
  createdAt           string
  updatedAt           string
}
```

| 字段 | 不可变 | 说明 |
|------|--------|------|
| `id` | ✅ | 创建后不可变 |
| `content` 相关 | ❌ | claims/evidence/citations 可追加 |
| `status` | ❌ | 状态驱动流转 |

### 1.2 Package Contract (Platform Canonical)

**定义位置：** `backend/src/platform/knowledge-hub/core/types.ts`

```
KnowledgePackage {
  id                  string
  workspace           string
  entityType          string
  entityId            string
  title               string
  description         string
  version             string
  status              'draft' | 'review' | 'approved' | 'published' | 'archived'
  statusHistory       StatusChange[]
  ...
}
```

**契约约束：** Package 是 KnowledgeObject 的标准化发布载体。KnowledgeObject → Package 的映射通过 Provider Adapter 实现。

### 1.3 Distribution Contract

**定义位置：** `backend/src/platform/knowledge-hub/distribution/contract.ts`

| Contract | 输入 | 输出 | 说明 |
|----------|------|------|------|
| `PublishRequest` | packageId, planId, targets[] | — | 统一分发请求 |
| `PublishResult` | — | target, status, files[], duration, artifactHash | 统一分发结果 |
| `PublishFile` | — | fileName, filePath, mimeType, content, size, contentHash | 统一文件产物 |
| `PublishRecordData` | — | packageId, target, status, duration, ... | 持久化记录 |
| `Publisher` | packageId → files | `publish(id): PublishFile[]` | 统一 Publisher 接口 |

**已实现的 Publisher：**
- WebsitePublisher — index.html + schema.jsonld + publish.json
- SitemapPublisher — sitemap.xml + sitemap-entry.json + publish.json
- AIFeedPublisher — ai-feed.json + ai-feed-summary.json + publish.json

### 1.4 Evidence Contract

**定义位置：** `backend/src/platform/knowledge-hub/evidence/collector.ts`

```
EvidenceRecord {
  id                string         — 唯一标识（不可变）
  type              enum           — discovery/knowledge/packaging/distribution/verification/observation
  scope             enum           — knowledge/package/distribution/observation/system
  sourceType        string         — 来源类型
  sourceId          string         — 来源记录 ID
  sourceVersion     string         — 语义版本
  targetType        enum           — knowledge_object/claim/citation/asset/package/publish_record
  targetId          string         — 目标 ID
  content           string         — 证明内容（不可变）
  confidence        number         — 0-1（不可变）
  checksum          string         — sha256（16 hex。不可变）
  level             enum           — raw/verified/golden
  status            enum           — pending/confirmed/invalid/expired
  metadata          Record?        — 扩展元数据
  truthId           string?        — 关联 TruthRecord
  verificationId    string?        — 关联 Verification
  collectedAt       Date           — 捕获时间（不可变）
}
```

**不可变原则：** `content` / `checksum` / `confidence` / `collectedAt` 在创建后不可修改。状态变更通过新增记录实现（append-only）。

---

## 2. 已冻结的数据模型

| 表 | Prisma 模型 | 说明 |
|----|------------|------|
| `knowledge_packages` | `KnowledgePackage` | 标准 Package 实体 |
| `package_manifests` | `PackageManifest` | 构建元数据 |
| `package_artifacts` | `PackageArtifact` | 构建产物 |
| `package_builds` | `PackageBuild` | 构建执行记录 |
| `package_claims` | `PackageClaim` | Package 附带 Claims |
| `package_citations` | `PackageCitation` | Package 附带 Citations |
| `package_assets` | `PackageAsset` | Package 附带 Assets |
| `publish_records` | `PublishRecord` | 发布执行记录 |
| `evidence_records` | `EvidenceRecord` | 统一证据记录（append-only） |

### 表关系示意图

```
KnowledgePackage
├── PackageManifest (1:1, 可选)
├── PackageArtifact (1:N)
├── PackageBuild (1:N)
│   └── EvidenceRecord (自动收集)
├── PackageClaim (1:N)
├── PackageCitation (1:N)
├── PackageAsset (1:N)
│
PublishRecord (1:N, 从 Package)
├── EvidenceRecord (自动收集)
│
EvidenceRecord (1:N, 从 Package / PublishRecord)
├── targetType = 'package' | 'publish_record'
├── sourceType = 'build' | 'publish_record'
└── type = packaging | distribution | ...
```

---

## 3. 已冻结的 API

### 3.1 Packaging API

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/packages/build` | 构建 Package |
| GET | `/api/v1/packages/:id` | 查询 Package 详情 |
| GET | `/api/v1/packages` | 列表查询 |

### 3.2 Distribution API

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v1/packages/:id/distribute` | 全量/选择性分发 |
| GET | `/api/v1/packages/:id/publishes` | 发布历史 |
| POST | `/api/v1/packages/:id/republish` | 幂等重新发布 |

### 3.3 Evidence API

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v1/evidence` | 通用证据查询（支持 targetType/targetId/scope/level/status 筛选） |
| GET | `/api/v1/evidence/timeline/:targetType/:targetId` | 证据时间线 |
| GET | `/api/v1/packages/:id/evidence` | Package 证据查询 |
| GET | `/api/v1/packages/:id/evidence/timeline` | Package 证据时间线 |

---

## 4. Golden Regression Baseline

| 验证脚本 | 验证数 | 状态 |
|----------|--------|------|
| `scripts/golden-e2e-validation.ts` | Packaging + Distribution E2E | ✅ 全部通过 |
| `scripts/golden-distribution-validation.ts` | Distribution 专项（15 项） | ✅ 全部通过 |
| `scripts/golden-evidence-validation.ts` | Evidence 专项（27 项） | ✅ 全部通过 |

**回归要求（Foundation Gate）：**
1. 每次修改 Contract / 数据模型 / API 后，必须运行全部三组 Golden Regression
2. Foundation Gate 不通过 → 不允许进入 Observation Engine 开发
3. Golden Regression 结果记录到 `docs/product/foundation-gate-status.md`

---

## 5. Product Maturity (v1)

| 引擎 | 状态 | Maturity |
|------|------|----------|
| Discovery | RC | 检测逻辑就绪，需进一步稳定 |
| Knowledge | RC | 知识提取就绪，需进一步稳定 |
| **Packaging** | ✅ **Production Ready** | 可构建、可验证、可回归 |
| **Distribution** | ✅ **Production Ready** | 可发布、可追踪、可回放 |
| **Evidence** | ✅ **Production Ready** | 自动收集、可查询、不可变 |
| Observation | 🔜 Sprint 4 | 规划中 |
| Adaptive | ❌ 未开始 | — |

### Product Readiness Score

| 维度 | 分数 | 说明 |
|------|------|------|
| 检测完整性 | 5.3/10 | Discovery RC |
| 发布能力 | ✅ **10/10** | 三大引擎 Production Ready |
| 外循环 | 0/10 | Observation / Adaptive 未启动 |
| 产品化 UI | 0/10 | 未构建 Sprint 1B Package 产品化 UI |
| **整体** | **6.3/10** | 比初次审计（5.3/10）提升 1 分 |

---

## 6. Foundation Gate Check

此检查单用于确定是否满足进入 Observation 开发的条件。

### Contract 冻结
- [x] KnowledgeObject Contract 冻结
- [x] Package Contract 冻结
- [x] Distribution Contract 冻结（PublishRequest / PublishResult / PublishFile / Publisher）
- [x] Evidence Contract 冻结（EvidenceRecord / EvidenceCollector）

### 数据模型冻结
- [x] All Prisma models stable (knowledge_packages → publish_records → evidence_records)
- [x] No pending schema migrations

### API 冻结
- [x] Packaging API 冻结
- [x] Distribution API 冻结（distribute / publishes / republish）
- [x] Evidence API 冻结（4 个端点）

### Regression Baseline
- [x] E2E Golden Regression (30+ items)
- [x] Distribution Golden Regression (15 items)
- [x] Evidence Golden Regression (27 items)
- [x] All three pass on current branch

### 代码冻结
- [x] 平台层代码零修改原则已建立
- [x] Provider Adapter 模式已标准化
- [x] Evidence 自动收集已接入 Build + Distribution

---

## 7. 未冻结的范围（后续处理）

以下范围**不属于** Foundation v1，将在未来 Sprint 中处理：

- **Sprint 1B:** Package 产品化 UI（Knowledge Object Viewer / Package Explorer）
- **Sprint 4:** Observation & Visibility Engine（调度器、Crawl 状态、AI 可见性）
- **Sprint 5:** Adaptive Engine（策略推理、自动调参）
- **Verification Engine:** 触发式验证（与 Truth Layer 协作）
- **EvidenceLink:** 引用关系表（暂缓，验证 EvidenceRecord 是否足够）
- **Truth Layer integration:** truthId 字段已预留，但 Truth Layer 本身保持独立
- **旧表清理:** knowledge_evidence 标记 deprecated 但未删除
