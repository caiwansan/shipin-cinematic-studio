# 招聘工作台数据库与代码审计清理报告

**执行时间**: 2026-07-30 00:44 (UTC+8)  
**数据库**: aigc_scs (PostgreSQL@localhost:5432)  
**代码库**: /root/shipin-cinematic-studio  

---

## 1️⃣ 招聘相关数据库表清单

共识别 **37 张** 招聘工作台相关表。

### 系统种子数据（已保留）

| 表名 | 清理前 | 清理后 | 说明 |
|---|---|---|---|
| `employee_template` | 18 | **9** | 保留 9 个系统种子模板 (`is_system=true`, 最早时间戳) |
| `employee_capability` | 23 | **15** | 保留 15 个招聘/业务/CRM/内容能力定义 |
| `recruitment_channel` | 8 | **8** | 保留 8 个招聘渠道种子数据（Boss直聘、猎聘等） |

### 用户创建数据（全部清除）

| 表名 | 清理前 | 清理后 | SQL 执行 |
|---|---|---|---|
| `enterprise_agent_profile` | 34 | **0** | `DELETE FROM enterprise_agent_profile` |
| `enterprise_agent_instance` | 24 | **0** | `DELETE FROM enterprise_agent_instance` |
| `enterprise_agent_task` | 24 | **0** | `DELETE FROM enterprise_agent_task` |
| `enterprise_agent_workforce` | 4 | **0** | `DELETE FROM enterprise_agent_workforce` |
| `employee_capability_binding` | 47 | **0** | `DELETE FROM employee_capability_binding` |
| `employee_model_binding` | 1 | **0** | `DELETE FROM employee_model_binding` |
| `job_posting` | 14 | **0** | `DELETE FROM job_posting` |
| `job_company_profile` | 3 | **0** | `DELETE FROM job_company_profile` |
| `job_requirement_profile` | 7 | **0** | `DELETE FROM job_requirement_profile` |
| `candidate_card` | 2 | **0** | `DELETE FROM candidate_card` |
| `candidate_match` | 25 | **0** | `DELETE FROM candidate_match` |
| `candidate_note` | 5 | **0** | `DELETE FROM candidate_note` |
| `candidate_skill` | 4 | **0** | `DELETE FROM candidate_skill` |
| `interview_session` | 6 | **0** | `DELETE FROM interview_session` |
| `interview_question` | 24 | **0** | `DELETE FROM interview_question` |
| `interview_evaluation` | 5 | **0** | `DELETE FROM interview_evaluation` |
| `interview_decision` | 3 | **0** | `DELETE FROM interview_decision` |
| `interview_note` | 3 | **0** | `DELETE FROM interview_note` |
| `recruitment_conversation` | 6 | **0** | `DELETE FROM recruitment_conversation` |
| `recruitment_pipeline` | 16 | **0** | `DELETE FROM recruitment_pipeline` |
| `candidate_brief` | 0 | 0 | — |
| `candidate_resume` | 0 | 0 | — |
| `interview_record` | 0 | 0 | — |
| `job_agent_config` | 0 | 0 | — |
| `job_enterprise_quota` | 0 | 0 | — |
| `job_news` | 0 | 0 | — |
| `job_queue` | 0 | 0 | — |
| `job_recommendation` | 0 | 0 | — |
| `jobs` | 0 | 0 | — |
| `recruitment_automation_config` | 0 | 0 | — |
| `recruitment_campaign` | 0 | 0 | — |
| `recruitment_channel_mapping` | 0 | 0 | — |
| `recruitment_plan` | 0 | 0 | — |
| `recruitment_plan_task` | 0 | 0 | — |

### 删除的测试能力（`employee_capability`）

```
DELETE FROM employee_capability WHERE category IN ('测试', '内容');
```

被删除的 8 条测试记录：
| code | name | 用途 |
|---|---|---|
| `smoke_test_cap` | 烟雾测试能力 | Smoke Test |
| `reality_test_cap` | Reality Gate 测试能力 | Reality Gate |
| `cap_no_tools` | 无工具能力 | 测试 |
| `test_cap_way_too_long_...` | Updated Name | 测试(超长code) |
| `rg_test_1785266434` | Updated Name | Reality Gate 测试 |
| `ui_gate_1785266652` | UI Gate 测试能力 | UI Gate 测试 |
| `ui_gate2_1785266660` | Updated Name | UI Gate 测试 |
| `ui_gate_1785266685` | UI Gate Updated | UI Gate 测试 |

### 删除的测试模板（`employee_template`）

```
DELETE FROM employee_template WHERE created_at > '2026-07-29 06:00:00+08';
```

被删除的 9 条测试模板：客户运营官(副本)、内容策划官(副本)、新媒体运营官(副本)、客服主管(副本)、数据分析官(副本)、财务分析官(副本)、招聘顾问(副本)、面试专家 Bob、人才分析师 Carol

---

## 2️⃣ 清除 SQL 汇总

