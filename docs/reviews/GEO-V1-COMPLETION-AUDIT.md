# GEO V1 Completion Audit (Phase 0)

> **审计日期**: 2026-07-20
> **审计范围**: GEO Workspace 全栈（前端 + 后端 + Adapter + Platform 能力接入）
> **原则**: 只扫描，不修改。平台能力不写进 GEO。
> **产出**: 本报告作为 Batch 3（P18 Retirement）并行工作，**不影响 Batch 3 启动状态**

---

## 一、当前范围总览

### 前端（brand-geo 目录 — 52 文件）

| 类别 | 文件数 | 说明 |
|------|--------|------|
| Pages (.vue) | 18 | 页面级组件 |
| Components | 15 | 业务/原子组件 |
| Composable | 2 | `useBrandGEORuntime`, `useGeoHydrate` |
| Stores | 1 | `useBrandGeoStore` |
| Services | 6 | API 调用层 |
| Config | 2 | `sidebar.ts`, `dashboard-cards.ts` |
| Types | 3 | `brand.ts`, `index.ts`, `runtime.ts` |
| **总计** | **47** | 不含入口文件 (DEPRECATED.md, BrandGEOWorkspace.vue) |

### 后端（services/geo/ — 70+ 文件）

| 类别 | 数量 | 说明 |
|------|------|------|
| Routes | 11 | REST API 路由文件 |
| Services | 11 | 业务逻辑层 |
| Agents | 8 | AI Agent 定义 |
| Repositories | 8 | 数据库访问层 |
| Adapters | 3 | 平台能力适配器（仅 Citation） |
| Registry | 4 | Workflow/Prompt 注册 |
| Runtime | 10+ | Generation/Knowledge/Provider/Trace |
| Types | 1 | 类型定义 |
| Utils | 1 | 工具函数 |
| **总计** | ~57 | 活跃文件（不含测试） |

### 平台能力（core/）

| 模块 | 路径 | 状态 |
|------|------|------|
| Citation | `core/citation/` | ✅ 7 文件，完整实现 |
| Trust Engine | `core/trust/` | ❌ **不存在** — 仅在 decision-runtime 中有 `trust-weight-registry` 和 `d2-trust-layer` |
| Evidence | — | ❌ **只在 GEO 内部**（`services/geo/services/geo-evidence.service.ts`） |
| Claim | — | ❌ **只在 GEO 内部**（`services/geo/services/geo-claim.service.ts`） |

---

## 二、已完成项（✅ — V1 能力已有）

### 2.1 前端页面

| 页面 | 路由 | 状态 | 行数 | 备注 |
|------|------|------|------|------|
| Dashboard | `?panel=dashboard` | ✅ 完成 | — | GeoDashboard.vue 组件 |
| Brand List | `?panel=brands` | ✅ 完成 | — | BrandListPage.vue |
| Brand Detail | `?panel=brand-detail` | ✅ 完成 | ~240 行 | BrandDetailPage.vue — **行数超限**，需拆组件 |
| Brand Profile | `?panel=brand-profile` | ✅ 完成 | — | BrandProfilePage.vue |
| Keywords | `?panel=keywords` | ✅ 完成 | — | KeywordPage.vue |
| Knowledge Center | `?panel=knowledge` | ✅ 完成 | — | KnowledgeCenterPage.vue |
| Knowledge Graph | `?panel=knowledge-graph` | ✅ 完成 | — | KnowledgeGraphPage.vue |
| Settings | `?panel=settings` | ✅ 完成 | — | SettingsPage.vue — **含 Provider/Credential/模型管理，需清理** |
| Website Scanner | `?panel=website` | ✅ 完成 | — | WebsiteScannerPage.vue |
| Project Create | `?panel=create-project` | ✅ 完成 | — | ProjectCreatePage.vue |
| Project Select | `?panel=select-project` | ✅ 完成 | — | ProjectSelectPage.vue |

### 2.2 后端路由

| 路由 | 路径 | 状态 | 备注 |
|------|------|------|------|
| Dashboard | `/api/geo/dashboard/stats` | ✅ 完成 | 含品牌/KO/关键词/关系/扫描统计 |
| Projects | `/api/geo/projects` | ✅ 完成 | CRUD |
| Brands | `/api/geo/brands` | ✅ 完成 | CRUD + 品牌详情 |
| Entities | `/api/geo/entities` | ✅ 完成 | CRUD |
| Knowledge | `/api/geo/knowledge` | ✅ 完成 | KO CRUD + merge |
| Knowledge Graph | `/api/geo/graph` | ✅ 完成 | 图谱查询 |
| Keywords | `/api/geo/keywords` | ✅ 完成 | 关键词管理 |
| Scan | `/api/geo/scans` | ✅ 完成 | 官网扫描触发 |
| Trace | `/api/geo/trace` | ✅ 完成 | 执行轨迹 |
| Knowledge Quality | `/api/geo/knowledge-quality` | ✅ 完成 | Evidence/Claim/FAQ 执行路由 |
| Watcher | `/api/geo/watcher` | ✅ 完成 | 监控 |

