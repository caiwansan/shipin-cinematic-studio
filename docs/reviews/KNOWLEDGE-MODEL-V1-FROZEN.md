# AI Knowledge Model v1.0 — 冻结声明

## 状态: FROZEN
冻结日期: 2026-07-02
关联验收: KH-RC2 Gate — ✅ PASS
验收报告: `docs/reviews/KH-RC2-GATE-VERIFICATION.md`

## 冻结范围

以下组件冻结，仅允许 Bug Fix，不再调整核心模型：

### 1. Knowledge Package （M1 — Package Builder）
**文件**: `backend/src/services/knowledge/builders/package-builder.ts`
- BrandPackage / ProductPackage / OrganizationPackage / EntityPackage
- FaqItem / RelationItem
- `buildBrandPackage()`, `buildProductPackage()`, `buildOrganizationPackage()`, `buildEntityPackage()`

### 2. JSON-LD （M2 — JSON-LD Builder）
**文件**: `backend/src/services/knowledge/builders/jsonld-builder.ts`
- Organization / Product / Article / FAQ / Breadcrumb / Full @graph
- `buildOrganizationJsonLd()`, `buildProductJsonLd()`, `buildArticleJsonLd()`, `buildFaqJsonLd()`, `buildBreadcrumbJsonLd()`, `buildFullJsonLd()`

### 3. Prompt Block （M3 — Prompt Builder）
**文件**: `backend/src/services/knowledge/builders/prompt-builder.ts`
- LLM Summary / AI Citation Block / Retrieval Context / Canonical Facts / FAQ Prompt
- `buildLlmSummary()`, `buildAiCitationBlock()`, `buildRetrievalContext()`, `buildCanonicalFacts()`, `buildFaqPrompt()`
- `CanonicalFacts` interface

### 4. Knowledge Compiler （M4 — Compiler）
**文件**: `backend/src/services/knowledge/compiler/index.ts`
- `compileKnowledgePackage()`, `getKnowledgeSummary()`, `getJsonLdData()`, `getPromptData()`
- `CompileOptions`, `CompiledKnowledgePackage`

### 5. Knowledge Snapshot （M5 — Snapshot）
**文件**: `backend/src/services/knowledge/compiler/snapshot.ts`
- `createSnapshot()`, `getLatestSnapshot()`, `getSnapshot()`, `listSnapshots()`, `diffSnapshots()`
- `KnowledgeSnapshot`, `SnapshotDiff`

### 6. Knowledge Package API （M6 — API）
**文件**: `backend/src/services/knowledge/api/index.ts`（新增路由）
- `GET /package`, `GET /package/:type`
- `GET /jsonld`, `GET /jsonld/:type`
- `GET /prompt`
- `GET /snapshot`, `GET /snapshots`, `GET /snapshot/:version`
- `GET /export`

## 冻结纪律

1. 以上 6 个模块的接口签名和数据结构不允许调整
2. 新增字段可通过扩展 `extends` 或新增接口实现，不修改冻结接口
3. Bug 修复须在变更时注明此冻结声明
4. 冻结期至少到 GEO-RC2 完成

## 不在此冻结范围

以下模块持续活跃开发：
- Repository（可增加查询方法）
- API 路由（可新增端点，不修改已冻结端点签名）
- Prisma Schema（可新增字段，不影响冻结接口）

## 当前版本哈希

编译输出版本: `knowledge-hub-v1.0-rc1-4-g8afda89`
Snapshot contentHash: `45f91bf0b49a4d7636719c7339a181ad437de10af5c5fba1387d707f3619c9fb`