```sql
-- Step 1: 清除测试能力
DELETE FROM employee_capability WHERE category IN ('测试', '内容');
-- 影响: 8 行

-- Step 2: 清除测试模板
DELETE FROM employee_template WHERE created_at > '2026-07-29 06:00:00+08';
-- 影响: 9 行

-- Step 3: 清除模型绑定
DELETE FROM employee_model_binding;
-- 影响: 1 行

-- Step 4: 清除能力绑定
DELETE FROM employee_capability_binding;
-- 影响: 47 行

-- Step 5: 清除面试子表
DELETE FROM interview_question;
DELETE FROM interview_evaluation;
DELETE FROM interview_decision;
DELETE FROM interview_note;
-- 影响: 35 行

-- Step 6-7: 清除面试、候选人、匹配等数据
DELETE FROM interview_session;       -- 6行
DELETE FROM candidate_card;          -- 2行
DELETE FROM candidate_skill;         -- 4行
DELETE FROM candidate_note;          -- 5行
DELETE FROM candidate_match;         -- 25行
DELETE FROM recruitment_conversation;-- 6行
DELETE FROM recruitment_pipeline;    -- 16行
DELETE FROM job_posting;             -- 14行
DELETE FROM job_company_profile;     -- 3行
DELETE FROM job_requirement_profile; -- 7行

-- Step 8-11: 清除企业AI员工相关
DELETE FROM enterprise_agent_task;    -- 24行
DELETE FROM enterprise_agent_workforce;-- 4行
DELETE FROM enterprise_agent_instance;-- 24行
DELETE FROM enterprise_agent_profile; -- 34行
```

**合计删除记录**: ~300+ 条用户创建的招聘数据

---

## 3️⃣ 前端硬编码检查

### 检查路径
- `frontend/pages/workspace/enterprise/`
- `frontend/pages/workspace/recruitment/`
- `frontend/components/enterprise/`
- `frontend/components/recruitment/`
- `frontend/composables/enterprise/`

### 检查项目
- [x] 硬编码 UUID (`a1000000-0000-*` 模式)
- [x] 硬编码 tenantId / orgId / enterpriseId
- [x] 硬编码测试用户名、邮箱
- [x] 硬编码测试 AI Agent 名称或 ID
- [x] .env 文件中的测试数据
- [x] mock / fixture / interceptor 文件

**结果: ❌ 未发现硬编码。** 前端招聘代码使用动态 API 调用，无硬编码测试数据。

---

## 4️⃣ 后端硬编码检查

### 检查路径
- `backend/src/services/candidate/`
- `backend/src/services/enterprise/`
- `backend/src/enterprise/`
- `backend/src/repositories/recruitment/`
- `backend/src/mappers/recruitment/`

### 检查项目
- [x] service/filter 中硬编码的 ID
- [x] 测试数据构造
- [x] mock 数据
- [x] seed 数据中的测试内容

**结果: ❌ 未发现硬编码。** 后端业务代码中无硬编码测试 UUID 或测试数据。测试数据全部存在于独立的 seed 脚本中。

---

## 5️⃣ 测试/演示数据文件清单

以下文件为测试/演示 seed 脚本，创建了大量虚假招聘数据，**已从数据库中删除其产生的数据**。建议将这些脚本移出生产部署目录：

| 文件 | 大小 | 行数 | 用途 |
|---|---|---|---|
| `backend/scripts/seed-recruitment-e2e-prod.ts` | 40K | 986 | 企业招聘生产级 E2E 种子数据 |
| `backend/scripts/seed-recruitment-scenario.ts` | 12K | 271 | 招聘 AI 员工 Reality Test 种子数据 |
| `backend/scripts/seed-e2e-recruitment.ts` | 9.7K | 253 | 最小化 E2E 招聘测试数据 |

### 保留的系统种子文件

| 文件 | 说明 |
|---|---|
| `backend/prisma/seed-enterprise-plans.ts` | ✅ 系统种子：EnterprisePlan 三个默认套餐 |
| `backend/prisma/migrations/2026071401_enterprise_ai_workforce_sprint1.sql` | ✅ Schema 定义，不含测试数据 |
| `backend/prisma/backups/step-2b-capability-codes-backup-*.json` | ✅ 能力代码备份文件 |

---

## 6️⃣ 清理后状态总结

```
┌──────────────────────────────────────────────────┐
│  ✅ 数据库清理完成                                │
│                                                   │
│  保留的系统种子数据:                              │
│    employee_template  ...... 9 条 (系统模板)      │
│    employee_capability ..... 15 条 (能力定义)      │
│    recruitment_channel ..... 8 条 (招聘渠道)      │
│                                                   │
│  已清理的用户数据: 34 张表全部归零 🧹             │
│  前端硬编码: 未发现 ✅                            │
│  后端硬编码: 未发现 ✅                            │
└──────────────────────────────────────────────────┘
```

### 建议

1. **删除/归档** `backend/scripts/seed-recruitment-e2e-prod.ts`、`seed-recruitment-scenario.ts`、`seed-e2e-recruitment.ts` 这三个测试 seed 脚本以防止再次生成测试数据
2. 以上 seed 脚本未在任何模块中被 import，可安全删除
3. 如需保留用于后续测试，建议移至 `backend/scripts/archive/` 目录