### 2.3 Adapter 模式

| Adapter | 路径 | 状态 | 备注 |
|---------|------|------|------|
| Citation Adapter | `adapters/citation/` | ✅ 完成 | 3 文件（index.ts + GeoCitationAdapter.ts + routes.ts） |

---

## 三、未完成项（❌ — V1 需要但缺失）

### 3.1 缺失的页面

| 页面 | 当前状态 | 需要动作 |
|------|----------|----------|
| **Evidence 页面** | ❌ 不存在 | 新建 `Pages/EvidenceListPage.vue`, `EvidenceDetailPage.vue` |
| **Claim 页面** | ❌ 不存在 | 新建 `Pages/ClaimTreePage.vue`, `ClaimDetailPage.vue` |
| **History/Activity** | ❌ 不存在 | 新建 `Pages/HistoryPage.vue` — 执行/扫描历史列表 |
| **Report** | ❌ 不存在 | 新建 `Pages/ReportPage.vue` — 品牌/知识报告生成与查看 |
| **Asset Center** | ⚠️ 存在但非统一 | `AssetCenterPage.vue` 存在，但未接入 Platform Asset Center |

### 3.2 Evidence（后端有，前端无）

**后端**: ✅ 完整
- `services/geo/services/geo-evidence.service.ts` — create, findByClaimId, list, update
- `services/geo/agents/evidence.agent.ts`
- `routes/geo-knowledge-quality.route.ts` — 通过 workflow 调用
- `repositories/geo-evidence.repository.ts`

**前端**: ❌ 缺失
- 无 Evidence 列表页面
- 无 Evidence 详情页面
- 无 Evidence Score/Trace/Source 展示
- 无 Evidence Filter/Export

### 3.3 Claim（后端有，前端无）

**后端**: ✅ 完整
- `services/geo/services/geo-claim.service.ts` — create, findByEntityId, list, update
- `services/geo/agents/claim.agent.ts`
- `repositories/geo-claim.repository.ts`

**前端**: ❌ 缺失
- 无 Claim Tree 页面
- 无 Claim Status/Confidence 展示
- 无 Evidence Binding / Citation Binding 展示
- 无 Reasoning 展示

### 3.4 Trust Engine（全缺）

**后端**: ⚠️ 在 decision-runtime 中有，但未平台化到 `core/trust/`
- `decision-runtime/signal-orchestration/trust-weight-registry.ts`
- `decision-runtime/invocation/d2-trust-layer.ts`

**前端**: ❌ 缺失
- 无 Trust Score 展示
- 无 Trust 面板

### 3.5 Workflow 闭环

| Workflow 步骤 | 状态 | 备注 |
|--------------|------|------|
| Website 采集 | ✅ 完成 | → Workspace 页面完成 |
| ↓ Knowledge 加工 | ✅ 完成 | → KO CRUD、知识图谱 |
| ↓ Citation 生成 | ✅ 完成 | → core/citation + Adapter |
| ↓ Evidence  | ⚠️ 后端有、前端无 | → 缺少 UI |
| ↓ Claim | ⚠️ 后端有、前端无 | → 缺少 UI |
| ↓ Trust | ❌ 全缺 | → 需要 core/trust 先到位 |
| ↓ Report 输出 | ❌ 全缺 | → 报告生成/展示 |

**结论**: Workflow 从 Website → Knowledge → Citation 已完成，但 Evidence → Claim → Trust → Report 链尚未前端闭环。

---

## 四、重复能力（⚠️ — 应迁移到 Platform 但仍在 GEO 内）

### 4.1 Provider 管理（应属于 AI Center）

| 位置 | 说明 | 建议动作 |
|------|------|----------|
| `SettingsPage.vue` | 含 Provider/API Key/Credential 管理 | **删除** → 改为"前往 AI Center" |
| `runtime/provider/` | GEO 内部 provider-resolver, llm-client, capability-registry | **冻结** — 等待 AI Center 就绪后迁出 |
| `StepProvider.vue` (Wizard) | 创建品牌时选 Provider/模型 | **删除** — 改为使用平台默认模型 |
| `platform-llm.vue` | Life Assistant 已 Deprecate，但仍在 director-os 中 | 保持现状（非 GEO 模块） |

