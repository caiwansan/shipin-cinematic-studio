# Knowledge Package Specification v1.0

**版本**: v1.0-draft  
**状态**: DRAFT — Gate 1（待评审）  
**适用范围**: 昆仑镜 AI-first Knowledge Platform 全平台  
**定位**: 平台核心数据契约。Knowledge Package 是昆仑镜唯一的知识交换原子单位。

---

## 版本记录

| 版本 | 日期 | 变更 | 作者 |
|------|------|------|------|
| v1.0-draft | 2026-07-22 | 初版，12 章完整规范 | OpenClaw Architecture Review |

---

## 1. 概述

### 1.1 什么是 Knowledge Package

Knowledge Package（知识包）是昆仑镜平台中知识的一个自包含、可分发、可验证的标准化单元。它封装了品牌/实体在特定时间点上的知识状态，包括实体描述、声明（Claim）、证据（Evidence）、引用（Citation）、FAQ、结构化数据等，并附带完整性校验、元数据和生命周期状态。

### 1.2 设计目标

1. **AI 可消费** — AI 模型无需适配即可读取、引用、验证
2. **平台中立** — 不绑定任何特定工作台（GEO / Knowledge Hub / 小说 / 短剧 / PPT）
3. **版本可演进** — v1 → v2 有明确升级路径，向后兼容
4. **自验证** — 每条 Claim 绑定 Evidence，证据链可追溯
5. **可分发** — 适配 Website / CMS / JSON-LD / RSS / API / Static 等多种渠道

### 1.3 核心原则

- **Knowledge Package 是原子单位** — 任何工作台如需发布、共享、验证、分发知识，必须以 Knowledge Package 为输入输出
- **Evidence Binding** — 每条声明（Claim）必须附带证据（Evidence），否则视为未验证声明
- **Write Once, Distribute Many** — Package 一次打包，通过 Distribution Engine 分发到多个渠道
- **版本化一切** — Package 版本、Schema 版本、Evidence 版本全部可追溯

### 1.4 适用范围

- GEO Workspace：品牌知识发布
- Knowledge Hub：知识库内容发布
- 小说工作台：小说元数据 / 角色 / 世界观发布
- 短剧工作台：短剧 / 剧集信息发布
- PPT 工作台：演示文稿知识发布
- 未来 AI Lab：实验报告 / Benchmark 发布

---

## 2. Package Schema

### 2.1 顶层 Schema

```typescript
interface KnowledgePackage {
  /** 包元数据 */
  manifest: PackageManifest

  /** 实体定义（品牌/人物/概念等） */
  entities: Entity[]

  /** 声明列表（关于实体的断言） */
  claims: Claim[]

  /** 证据集合（支持声明的原始材料） */
  evidences: Evidence[]

  /** 引用来源 */
  citations: Citation[]

  /** FAQ */
  faqs: FAQ[]

  /** 结构化数据（JSON-LD / Schema.org 等） */
  structuredData: StructuredData[]

  /** 附件（图片/文档等媒体文件引用） */
  attachments: Attachment[]

  /** 验证状态 */
  verification: VerificationStatus
}
```

### 2.2 Entity

```typescript
interface Entity {
  id: string                    // 实体唯一 ID（UUID）
  type: EntityType              // brand | person | concept | product | organization | location | event
  name: string                  // 实体名称
  aliases?: string[]            // 别名（用于 AI 匹配）
  description?: string          // 简短描述
  properties?: Record<string, any>  // 扩展属性

  // 来源
  sourceId?: string             // 来源系统 ID
  sourceUrl?: string            // 来源 URL

  // 元数据
  createdAt: string             // ISO 8601
  updatedAt: string             // ISO 8601
  version: number               // 实体版本号
}
```

### 2.3 Claim

```typescript
interface Claim {
  id: string                    // 声明唯一 ID
  entityId: string              // 关联的实体 ID
  predicate: string             // 谓词（如 "foundedIn", "productDescription", "headquarter"）
  object: string                // 宾语值
  objectType?: ClaimObjectType  // text | url | date | number | entityRef | geo

  // 置信度
  confidence: number            // 0~1
  source?: string               // 声明来源

  // 证据绑定
  evidenceIds: string[]         // 关联的证据 ID 列表

  // 生命周期
  status: ClaimStatus           // draft | verified | disputed | deprecated
  createdAt: string
  updatedAt: string
}
```

