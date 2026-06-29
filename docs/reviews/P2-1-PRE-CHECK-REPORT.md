# P2.1 Pre-Check Report

> Sprint: P2.1 — Citation Foundation
> Protocol: SDP Sprint Delivery Protocol V1.0
> Baseline: V4 Platform Baseline
> Date: 2026-07-17
> Verdict: **CONDITIONAL PASS**

---

## Phase 0 — Pre-Check 逐项确认

| ID | 检查项 | 结果 | 备注 |
|----|--------|------|------|
| P0-001 | Runtime V1 RC 已冻结 | ✅ | KMKI-RUNTIME-V1-RC.json 已生成，严禁修改 |
| P0-002 | Knowledge Object 为唯一真相源 | ✅ | Prisma 中 KnowledgeObject 表存在，Agent 不绕过 KO 写入 Graph |
| P0-003 | 前端规范 V2 生效 | ⚠️ | 已建立文档，但现有代码超限严重（见 UI Audit） |
| P0-004 | kmki-ui 使用平台组件 | ⚠️ | kmki-ui 目录已创建（仅 README），尚无实际组件迁移 |
| P0-005 | Platform Baseline 12 项规范确认 | ✅ | PLATFORM-BASELINE-V4.md 已冻结 |
| P0-006 | 不新增违反规范目录 | ✅ | P2.1 不新增目录 |
| P0-007 | 不产生重复 UI | ⚠️ | 现有代码存在重复样式定义，需在 P2.1 中逐步治理 |
| P0-008 | 对应 PLAT 层无未定决策 | ✅ | Citation 归属明确（详见 Capability Audit） |

**结论：** 无 P0 阻塞，3 个 ⚠️ 为现有技术债而非新增违规。**可进入 Phase 1，但 UI 超限问题需在 Sprint 中逐步治理。**

---

## 一、Architecture Baseline 确认

### Runtime V1 RC
- `backend/runtime/release/KMKI-RUNTIME-V1-RC.json` ✅ 已冻结
- 20/20 Benchmark, Avg 84.38, G1-G6 全部 PASS
- **P2.1 不修改 Runtime 代码**

### Knowledge Object (SSOT)
- Prisma: `KnowledgeObject` 表 ✅
- Entity Pipeline 已迁移到 KO → GraphSync ✅
- 无 Agent 绕过 KO 写入 Graph ✅

### Platform Baseline 合规
- V4 Platform Baseline 12 项规范 ✅ 已冻结
- P2.1 新增的 Citation 能力不违反任何规范

### Citation 层级归属（核心决策）

```
Platform Layer (core/citation)
    ↑ 平台能力（四个工作台共享后台/KO/Trust）
    ↑ 非 Workspace 私有
```

**断言：** Citation 是平台能力，不是 GEO Workspace 私有能力。理由：
1. 短剧 / 小说 / PPT 工作台未来也需要引用来源管理
2. Citation 关联 Trust Engine（平台级）
3. Citation 后台管理属于统一 Admin

---

## 二、Workspace Audit

### 后端模块完成度

| 模块 | Agent | Service | Repository | Route | 前端 | 状态 |
|------|-------|---------|------------|-------|------|------|
| Entity | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 完成 |
| Citation | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ 无 Route + 前端 |
| Evidence | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ 同 |
| Claim | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ 同 |
| FAQ | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ 同 |
| Schema | ✅ | ✅ | ✅ | ❌ | ❌ | ⚠️ 同 |
| Brand | — | — | — | ✅ | ✅ | ✅ 完成 |
| Keyword | — | — | — | ✅ | ✅ | ✅ 完成 |
| Scan | — | — | — | ✅ | ✅ | ✅ 完成 |
| Dashboard | — | — | — | ✅ | ✅ | ✅ 完成 |

**关键发现：** Citation (Agent + Service + Repository) 在 Sprint 1B 已实现，但**缺少 Route 层和前端页面**。P2.1 实际上是补全"搁置的交付缺口"，而非从零开始。

### 后端技术债
| 项 | 严重度 | 说明 |
|----|--------|------|
| `provider-resolver.ts.bak` | Low | 旧版本残留，不影响运行 |
| `llm-client.ts.bak` | Low | 旧版本残留 |
| `p0-gateway-route.ts.bak` | Low | 旧版本残留 |
| TSC 编译错误 | P1 | 主要来自短剧工作台（video-compiler / temporal-engine），GEO 模块本身无新增编译错误 |

### 前端模块完成度

