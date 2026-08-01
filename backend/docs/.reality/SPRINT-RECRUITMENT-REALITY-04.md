# Sprint-RECRUITMENT-REALITY-04 — 商业运营闭环 Reality Audit

**日期:** 2026-08-01 01:45 CST
**Gate:** 掌柜指令启动（总评 95/100 → 补齐商业运营闭环，不扩功能）
**范围:** LLM Key 治理(P0) / AI员工执行历史(P1) / 额度体系(P2) / 死代码清理(P3)

---

# Task 完成

| Task | 交付 | 状态 |
|------|------|------|
| T01 Model Health Center | 后端健康检测服务 + Admin API + 前端页面 + Runtime 自动标记 | ✅ Runtime Verified |
| T02 Agent Activity Center | 执行历史聚合服务 + Admin API + 前端页面 | ✅ Runtime Verified |
| T03 AI 员工额度体系 | schema(quotaConfig/quotaUsage) + 回填 + 重算服务 + API + 前端 + 设计文档 | ✅ Runtime Verified |
| T04 招聘死代码清理审计 | 全仓扫描 + 4 个死文件 deprecated 标记 + 回归 | ✅ |

---

# T01 — Model Health Center（P0 最高优先）✅

## 核心发现（比掌柜预估更严重）

```
14 个 enterpriseLlmConfig
├─ ✅ 可用 2   （真实调用 130ms/184ms）
├─ 🔒 解密失败 9 （CRYPTO_ENCRYPTION_KEY 曾变更，旧密文无法解开）
├─ ❌ key 失效 2  （HTTP 401 认证失败）
└─ ⏸ 停用 1
```

**结论：14 个企业 key 中仅 2 个真正可用 → 客户购买 AI 员工后「员工不能工作」是真实风险。**

## 交付

- **schema**（migration 20260801_add_llm_health_center）: `lastHealthCheckAt / healthStatus / healthLatencyMs / healthError`
  - healthStatus: `untested | ok | failed | decrypt_error | disabled`
- **服务** `llm-health.service.ts`:
  - 真实 1-token 调用 provider（15s 超时，串行防限流）
  - 解密失败 → decrypt_error；401 → failed（附「认证失败/余额不足/模型不存在」语义提示）
  - **安全: key 永不入日志/响应；错误信息脱敏**
- **API**（Admin）:
  - `GET  /api/admin/llm/health`（列表+汇总，不含 key）
  - `POST /api/admin/llm/health/test/all`（全量测试）
  - `POST /api/admin/llm/health/test/:id`（单个测试）
- **Runtime 集成**: resolveRuntimeConfig 解密失败 → fire-and-forget 标记 decrypt_error（不阻塞热路径）
- **前端**: `/admin/enterprise/llm-health`（汇总卡片 + 健康表格 + 一键全测 + 治理指南）

## Reality 验证

```
POST test/all → summary: { total:14, ok:2, failed:2, decryptError:9, disabled:1 }
  实际结果与解密探测完全一致 ✅
```

---

# T02 — Agent Activity Center（P1）✅

## 交付

- **服务** `agent-activity.service.ts`: 数据源 EnterpriseAgentTask（30 条真实任务）
  - 汇总: 任务数 / 成功率 / tokens / 成本 / 平均耗时 / 活跃员工数
  - 按 AI 员工聚合（含成功率、任务类型分布、最后活跃）
  - 按天曲线（1-90 天可调）
  - 按任务类型聚合（中文标签: 💬生成回复 / 📄简历解析 / 🎯职业规划激活...）
  - 任务流（最近 200 条，含企业名/输入摘要/tokens/成本/耗时）
- **API**: `GET /api/admin/enterprise/agent-activity?days=&organizationId=`
- **前端**: `/admin/enterprise/agent-activity`

## Reality 验证

```
30 任务 | 成功率 70% | 18,187 tokens | ¥0.0303 | 5 个活跃 AI 员工
按 agent: 7fc5ee06 17任务 53%成功率（含失败任务）✅
```

---

# T03 — AI 员工额度体系（P2，设计落地）✅

## 模型（已落地）

```
EnterprisePlan.quotaConfig (JSONB)     Admin 配置月配额
EnterpriseEntitlement.quotaUsage (JSONB)  当前周期已用（重算）
数据源: EnterpriseAgentTask（真实执行记录，无需改 runtime）
```

## 交付

- schema（migration 20260801_add_quota_config_usage）+ 4 套餐配额回填
  - TRIAL 10/30 · BASIC 30/100 · PRO 100/500 · ENTERPRISE 1000/5000