### 2.4 Evidence

```typescript
interface Evidence {
  id: string                    // 证据唯一 ID
  claimId?: string              // 关联声明（可选，也可通过 Claim.evidenceIds 反向关联）
  type: EvidenceType            // webPage | document | official | thirdParty | userGenerated | knowledgeBase | aiResponse
  content: string               // 证据文本内容（或摘要）
  url?: string                  // 证据来源 URL
  title?: string                // 页面/文档标题

  // 可信度
  trustLevel: TrustLevel        // HIGH | MEDIUM | LOW | UNVERIFIED
  authority?: AuthorityLevel    // OFFICIAL | REFERENCE | USER | UNKNOWN

  // 时间
  crawledAt: string             // 抓取时间
  publishedAt?: string          // 原发布时间
  freshnessDays?: number        // 距离现在天数（自动计算）

  // 可追溯
  checksum?: string             // 内容哈希（用于完整性校验）
}
```

### 2.5 Citation

```typescript
interface Citation {
  id: string
  claimId: string               // 被引用的声明
  sourceUrl: string             // 引用来源
  sourceTitle?: string
  citedText?: string            // 被引用的原文片段
  citationType: CitationType    // directQuote | paraphrase | summary | reference
  publishedAt?: string          // 引用来源发布时间
}
```

### 2.6 FAQ

```typescript
interface FAQ {
  id: string
  entityId: string              // 所属实体
  question: string              // 问题
  answer: string                // 答案
  category?: string             // 分类
  evidenceIds?: string[]        // 支持的证据
  language?: string             // 语言（默认 zh-CN）
  priority?: number             // 排序权重
  status: ClaimStatus           // draft | verified | deprecated
}
```

### 2.7 StructuredData

```typescript
interface StructuredData {
  id: string
  entityId: string
  format: StructuredDataFormat  // jsonLd | microdata | rdfa | custom
  schemaType: string            // "Organization" | "Product" | "FAQPage" | "Article" | "Person" | ...
  content: Record<string, any>  // 具体的结构化数据内容
}
```

### 2.8 Attachment

```typescript
interface Attachment {
  id: string
  type: AttachmentType          // image | document | video | audio | file
  url: string                   // 文件 URL
  mimeType: string              // MIME 类型
  size?: number                 // 字节数
  checksum?: string             // 文件哈希
  title?: string
  description?: string
  entityId?: string             // 关联实体
}
```

### 2.9 VerificationStatus

```typescript
interface VerificationStatus {
  overall: VerificationLevel    // VERIFIED | PARTIALLY_VERIFIED | UNVERIFIED | DISPUTED
  claimCount: number            // 声明总数
  verifiedClaimCount: number    // 已验证声明数
  verificationRate: number      // 验证率 (0~1)
  lastVerifiedAt: string        // 最近验证时间
  checksum: string              // 包内容哈希
}
```

---

## 3. Package Lifecycle

```
                        ┌──────────────────────┐
                        │       DRAFT          │
                        │  (编辑/组装中)       │
                        └──────────┬───────────┘
                                   │ 提交审核
                                   ▼
                        ┌──────────────────────┐
                        │      REVIEWED        │
                        │  (人工/AI 审核)      │
                        └──────────┬───────────┘
                                   │ 验证通过
                                   ▼
                        ┌──────────────────────┐
                        │      VERIFIED        │
                        │  (Evidence 验证完成) │
                        └──────────┬───────────┘
                                   │ 打包
                                   ▼
                        ┌──────────────────────┐
                        │     PACKAGED         │
                        │  (生成 checksum)     │
                        └──────────┬───────────┘
                                   │ 发布
                                   ▼
                        ┌──────────────────────┐
                        │     PUBLISHED        │
                        │  (正式发布)          │
                        └──────────┬───────────┘
                                   │ 分发
                                   ▼
                        ┌──────────────────────┐
                        │    DISTRIBUTED       │
                        │  (送达各个渠道)      │
                        └──────────┬───────────┘
                                   │ 监测
                                   ▼
                        ┌──────────────────────┐
                        │     MONITORED        │
                        │  (持续监测漂移)      │
                        └──────────┬───────────┘
                                   │ 归档/过期
                                   ▼
                        ┌──────────────────────┐
                        │      ARCHIVED        │
                        │  (历史只读)          │
                        └──────────────────────┘
```

