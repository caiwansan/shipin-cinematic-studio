# Brand Knowledge OS 能力矩阵 v1.1

**依据**：《昆仑镜 Brand Knowledge OS 产品白皮书 v1.1》第五章（七项核心能力）
**状态**：冻结
**定义**：Brand Knowledge OS 全平台每项产品能力的实现状态，分为 Ready / Partial / Missing
**GEO Workspace** 是本平台的第一个产品化工作台，专注于 AI 品牌知识优化与分发。

---

## 七项核心能力总览

| 产品能力 | Backend | API | Frontend | 状态 | 备注 |
|---|---|---|---|---|---|
| 知识创建（Knowledge Creation） | ✅ | ✅ | ✅ | ✅ Ready | Includes Brand Project + Knowledge Asset |
| 知识优化（Knowledge Optimization） | ✅ | ✅ | ✅ | ⚠️ Partial | 商业语言优化需补充 |
| 知识验证（Knowledge Verification） | ✅ | ✅ | ✅ | ✅ Ready | Verification Engine + Explain |
| 知识包装（Knowledge Packaging） | ✅ | ✅ | ❌ | ⚠️ Partial | 6 种 Package Type，无 UI |
| 知识分发（Knowledge Distribution） | ✅ | ✅ | ❌ | ⚠️ Partial | Delivery Runtime + Static Delivery，无 UI |
| 知识监测（Knowledge Monitoring） | ✅ | ✅ | ⚠️ | ⚠️ Partial | 告警有计数，详情需增强 |
| 知识学习（Knowledge Learning） | ✅ | ✅ | ❌ | ⚠️ Partial | Learning Engine 就绪，UI 无 |

---

## 详细能力矩阵

### 1. 知识创建（Knowledge Creation）

| 子能力 | Engine | API | UI | 状态 |
|---|---|---|---|---|
| 创建品牌项目 | ✅ ProjectService | `POST /api/geo/projects` | ✅ GeoWorkspace | ✅ |
| 品牌信息编辑 | ✅ ProjectService | `PUT /api/geo/projects/:id` | ✅ 右侧 Panel | ✅ |
| 品牌列表 | ✅ Prisma | `GET /api/geo/projects` | ✅ Projects Panel | ✅ |
| 品牌知识对象 | ✅ KO System | `POST /api/knowledge/objects` | ⚠️ KMKI 系统 | ⚠️ |
| 品牌知识资产 | ✅ AssetBuilderService | `POST /api/geo/kdp/assets` | ❌ 无 UI | ⚠️ |
| 三层内容变体 | ✅ AssetVariantService | 内联 | ❌ 无 UI | ⚠️ |

---

### 2. 知识优化（Knowledge Optimization）

| 子能力 | Engine | API | UI | 状态 |
|---|---|---|---|---|
| 优化建议列表 | ✅ LearningEngine | `GET /api/geo/learning/signals` | ✅ InsightsPanel | ✅ |
| 建议解释 | ✅ ExplainEngine | `GET /api/geo/learning/explain/:signalId` | ✅ ExplainPanel | ✅ |
| 一键执行优化 | ✅ VerificationEngine | `POST /api/geo/verification/run` | ✅ "应用优化" | ✅ |
| 商业语言描述 | ⚠️ 部分技术语言 | 同 signals API | ⚠️ | ⚠️ |
| 执行状态追踪 | ✅ State Machine | `GET /api/geo/verification/job/:id` | ⚠️ 按钮反馈 | ⚠️ |

---

### 3. 知识验证（Knowledge Verification）

| 子能力 | Engine | API | UI | 状态 |
|---|---|---|---|---|
| 验证引擎 | ✅ VerificationEngine | `POST /api/geo/verification/run` | ✅ "重新验证" | ✅ |
| 评分解释 | ✅ ScoreExplainability | `GET /api/geo/recommendation/explain` | ✅ ExplainPanel | ✅ |
| 验证历史 | ✅ | `GET /api/geo/verification/history` | ✅ Evidence Tab | ✅ |
| 前后对比 | ✅ | `GET /api/geo/verification/compare` | ❌ 无 UI | ❌ |
| 验证状态机 | ✅ | 内联 | ⚠️ | ✅ |