- 服务 `quota.service.ts`: recalcQuotaUsage（周期起点=max(激活日,本月1号)，失败任务不计）+ 总览/单企业
- API: `GET /api/admin/enterprise/quotas` + `/:organizationId` + `POST /recalc/:organizationId`
- 前端: `/admin/enterprise/quotas`（进度条 + 三级预警 normal/warning/exhausted）
- 设计文档: `docs/.reality/QUOTA-SYSTEM-DESIGN.md`（P3 蓝图: 实时扣减/执行拦截 429/加量包/预警通知）

## Reality 验证

```
造 8 月 jd_generate 任务 → 重算 → AI_JD_GENERATE used=1/1000 ✅（测试后清理）
周期语义: 7 月任务不计入 8 月周期 ✅
```

## 冻结

❌ 本期不做: 实时扣减 / 执行拦截 / 加量包 / 用户自助页 / 邮件预警（设计已定稿）

---

# T04 — 招聘死代码清理审计（P3）✅

## 扫描结果（全仓 import 引用分析）

| 文件 | 行数 | 引用 | 处置 |
|------|-----:|------|------|
| services/enterprise/recruitment-orchestrator.service.ts | 433 | 0 | ✅ deprecated 标记 |
| agents/job/job-enterprise.agent.ts | 135 | 0 | ✅ deprecated 标记 |
| agents/job/job-career.agent.ts | ~100 | 0 | ✅ deprecated 标记 |
| services/enterprise/workflow/recruitment-tool-mapper.ts | 124 | 0 | ✅ deprecated 标记 |

**治理原则（Phase5 延续）: 不删除文件，只标记。删除需掌柜批准。**

## 活跃确认（非死代码）

- enterprise-talent-agent.ts / enterprise-interview-agent.ts → index.ts 注册路由 ✅
- recruitment-action.service.ts → enterprise-action.ts ✅
- tool-permission.service.ts → tool-permission.ts ✅
- job-matching / talent-search / resume-parser / job-career-engine ✅ 活跃

## 回归

```
GET /api/admin/llm/health → 200 ✅
GET /api/admin/enterprise/agent-activity → 200 ✅
GET /api/admin/enterprise/quotas → 200 ✅
GET /api/admin/enterprise/plans → 200 ✅
```

---

# Reality Gate

| Gate | 验证 | 状态 |
|------|------|------|
| G1 Key 可用性可见 | 14 个配置真实检测：2 可用 / 9 解密失败 / 2 失效 / 1 停用，全部可视化 | ✅ PASS |
| G2 执行历史可追溯 | 30 条任务按员工/类型/天聚合，含成本与成功率 | ✅ PASS |
| G3 配额可计量 | 真实任务聚合计数验证（used=1/1000） | ✅ PASS |
| G4 死代码已治理 | 4 文件 deprecated 标记，无副作用，主端点回归 200 | ✅ PASS |
| G5 无功能扩张 | 全部为运营治理能力，未新增 AI 员工/知识图谱/新业务 | ✅ PASS |

# 遗留（存量，非本次范围）

## 🔴 解密失败根因修正（验收后深挖）

掌柜验收后按 A+B 方案探测，**根因比预估更精细，真实损坏面大幅缩小**：

| 类型 | 数量 | 时间 | 判定 |
|------|-----:|------|------|
| 完整密文但 GCM 认证失败（旧 key） | 3 | 7/18、7/26×2 | 🔴 **真实企业配置损坏**（key 曾变更） |
| 截断/测试明文（iv:tag 半截、sk-e2e、enc_test、sk-dummy） | 9 | 7/28 集中 | 🟡 **测试租户数据**（test-ten/rg-tenan/e2e），非真实客户 |
| 完整密文且当前 key 可解 | 2 | 7/29、8/1 | ✅ 正常（即 T01 ok:2） |

### 方案 B（旧 key 迁移）结论：❌ 不可行
- git 无 .env 历史（从未入库），pm2 dump 6 个 key 全部与当前一致 → **旧 key 无任何备份**
- 即使有旧 key，9 条测试数据无需迁移，仅 3 条真实损坏可迁移

### 方案 A 第一阶段组件确认 ✅（全部已就绪）
1. KeyHealth 检测（T01: 3 API + llm-health.vue）
2. Admin 重新配置入口（admin-recruitment.ts create/update + admin/recruitment/agents.vue）
3. 企业侧重配入口（enterprise.ts + 企业工作台）
4. 治理指南（llm-health.vue）

### 待办（掌柜决策后执行）
- 3 条真实损坏：联系对应企业重配（或掌柜提供 7/26 前 .env 备份则迁移）
- 9 条测试数据：建议标记 deprecated（不删），避免污染后续健康统计

# 待掌柜决策（Sprint-05 启动项）
- T02 AI 员工 ROI 报表（价值报表）
- T03 额度正式消费链（执行前检查，暂不硬限制）
- T04 真实企业 30 天试运营 Reality Test
