# KMKI Runtime Reality Audit-02 — 平台级模型配置终扫 + 双轨断裂治理 — COMPLETE ✅

**Date:** 2026-08-01
**Gate:** 掌柜战略指令（59d8eb13 冻结点作为后续所有 Workspace 开发最高约束）
**前置:** KMKI AI Runtime Principle（docs/architecture/KMKI-AI-RUNTIME-PRINCIPLE.md）

---

## 一、全平台扫描：隐藏模型入口清单

### 1.1 Prisma Schema 模型配置表全清单

| 表 | 数据量 | 状态 | 判定 |
|----|--------|------|------|
| `UserModelConfigV2` | — | ✅ 活跃 | **用户 BYOK 唯一权威**（个人 Workspace） |
| `OrgModelConfig` | 6 | ✅ 活跃 | **企业 BYOK 模型选择权威** |
| `ProviderCredential` | 6 | ✅ 活跃 | **企业资产（加密）唯一权威** |
| `AiStageModelConfig` | — | ✅ 活跃 | 平台默认模型（fallback 第 5 层，永远排 BYOK 后） |
| `EnterpriseLlmConfig` | 14 | ⚠️ deprecated | 平台托管 Key 旧体系，仅 compat 读（第 2.5 层），禁新写 |
| `AIProviderConfig` | **0** | ❌ 死表 | **双轨断裂源 #1**（写端点已 410） |
| `EmployeeModelBinding` | **0** | ❌ 死表 | **双轨断裂源 #2**（agent-brain 已改统一链） |
| `CredentialVault` | 0 | ⚪ 平台资源凭证 | 平台 fallback 兜底层（非 Workspace 级模型配置） |
| `ResourceCredential` | — | ⚪ 平台资源凭证 | 平台资源体系（图片/视频资源账号，非模型 Key） |

**结论：无任何 Workspace 级模型配置表（WorkspaceModelConfig / ShortDramaModelConfig / RecruitmentModelConfig 均不存在）✅**

### 1.2 路由层扫描（*ModelConfig / *LLMConfig / *ProviderConfig / *ApiKey / *Credential）

- ✅ 合规：`/api/enterprise/model-config`（新权威）、`/api/v2/user/model-config/unified`、`/api/user/llm-config`、`/api/career/llm/config`、`/api/capability/llm/config/:capability`（均走 UserModelConfigV2 / OrgModelConfig）
- ✅ 平台层：`/api/admin/ai-providers`、`/api/admin/global-models`、`/api/admin/platform-default-models`、`/api/admin/platform/llm/*`（Provider Registry / 默认模型管理，合规）
- ❌ **`/api/enterprise-foundation/:orgId/ai-providers/*`** → 写 AIProviderConfig 死表 → **全部 410 拒绝**（本次治理）
- ❌ **`/api/provider-management/*`** → 读写 enterpriseProviderCredential / enterpriseAgentModelBinding / enterpriseProviderUsage（**Prisma schema 从未定义的表**）→ 写端点全部 410（本次治理）

### 1.3 运行时 Resolver 统一性审计

| 入口 | 链路 | 状态 |
|------|------|------|
| 🎬 短剧 narrativeGateway | getRuntimeConfig（用户 BYOK 注入） | ✅ 统一 |
| 💼 招聘 enterprise-agent-runtime | modelResolver.resolveEnterpriseModel（OrgModelConfig） | ✅ 统一 |
| 💼 招聘 career-workflow / enterprise-intelligence（AgentExecutor → orchestrator → **AgentBrain**） | **旧: EmployeeModelBinding → EnterpriseLlmConfig → env 开发后门** | ❌ → ✅ **本次治理：改为 resolveEnterpriseModel** |
| 📖 小说 / 🌎 GEO / 🖼️ 图片 / 🎵 音乐 | UserModelConfigV2 / api-router selectProvider | ✅ 统一 |

**治理动作：`agent-brain.service.ts` resolveProvider 退役旧表读取 + env 开发后门，企业上下文一律走 modelResolver.resolveEnterpriseModel（无配置显式抛「企业模型配置缺失」，G2 身份隔离）。**

---

## 二、重大发现：双轨断裂真相（写死表 + 读新表 = 用户 Key 配置从未生效）

