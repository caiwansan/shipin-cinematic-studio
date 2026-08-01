# Sprint-09D-02 Task 02 — 求职顾问 Platform AI 配置 Reality Audit

**Audit Date:** 2026-07-30 20:21 CST
**Auditor:** 杨玉环 🏮
**State:** COMPLETE ✅

---

## 验收标准：三扇门

| # | 门 | 状态 |
|---|----|------|
| 1 | 🧠 求职顾问是否真正走平台模型？ | ✅ **PASS — 订阅用户走平台模型，免费用户走规则引擎** |
| 2 | 管理员是否可以控制模型？ | ✅ **PASS — admin UI + requireAdmin API** |
| 3 | 🪞 镜心是否完全不受影响？ | ✅ **PASS — 业务身份隔离，无交叉污染** |

---

## 已冻结产品身份

| 产品 | 身份 | businessType | 模型来源 |
|------|------|-------------|---------|
| 🧠 求职顾问 | 公共职业咨询 AI | `career_advisor` | Platform AI Gateway |
| 🪞 镜心 | 私人职业助理 | `career_agent`（订阅码） | UserModelConfigV2 (BYOK) |

前后端代码已全线统一，无混用。

---

## 审计记录

### G1: 🧠 求职顾问 Platform AI 链路

**全链路 Trace:**

```
用户消息 → /api/job/chat → careerConversationOrchestrator
  ↓
getOrCreateAgentContext(userId)
  ↓
  ├─ [有 career_agent] → processWithAlice()
  │   ↓
  │   enterpriseAgentRuntime.executeTask({ businessType: 'career_advisor' })
  │   ↓
  │   resolveRuntimeConfig(input.businessType='career_advisor', capability='llm')
  │   ↓
  │   1. getRouteConfig('route:admin-global-config:career_advisor', 'llm_model')
  │   2. getRouteConfig('route:admin-global-config:career_advisor', 'llm_provider')
  │   3. prisma.apiKey.findUnique({ provider: 'business_type_career_advisor' })
  │   4. → Platform AI model (deepseek-v4-flash) → LLM response
  │
  └─ [无 career_agent] → processWithEngine()
      ↓
      JobCareerEngine (规则引擎，无 LLM)
```

**关键文件确认：**

| 文件 | 行号 | businessType | 结论 |
|------|------|-------------|------|
| `career-conversation-orchestrator.ts` | 598 | `career_advisor` | ✅ 画像提取 |
| `career-conversation-orchestrator.ts` | 737 | `career_advisor` | ✅ 回复生成 |
| `resolveRuntimeConfig.ts` | 97 | 接受 businessType 参数 | ✅ 支持 career_advisor |
| `resolveRuntimeConfig.ts` | 178-240 | 读取 admin-global-config | ✅ 完整实现 |
| `runtime-gateway.ts` | 61 | 透传 businessType | ✅ |
| `admin-global-config.ts` | — | allowedTypes 含 career_advisor | ✅ |

**当前 DB 配置：**

```json
{
  "provider": "deepseek",
  "model": "deepseek-v4-flash",
  "hasApiKey": true
}
```

### G2: 管理员控制模型

| 检查项 | 结论 |
|--------|------|
| admin UI 页面 | ✅ `/admin/aigc/models` — "🎯 求职顾问" 卡片 |
| 供应商选择 | ✅ DeepSeek / OpenAI / 火山引擎 / 阿里百炼 / 通义千问 |
| 模型输入 | ✅ 文本框 `deepseek-v4-flash` |
| API Key 输入 | ✅ 密码框，已配置 |
| Base URL 输入 | ✅ 可选 |
| 保存接口 | ✅ `PUT /api/admin/global-config/business-type/:type` |
| 权限保护 | ✅ `requireAdmin` — 非管理员不可操作 |

### G3: 🪞 镜心不受影响

| 检查项 | 结论 |
|--------|------|
| 镜心 = career_agent，非 career_advisor | ✅ |
| career_agent 仅出现在 payment / subscription / Agent provision | ✅ |
| career_agent 的 Profile.agentType 虽为 'career_advisor' 但 metadata.source='career_agent' 标识 | ✅ 命名重叠但不污染 |
| UserModelConfigV2 未被求职顾问读取 | ✅ 仅职业伙伴私有助手读取 |
| EnterpriseLlmConfig 未混入 | ✅ |
| 免费公共用户 BYOK 不会被读取 | ✅ 无 career_agent → 无 BYOK 路径 |

---

## ⚠️ 设计发现

### 免费用户 → 规则引擎

当前架构：

```
免费用户 → getOrCreateAgentContext() → null → JobCareerEngine (规则引擎)
订阅用户 → getOrCreateAgentContext() → career_agent → processWithAlice() → Platform AI LLM
```

这意味着：

1. 免费用户的求职顾问聊天**不消耗 Platform AI token**
2. 免费用户得到的是**模板化的规则应答**（收集画像信息的引导对话）
3. 一旦用户订阅 → Agent 创建 → 对话切换到全 LLM 模式

**这不是 bug，是商业模式设计。** 免费交互用于展示价值 + 收集画像，付费解锁 LLM 能力。

建议在 UI 上对此有明确引导（已完成：Task 01 的 mirror card 在右侧显示）。

---

## 禁止条目检查

```diff
- ❌ career_agent 误用于公共顾问 → ✅ 未发现
- ❌ UserModelConfigV2 被公共顾问读取 → ✅ 未发现
- ❌ 用户 BYOK 影响公共顾问 → ✅ 未发现
- ❌ EnterpriseLlmConfig 混入 → ✅ 未发现
```

---

## 三扇门结论

| 门 | 状态 | 证据 |
|----|------|------|
| 1️⃣ 求职顾问走平台模型 | ✅ | career_advisor → resolveRuntimeConfig → admin-global-config → deepseek-v4-flash |
| 2️⃣ 管理员控制模型 | ✅ | admin UI + requireAdmin API + DB 配置已就绪 |
| 3️⃣ 镜心不受影响 | ✅ | 业务身份隔离，无交叉污染 |

---

**三扇门全部通过。✅🏮**