| 页面 | 当前行数 | 规范上限 | 状态 |
|------|---------|---------|------|
| KnowledgeCenterPage | 133 | 150 | ✅ |
| ProjectSelectPage | 120 | 150 | ✅ |
| BrandProfilePage | 56 | 150 | ✅ |
| WebsiteScannerPage | 45 | 150 | ✅ |
| AssetCenterPage | 135 | 150 | ✅ |
| ExecutionStudioPage | 165 | 150 | ⚠️ 略超 |
| InspectorPanel | 246 | 150 | ❌ 超限 |
| BrandDetailPage | 297 | 150 | ❌ 超限 |
| KnowledgeGraphPage | 290 | 150 | ❌ 超限 |
| SemanticExplorer | 389 | 150 | ❌ 超限 |
| ExecutionPanel | 342 | 150 | ❌ 超限 |
| SettingsPage | 278 | 150 | ❌ 超限 |
| KeywordPage | 410 | 150 | ❌ 超限 |
| BrandListPage | 424 | 150 | ❌ 超限 |
| ProjectCreatePage | 401 | 150 | ❌ 超限 |
| SystemLensPage | 354 | 150 | ❌ 超限 |
| SystemControlPage | 500 | 150 | ❌ 超限 |
| SystemMetadataPage | 395 | 150 | ❌ 超限 |

**关键发现：** 符合前端规范 V2 的页面仅 5/18 个（28%），其余 13 个均超限。这是 P1~P1.5 快速交付期积累的技术债。

---

## 三、UI Audit

### 超过行数上限的组件

| 文件 | 行数 | 类型 | 上限 | 超限 |
|------|------|------|------|------|
| SystemControlPage | 500 | Page | 150 | +350 |
| BrandListPage | 424 | Page | 150 | +274 |
| KeywordPage | 410 | Page | 150 | +260 |
| ProjectCreatePage | 401 | Page | 150 | +251 |
| SystemMetadataPage | 395 | Page | 150 | +245 |
| SemanticExplorer | 389 | Page | 150 | +239 |
| SystemLensPage | 354 | Page | 150 | +204 |
| ExecutionPanel | 342 | Page | 150 | +192 |
| ExecutionTraceViewer | 348 | Comp | 200 | +148 |
| WorkflowTimeline | 299 | Comp | 200 | +99 |
| KnowledgeGraphPage | 290 | Page | 150 | +140 |
| SettingsPage | 278 | Page | 150 | +128 |
| BrandGEOWorkspace | 264 | Comp | 200 | +64 |
| InspectorPanel | 246 | Page | 150 | +96 |
| GeoDashboard | 284 | Comp | 200 | +84 |

**总计超限组件/页面：15 个**

### kmki-ui 迁移状态
| 组件 | GEO 位置 | kmki-ui 迁移 | 状态 |
|------|---------|-------------|------|
| Empty State | `GeoEmptyState.vue` (77行) | ❌ 未迁移 | 待迁移 |
| Skeleton | `GeoLoadingSkeleton.vue` (148行) | ❌ 未迁移 | 待迁移 |
| Toast | `GeoToast.vue` (140行) | ❌ 未迁移 | 待迁移 |
| StatCard | GeoDashboard 内内联 | ❌ 未迁移 | 待提取 |
| Badge | 各页面内联样式 | ❌ 未迁移 | 待提取 |

**现状：kmki-ui 仅有 README，0 个实际组件。5 个候迁移组件均尚未迁移。**

---

## 四、Platform Capability Audit — Citation 归属

### Citation 的层级归属

```
core/citation/
├── CitationService        — 业务逻辑（跨工作台共享）
├── CitationRepository     — 数据库访问
├── CitationValidator      — 输入校验
├── CitationAPI           — REST 端点（平台级）
└── (未来) CitationAgent    — AI-powered 引用生成
```

### 为什么 Citation 是平台能力 | 否 |
|----|------|------|
| 短剧工作台是否需要引用来源管理？ | ✅ 是 | |
| 小说工作台是否需要引用来源管理？ | ✅ 是 | |
| PPT 工作台是否需要引用来源管理？ | ✅ 是 | |
| Citation 是否关联 Trust Engine？ | ✅ 是 | |
| Citation 后台是否属于统一 Admin？ | ✅ 是 | |

**结论：** Citation → **Platform Capability**（放在 `core/citation/` 或 `backend/src/services/platform/citation/`）

### 当前后端架构图（已有模块）

```
backend/src/services/geo/
├── agents/citation.agent.ts     ✅ 已实现
├── services/geo-citation.service.ts  ✅ 已实现（依附证据）
├── repositories/geo-citation.repository.ts  ✅ 已实现
├── routes/geo-citation.route.ts  ❌ 缺少
└── (未放入 core/)

backend/prisma/
└── model GEOCitation  ✅ 已存在
```

---