---

### 4. 知识包装（Knowledge Packaging）

| 子能力 | Engine | API | UI | 状态 |
|---|---|---|---|---|
| 知识资产构建 | ✅ AssetBuilderService | 内联 Service | ❌ 无 UI | ⚠️ |
| 分发计划生成 | ✅ DistributionPlannerService | 内联 Service | ❌ 无 UI | ⚠️ |
| 包装管道 | ✅ PackagingPipeline | 内联 Service | ❌ 无 UI | ⚠️ |
| 包装编排 | ✅ PackagingOrchestrator | 内联 Service | ❌ 无 UI | ⚠️ |
| 包装适配器注册 | ✅ PackagingAdapterRegistry | 内联 | ❌ 无 UI | ⚠️ |
| 6 种 Package Type | ✅ (全部 Local) | 内联 | ❌ 无 UI | ⚠️ |
| Manifest 生成 | ✅ | 内联 | ❌ 无 UI | ⚠️ |
| Package 校验 | ✅ | 内联 | ❌ 无 UI | ⚠️ |

---

### 5. 知识分发（Knowledge Distribution）

| 子能力 | Engine | API | UI | 状态 |
|---|---|---|---|---|
| Delivery Runtime | ✅ DeliveryRuntime | 内联 | ❌ 无 UI | ⚠️ |
| DeliveryJob 管理 | ✅ JobRepository | 内联 | ❌ 无 UI | ⚠️ |
| DeliveryTarget 管理 | ✅ TargetRepository | 内联 | ❌ 无 UI | ⚠️ |
| DeliveryRecord | ✅ RecordRepository | 内联 | ❌ 无 UI | ⚠️ |
| Local Delivery | ✅ LocalDeliveryAdapter | 内联 | ❌ 无 UI | ⚠️ |
| Static Delivery | ✅ StaticDelivery | 内联 | ❌ 无 UI | ⚠️ |
| External Adapter | ❌ 未开始 | ❌ | ❌ | ❌ |

---

### 6. 知识监测（Knowledge Monitoring）

| 子能力 | Engine | API | UI | 状态 |
|---|---|---|---|---|
| 活跃告警计数 | ✅ MonitorService | `GET /api/geo/monitor/dashboard/:projectId` | ✅ InsightsPanel | ✅ |
| 告警详情 | ✅ | 同上 | ❌ 无 UI | ❌ |
| 发布状态检测 | ✅ | `POST /api/geo/monitor/check/published` | ❌ 无 UI | ❌ |
| 收录状态检测 | ✅ | `POST /api/geo/monitor/check/indexed` | ❌ 无 UI | ❌ |
| 漂移检测 | ✅ | `POST /api/geo/monitor/drift` | ❌ 无 UI | ❌ |

---

### 7. 知识学习（Knowledge Learning）

| 子能力 | Engine | API | UI | 状态 |
|---|---|---|---|---|
| 学习信号 | ✅ LearningEngine | `GET /api/geo/learning/signals` | ✅ InsightsPanel | ✅ |
| 学习仪表盘 | ✅ | `GET /api/geo/learning/dashboard` | ❌ 无 UI | ❌ |
| 信号历史 | ✅ | `GET /api/geo/learning/history` | ❌ 无 UI | ❌ |
| 信号解释 | ✅ ExplainEngine | `GET /api/geo/learning/explain/:signalId` | ✅ ExplainPanel | ✅ |

---

## 当前可用能力分布

| 状态 | 数量 | 占比 |
|---|---|---|
| Ready | 17 | 32% |
| Partial | 20 | 38% |
| Missing | 16 | 30% |
| **总计** | **53** | **100%** |

---

## 缺口分布

75% 的 Missing 能力集中在两个领域：
1. **知识包装 & 知识分发 UI** — KDP 核心能力全部 Ready，但无任何用户界面
2. **外部平台适配器** — K4 RC2 尚未开始
