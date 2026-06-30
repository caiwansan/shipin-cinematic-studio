# GEO 产品路线图 v1.0

**依据**：《昆仑镜 GEO 产品白皮书 v1.0》第四章（八阶段工作流）
**状态**：冻结
**定义**：GEO 工作台全部产品功能的阶段规划与验收标准

---

## Phase 1：MVP 全闭环

覆盖白皮书第四章全部八阶段。

### 1. 品牌创建（Build）

| 项 | 内容 |
|---|---|
| 用户目标 | 用户输入品牌名称/官网，系统自动创建品牌档案 |
| 页面入口 | Overview Tab → "新建品牌" 按钮（左侧 Projects Panel 顶部） |
| 后端 API | `POST /api/geo/projects` |
| 数据来源 | 项目表 + 知识对象表 |
| MVP 完成标准 | 用户可输入品牌网址，系统创建品牌档案并写入 DB |
| 验收标准 | 创建后项目出现在左侧 Projects Panel，点击可查看详情 |

**当前状态**：✅ 完成

---

### 2. AI 收录检测（Analyze）

| 项 | 内容 |
|---|---|
| 用户目标 | 检测品牌在 AI 中的认知情况，生成检测报告 |
| 页面入口 | Overview Tab → "开始检测" 按钮 |
| 后端 API | `POST /api/geo/scans` + `POST /api/geo/learning/run` |
| 数据来源 | GeoScorer + Learning Engine |
| MVP 完成标准 | 用户点击检测后，系统在后台执行评分，完成后 Overview 显示 GEO 评分 |
| 验收标准 | 评分显示在 Overview 仪表盘，评分变化可追踪 |

**当前状态**：✅ 完成

---

### 3. 品牌质量报告（Report）

| 项 | 内容 |
|---|---|
| 用户目标 | 查看品牌在 AI 认知中的完整质量报告，包含各维度评分 |
| 页面入口 | Overview Tab → GEO 评分卡片 → "查看报告" |
| 后端 API | `GET /api/geo/reports/generate?projectId=&type=` |
| 数据来源 | GeoScorer 各维度评分 + Knowledge Quality |
| MVP 完成标准 | 报告包含 visibility / authority / content / website / knowledge 五维评分及详情 |
| 验收标准 | 报告可导出视图（当前为 JSON 数据），各维度可展开查看细分项 |

**当前状态**：⚠️ 部分完成。API 和 Engine 就绪，UI 层报告展示仅通过 Overview 仪表盘展示分数，无专门的报告页面。细分项需增强。

---

### 4. 优化建议（Optimize）

| 项 | 内容 |
|---|---|
| 用户目标 | 获取可操作的 AI 优化建议，以商业语言描述 |
| 页面入口 | Insights Tab |
| 后端 API | `GET /api/geo/learning/signals?projectId=` |
| 数据来源 | LearningEngine → LearningSignal 表 |
| MVP 完成标准 | Insights 面板显示建议列表，每条包含标题/原因/置信度/预计效果 |
| 验收标准 | 建议以商业语言描述，可查看详情 |

**当前状态**：⚠️ 部分完成。API 就绪，InsightsPanel 已接入数据显示。建议的商业语言转换需补充（当前部分字段仍为技术语言）。

---

### 5. 执行优化（Execute）

| 项 | 内容 |
|---|---|
| 用户目标 | 一键执行优化建议 |
| 页面入口 | Insights Panel → "应用优化" 按钮 + Evidence Tab → "重新验证" 按钮 |
| 后端 API | `POST /api/geo/verification/run` |
| 数据来源 | VerificationEngine → OptimizationExecution 表 |
| MVP 完成标准 | 用户点击"应用优化"→ 系统提交验证 → 完成后显示结果反馈 |
| 验收标准 | 执行过程可追踪（pending → running → completed/failed），结果可见 |

**当前状态**：✅ 完成

---

### 6. 发布（Publish）

| 项 | 内容 |
|---|---|
| 用户目标 | 将品牌信息发布到官网/FAQ/结构化内容 |
| 页面入口 | Publish Tab |
| 后端 API | `POST /api/geo/publishing/submit`, `POST /api/geo/publishing/approve` |
| 数据来源 | PublishingService → PublishingRecord 表 |
| MVP 完成标准 | 用户可提交发布、审阅、查看发布历史 |
| 验收标准 | 发布状态可追踪，可回滚，Publish Tab 显示记录列表 |

**当前状态**：✅ 完成

---

### 7. 验证（Verify）

| 项 | 内容 |
|---|---|
| 用户目标 | 验证优化是否真正产生效果 |
| 页面入口 | Evidence Tab |
| 后端 API | `GET /api/geo/verification/history/:projectId` |
| 数据来源 | VerificationEngine → VerificationResult 表 |
| MVP 完成标准 | 验证结果显示 Delta 变化 + 是否改善标记 |
| 验收标准 | 每个验证记录包含 before/after 快照 ID，可溯源 |

**当前状态**：✅ 完成

---

### 8. 持续监测（Monitor）

