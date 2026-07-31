# KMKI AI Runtime Principle — 昆仑镜 AI 运行时最高级架构规则

**Status:** FREEZE（掌柜战略定论 2026-08-01）
**Supersedes:** 一切 Workspace 级模型配置设计（EnterpriseLlmConfig 方向、Workspace Model Config、Recruitment/ShortDrama Model Config 等）
**适用范围:** 昆仑镜所有 Workspace（短剧 / 招聘 / 小说 / GEO / 图片 / 音乐 / 新媒体 / 电商）

---

## 一句话

> **所有昆仑镜 Workspace 的 AI 能力必须遵循 BYOK Runtime。**
> Workspace 负责业务场景、Agent 编排、能力授权、执行记录；
> 用户负责模型供应商和 API 成本；
> **平台禁止成为业务 Workspace 的大模型调用中转方。**

昆仑镜是 **AI 员工操作系统**，不是 **AI API 供应商**。

---

## 标准链路（唯一）

```
用户/企业 购买 Workspace 套餐
 ↓
获得 Workspace 权益
 ↓
激活 AI 员工
 ↓
AI 员工绑定：
  Identity · Capability · Runtime · Memory · Usage Record
 ↓
执行任务
 ↓
读取当前 用户/企业 的大模型配置
 ↓
Unified Runtime Resolver（Model Resolver）
 ↓
用户/企业 自己的 API Key
 ↓
DeepSeek / OpenAI / 火山 / Claude / Gemini / 可灵 / 即梦 / Replicate …
 ↓
返回结果
```

---

## 三层职责模型

### 平台层 — 只管理「支持什么」，不「替用户调用」

```
Provider Registry    DeepSeek / GPT / Claude / Gemini / 可灵 / 即梦 / Replicate …
Model Registry       各 provider 可用模型
Capability Registry  TEXT / IMAGE / VIDEO / TTS …
Agent Registry       AI 员工模板与实例
Runtime              任务执行、编排、队列
Usage Billing        用量与计费记录
```

平台默认模型（AiStageModelConfig）只是 **fallback 第 5 层**，用户/企业 BYOK 永远优先。

### 用户/企业层 — 自己管理「用什么、花谁的钱」

```
我的模型设置
  Provider:  DeepSeek
  API Key:   sk-xxxx（企业资产，AES 加密，平台不可见）
  默认模型:   deepseek-chat
  能力:       TEXT / IMAGE / VIDEO
```

- 个人 Workspace → **UserModelConfigV2**（用户 BYOK）
- 企业 Workspace → **OrgModelConfig + ProviderCredential**（企业 BYOK）

### Agent 层 — 只声明「需要什么」，不保存任何密钥

```
需要:    TEXT 能力
推荐:    deepseek-chat
fallback: gpt-4o
```

❌ API Key　❌ Provider Secret　❌ 平台账号

---

## 唯一允许的配置入口

```
User/Organization Model Config
 ↓
Unified Runtime Resolver
 ↓
All Workspace Agents
```

**禁止再设计（违反 SSOT）：**
- ❌ EnterpriseLlmConfig（已 deprecated，存量仅兼容读取）
- ❌ Workspace Model Config
- ❌ Recruitment Model Config
- ❌ ShortDrama Model Config
- ❌ 任何业务线专属模型配置表/路由

---

## 各 Workspace 已对齐现状（2026-08-01 审计）

| Workspace | 配置入口 | 执行链路 | 状态 |
|-----------|---------|---------|------|
| 🎬 AI短剧 | 用户大模型设置（UserModelConfigV2） | narrativeGateway → getRuntimeConfig 注入用户 Key | ✅ 已对齐 |
| 💼 招聘 | 企业AI模型设置（OrgModelConfig+ProviderCredential） | executeTask → modelResolver.resolveEnterpriseModel | ✅ 已对齐（IDENTITY-REALITY-FIX-01） |
| 📖 小说 | 用户模型配置（UserModelConfigV2） | resolveRuntimeConfig 统一链 | ✅ |
| 🌎 GEO | 用户模型配置（UserModelConfigV2） | user-model-config.repository → 统一链 | ✅ |
| 🖼️ 图片/电商 | 用户模型配置（UserModelConfigV2） | api-router → selectProvider 用户 Key 优先 | ✅ |
| 🎵 音乐 | 用户能力配置（capability-llm-config → UserModelConfigV2） | 统一链 | ✅ |

## 商业模式含义

- 企业买「招聘 AI 员工 ¥2999/月」→ 得到 Alice 招聘顾问 / Bob 面试专家 / Carol 人才分析师
- **算力企业自己承担**
- 昆仑镜收入 = Workspace 订阅 + AI 员工订阅 + 增值能力 + 企业服务
- **不是 API 差价**

---

## 落地检查清单（新功能评审必过）

1. 新 Workspace 是否复用 UserModelConfigV2 / OrgModelConfig？→ 禁止新建模型配置表
2. 执行链路是否走 Unified Runtime Resolver？→ 禁止业务线直连 provider
3. 平台代码是否接触用户/企业 Key？→ 禁止（仅加密存储 + 掩码展示）
4. 无企业/用户配置时是否显式阻断（如 ENTERPRISE_MODEL_CONFIG_MISSING）？→ 禁止静默用平台 Key 兜底业务 Workspace
5. 是否产生 usage_record（organizationId/agentId/model/cost）？→ 必须

---

*本原则由掌柜战略指令冻结。任何违反需掌柜批准方可变更。*
