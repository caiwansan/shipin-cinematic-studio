# Sprint-RECRUITMENT-REALITY-07 — Enterprise Pilot Reality（P0 待掌柜拍板，P1 已就绪）

**日期:** 2026-08-01 02:30 CST
**Gate:** 掌柜指令「不扩功能，进入真实企业 30 天验证」

---

# P0 企业扫描真相：没有真实企业

扫描全部 73 家组织，**结论：无真实付费使用企业**。

| 类别 | 数量 | 说明 |
|------|------|------|
| 注册残留 | ~60 | 微信注册默认组织，0 员工 0 任务 0 配置 |
| 测试组织 | ~10 | E2E Test Org / TEST-ORG / Reality测试企业 |
| active 订阅 | 3 | 昆仑镜AI招聘部 / 昆仑镜科技 / 演示企业(AI招聘Demo) |
| 有 AI 员工 | 1 | 昆仑镜科技（Alice/Bob/Carol 档案 + 1 个运行时实例 Carol） |
| 有任务记录 | 1 | 昆仑镜科技 4 条（7/30 测试残留，成功率 0%） |

## 推荐 Pilot 企业：昆仑镜科技 ✅（掌柜路径 A 的最接近项）

- **id**: `a1000000-0000-4000-8000-000000000001`
- **1 年 active 订阅**（2026-07-29 → 2027-07-29）——最接近付费状态
- **已有 AI 员工三角色档案**：招聘顾问 Alice / 面试专家 Bob / 人才分析师 Carol
- 历史任务 4 条（测试残留，观察窗口从 8/1 重新起算，不污染指标）
- 缺：模型配置（需补真实 key，可一键重配）

⚠️ 备选：演示企业（AI招聘Demo，8/1 刚建，纯净但无历史）。**等掌柜拍板**。

## 数据坑（已绕过）

Organization / EnterpriseAgentTask / EnterpriseAgentInstance 的 id 与 organization_id 列
均为 **@db.Uuid**，传非 UUID 短 id 会 P2023。快照脚本已改为：名称容错解析 → 完整 UUID → 经 agentInstanceId（text 列）归属过滤。

---

# P1 30 天观察体系 — 已就绪 ✅

## 每日快照 `scripts/pilot-daily-snapshot.mjs`

- crontab **23:50 每天自动**快照（`crontab -l | grep pilot`）
- 支持补拍历史：`node scripts/pilot-daily-snapshot.mjs 2026-07-31`
- 输出：`data/pilot-snapshots/<orgId>/<date>.json`（掌柜指标全字段）

## 30 天汇总 `scripts/pilot-snapshot-summary.mjs`

- `node scripts/pilot-snapshot-summary.mjs a1000000`（id 前缀 / 组织名「昆仑」/ 完整 UUID 均可）
- 输出掌柜指标表 + 逐日明细 + 活跃天数 + 近 5 天最后活跃（连续使用性）

## 指标映射（对齐掌柜 P1 表）

| 掌柜指标 | 快照字段 |
|---------|---------|
| AI员工调用次数 | summary.tasks |
| JD生成数量(Alice) | summary.jdGenerate |
| 面试次数(Bob) | summary.interviews |
| 候选分析数量(Carol) | summary.candidateAnalysis |
| LLM成本 | summary.aiCost |
| tokens | summary.tokens |
| ROI | summary.roi（savedCost/aiCost） |
| 失败率 | 100 - summary.successRate |
| 模型健康 | modelHealth.{ok,failed,decryptError,disabled} |

## 基线快照（已生成）

```
2026-07-30 | 4任务 成功率0%（测试残留）| 面试1 候选2 | ¥0.0042
2026-07-31 | 0
2026-08-01 | 0
```

---

# Reality Gate

| Gate | 验证 | 状态 |
|------|------|------|
| G1 企业扫描真实 | 73 家全查，无真实企业 → 如实上报，不假装有 | ✅ PASS |
| G2 Pilot 候选可运行 | 昆仑镜科技：订阅+员工+任务+组织解析全通 | ✅ PASS |
| G3 观察体系自动化 | crontab 每日快照 + 汇总脚本 | ✅ PASS |
| G4 指标完整 | 掌柜 7 项指标全覆盖 | ✅ PASS |
| G5 数据坑防御 | UUID 列容错 + 补拍 + 名称解析 | ✅ PASS |

# 待掌柜

1. **Pilot 企业拍板**：昆仑镜科技（推荐，补真实 key 即可开跑）or 演示企业（纯净）
2. 选好后：P0 落地 = 补模型配置 → 模拟真实 HR 使用（或真实接入）→ 30 天观察
3. P2 确认：不扩功能（Agent/页面/套餐全冻结）