1. **EnterpriseOnboardingWizard.vue（企业入职向导）** 一直调 `/api/enterprise-foundation/ai-providers` 写 AIProviderConfig
2. **但该端点注册 prefix 是 `/api`，路由自带 `/api/enterprise-foundation/...`** → 实际路径 `/api/api/enterprise-foundation/...`（双前缀 bug）→ **前端调用一直 404 且被 `.catch(() => {})` 吞掉**
3. **结果：AIProviderConfig 表 0 数据 + 用户以为配了 Key 实际从未生效** —— 向导 Step2 是死步骤
4. 同时运行时（agent-brain / enterprise-agent-runtime）读 OrgModelConfig → **配置永远缺失 → AI 员工永远无法运行**

### 治理
- ✅ OnboardingWizard Step2 改调 **PUT /api/enterprise/model-config**（真端点）+ 测试连接改 **POST /api/enterprise/model-config/test** + provider 列表前端内置
- ✅ enterprise-foundation ai-providers 写端点 410 拒绝（带清晰指引）
- ✅ provider-management 写端点 410 拒绝（死表 API）
- ✅ frontend/stores/enterprise-agent.ts bindModel/getAgentBinding 改走 /api/enterprise/model-config
- ✅ schema 三表加 `@deprecated` 注释（AIProviderConfig / EmployeeModelBinding / EnterpriseLlmConfig）

---

## 三、P0：企业 AI 模型配置引导（降低首次使用阻力）

**目标链路：** 购买套餐 → 激活 AI 员工 → **发现未配模型 → 引导配置 → 员工转绿 → 产生任务 → 价值记录 → 续费**

### 交付（企业工作台首页 /workspace/enterprise/index.vue）
- `loadAgents` 中检测 `GET /api/enterprise/model-config`：`settings.some(s => s.hasCredential && s.healthStatus === 'ok')` → `modelConfigured`
- 未配置 → 「我的 AI 招聘团队」上方显示 **AI 模型配置引导横幅**：
  - 🔑 欢迎使用 AI 招聘团队
  - 您的 AI 员工需要连接您的大模型账号才能开始工作
  - 请配置：① DeepSeek ② OpenAI ③ 火山引擎 ④ 其他兼容模型
  - 配置完成后 **Alice 招聘顾问 · Bob 面试专家 · Carol 人才分析师** 即可开始工作
  - BYOK 提示：企业提供算力，昆仑镜不托管您的 API Key，Key 加密存储仅归企业所有
  - 「**立即配置 AI 模型**」→ 跳转 `/workspace/enterprise/model-settings`（AI模型设置页）
- 已配置（hasCredential + health ok）→ 横幅自动消失

---

## 四、验收（Reality Check）

| Gate | 验证 | 结果 |
|------|------|------|
| A1 | 全仓无 Workspace 级模型配置表/路由残留 | ✅ schema + 路由扫描 |
| A2 | agent-brain 企业调用走统一 Resolver，无配置显式阻断 | ✅ 代码改造 + tsc 通过 |
| A3 | 旧 ai-providers / provider-management 写端点 410 | ✅ 实测 410（enterprise-foundation 双前缀路径实测返回 410 文案） |
| A4 | OnboardingWizard 写新端点（不再写死表） | ✅ 代码改造 |
| A5 | 首页引导横幅：未配置显示 / 已配置隐藏 | ✅ 逻辑 + 待浏览器截图 |
| A6 | 我的改动不引入新编译错误 | ✅（基线 1960 个历史错误未新增，改动文件全通过） |

## 数据真相（2026-08-01）
```
OrgModelConfig 6 条（deepseek×3 / openai×3）  ProviderCredential 6 条
EnterpriseLlmConfig 14 条（compat 存量，禁新写）  AIProviderConfig 0（死表）  EmployeeModelBinding 0（死表）
```

## 提交
待填

## 冻结清单（持续）
❌ Workspace 级模型配置（任何业务线） ❌ AIProviderConfig / EmployeeModelBinding 写入 ❌ provider-management 死表 API
✅ 唯一配置入口：User/Organization Model Config → Unified Runtime Resolver → All Workspace Agents