| 项 | 内容 |
|---|---|
| 用户目标 | 持续监测 AI 推荐变化、收录变化、漂移风险 |
| 页面入口 | Overview Tab → 活跃告警区（右侧 InsightsPanel 顶部） |
| 后端 API | `GET /api/geo/monitor/dashboard/:projectId` |
| 数据来源 | MonitorService → Observation 表 |
| MVP 完成标准 | Overview 显示活跃告警计数，点击可查看详情 |
| 验收标准 | 监测数据自动更新，漂移风险主动提示 |

**当前状态**：⚠️ 部分完成。API 就绪，InsightsPanel 已接入活跃建议计数。告警详情展示和主动提醒需补充。

---

## 第二阶段：完善品牌运营能力

规划方向（仅定义框架，内容待确认）：

- 品牌知识库管理（知识对象增删改查）
- 品牌内容策略建议
- 多品牌统一管理
- 品牌一致性检测
- 品牌健康度趋势

---

## 第三阶段：完善 AI 持续学习能力

规划方向（仅定义框架，内容待确认）：

- 学习引擎自动运行
- 优化效果跨项目学习
- 策略自动调整---

## 第五阶段：Knowledge Distribution Platform

覆盖白皮书八阶段以外的"分发"能力，形成完整 6-Plane 架构。

### KDP Content（知识资产管理）

| 项 | 内容 |
|---|---|
| 用户目标 | 将已验证/已发布的内容转化为 AI 可消费的知识资产 |
| 页面入口 | Publish Tab → Knowledge Assets 面板 |
| 后端 API | `GET/POST/PUT /api/geo/kdp/assets` |
| 数据来源 | KnowledgeAsset 表 |
| MVP 完成标准 | 系统自动将 PublishingRecord 转化为 KnowledgeAsset（含三层：human/search/AI） |
| 验收标准 | 每个 Asset 可预览三层输出，状态可追踪 |

**当前状态**：❌ 未开始（Sprint K1）

### KDP Distribution（分发管理）

| 项 | 内容 |
|---|---|
| 用户目标 | 规划知识资产的分发策略并审批执行 |
| 页面入口 | Publish Tab → Distribution Plans 面板 |
| 后端 API | `GET/POST/PUT /api/geo/kdp/plans` + `/api/geo/kdp/attempts` |
| 数据来源 | DistributionPlan + DistributionAttempt 表 |
| MVP 完成标准 | 用户可审批由系统自动生成的 DistributionPlan，查看分发的 Attempt 历史 |
| 验收标准 | 每次 Attempt 可追溯（时间、状态、错误日志） |

**当前状态**：❌ 未开始（Sprint K2）

### KDP Adapters（适配器层）

| 项 | 内容 |
|---|---|
| 用户目标 | 通过 Adapter 将知识资产分发到不同目标 |
| 支持 Adapter | Sitemap / RSS / Knowledge Feed / robots.txt / AI Crawl Manifest |
| 后端 API | `GET /api/geo/kdp/adapters`（注册表） |
| 数据来源 | DistributionAdapter 表 + 各 Adapter 本地输出 |
| MVP 完成标准 | 5 种 Local Adapter 全部可用（无外部依赖） |
| 验收标准 | 每个 Adapter 可通过 `prepare() → validate() → package() → deliver()` 完整执行 |

**当前状态**：❌ 未开始（Sprint K2）

### KDP Submission（外部提交）

| 项 | 内容 |
|---|---|
| 用户目标 | 将分发内容提交到外部搜索平台 |
| 支持平台 | Google Search Console / Bing Webmaster / Baidu Zhanzhang |
| 前置依赖 | Platform Credential Registry |
| MVP 完成标准 | 凭据就绪后可提交 URL 并查询索引状态 |
| 验收标准 | 提交后可确认 URL 已被收录 |

**当前状态**：❌ 未开始（KDP RC2+）

---

## 附录：八阶段与当前 Tab 映射

| 白皮书阶段 | 对应 Tab | 状态 |
|---|---|---|
| Build | 左侧 Projects Panel | ✅ |
| Analyze | Overview | ✅ |
| Report | Overview +（待补充报告专用页面） | ⚠️ |
| Optimize | Insights | ⚠️ |
| Execute | Insights + Evidence | ✅ |
| Publish | Publish | ✅（RC1 冻结） |
| Verify | Evidence | ✅ |
| Monitor | Overview + InsightsPanel | ⚠️ |

## 附录 B：Six-Plane Architecture（冻结 2026-06-30）

```
                     Vertical Planes
  Assessment → Recommendation → Optimization → Verification → Publishing → KDP

                     Horizontal Layers
               Monitoring                          Automation
```

| Plane | 状态 | 说明 |
|-------|------|------|
| Assessment | ✅ | 品牌 AI 认知检测 |
| Recommendation | ✅ | 优化建议生成 + Explain |
| Optimization | ✅ | 建议执行 + 验证 |
| Verification | ✅ | 效果验证 + 证据链 |
| Publishing | ✅ (RC1) | 内容生成、审核、发布 |
| Knowledge Distribution | 🚀 (K1) | 知识资产管理 + 分发 |

| Layer | 状态 | 说明 |
|-------|------|------|
| Monitoring | ⚠️ | 监控仪表盘，跨 Plane |
| Automation | ❌ | Agent 自动化，跨 Plane |