### 4.2 Website 管理（应属于 Platform Knowledge Acquisition）

| 位置 | 说明 | 建议动作 |
|------|------|----------|
| `WebsiteScannerPage.vue` | 官网扫描 UI | **保持** — 但采集能力不做增强 |
| `BrandDetailPage.vue` 中的"官网管理"卡片 | 含扫描触发/记录 | **保持** — 数据展示层 |
| `geo-scan.route.ts` | 扫描 API | **冻结** — 不新增扫描类型 |
| `StepWebsite.vue` (Wizard) | 创建品牌时输入官网 | **保持** |

**原则**: GEO 保留 Website 信息展示和触发扫描的能力，但深层采集/爬虫/监控能力归属 Platform。

### 4.3 Evidence/Claim（应在 core/ 层）

| 当前情况 | 建议 |
|----------|------|
| `geo-evidence.service` 和 `geo-claim.service` 在 GEO 内部实现 | **短期保持**（V1 需要）。**长期** Evidence/Claim 应成为 Platform 基础设施，GEO 通过 Adapter 调用 |
| 无 `core/evidence/` 和 `core/claim/` | Phase B 目标 |

### 4.4 Execution Studio（应属于 Platform Runtime）

| 位置 | 说明 | 建议 |
|------|------|----------|
| `ExecutionPanel.vue`, `ExecutionStudioPage.vue`, `InspectorPanel.vue` | 属于 Developer 工具 | **保持** 作为 Developer 面板，不作为产品页面 |
| `SystemControlPage.vue`, `SystemLensPage.vue`, `SystemMetadataPage.vue` | 系统级调试 | **保持** 作为 Developer 面板 |

---

## 五、应保留的内容（✅ — 正确的 GEO Workspace 职责）

### 5.1 正确的 Workspace 能力

| 能力 | 定位 | 说明 |
|------|------|------|
| 品牌 CRUD | ✅ Workspace 业务 | 品牌管理的增删改查 |
| 品牌信息展示 | ✅ Workspace 业务 | Dashboard、品牌列表、详情 |
| 关键词管理 | ✅ Workspace 业务 | 关键词 CRUD、标签管理 |
| 知识图谱可视化 | ✅ Workspace 业务 | D3 图谱、节点关系展示 |
| Knowledge Center | ✅ Workspace 业务 | KO 列表、搜索、详情 |
| 项目/品牌创建 Wizard | ✅ Workspace 业务 | 引导式创建流程 |
| Settings（仅 Workspace 偏好） | ✅ Workspace 业务 | 语言/默认输出/模板/自动保存 |
| Evidence/Claim 展示 | ✅ Workspace 业务 | 仅展示，不实现引擎 |
| Report 查看 | ✅ Workspace 业务 | 报告消费，不实现生成引擎 |

### 5.2 正确的 Adapter 模式

**Citation Adapter**（✅ 标杆）:
```
GEO Workspace → GeoCitationAdapter → core/citation/
```
Workspace 不直接访问 Core，通过 Adapter 桥接。其他能力（Evidence/Claim/Trust）也应按此模式设计。

---

## 六、Frontend V2 规范合规检查

| 规范 | 当前状态 | 结论 |
|------|----------|------|
| Page ≤150 行 | BrandDetailPage ~240 行超限 ⚠️ | 需要拆组件 |
| Feature ≤200 行 | — | 待验证 |
| Step ≤120 行 | — | 待验证 |
| Atomic ≤80 行 | — | 待验证 |
| PAGE 职责隔离 | BrandGEOWorkspace.vue 混合路由+布局+数据 👎 | 需要重构 |
| `.geo-*` class 体系 | ✅ 已遵循 | 所有页面使用 `.geo-page`, `.geo-card` 等 |
| Wizard 模式 | ✅ StepBasicInfo/Design/Provider/Finish 完整 | 模板完整 |
| 统一 Layout | ⚠️ 无统一 Layout 组件 | 每个页面自己处理 header/breadcrumb |
| 统一 Loading/Empty/Error | 组件存在但未统一使用 | GeoLoadingSkeleton / GeoEmptyState 存在但非每个页面都引用 |
| 统一 Dark Theme | ✅ 已遵循 | `.geo-*` 均已暗色设计 |

---

## 七、Settings 页面的 Provider/Credential 依赖审计

