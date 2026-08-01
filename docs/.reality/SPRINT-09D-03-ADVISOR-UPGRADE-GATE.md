# Sprint-09D-03 — 🧠 求职顾问 Agent Reality Upgrade — Gate Report

**Date:** 2026-07-30 21:00 CST
**Gate:** 掌柜产品方向纠正验收

---

## 本次改动一览

| 文件 | 类型 | 说明 |
|------|------|------|
| `docs/.reality/SPRINT-09D-ADVISOR-AGENT-REALITY-AUDIT.md` | 📄 审计报告 | 完整 Reality Audit |
| `backend/src/services/career/career-advisor.service.ts` | 🆕 新文件 | 求职顾问 Agent 核心服务（文曲星模式） |
| `backend/src/routes/job.routes.ts` | 🔧 修改 | 加入 CareerAdvisorService 为首选路径 |
| route_config 表 | 🗄️ 插入 | `career_advisor` 的 `llm_model` + `llm_provider` |
| `career_profile` + 8 张关联表 | 🗄️ 迁移 | 从 Prisma schema 创建到 DB |

---

## Reality Gate 四扇门

### G1 🧠 求职顾问 + LLM 对话（Platform AI Gateway）

| 检查项 | 状态 | 说明 |
|--------|------|------|
| route_config 已配置 | ✅ `llm_model=doubao-seed-2-0-mini-260428`, `llm_provider=volcengine` |
| ApiKey 已配置 | ❌ `business_type_career_advisor` 无对应 key |
| 环境变量 `VOLCENGINE_API_KEY` | ❌ .env 中被注释 |
| resolveRuntimeConfig 平台层 | ✅ 代码完整，等待 key |
| LLM 实际可调用 | ❌ 阻断 |

**导致阻断的原因：无 VOLCENGINE_API_KEY**

| fallback 路径 | 状态 |
|---------------|------|
| → CareerConversationOrchestrator (Hermes) | ✅ 试用用户尝试 |
| → JobCareerEngine (规则引擎) | ✅ 正常回复 |

### G2 🧠 求职顾问 Service（新架构）

| 检查项 | 状态 |
|--------|------|
| Static system prompt | ✅ "你是求职顾问 🧠" 身份独立 |
| Context packet | ✅ 用户信息 + CareerProfile + 对话摘要 |
| `===COLLECT_START===` 标记检测 | ✅ 字段采集标记 |
| `===CAREER_PROFILE_SAVE===` 标记检测 | ✅ 画像保存标记 |
| 标记移除（不污染回复） | ✅ `removeMarkers()` |
| saveExtractedFields → CareerProfile | ✅ 逐字段写入 |
| 对话历史管理 | ✅ 内存 Map，限制 40 轮 |
| 对话摘要（每 20 轮） | ✅ `generateSummary()` |

### G3 🗄️ CareerProfile 数据闭环

| 检查项 | 状态 |
|--------|------|
| `career_profile` 表 | ✅ 已创建 |
| `work_experience` 表 | ✅ 已创建 |
| `education` 表 | ✅ 已创建 |
| `candidate_resume` 表 | ✅ 已创建 |
| `candidate_card` 表 | ✅ 已创建 |
| `skill` 表 | ✅ 已创建 |
| `candidate_skill` 表 | ✅ 已创建 |
| `skill_evidence` 表 | ✅ 已创建 |
| `career_timeline_event` 表 | ✅ 已创建 |
| 外键约束 | ✅ 全部到位 |
| 索引 | ✅ 全部到位 |

### G4 🚦 Fallback 链正确性

```
CareerAdvisorService → 无 key → ❌
  ↓
CareerConversationOrchestrator → 非订阅用户 → ❌
  ↓
JobCareerEngine → ✅ 返回规则引擎回复
```

**线上验证：** `/api/job/chat` 返回 `{"reply":"你有几年的工作经验？\n\nA 应届生\nB 1-2年..."}` ✅

---

## 已遵守的边界

| 约束 | 遵守情况 |
|------|----------|
| 不修改镜心 Hermes Runtime | ✅ 新服务直接 executeViaGateway |
| 不修改支付 | ✅ 无改动 |
| 不修改 Subscription | ✅ 无改动 |
| 不修改企业招聘 Agent | ✅ 无改动 |
| 不新增 Agent 类型 | ✅ 复用已有 route_config + executeViaGateway |
| 求职顾问 ≠ 镜心 | ✅ 独立 system prompt + 独立 businessType |

## 产品身份跃迁

```
以前：
  用户 → 求职管家 → JobCareerEngine(规则) → 固定问答

现在（已有 key 时）：
  用户 → 求职管家
    ↓
  CareerAdvisorService
    ↓
  Platform AI Gateway (doubao-seed-2-0-mini)
    ↓
  LLM 对话理解
    ↓
  ===COLLECT_START=== → CareerProfile 持久化
    ↓
  回复 ← 自然语言

现在（无 key fallback）：
  用户 → 求职管家 → JobCareerEngine(规则) → 固定问答
```

---

## 阻断项

| # | 阻断 | 修复方案 | 预估时长 |
|---|------|----------|----------|
| 1 | `VOLCENGINE_API_KEY` 未配置 | 掌柜提供有效的火山引擎 key |
| 2 | 或改用 DEEPSEEK（.env 中有 `DEEPSEEK_BASE_URL` + `DEEPSEEK_LLM_MODEL`） | 需要 `DEEPSEEK_API_KEY` |

---

## 建议执行顺序（掌柜确认 key 后）

```
① 设置 VOLCENGINE_API_KEY（取消 .env 注释 / 添加 value）
  ↓
② 重启后端（kill -9 + nohup 启动）
  ↓
③ 验证：curl POST /api/job/chat 返回 LLM 回复（非规则引擎）
  ↓
④ 前端验证：用户进入求职管家 → 自然对话 → 采集字段 → 保存 CareerProfile
  ↓
⑤ 简历创建流程：用户说"帮我写简历" → 多轮采集 → 数据保存 → 前端展示
```

---

*Report generated at 2026-07-30 21:05 CST by 杨玉环 🏮*