### 状态转换规则

| 当前状态 | 允许转换到 | 触发条件 |
|---------|-----------|---------|
| DRAFT | REVIEWED | 手动提交审核 |
| REVIEWED | VERIFIED | AI/人工审核通过 |
| REVIEWED | DRAFT | 审核退回修改 |
| VERIFIED | PACKAGED | 生成 manifest + checksum |
| PACKAGED | PUBLISHED | 用户点击发布 |
| PUBLISHED | DISTRIBUTED | Distribution Engine 完成多路分发 |
| DISTRIBUTED | MONITORED | Monitor 开始跟踪收录/引用 |
| MONITORED | DRAFT | 监测发现漂移，需要更新 |
| MONITORED | ARCHIVED | 用户主动归档 |
| PUBLISHED | ARCHIVED | 用户主动下架 |
| * | DEPRECATED | 标记为废弃（软删除） |

---

## 4. Package Manifest

```typescript
interface PackageManifest {
  /** 包标识 */
  id: string
  name: string
  version: string               // semver: "1.0.0"
  description?: string

  /** 作者/发布者 */
  author: {
    id: string
    name: string
    type: 'user' | 'system' | 'workspace'
  }

  /** 实体引用 */
  entityIds: string[]           // 包中包含的实体列表

  /** 完整性校验 */
  checksum: string              // SHA-256 of all content fields
  checksumAlgorithm: 'sha256'

  /** 依赖 */
  dependencies?: {
    packageId: string
    version: string
    required: boolean
  }[]

  /** 兼容性 */
  specVersion: string           // 本规范版本
  minSpecVersion?: string       // 兼容的最低规范版本
  maxSpecVersion?: string       // 兼容的最高规范版本

  /** 元数据 */
  createdAt: string
  updatedAt: string
  tags?: string[]
  workspace: string             // 来源工作台（geo | knowledge-hub | novel | drama | ppt）

  /** 分发路径 */
  distributionTargets?: string[]  // 已分发的目标渠道
}
```

---

## 5. Evidence Contract

### 5.1 绑定规则

每条 Claim 必须满足以下至少一项：

| 绑定类型 | 要求 | 示例 |
|---------|------|------|
| **直接证据** | `evidenceIds` 非空，且引用的 Evidence 存在 | 官网截图、官方文档 |
| **引用来源** | `citations` 包含引用 | 媒体报道、第三方评测 |
| **结构化数据** | 关联的 StructuredData 包含该信息 | JSON-LD 中的 Organization 信息 |
| **AI 验证** | AI 模型验证结果 | AI 回答中对声明的确认 |

### 5.2 可信等级

| 等级 | 值 | 条件 |
|------|-----|------|
| HIGH | 3 | 官方来源 or 多个独立第三方验证 |
| MEDIUM | 2 | 单一第三方来源，或官方间接来源 |
| LOW | 1 | 用户生成内容，或未经验证 |
| UNVERIFIED | 0 | 无任何证据绑定 |

### 5.3 来源规则

```
证据来源优先级:
1. OFFICIAL (官网、官方文档、官方社交媒体)
2. AUTHORITATIVE (政府、行业协会、Wikipedia)
3. REFERENCE (新闻媒体、评测网站)
4. USER (用户生成内容、论坛)
5. AI (AI 模型输出 — 优先级最低)
```

---

## 6. AI Consumption Contract

### 6.1 AI 如何读取

Knowledge Package 以 JSON 格式输出，AI 可以通过以下方式读取：