```
SettingsPage.vue 当前包含：
├── Workspace 偏好（保留）
│   ├── 默认语言
│   ├── 默认输出格式
│   └── 自动保存
├── Provider 管理（删除 → "前往 AI Center"）
│   ├── 供应商列表
│   ├── API Key 配置
│   └── 模型选择
├── Credential 管理（删除 → "前往 AI Center"）
│   ├── API Key 录入
│   └── 密钥轮换
└── 模型配置（删除 → "前往 AI Center"）
    ├── 默认模型
    └── 模型参数
```

**必须删除**：Provider、Credential、模型管理。
**保留**：Workspace 偏好（语言/格式/输出/自动保存）。

---

## 八、Asset Center 审计

| 检查项 | 状态 | 说明 |
|--------|------|------|
| Asset Center 页面存在 | ⚠️ 存在但非统一 | `AssetCenterPage.vue` 在 brand-geo/ 目录中 |
| Platform Asset Center 就绪 | ✅ | 在 platform 架构中有 Asset Center 设计（core/asset-economy） |
| Workspace 直接管理附件 | ❌ 应禁止 | `brandService.ts` 和 `visibilityService.ts` 中直接上传文件 |
| 当前连接方式 | GEO 内自建 | 非 Adapter 模式 |

**建议**: AssetCenterPage.vue 改为引用 Platform Asset Center 的组件（Platform Adapter 模式），GEO 不再管理文件附件。

---

## 九、整体评分

| 维度 | 完成度 | 备注 |
|------|--------|------|
| 后端 Service | ✅ 8/10 | Evidence/Claim 后端完整，缺 Trust Engine |
| 后端 Routes | ✅ 9/10 | 覆盖全面，缺 Report API |
| 前端 Pages | ⚠️ 6/10 | 缺 Evidence/Claim/History/Report 页面 |
| UI 规范合规 | ⚠️ 5/10 | 统一 Layout/Breadcrumb 缺，行数控制未全面落实 |
| Adapter 模式 | ✅ 6/10 | Citation ✅ 正确，Evidence/Claim 仍直接使用 Service（非 Adapter） |
| Workflow 闭环 | ⚠️ 5/10 | Website→Knowledge→Citation 通，Evidence→Claim→Trust→Report 断 |
| Settings 清理 | ⚠️ 4/10 | Provider/Credential/模型仍在，需剥离 |
| Asset 接入 | ⚠️ 3/10 | 仍自有管理，未接入 Platform |
| Trust 集成 | ❌ 0/10 | core/trust 不存在 |
| Frontend V2 | ⚠️ 4/10 | Layout/Breadcrumb/Empty/Error 未统一 |
| **综合评分** | **🟡 5.0/10** | 后端接近完成，前端缺失明显，UI 规范需大幅度统一 |

---

## 十、Phase 1-11 工作量估算

| Phase | 工作项 | 预估 |
|-------|--------|------|
| **Phase 1** | UI Completion（Layout/Breadcrumb/Card/统一） | 📋 中型 |
| **Phase 2** | Workflow Completion（Evidence UI + Claim UI） | 📋 中型 |
| **Phase 3** | Citation Integration（检查 + 统一 Adapter） | 📋 小型 |
| **Phase 4** | Knowledge Completion（Knowledge Center 补齐） | 📋 小型 |
| **Phase 5** | Evidence Workspace（前端页面） | 📋 中型 |
| **Phase 6** | Claim Workspace（前端页面） | 📋 中型 |
| **Phase 7** | Trust（等待 core/trust → Workspace 展示） | 📋 等待 Phase B |
| **Phase 8** | Settings 清理（剥离 Provider/Credential） | 📋 小型 |
| **Phase 9** | Asset Integration（Platform Adapter） | 📋 中型 |
| **Phase 10** | Workspace Review（评分审计） | 📋 小型 |
| **Phase 11** | Completion Report | 📋 小型 |

### 执行建议

**优先级排序**（最高价值/最低风险优先）：

```
Phase 1 (UI) → Phase 8 (Settings 清理) → Phase 2+5+6 (Workflow 闭环) 
→ Phase 3+4+9 (Adapter/Asset) → Phase 7 (Trust — 依赖 Phase B) 
→ Phase 10 (Review) → Phase 11 (Report)
```

**依赖关系**:
- Phase 7 (Trust) 阻塞于 `core/trust/` 的实现（Phase B 范畴）
- Phase 3 (Citation) 依赖程度低 — 当前 Adapter 模式已正确，只需验证一致性
- Phase 8 (Settings) 无依赖 — **可立即执行**

---

*End of GEO V1 Completion Audit — Phase 0*
