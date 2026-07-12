# Sprint 3A: Evidence Architecture Freeze

> **目标：** 冻结 Evidence Engine 的 Data Model、Contract 和 Pipeline 设计，不编码。
> **当前状态：** 系统中存在 3 个不同的 `Evidence` 概念（Platform type、Verification、Truth Layer），需要统一。
> **前置条件：** ✅ Sprint 2 RC Gate 通过（45/45）

---

## 核心命题

> **Evidence 不是一次发布后的副产品，也不是 Verification 的私有数据——它是贯穿 Discovery → Knowledge → Packaging → Distribution 全链的统一事实层（Fact Layer）。**

Evidence Engine 的职责：
1. **收集** — 从每个引擎阶段自动捕获 Evidence
2. **关联** — 将 Evidence 链接到 Claims、Packages、PublishRecords
3. **评级** — 按确定性/可信度分层（Raw → Verified → Golden）
4. **提供** — 给 Observation Engine 和 Adaptive Engine 消费

---

## 现状审计

当前系统中**存在三个互不关联的「证据」概念**，这是 Sprint 3A 必须解决的架构债。

### 1. Platform Canonical Type: `KnowledgeEvidence`

```
backend/src/platform/knowledge-hub/core/types.ts
```

```ts
interface KnowledgeEvidence {
  id: string
  source: string      // 证明来源 URL/ID
  content: string     // 证明内容摘要
  url?: string        // 可选链接
  publishedAt?: string
}
```

**问题：** 太简单，没有 confidence/status/checksum/evidenceLink，并且被 PackageBuilder 直接序列化到 `package.json` 里。它现在承担的是"内容字段"角色，而不是"事实记录"。

### 2. Verification System: `EvidenceRecord` / `VerificationEvidence`

```
backend/src/services/geo/verification/verification.types.ts  → EvidenceRecord
backend/src/services/geo/verification/types.ts               → VerificationEvidence
```

两个完全不同：
- `EvidenceRecord` — 前后对比型（before/after/delta）
- `VerificationEvidence` — 来源型（claim_result / snapshot / ai_presence / optimization）

**问题：** 这两个互不相干，且都是 Verification 的私有类型，其他引擎不可见。

### 3. Truth Layer: `TruthEntry` / `TruthRecord`

```
backend/src/truth/truth-model.ts
```

系统已有的 SSOT 层：
```ts
interface TruthEntry {
  taskId: string
  winner: ExecutionResult
  score: TruthScore
  allResults: ExecutionResult[]
  timestamp: number
}
```

**问题：** Truth 是"执行结果仲裁"，不是"知识证据"。它跟 KnowledgeObject、Package、PublishRecord 没有任何关系。

---

## Evidence Architecture Freeze

### 核心概念：EvidenceRecord（统一证据对象）

**EvidenceRecord** 是整个 GEO 系统的唯一证据对象。不保留 `KnowledgeEvidence`（Platform type）和 `VerificationEvidence` 的独立定义，全部映射到 EvidenceRecord。

```ts
// ─── EvidenceRecord（唯一证据对象） ───
interface EvidenceRecord {
  // ── 标识 ──
  id: string
  type: 'discovery' | 'knowledge' | 'packaging' | 'distribution' | 'verification' | 'observation'

  // ── Scope：证据所属阶段（与 type 区分——type 表示来源种类，scope 表明归属域） ──
  scope: 'knowledge' | 'package' | 'distribution' | 'observation' | 'system'

  // ── 来源追踪（标准化：type + id + version） ──
  sourceType: string              // 'job_run' | 'publish_record' | 'truth_arbitration' | 'claim' | 'system'
  sourceId: string                // 对应记录 ID（如 publish_record_id、build_id）
  sourceVersion: string           // 语义版本

  // ── 目标关联（支持多目标——不只是 Package） ──
  targetType: 'knowledge_object' | 'claim' | 'citation' | 'asset' | 'package' | 'publish_record'
  targetId: string

  // ── 内容 ──
  content: string                 // 证明内容或摘要
  confidence: number              // 0-1
  checksum: string                // 内容指纹（确定性验证）

  // ── 证据等级（表示事实的确定程度，不是生命周期） ──
  level: 'raw' | 'verified' | 'golden'

  // ── 证据状态（表示生命周期——与 level 独立） ──
  status: 'pending' | 'confirmed' | 'invalid' | 'expired'

  // ── 元数据 ──
  metadata?: Record<string, any>
  collectedAt: Date               // 证据被捕获的时间

  // ── 可选的扩展指针 ──
  truthId?: string                // 指向 TruthRecord（如果经仲裁）
  verificationId?: string         // 指向 Verification 执行
}
```

