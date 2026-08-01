# AI 员工额度体系设计（Usage Ledger → 配额）

**Sprint-RECRUITMENT-REALITY-04 T03 | 2026-08-01**
**原则：用量来自真实执行记录（EnterpriseAgentTask），配额来自套餐配置（EnterprisePlan.quotaConfig）**

---

## 一、设计目标

客户视角：**「我这个月还能让 AI 员工干多少活」**
商业视角：**SaaS 收费基础（套餐内配额 + 超额加购）**

---

## 二、数据模型（已落地 ✅）

```
EnterprisePlan.quotaConfig (JSONB)    套餐配额定义（Admin 配置）
  { "AI_JD_GENERATE": { "monthly": 100, "unit": "次" }, ... }

EnterpriseEntitlement.quotaUsage (JSONB)  当前周期已用（重算产生）
  { "AI_JD_GENERATE": { "used": 37, "limit": 100, "unit": "次", "periodStart": "..." } }

数据源: EnterpriseAgentTask（真实任务记录，无需改 runtime）
```

### 能力 → 任务类型映射

| capability | taskType |
|---|---|
| AI_JD_GENERATE | jd_generate |
| AI_RESUME_MATCH | resume_match / matching_report |
| AI_INTERVIEW | interview_questions / interview_recommendation |
| AI_INTERVIEW_SUMMARY | interview_evaluation |
| AI_CANDIDATE_RECOMMEND | candidate_screening |
| AI_GENERATE_REPLY | generate_reply |
| AI_RESUME_PARSE | profile_extraction |
| AI_CAREER_PLANNING | career_activation |
| AI_JOB_ANALYSIS | job_analysis |

### 回填默认配额（已写入 4 个正式套餐）

| 套餐 | JD | 简历匹配 | 面试 | 面试评估 | 推荐 |
|---|---|---|---|---|---|
| TRIAL | 10 | 30 | 10 | — | — |
| BASIC | 30 | 100 | 30 | — | — |
| PRO | 100 | 500 | 100 | 100 | 500 |
| ENTERPRISE | 1000 | 5000 | 1000 | 1000 | 5000 |

---

## 三、已交付（本期）

1. Schema: `EnterprisePlan.quotaConfig` + `EnterpriseEntitlement.quotaUsage`（migration 20260801_add_quota_config_usage）
2. 服务: `quota.service.ts` — recalcQuotaUsage（按周期聚合真实任务）+ getQuotaOverview + getOrganizationQuota
3. API（Admin）:
   - `GET  /api/admin/enterprise/quotas` — 全企业配额总览（用量/剩余/预警级别）
   - `GET  /api/admin/enterprise/quotas/:organizationId` — 单企业
   - `POST /api/admin/enterprise/quotas/recalc/:organizationId` — 重算
4. 前端: `/admin/enterprise/quotas`（进度条 + 三级预警：normal <80% / warning ≥80% / exhausted ≥100%）
5. Reality 验证: 造 8 月 jd_generate 任务 → 重算 → `AI_JD_GENERATE used=1/1000` ✅（测试后清理）

---

## 四、P3 蓝图（本期不实现 — 设计定稿）

### 1. 用量实时扣减
- 现: 重算（recalc，Admin 触发）
- P3: `enterprise-agent-runtime.service.ts` 任务完成时增量更新 `quotaUsage.used+1`（与 usageLog 写入同位置，幂等 by taskId）
- 周期切换: 检测 `periodStart` 跨月 → 归零（订阅周年 vs 自然月，产品决策默认自然月）

### 2. 执行拦截（超额处理策略）
```
executeTask 入口
  ↓
quotaGuard(capability, organizationId)
  ↓
├─ unlimited (quotaPolicy=unlimited) → 放行
├─ fixed + 未超额 → 放行 + 扣减
├─ fixed + 超额 → 返回 429 QUOTA_EXCEEDED
│    { message: "本月 AI_JD_GENERATE 额度已用尽（100/100），请升级套餐或下月再试" }
└─ 失败任务不扣减（status=failed 不计）
```
- **拦截点选择**: `enterpriseAgentRuntime.executeTask()`（单一入口，所有 AI 员工执行必经）
- 与 Capability Gate 分层: Gate 管「能不能用」（权限），Quota 管「能用多少次」（计量）

### 3. 超额商业动作（产品决策项）
| 方案 | 说明 | 推荐度 |
|---|---|---|
| A 硬拦截 | 429 + 引导升级 | ★★★ 默认 |
| B 降级 | 超额后切平台模型（BYOK→平台兜底） | ★★ |
| C 加量包 | 按次付费 add-on 订单（复用 create-order） | ★★★ 长期 |

### 4. 预警通知
- 80% 预警 / 100% 用尽 → 企业工作台横幅 + 邮件（复用通知通道）
- Admin 视角已有（前端三级颜色）

### 5. 客户自助
- 企业工作台「用量仪表盘」：本月已用/剩余/预计超额日（数据源同 quota API，加用户侧端点）

---

## 五、冻结（持续有效）

❌ 本期不做: 实时扣减 / 执行拦截 / 加量包 / 用户自助页 / 邮件预警
✅ 已做: 配额配置 + 用量重算 + Admin 总览 + 预警展示（商业运营闭环第一步）
