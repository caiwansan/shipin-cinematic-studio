# Sprint-09D-03 Task 05 — 🧠 求职顾问平台管理配置 Reality Gate

**Date:** 2026-07-30 21:05 CST
**Gate:** 掌柜验收

---

## 问题纠正

**以前（错误方向）：**
```
环境变量 VOLCENGINE_API_KEY
  ↓
route_config
  ↓
career-advisor.service.ts → executeViaGateway
```

开发人员手工塞 Key = 基础设施配置 ≠ 产品配置 ❌

**现在（正确方向）：**
```
管理后台 /admin/recruitment/config
  ↓
管理员选择 Provider + 模型 + 填写 API Key
  ↓
route_config (scope: route:admin-global-config:career_advisor)
  + ApiKey (provider: business_type_career_advisor)
  ↓
career-advisor.service.ts → executeViaGateway
  ↓
所有免费用户使用
```

平台运营配置，不是基础设施配置 ✅

---

## 改动一览

| 文件 | 类型 | 说明 |
|------|------|------|
| `pages/admin/recruitment/config.vue` | 🆕 新页面 | 求职顾问 AI 配置管理页面 |
| `pages/admin/recruitment/index.vue` | 🔧 修改 | 快捷入口增加"🧠 AI 配置"按钮 |
| `backend/src/routes/admin-global-config.ts` | ✅ 已有 | `career_advisor` 已在 10 天前的 Sprint-07A 的白名单中 |

**零新增后端代码** — 复用 `GET/PUT /api/admin/global-config/business-type/:type`

---

## 产品身份隔离验证

| Agent | 配置来源 | 存储 | Runtime | 本次是否受影响 |
|-------|---------|------|---------|:------------:|
| 🧠 求职顾问 | `route:admin-global-config:career_advisor` | `route_config` + `ApiKey` | Platform AI Gateway | ✅ 本次新增 |
| 🪞 镜心 | `UserModelConfigV2` | `user_model_config` 表 | Hermes Instance | ❌ 无改动 |
| 🏢 企业招聘 | `EnterpriseLlmConfig` | `enterprise_llm_config` 表 | Enterprise Runtime | ❌ 无改动 |

---

## Reality Gate

### G1 ✅ 管理员能配置模型

```
/admin/recruitment/config
  → GET /api/admin/global-config/business-type/career_advisor
  → 显示 Provider / Model / Key 状态
  → PUT 保存 → route_config + ApiKey
```

### G2 ✅ API Key 不进代码/环境变量

- Key 存储到 `ApiKey` 表 (`provider: business_type_career_advisor`)
- GET 接口不返回实际 Key（`hasApiKey: boolean`）
- 管理员在页面中填写，仅保存时写入

### G3 ✅ 普通用户聊天走平台模型

```
CareerAdvisorService.execute()
  → executeViaGateway('llm', ..., { businessType: 'career_advisor' })
  → resolveRuntimeConfig → route_config:career_advisor → 使用平台 Key
```

### G4 ✅ 镜心不受影响

`career-advisor.service.ts` 不走 `UserModelConfigV2`

### G5 ✅ 企业 AI 不受影响

`career-advisor.service.ts` 不走 `EnterpriseLlmConfig`

---

## 使用流程

```
管理员登录 → 左侧导航「求职招聘管理」
  ↓
快速入口「🧠 AI 配置」
  ↓
选择供应商（DeepSeek / 火山引擎 / OpenAI / 阿里百炼）
  ↓
选择模型（自动加载该供应商的 LLM 模型列表）
  ↓
填写 API Key
  ↓
「测试连接」→ 验证求职顾问能否正常对话
  ↓
「保存配置」
  ↓
用户进求职管家 → CareerAdvisorService → Platform AI Gateway → LLM → 回复
```

---

*Report generated at 2026-07-30 21:08 CST by 杨玉环 🏮*