- **HTTP API** — GET `/api/v1/packages/{id}` 返回完整 Package
- **RSS Feed** — Package 摘要通过 RSS 分发
- **JSON-LD 嵌入** — Website 页面嵌入 JSON-LD 结构化数据
- **Sitemap** — Package 中的实体 URL 包含在 Sitemap 中
- **AI Feed** — 专属 AI 订阅 feed（XML/JSON 格式）

### 6.2 AI 如何引用

```typescript
interface AICitation {
  packageId: string             // 来源 Package ID
  claimId: string               // 被引用的 Claim ID
  evidenceId: string            // 支撑证据 ID
  sourceUrl: string             // 证据源 URL
  confidence: number            // AI 对引用的置信度
  citedAt: string               // 引用时间
}
```

AI 引用 Package 时，必须包含 `packageId` + `claimId` + `evidenceId`，确保引用可追溯。

### 6.3 AI 如何验证

AI 验证流程：
1. 读取 Package 中的 Claims
2. 对每条 Claim 检查其 Evidence 链
3. 对每条 Evidence 检查：
   - URL 是否可达
   - 内容是否一致（checksum 比对）
   - 发布时间是否新鲜
4. 输出验证结果（Verified / Partially / Unverified）

### 6.4 AI 如何更新

当 AI 发现 Package 中的信息过时或不准确时：
1. 提交 `Discrepancy Report`（包含差异描述 + 新证据）
2. Platform 收到后触发重新验证
3. 验证通过后生成新版本 Package
4. 旧版本标记为 `DEPRECATED`

---

## 7. Distribution Contract

### 7.1 分发目标

| 渠道 | 适配器 | 输出格式 | 状态 |
|------|--------|---------|------|
| Website | `website.adapter.ts` | HTML + JSON-LD 嵌入 | 🔴 未实现 |
| CMS (WordPress) | `wordpress.adapter.ts` | REST API / Webhook | 🔴 未实现 |
| Markdown | `markdown.adapter.ts` | .md 文件 | 🔴 未实现 |
| JSON-LD | `jsonld.adapter.ts` | 独立 JSON-LD 文件 | 🔴 未实现 |
| RSS | `rss.adapter.ts` | RSS 2.0 XML | 🔴 未实现 |
| API | `api.adapter.ts` | REST API 端点 | 🔴 未实现 |
| Static | `static.adapter.ts` | 静态文件（HTML/JSON） | 🔴 未实现 |

### 7.2 适配器接口

```typescript
interface DistributionAdapter {
  id: string
  name: string
  type: DistributionTarget

  /** 发布 Package 到目标 */
  publish(pkg: KnowledgePackage, options?: PublishOptions): Promise<DistributionResult>

  /** 更新已发布的 Package */
  update(pkg: KnowledgePackage): Promise<DistributionResult>

  /** 撤回发布 */
  unpublish(packageId: string): Promise<DistributionResult>

  /** 检查发布状态 */
  status(packageId: string): Promise<DistributionStatus>
}

interface DistributionResult {
  success: boolean
  target: string
  url?: string                  // 发布后的访问 URL
  version?: string              // 目标系统版本
  error?: string
}

interface DistributionStatus {
  packageId: string
  target: string
  status: 'synced' | 'pending' | 'failed' | 'unknown'
  lastSyncedAt?: string
}
```

### 7.3 DistributeOnce 原则

一个 Package 一次打包，分发到多个目标。不针对每个目标单独打包。

---

## 8. Verification Contract

### 8.1 预发布验证

在 Package 发布前：

```
1. Schema 合规性验证 → Package 格式符合 Spec v1
2. Evidence 完整性验证 → 每条 Claim 至少绑定一条 Evidence
3. 链接可达性验证 → 所有 URL 可访问
4. Checksum 一致性验证 → 内容与 manifest 中的 checksum 一致
5. AI 可读性验证 → 模拟 AI 读取是否成功
```

### 8.2 发布后验证

```
1. AI 收录检测 → Package 是否被 AI 检索到
2. 引用检测 → AI 是否引用了 Package 内容
3. 内容一致性检测 → 已分发内容与 Package 是否一致
4. 漂移检测 → AI 的回答是否偏离 Package 内容
```

