# SPRINT-AGENT-OPERATIONS-01 AI 员工运营闭环 — COMPLETE ✅

**Date:** 2026-08-01 20:30
**Gate:** 掌柜战略指令（AI 员工不是资源，是企业购买并运营的数字劳动力；后台核心 = 管理数字员工的招聘、上岗、绩效、价值）

## 定位

昆仑镜从「AI 员工操作系统」进入**运营闭环**：老板现在能回答四问——
1. 哪些 AI 员工正在工作？ → 健康中心
2. 哪些企业真的在使用？ → 生命周期
3. 哪些 AI 员工产生价值？ → 价值参数 + ROI
4. 哪些企业可能流失？ → 续费风险 + 沉睡预警

## T01 企业价值参数配置（ROI 前置）

- **表** `enterprise_value_param`：organizationId + agentInstanceId（一个员工一条）+ laborHourlyCost（¥/小时）+ manualMinutesPerTask（分钟）+ aiSecondsPerTask（秒）
- **红线落地**：价值参数由企业输入，**平台禁止估算/猜测**。未配置 → ROI 一律不展示（null + 「待企业配置价值参数」）
- **废弃平台估算**：`getRoiReport` 硬编码 HR_HOURLY_RATE=50 标记 DEPRECATED；`/api/admin/dashboard/roi` 改由企业参数驱动
- **价值公式（透明）**：节省时间 = 成功任务 × (人工耗时 − AI 耗时)；节省价值 = 节省时间 × 小时成本；ROI = 节省价值 / 真实成本
- **API**：GET/PUT/DELETE /api/enterprise/value-params（身份解析改 resolveEnterpriseId → OrgMember → Organization SSOT，修复误用 governance 路径）
- **前端**：/workspace/enterprise/value-params 页面 + 子导航「价值参数」——每员工：30 天真实统计 + 参数表单 + 价值预览

## T02 AI 员工健康中心

- **API** GET /api/admin/dashboard/agent-health（真实数据规则判定）：
  - 🟢 正常 = 30 天有执行且成功率 ≥ 95%
  - 🟡 注意 = 成功率 < 95% 或 7 天无执行
  - 🔴 异常 = 非 active 或成功率 < 90%
  - ⚪ 待上岗 = 无执行记录（部署未用）
- **前端**：罗盘 AgentHealthCard（分布 + 员工级状态/原因/成本/成功率）

## T03 企业 AI 员工生命周期

- **API** GET /api/admin/dashboard/lifecycle：试用 → 上岗观察(≤7天) → 稳定运行；30 天无执行 = 沉睡；到期 ≤14 天 = 续费风险；部署未使用 = 流失预警
- 真实数据：南波万（6 员工 0 执行 → 沉睡+流失预警）、demo（观察期 + 价值 ¥12.67）
- **前端**：罗盘 LifecycleCard（企业列表 + 阶段徽章 + 到期 + 风险）

## T04 罗盘价值升级

- AiOutcomeValueCard 升级：显示企业配置参数后的**真实 ROI**（roiStatus）；`$` 误标修正为 `¥`（成本单位确认为人民币）
- 新 Row：健康中心 + 生命周期（四问全覆盖）

## T05 Reality Gate（生产域实测全 PASS）

| 验收项 | 结果 |
|--------|------|
| 企业端 GET 价值参数 | ✅ demo 5 员工真实统计（招聘顾问 4 执行/1 成功/25%/4.1s） |
| 企业端 PUT 配置 | ✅ 归属校验 + upsert，¥80/10min/30s 保存成功 |
| ROI 计算 | ✅ 1 成功任务 → 节省 9.5 分钟 → ¥12.67 vs 成本 ¥0.0009 |
| 未配置员工 | ✅ 诚实返回 null + 「平台不估算」 |
| 罗盘 ROI 状态 | ✅ configuredOrgs 1 / demo 真实 ROI |
| 健康中心 | ✅ 3 绿/1 黄/4 红/13 待上岗（成功率 25% 招聘顾问正确标黄） |
| 生命周期 | ✅ 75 企业/运行中 3/沉睡 1 + 流失预警 |
| 数据对齐 | ✅ 16 个实例 organization_id 补齐（Organization SSOT）；4 个孤儿（mock UUID）不动 |
| 浏览器 | ✅ 企业价值参数页 + 罗盘运营区全渲染 |

截图：AGENT-OPERATIONS-01-{value-params,ops-dashboard}.png

## 治理规则（冻结）

1. ROI 必须由企业价值参数驱动；平台硬编码估算 = 违规（getRoiReport 已废弃）
2. 价值参数按员工配置（agentInstanceId），一个员工一条；清除 = 回到未配置
3. 健康/生命周期判定规则公开可解释（阈值在代码注释与页面标注）
4. 成本单位统一 ¥（人民币），真实成本保留 4 位小数展示

## 遗留

⏸ 求职管家（career 个人线）价值参数（个人时薪）——本期只做企业招聘线
⏸ 续费提醒主动触达（短信/站内信）——本期罗盘已标记风险，触达渠道待定
