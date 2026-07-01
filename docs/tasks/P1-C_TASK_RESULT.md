# P1-C — Deliverable Center (Report Center + Export)

## 架构说明

Deliverable Center 是在现有 GEO 工作流之上构建的**综合报告层**。它不存储新数据，而是从 PersistenceService（DiscoveryReport + ActionPlan + VerificationReport）实时聚合，生成一个包含 6 个 Section 的完整品牌健康报告 `DeliverableReport`。

```
PersistenceService (Discovery / Action Plan / Verification)
    ↓
geo-report-v2.service.ts  ← 组装为 DeliverableReport
    ↓
geo-deliverable.route.ts  ← REST API
    ↓
ReportCenter.vue          ← 前端展示 (6 Section + Export)
    ↓
kmki-ui 组件              ← 可复用卡片
```

## 新增文件

### Backend

| 文件 | 说明 |
|------|------|
| `backend/src/benchmark/deliverable/types.ts` | DeliverableReport 完整类型定义（6 个 Section） |
| `backend/src/services/geo/services/geo-report-v2.service.ts` | Report Generator 服务：组装报告 + Markdown/JSON 导出 |
| `backend/src/services/geo/routes/geo-deliverable.route.ts` | REST API 路由 |

### Frontend

| 文件 | 说明 |
|------|------|
| `frontend/workspaces/geo/types/report.ts` | 前端 DeliverableReport 类型 |
| `frontend/workspaces/geo/pages/ReportCenter.vue` | 完整报告页面（6 Section + Export） |
| `frontend/workspaces/geo/services/reportService.ts` | 前端 Report API 服务 |
| `frontend/components/kmki-ui/ExecutiveSummaryCard/index.vue` | 执行摘要卡片 |
| `frontend/components/kmki-ui/FindingsSection/index.vue` | 发现汇总 |
| `frontend/components/kmki-ui/OpportunitiesSection/index.vue` | 机会汇总 |
| `frontend/components/kmki-ui/ActionsSection/index.vue` | 行动汇总 |
| `frontend/components/kmki-ui/VerificationSection/index.vue` | 验证汇总 |
| `frontend/components/kmki-ui/NextRecommendations/index.vue` | 下一步建议 |
| `frontend/components/kmki-ui/ExportMenu/index.vue` | 导出下拉菜单 |
| `frontend/components/kmki-ui/ReportCard/index.vue` | 通用报告卡片 |

## 修改文件

| 文件 | 修改 |
|------|------|
| `backend/src/index.ts` | 注册 geo-deliverable.route |
| `frontend/workspaces/geo/router.ts` | 添加 `/workspace/geo/report/:projectId` 路由 |
| `frontend/workspaces/geo/components/ReportPanelEmbedded.vue` | 全面重写：嵌入报告迷你视图 + "View Full Report" 链接 |
| `frontend/workspaces/geo/pages/GEODashboard.vue` | 验证卡片增加 "View Report" 链接 |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/geo/report/:projectId` | 返回完整 DeliverableReport JSON |
| `GET` | `/api/geo/report/:projectId/export?format=markdown\|json` | 下载导出文件 |
| `POST` | `/api/geo/report/:projectId/export` | 触发导出，返回内容体 |

## 验收检查

- ✅ DeliverableReport 类型完整（6 个 section）
- ✅ ReportGenerator 服务组装报告
- ✅ API GET /api/geo/report/:projectId 返回完整报告
- ✅ API GET /api/geo/report/:projectId/export?format=markdown|json 导出
- ✅ ReportCenter 页面展示完整报告（6 个 section）
- ✅ 导出功能（Markdown / JSON / Copy to Clipboard）
- ✅ Workflow Step 7 集成报告（ReportPanelEmbedded 迷你视图 + 查看完整报告）
- ✅ Dashboard 增加 "View Report" 链接
- ✅ kmki-ui 组件（6 个 section + ExportMenu + ReportCard）
- ✅ 后端代码语法验证通过
- ✅ 单 Commit

## 用户交付物说明

### 用户现在能拿到什么完整的交付物？

用户现在能拿到一个**完整的品牌健康报告（Brand Health Report）**，包含以下 6 个部分：

1. **Executive Summary（执行摘要）** — 顶部卡片展示 Current ADI / ΔADI / 完成率 / 机会数 / Confidence / 整体健康度
2. **Findings（发现汇总）** — 行业、实体、覆盖统计、Top 5 场景、Bottom 5 场景（含趋势箭头）
3. **Opportunities（机会汇总）** — High/Medium/Low 计数、总预期收益、完整机会表格（场景 + 差距 + 优先级 + 建议 + 预期收益）
4. **Actions（行动汇总）** — 完成率进度条、各状态计数、预期 vs 实际收益对比、行动列表
5. **Verification（验证结果）** — Before → After 对比 + 改进率 + Improvement Breakdown 瀑布图 + 剩余问题
6. **Next Recommendations（下一步建议）** — 基于未完成的 Opportunity 和剩余问题，按优先级排序

外加 **Export 导出** 功能：Markdown 下载、JSON 下载、复制到剪贴板。

### 这份报告和普通 Dashboard 有什么区别？

| 维度 | Dashboard | Deliverable Report |
|------|-----------|-------------------|
| **目的** | 运营概览、项目列表、快速行动 | **最终交付物** — 面向 stakeholder 的完整报告 |
| **数据范围** | 全项目级别（列表、统计卡片） | **单项目深度分析**（6 个 Section 覆盖完整链路） |
| **结构** | 卡片网格、列表 | **SaaS 风格报告** — 有叙事结构：摘要→发现→机会→行动→验证→建议 |
| **导出能力** | 无 | Markdown / JSON / Copy to Clipboard |
| **Workflow 位置** | 首页、导航 | **Step 7 最终步骤** — 工作流的自然终点 |
| **可分享性** | 仅限平台内查看 | 导出为 Markdown/JSON 后可分享、嵌入、存档 |
| **可操作性** | 点击进入 Workflow | 直接给出 Next Recommendations 可执行建议 |

**一句话总结：Dashboard 是「驾驶舱」，Deliverable Report 是「报告的最终输出」——前者帮助操作用户监控和导航，后者是交付给品牌团队/客户看的完整分析报告。**