### 8.3 Learning 回写

```typescript
interface VerificationFeedback {
  packageId: string
  claimId: string
  result: 'verified' | 'disputed' | 'deprecated'
  aiSource: string              // 检测来源（ChatGPT / Claude / DeepSeek 等）
  evidence?: string             // AI 给出的判断依据
  detectedAt: string
}
```

Feedback 写入后触发：
- 漂移率 > 阈值 → 通知用户 → 创建新版本
- 偏差声明被确认 → 更新对应 Claim 状态
- 多 AI 一致偏离 → 自动触发重新验证

---

## 9. Repository & Registry

### 9.1 PackageRepository

```typescript
interface PackageRepository {
  create(pkg: KnowledgePackage): Promise<PackageRecord>
  findById(id: string): Promise<PackageRecord | null>
  findLatestByEntity(entityId: string): Promise<PackageRecord | null>
  findByStatus(status: PackageStatus): Promise<PackageRecord[]>
  updateStatus(id: string, status: PackageStatus): Promise<void>
  listByWorkspace(workspace: string, options?: ListOptions): Promise<PackageRecord[]>
}
```

### 9.2 DistributionRepository

```typescript
interface DistributionRepository {
  create(log: DistributionLog): Promise<void>
  findByPackage(packageId: string): Promise<DistributionLog[]>
  findLatestByTarget(packageId: string, target: string): Promise<DistributionLog | null>
  updateStatus(id: string, status: DistributionStatus): Promise<void>
}
```

### 9.3 AdapterRegistry

```typescript
interface AdapterRegistry {
  register(adapter: DistributionAdapter): void
  resolve(type: DistributionTarget): DistributionAdapter | null
  list(): DistributionAdapter[]
  isRegistered(type: DistributionTarget): boolean
}
```

### 9.4 PackageRegistry

```typescript
interface PackageRegistry {
  register(pkg: KnowledgePackage): Promise<string>  // 返回 packageId
  lookup(entityId: string): Promise<KnowledgePackage | null>
  lookupByVersion(packageId: string, version: string): Promise<KnowledgePackage | null>
  listVersions(packageId: string): Promise<string[]>
  deprecate(packageId: string): Promise<void>
}
```

---

## 10. Event Model

### 10.1 事件定义

```typescript
interface PackageEvent {
  eventId: string
  eventType: PackageEventType
  packageId: string
  version: string
  timestamp: string
  actor?: { id: string; name: string }
  payload?: Record<string, any>
}

enum PackageEventType {
  // 生命周期
  PACKAGE_CREATED = 'package.created',
  PACKAGE_UPDATED = 'package.updated',
  PACKAGE_SUBMITTED = 'package.submitted',
  PACKAGE_REVIEWED = 'package.reviewed',
  PACKAGE_VERIFIED = 'package.verified',
  PACKAGE_REJECTED = 'package.rejected',

  // 发布
  PACKAGE_PUBLISHED = 'package.published',
  PACKAGE_UNPUBLISHED = 'package.unpublished',
  PACKAGE_ROLLED_BACK = 'package.rolled_back',

  // 分发
  DISTRIBUTION_STARTED = 'distribution.started',
  DISTRIBUTION_COMPLETED = 'distribution.completed',
  DISTRIBUTION_FAILED = 'distribution.failed',

  // AI 交互
  AI_INDEXED = 'ai.indexed',
  AI_CITED = 'ai.cited',
  AI_VERIFIED = 'ai.verified',
  AI_DISPUTED = 'ai.disputed',

  // 监测
  MONITOR_DRIFT_DETECTED = 'monitor.drift_detected',
  MONITOR_CITATION_LOST = 'monitor.citation_lost',

  // 学习
  LEARNING_SIGNAL_GENERATED = 'learning.signal_generated',
  PACKAGE_ARCHIVED = 'package.archived',
  PACKAGE_DEPRECATED = 'package.deprecated',
}
```

### 10.2 事件消费者