### 设计决策（冻结）

| 决策 | 选择 | 理由 |
|------|------|------|
| 是否保留 `KnowledgeEvidence` | ❌ 废弃 | 改为 EvidenceRecord |
| 是否保留 `VerificationEvidence` | ❌ 废弃 | 改为 EvidenceRecord type=verification |
| **Evidence 是否支持多目标（Target）** | ✅ `targetType + targetId` | 可关联 KnowledgeObject / Claim / Citation / Asset / Package / PublishRecord |
| **Evidence 是否需要 scope** | ✅ `scope` 字段 | knowledge / package / distribution / observation / system |
| **Evidence 是否需要 status** | ✅ `status` 字段 | pending / confirmed / invalid / expired，与 level 独立 |
| **来源是否标准化** | ✅ `sourceType + sourceId + sourceVersion` | 方便定位问题 |
| **EvidenceLink 表现否立即建** | ❌ 暂缓 | Sprint 3B 先验证 EvidenceRecord 是否足够表达关系 |
| **EvidenceRecord 是否可修改** | ❌ **不可变（append-only）** | 创建后 content/checksum/confidence/collectedAt 不覆盖。状态变化通过新增记录实现 |
| 证据等级如何确定 | 按来源和验证程度：raw ≥ verified ≥ golden | Truth Layer 的输出可升级为 golden |
| Evidence 写入时机 | Build → 写；Distribution → 写；PublishRecord → 写 | 每一步结束时自动产生 EvidenceRecord |
| 是否留存 Evidence 历史 | ✅ 追加写入，不更新 | Evidence 是 immutable 的追加日志 |

### EvidenceLink（引用关系）

当前 Claims、Evidence、Citations 在 `package.json` 里是 flat array。Evidence Engine 需要建立显式引用关系：

```ts
interface EvidenceLink {
  evidenceId: string      // 指向 EvidenceRecord
  targetType: 'claim' | 'citation' | 'asset' | 'package'
  targetId: string
  relationship: 'supports' | 'contradicts' | 'references' | 'generates'
  createdAt: Date
}
```

### Evidence Pipeline

```
Discovery ───► EvidenceCollector(type='discovery')
  │                │
  │                ▼
  │           EvidenceRecord
  │           level: 'raw'
  │
Knowledge ──► EvidenceCollector(type='knowledge')
  │                │
  │                ▼
  │           EvidenceRecord
  │           confidence: 0-1
  │
Packaging ──► EvidenceCollector(type='packaging')
  │                │
  │                ▼
  │           EvidenceRecord
  │           checksum: hash(package_artifact)
  │
Distribution ► EvidenceCollector(type='distribution')
  │                │
  │                ▼
  │           EvidenceRecord
  │           checksum: hash(publish_files)
  │
Verification ► EvidenceCollector(type='verification')
                   │
                   ▼
              EvidenceRecord
              level: 'verified'
              confidence: 0-1
```

### Evidence Level（冻结）

| Level | 定义 | 来源 | 可否升级 |
|-------|------|------|----------|
| Raw | 系统自动捕获，未经验证 | Discovery/Knowledge/Packaging/Distribution 自动产生 | → Verified（经验证） |
| Verified | 经 Verification Engine 验证 | Verification Engine 输出 | → Golden（经仲裁） |
| Golden | 经 Truth Layer 仲裁，系统可靠 | Truth Layer 裁决 | 不变，最终等级 |

### Evidence Level 升级规则

```
Raw ──(Verification Engine)──► Verified
Verified ──(Truth Arbitration)──► Golden
```

升级是单向的，不能降级。

---

## Sprint 3B: 最小实现设计

### Phase 1：EvidenceRecord Model + Auto-Collect