## 五、Admin Audit

| 模块 | 状态 | 说明 |
|------|------|------|
| Citation Management 入口 | ❌ 不存在 | 需要新建 |
| GEO 管理入口 | ❌ 不存在 | Baseline 已规划，未实现 |
| License 接口 | ⚠️ 不完整 | 前端有 `membership.ts` 定义，但 Entitlement Service 未实现 |
| Asset Center 接口 | ⚠️ 部分实现 | Route 已注册（try/catch 包裹），前端有 AssetCenterPage |
| Trust Engine 接口 | ❌ 不存在 | P2.4 才开发 |

**发现：** Backend `admin/` 目录不存在。当前 Admin 是前端独立页面系统，不是统一后台。

---

## 六、Risk Assessment

### P0 风险（阻止 Sprint 启动）

| ID | 风险 | 说明 | 处理建议 |
|----|------|------|----------|
| R-01 | 无 | — | — |

### P1 风险（需在 Sprint 中解决）

| ID | 风险 | 说明 | 影响 |
|----|------|------|------|
| R-02 | TSC 编译错误 | 短剧工作台模块（video-compiler, temporal-engine）有 15+ 个错误 | 不影响 GEO / P2.1 开发 |
| R-03 | Citation 归属决策待确认 | 当前 Citation 代码在 `geo/` 下，是按平台能力迁移到 `core/` 还是留在 GEO 内？ | 影响架构决策 |

### 技术债

| ID | 债项 | 严重度 | 建议 |
|----|------|--------|------|
| T-01 | 13/18 页面超 150 行 | 中 | 在 P2.1~P2.4 中逐步拆分 |
| T-02 | 15 个组件/页面超限 | 中 | 同上 |
| T-03 | kmki-ui 零组件 | 低 | P1.5 验收后立即启动迁移 |
| T-04 | `.bak` 文件残留 | 低 | 清理 |
| T-05 | Asset Routes try/catch | 低 | 后续修复 |
| T-06 | Admin 后台不存在 | 高 | 可独立 Sprint 处理 |

### 阻塞项

| ID | 项 | 处理 |
|----|----|------|
| B-01 | 无 | — |

### 对 P2.1 的影响程度评估

| 因素 | 影响 | 说明 |
|------|------|------|
| 新功能开发 | 低 | Citation Agent/Service/Repository 已存在 |
| 规范遵守 | 中 | P2.1 创建的页面必须严格执行 Frontend V2 |
| 平台化 | 中 | Citation 的层级归属（core/ vs geo/）需决定 |
| 编译 | 低 | 现有错误不阻碍 P2.1 |

---

## 七、建议处理顺序

1. **Decision: Citation 层级归属** — 核心架构决策，影响 Route 路径和导入方式
2. **AI 建议：将 Citation 迁移到 `core/citation/`**（作为平台能力，但保留 GEO 兼容性）
3. **P2.1 开发** — 补全 Route + 前端页面 + Admin
4. **UI 拆分为并行任务** — 逐步拆分超限页面（可与 P2.1 并行）
5. **kmki-ui 首批迁移** — 先迁移 EmptyState（77 行，最简单）

---

## 八、建议的 P2.1 Execution Plan

| Phase | 内容 | 预计耗时 |
|-------|------|----------|
| Phase 1 | Architecture — Citation 层级归属确认 | 需要你决策 |
| Phase 2 | Backend — 给已有 Citation Service 补 Route 层 | 短 |
| Phase 3 | Data — 使用已存在的 GEOCitation 表，确认结构 | 短 |
| Phase 4 | API — Citation CRUD + Search + Import/Export | 中 |
| Phase 5 | Frontend — Citation List / Detail / Editor / Import | 中 |
| Phase 6 | Admin — Citation 管理入口 | 中 |
| Phase 7 | Security — Permission / License / Tenant | 短 |
| Phase 8 | Test — Unit + Integration + Frontend | 中 |
| Phase 9 | Self-Audit — 全部 6 项审计 | 短 |
| Phase 10 | Deliverable — 10 件交付物 | 短 |
| Phase 11 | Final Acceptance | 你验收 |

---

## 九、Sprint Readiness Verdict

```
Verdict: ✅ CONDITIONAL PASS
Conditions:
  1. Citation 层级归属决策（core/citation/ vs geo/）在 Phase 1 前确定
  2. P2.1 新创建的页面/组件严格遵循 Frontend V2（≤150/≤200/≤120 行）
  3. 超限页面拆分作为副线任务在 Sprint 期间逐步处理（不阻塞 Phase 1）
```

---

*Pre-Check 执行完成。请确认 Verdict 后通知进入 Phase 1。*