| 事件 | 消费者 | 行为 |
|------|--------|------|
| `package.verified` | Publishing Engine | 触发发布流程 |
| `package.published` | Distribution Engine | 触发多路分发 |
| `distribution.completed` | Monitor | 开始监测收录/引用 |
| `ai.disputed` | Verification Engine | 重新验证相关 Claim |
| `monitor.drift_detected` | Notification | 通知用户 |
| `learning.signal_generated` | Recommendation Engine | 调整推荐权重 |

---

## 11. Compatibility & Versioning

### 11.1 版本策略

- **Major 版本**（1.x → 2.x）：不兼容的 Schema 变更。新字段必填，旧字段移除。
- **Minor 版本**（1.1 → 1.2）：向后兼容的新增。新字段可选，旧字段保留。
- **Patch 版本**（1.1.1 → 1.1.2）：Bug 修复。无 Schema 变更。

### 11.2 字段废弃规则

1. 标记为 `@deprecated` 的字段保留至少 2 个 Major 版本
2. 废弃字段在前一个 Major 版本中必须保持可读取
3. 废弃字段在 Manifest 中标明 `deprecatedSince`

### 11.3 向后兼容规则

```
v1.x → v2.x:
- 允许：新增可选字段
- 允许：扩展已有枚举值
- 禁止：删除必填字段
- 禁止：修改现有字段类型
- 禁止：缩小枚举值范围
```

### 11.4 升级路径

```
v1 → v2 迁移:
1. 旧 Package 通过 `minSpecVersion: "1.0"` 声明兼容 v1
2. Adapter 读取时检查 `specVersion`，自动选择处理逻辑
3. 平台提供迁移工具：`kdp-migrate --from v1 --to v2`
4. 迁移期间两个版本并行运行
```

---

## 12. Security & Trust

### 12.1 Package 签名

```typescript
interface PackageSignature {
  algorithm: 'ed25519' | 'rsa-sha256'
  publicKeyFingerprint: string   // 发布者公钥指纹
  signature: string              // 对 manifest 内容的签名
  signedAt: string               // 签名时间
  expiresAt?: string             // 签名过期时间
}
```

### 12.2 完整性校验

- 每次 Package 打包生成 SHA-256 checksum
- checksum 覆盖 `entities + claims + evidences + citations + faqs + structuredData`
- 分发时携带 checksum，目标端可验证完整性
- Distribution 适配器收到后校验，不一致则拒绝写入

### 12.3 来源证明（Provenance）

```typescript
interface Provenance {
  packageId: string
  authorId: string
  workspace: string             // 来源工作台
  sourcePackage?: string        // 如果是从已有 Package 派生
  derivationType?: 'copy' | 'fork' | 'merge' | 'update'
  chain: ProvenanceEntry[]      // 完整溯源链
}

interface ProvenanceEntry {
  action: 'created' | 'modified' | 'merged' | 'copied' | 'archived'
  actorId: string
  timestamp: string
  description?: string
}
```

### 12.4 元数据安全

| 元数据字段 | 公开 | 说明 |
|-----------|------|------|
| packageId | ✅ | Package 唯一标识 |
| name | ✅ | Package 名称 |
| version | ✅ | 版本号 |
| author.name | ✅ | 发布者名称 |
| author.id | ❌ | 内部用户 ID（不公开） |
| checksum | ✅ | 完整性校验 |
| signature | ✅ | 签名信息 |
| createdAt | ✅ | 创建时间 |
| workspace | ✅ | 来源工作台 |
| tags | ✅ | 标签 |
| provenance | ✅ | 溯源链（不含内部 ID） |

---

## 13. Open Questions

### Q1: Package 粒度应该多大？
- **问题**: 一个 Package 应该包含一个实体的所有知识，还是每次变更的增量？
- **选项 A（全量）**: 每次发布都包含实体的完整知识状态。简单直接，但随着实体知识增长可能有冗余。
- **选项 B（增量）**: 增量发布，只包含本次变更。节省带宽，但需要客户端做合并。
- **建议**: 选项 A（全量）。当前阶段简单优先，后续可通过 Delta Package 扩展。