```
Package Build
    ↓ 自动
EvidenceRecord {
  type: 'packaging'
  packageId: pkg.id
  content: hash(package_artifact)
  checksum: hash
  level: 'raw'
}

Distribution
    ↓ 自动
EvidenceRecord {
  type: 'distribution'
  packageId: pkg.id
  publishRecordId: record.id
  content: hash(publish_files)
  checksum: hash
  level: 'raw'
}
```

### Phase 2：Evidence History API

```
GET /api/v1/packages/:id/evidence
→ EvidenceRecord[]
→ 支持按 scope / type / level / status / collectedAt 筛选

GET /api/v1/packages/:id/evidence/timeline
→ 按 collectedAt 排序的完整 Evidence 时间线
→ 适用于 Observation Engine 的可视化输入

GET /api/v1/knowledge-objects/:id/evidence
→ 跨 Package 的完整 Evidence 历史
```

### Phase 3：Evidence 与 Truth Layer 整合

当 Truth Layer 输出仲裁结果时，自动产生 `level: 'golden'` 的 EvidenceRecord。
Verification Engine 输出时，自动产生 `level: 'verified'` 的 EvidenceRecord。

---

## 不做

- ❌ 立即实现完整的 EvidenceLink 表（Sprint 3B 只写 EvidenceRecord）
- ❌ 修改 Truth Layer（保持独立，仅通过 evidenceRecord.truthId 连接）
- ❌ 修改 Verification Engine（保持独立，仅通过 evidenceRecord.verificationId 连接）
- ❌ Observation Engine — 那是 Sprint 4
- ❌ Adaptive Engine — 那是 Sprint 5
- ❌ 废除旧表（knowledge_evidence 存在但已不活跃，可以推迟删除）

---

## 文件变更清单

| 文件 | 变更 | 说明 |
|------|------|------|
| `docs/product/ evidence-architecture.md` | 新建 | 本文档 |
| `backend/prisma/schema.prisma` | 新增 EvidenceRecord 模型 | 统一证据表 |
| `backend/src/platform/knowledge-hub/evidence/record.ts` | 新建 | EvidenceRecord 类型 + 工厂函数 |
| `backend/src/platform/knowledge-hub/evidence/collector.ts` | 新建 | EvidenceCollector（自动捕获） |
| `backend/src/platform/knowledge-hub/evidence/index.ts` | 新建 | barrel export |
| `backend/src/platform/knowledge-hub/evidence/level.ts` | 新建 | raw/verified/golden + 升级规则 |
| `backend/src/platform/knowledge-hub/core/types.ts` | 标记 KnowledgeEvidence 为 `@deprecated` | 指向 EvidenceRecord |
| `backend/src/platform/knowledge-hub/api/packaging-routes.ts` | 在 Build + Distribute 中调用 collectEvidence | Sprint 3B 实现 |

---

## DoD

- [x] EvidenceRecord 类型冻结（含 scope / type / sourceType+sourceId+sourceVersion / level / status / targetType+targetId / checksum）
- [x] Evidence Level 冻结（raw / verified / golden + 单向升级规则）
- [x] Evidence Status 冻结（pending / confirmed / invalid / expired，与 level 解耦）
- [x] Evidence Scope 冻结（knowledge / package / distribution / observation / system）
- [x] Evidence Target 冻结（支持多目标：knowledge_object / claim / citation / asset / package / publish_record）
- [x] EvidencePipeline 四种来源冻结（discovery/knowledge/packaging/distribution）
- [x] 旧 KnowledgeEvidence 标记 deprecated
- [ ] Sprint 3B 最小实现设计完成
- [x] Evidence Architecture 文档写入 docs/product/

### Sprint 3B DoD

- [ ] Build 自动产生 EvidenceRecord（type=packaging, scope=package）
- [ ] Distribution 自动产生 EvidenceRecord（type=distribution, scope=distribution）
- [ ] Evidence 查询 API（GET /api/v1/packages/:id/evidence）
- [ ] **Evidence Timeline（GET /api/v1/packages/:id/evidence/timeline）**
- [ ] EvidenceRecord Prisma 模型 + 表
- [ ] Golden Evidence E2E 验证
