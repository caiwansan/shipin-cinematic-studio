# SPRINT-IDENTITY-REALITY-FIX-01 — 企业 AI 员工模型配置架构纠偏（BYOK）— COMPLETE ✅

**Date:** 2026-08-01
**Gate:** 掌柜战略纠偏指令：昆仑镜 = AI 员工操作系统，企业提供算力（BYOK），平台不托管企业 Key
**验收:** G1-G5 全 PASS（浏览器 + 真实 LLM 调用）

---

## 架构纠偏核心

### 旧架构（违反 BYOK）→ 新架构（企业资产）

```
旧: 企业订阅 → AgentInstance → EnterpriseLlmConfig(平台表) → 平台模型池 → LLM
新: 企业订阅 → AgentInstance → OrgModelConfig + ProviderCredential(企业资产,加密) → 企业Key → LLM
```

| 项 | 旧（已废弃权威） | 新（唯一权威） |
|----|----------------|--------------|
| 模型选择 | EnterpriseLlmConfig | **OrgModelConfig**（provider/model/fallbackModel/capability/isDefault） |
| Key 存储 | 平台 enterprise_llm_config 表 | **ProviderCredential**（owner=organization，AES 加密，平台不可见） |
| 解析链 | 平台托管 | **Input Override → Org BYOK → (compat) EnterpriseLlmConfig → User BYOK → stage → env** |
| 企业无配置 | 平台 Key 兜底 | **显式阻断「企业模型配置缺失」（G2）** |

### 冻结
❌ EnterpriseLlmConfig / AgentModelBinding / ModelRoutingPolicy 作为模型 SSOT → **deprecated（保留兼容读取，仅存量过渡）**
❌ 平台托管企业 Key ❌ 继续扩展 Enterprise LLM 配置体系
✅ Model Policy 不保存 Key：只存 { capability, preferredProvider, preferredModel, fallbackModel }

---

## Task 完成

### T01 Model Resolver（runtime/model-resolver.service.ts 新建）
- `resolveEnterpriseModel()`：企业 AI 员工专用（身份隔离，不 fallback 个人/平台 Key）
- `saveOrgModelSettings()`：OrgModelConfig + ProviderCredential upsert（加密）
- `getOrgModelSettings()`：不含 Key 明文（G4）
- `testConnection()`：真实调用测试 + 健康状态回写
- `resolveRuntimeConfig` 第 2 层改造：EnterpriseLlmConfig 平台层 → OrgModelConfig；compat 降级 2.5 层（仅存量未迁移企业）
- `runtime-gateway` 透传 provider/model/apiKey/baseUrl（Input Override）

### T02 Runtime 接线（executeTask）
- enterpriseLlm 查找 + 平台健康阻断 → **modelResolver.resolveEnterpriseModel**
- 无企业配置 → `ENTERPRISE_MODEL_CONFIG_MISSING: 企业模型配置缺失 — 请企业管理员前往 企业工作台 → AI模型设置 配置模型与 API Key`
- usage_logs 补 **organizationId / agentId / model**（G5）

### T03 数据迁移
- 5 条归属 llm_config → org_model_config + provider_credential（AI 猎聘顾问 deepseek key 转为企业资产，health=ok）
- 演示企业（AI招聘Demo, 8aed92ac）owner → demo 账号（验收 G1 管理链路）
- 演示企业补订阅（enterprise HR猎头）+ entitlement（[] 全部开放）
- demo 4 员工补 HermesProfileBinding（G3）
- **entitlementGate 修复**：enterprise_profile 旧链路 → Organization SSOT 直查订阅
- **EmployeeCapability 模型补 schema**（表存在但 Prisma 缺模型 → count 崩溃）
- 补 outcome_record 未处理（pre-existing，非本 Sprint 范围）

### T04 后台 AI员工运营中心（5 Tab）
- Tab1 AI员工：**模型来源列**（🟢 企业BYOK · provider/model · 可运行 / ⚠️ 等待企业配置模型 → 企业工作台 AI模型设置）
- 5 Tab：AI员工 / 模板中心 / 能力中心 / 运行中心 / 价值中心
- G4 判定改造：OrgModelConfig + ProviderCredential(hasCredential + health)
- auto-bind 退役：不再创建 AgentModelBinding（幂等检查 + deprecated 说明）
- 全后台零 Key 泄露（overview 只返回 provider/model/healthStatus/hasCredential）

### T05 企业工作台 AI模型设置（BYOK）
- 后端：GET/PUT/DELETE `/api/enterprise/model-config` + POST `/test`（企业用户 → Organization 解析，优先有模型配置/有员工的企业）
- 前端：`/workspace/enterprise/model-settings` 页 + 工作台导航「AI 模型设置」+ 设置模块入口卡
- 表单：Provider / 模型 / API Key（掩码显示 sk-****）/ 测试连接 / 默认模型
- 旧 provider-management API 全部下线（ProviderSettingsModule + provider-settings.vue 改接新端点）

---

## 验收 Gate（全部 PASS）

| Gate | 验证 | 结果 |
|------|------|------|
| **G1** | 企业 DeepSeek Key → 启动 AI 招聘顾问 → 真实调用成功 | ✅ 「我作为猎聘顾问的核心价值，是以数据为基石…」819ms |
| **G2** | 删除企业 Key → 员工停止 + 提示「企业模型配置缺失」 | ✅ ENTERPRISE_MODEL_CONFIG_MISSING（非平台模型错误） |
| **G3** | 企业A deepseek-v4-flash / 企业B deepseek-reasoner 并行 | ✅ 双成功，usage 各自归属（8aed92ac/f7392b7f） |
| **G4** | 平台管理员不可见企业 API Key | ✅ overview 零 Key 泄露；页面掩码 sk-**** |
| **G5** | usage_logs: organizationId/agentId/provider/model/token/cost | ✅ 逐条完整 |

## 数据真相（2026-08-01）

```
AI 员工 21 / 运行中 2（AI 猎聘顾问 + demo 招聘顾问）/ 上线率 10%
模型来源 100% 企业 BYOK（OrgModelConfig 2 企业 / ProviderCredential 2 条企业资产）
EnterpriseLlmConfig → deprecated（存量 5 条已迁移）
```

## 提交
`待填`

## 冻结清单（持续）
❌ 平台托管用户 Key ❌ EnterpriseLlmConfig 权威 ❌ 扩展 Enterprise LLM 配置体系
✅ BYOK：企业提供算力，昆仑镜管理 AI 员工身份/流程/能力/记忆/价值分析