### Q2: 是否支持 Package 嵌套？
- **问题**: 一个 Package 能否引用或包含另一个 Package？
- **选项 A（扁平）**: 每个 Package 独立，通过 `dependencies` 字段引用。
- **选项 B（嵌套）**: Package 可以嵌套包含子 Package。
- **建议**: 选项 A（扁平 + 依赖引用）。嵌套增加复杂度，且可能导致循环依赖。

### Q3: Evidence 的最大数量和内容长度？
- **问题**: 是否需要限制一个 Package 中 Evidence 的数量或每条 Evidence 的内容长度？
- **建议**: 暂不设硬限制。但每个 Package 推荐不超过 100 条 Evidence，单条 Evidence 内容不超过 10KB。

### Q4: 如何处理多语言？
- **问题**: 同一实体在不同语言下的 Knowledge Package 如何管理？
- **选项 A（多语言同包）**: 一个 Package 包含所有语言版本。
- **选项 B（按语言拆分）**: 每种语言独立 Package，通过 `language` 标签关联。
- **建议**: 开放。建议先支持单语言（zh-CN），多语言在 v1.1 中定义。

### Q5: 是否支持 Package 历史版本自动清理？
- **问题**: 是否需要自动清理非常旧的 Package 版本？
- **建议**: 保留所有历史版本（只读可查询）。版本存储成本低，删除后追溯成本高。

### Q6: Adapter 实现无锁并发发布？
- **问题**: 多个 Distribution 同时发布到同一目标时，如何处理冲突？
- **建议**: 通过 `@@unique([packageId, target])` 保证幂等。最后写入者胜出，但所有操作写入 Distribution Log。

### Q7: AI Response 可否作为 Evidence？
- **问题**: AI 模型的回答可否作为某个 Claim 的证据？
- **建议**: 可以，但 `trustLevel` 自动降级为 `LOW`，且必须记录 AI 模型名称和版本。

---

## 14. Appendix: Design Decision Records

### ADR-001: 为什么选 JSON 作为 Package 序列化格式？

**状态**: Accepted  
**理由**: 
- JSON 是 AI 模型原生支持的格式（无需额外解析）
- 与 Prisma 的 JSON 字段原生兼容
- 前端和后端生态支持广泛
- JSON-LD 是其超集，可无缝升级
- **不选 XML**: 解析成本高，AI 支持差
- **不选 Protobuf**: 人类不可读，调试困难

### ADR-002: 为什么 Claim 和 Evidence 分离？

**状态**: Accepted  
**理由**:
- 一条 Evidence 可能支撑多个 Claim
- Claim 和 Evidence 生命周期不同（Claim 可被更新，Evidence 是快照）
- 分离后可独立进行 Evidence 的可信度评估
- 支持 Evidence 去重（Registry 机制）

### ADR-003: 为什么 Package 是全量而非增量？

**状态**: Accepted（当前阶段）  
**理由**:
- 初始阶段简单性优先
- 全量 Package 无需客户端做合并逻辑
- 存储成本低（Package 以 JSON 存储，压缩率高）
- 后续可通过 Delta Extension 支持增量

### ADR-004: 为什么引入 Adapter Registry 而非硬编码分发逻辑？

**状态**: Accepted  
**理由**:
- 遵循平台可扩展设计原则
- 新增分发渠道无需修改核心逻辑，只需注册新 Adapter
- 与现有 Provider Registry 模式一致
- 支持第三方开发独立的 Distribution Adapter

### ADR-005: 为什么 Event Model 采用字符串枚举而非数字？

**状态**: Accepted  
**理由**:
- 字符串自描述，日志可读性强
- 便于事件驱动调试（不查映射表）
- 与现有 EventBus 的事件类型模式一致
- 支持 namespace 避免命名冲突（如 `package.` 前缀）

### ADR-006: 为什么 Spec 版本与 Package 版本分开？

**状态**: Accepted  
**理由**:
- Spec 版本（`specVersion`）标识规范本身的演进
- Package 版本（`version`）标识业务内容的演进
- 二者解耦：同版本 Spec 下 Package 可以独立升级
- 便于 Adapter 判断兼容性（只检查 `specVersion`）

---

*Knowledge Package Specification v1.0-draft — 2026-07-22*
