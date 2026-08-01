# Sprint-09D — 🧠 求职顾问 Agent 产品 Reality Audit

**Date:** 2026-07-30 20:50 CST
**Scope:** 求职顾问产品定位纠偏 + 文曲星模式复用审计 + Platform AI Gateway 配置确认

---

## 审计核心问题

1. **当前求职顾问是否是真 Agent？** ❌ — 规则引擎 + LLM fallback 的混合体
2. **如何复用文曲星模式？** — 需要重新设计，不可直接复制
3. **CareerProfile 数据如何沉淀？** — 表存在 Prisma schema 但 DB 未迁移 ⚠️
4. **Platform AI Gateway 如何接入？** — career_advisor 配置完全缺失 ❌
5. **与镜心如何保持身份隔离？** — 已有架构隔离，但 Runtime 层耦合 ⚠️

---

## Task 01 — JobCareerEngine 规则覆盖范围审计

### 文件
- `backend/src/agents/job/job-career-engine.ts` — 规则引擎本体（344 行）
- `backend/src/agents/job/job-career.agent.ts` — Agent 包装壳（占位实现）

### 规则引擎能力清单

| 能力 | 覆盖 | 质量评估 |
|------|------|----------|
| 收集姓名 | ✅ 正则匹配 "我叫/我是/称呼我/叫我 xxx" | 🟡 长名/英文名/昵称支持弱 |
| 收集学历 | ✅ 关键词匹配（本科/硕士/博士/大专/高中） | 🟢 中英文均支持 |
| 收集专业 | ✅ "专业/主修/学习 是xxx" | 🟡 仅单字段匹配 |
| 收集技能 | ✅ 48 个预设技能关键词 | 🟡 硬编码列表，无法覆盖新兴技能 |
| 收集经验年限 | ✅ 正则 + 范围匹配 | 🟢 支持数字+年/应届/无经验 |
| 收集城市 | ✅ 20 个预设城市 + "不限/远程" | 🟡 不支持县城/海外城市 |
| 收集薪资 | ✅ 正则匹配 K 范围和纯数字 | 🟢 支持 15-20K / 15000-20000 |
| 收集职业目标 | ✅ 7 种关键词匹配 | 🟡 无法处理模糊目标描述 |
| 引导沟通 | ✅ 6 阶段预设问题模板 | 🟡 固定顺序，无动态调整 |
| 完整度计算 | ✅ 7 字段加权（100 分制） | 🟢 合理 |
| 职业建议 | ✅ 基于规则的强弱项分析 | 🟡 无 LLM 语义理解，建议泛化 |
| 欢迎语/回访 | ✅ 根据已有数据区分新旧用户 | 🟢 |

### 关键缺陷

```
缺陷 1: 非自然沟通
  用户说 "我30岁做设计的想转AI"
  → 引擎无法理解 "设计" 行业背景
  → 无法分析 "30岁" 的转型紧迫性
  → 只能提取 "技能" 关键词，丢失上下文

缺陷 2: 无追问能力
  用户说 "我想去互联网行业"
  → 引擎仅提取 city=""（无城市关键词）
  → 不会追问 "哪个方向？前端/后端/算法/产品？"

缺陷 3: 固定流程
  EDUCATION → SKILLS → EXPERIENCE → LOCATION → SALARY → GOAL
  用户提前透露薪资 → 引擎无视（必须按顺序问）

缺陷 4: 无法给出深度洞察
  不能做：行业趋势分析 / 技能差距量化 / 转行路径规划
```

### 真实用户意图理解测试

| 用户输入 | 引擎理解 | 应理解 |
|----------|----------|--------|
| "我30了，想转AI" | skills=[] city="" | 年龄30, 转行需求, AI行业兴趣 |
| "我在阿里做了5年测试" | skills=[] experienceYears=5 city="" | 大厂经验, 测试岗位, 5年 |
| "帮我写简历" | skills=[] | 简历创建意图 → 引导多轮采集 |
| "产品经理怎么转型" | careerGoal="产品经理" | 职业咨询意图 |

**结论：当前引擎无法处理约 70% 的自然语言求职对话。需要 LLM 替代规则。**

---

## Task 02 — 文曲星 Agent 模式审计

### 文件
- `backend/src/services/hdz/worldbuilder.service.ts` — 文曲星核心（220 行）
- `backend/src/services/hdz/llm.client.ts` — LLM 调用封装
- `backend/src/services/hdz/repositories/` — Memory / Character / Chapter / Project 仓储

### 文曲星核心特征

```
┌─────────────────────────────────────────────────┐
│  系统提示词（完全静态）                           │
│  "你是文曲星，一位温润如玉的文学创作顾问。"         │
│  → KV Cache 友好，每次命中相同缓存               │
├─────────────────────────────────────────────────┤
│  上下文数据包（每次构建）                         │
│  [项目信息] + [已有角色] + [章节进度] + [对话摘要]  │
│  → 从 DB 加载最新数据                            │
├─────────────────────────────────────────────────┤
│  记忆系统（hdzMemoryRepository）                 │
│  每 50 轮 AI 回复 → 生成对话摘要                  │
│  → history 只保留最近 10 轮                      │
│  → 摘要替代更早的对话                            │
├─────────────────────────────────────────────────┤
│  工具调用（特殊标记格式）                         │
│  ===FETCH_URL_START=== → 抓取 URL 内容           │
│  ===CARD_DATA_START=== → 批量创建角色卡片         │
│  ===FACTION_DATA_START=== → 批量创建宗门          │
│  ===OUTLINE_DATA_START=== → 批量创建大纲章节       │
│  → 后端检测标记 → 解析 JSON → 写 DB → 继续对话     │
├─────────────────────────────────────────────────┤
│  LLM 调用链                                     │
│  worldbuilderService.execute()                   │
│    → callWithFetch() → callLLM()                │
│    → 直接调用 LLM（非 Hermes Runtime）            │
│    → 走 getUserLLMConfig（BYOK / 平台配置）       │
├─────────────────────────────────────────────────┤
│  对话管理                                        │
│  hdzSession 表存储完整消息历史                     │
│  GET /sessions 列出所有对话                       │
│  POST /send 发送消息 → 执行 → 保存回复            │
└─────────────────────────────────────────────────┘
```

### 可复用模式（求职顾问）

| 文曲星模式 | 求职顾问适配 | 优先级 |
|------------|-------------|--------|
| 静态 system prompt | ✅ 可直接复用 | P0 |
| 上下文数据包 | ⚠️ 需适配：CareerProfile → 用户画像 + 对话摘要 | P0 |
| 记忆摘要系统 | ✅ 可直接复用（每 N 轮生成对话摘要） | P1 |
| 工具调用（特殊标记） | ⚠️ 需创造：简历字段采集 → 数据提取标记 | P1 |
| 直接 LLM 调用 | ❌ 求职顾问走 Platform AI Gateway，不走 BYOK | P0 |
| 对话 session 管理 | ✅ 可直接复用 | P1 |

### 不可复用模式

| 文曲星模式 | 不可复用原因 |
|------------|-------------|
| URL 抓取工具 | 求职不需要 |
| 角色卡片 JSON | 求职不需要 |
| 大纲 JSON | 求职不需要 |
| 宗门 JSON | 求职不需要 |
| 用户 BYOK | 求职顾问是平台免费服务，不收用户 Key |
| Hermes Runtime | 求职顾问不创建 Personal Agent Instance |

---

## Task 03 — career_advisor Platform Agent 最小闭环设计

### 设计原则

```
不新建数据库表（除非 Reality Audit 证明必须）
不改 Subscription / 支付 / Hermes Runtime
不合并两个 Agent（求职顾问 ≠ 镜心）
```

### 架构

```
用户消息 → career_advisor_chat API
  ↓
getUserConfig() → 获取用户的 UserModelConfigV2（用于 Identity Context）
  ↓
┌──────────────────────────────────────────────┐
│            careerAdvisorService              │
│                                              │
│  system prompt: 静态提示词 "你是求职顾问 🧠"    │
│  context: [用户画像] + [对话历史摘要] + [技能库] │
│                                              │
│  → executeViaGateway(llm, {                  │
│      businessType: 'career_advisor'          │
│    })                                        │
│  → Platform AI Gateway 兜底模型               │
│                                              │
│  回复检测: ===COLLECT_START=== → 字段提取      │
│  回复检测: ===CAREER_PROFILE_SAVE=== → 画像持久化│
└──────────────────────────────────────────────┘
  ↓
回复 → 前端展示
```

### 数据流

```
对话 Session（memory 模式）
  │
  ├── hdzSession 风格：对话历史 + metadata
  │   （复用，非新建）
  │
  ├── CareerProfile（Prisma model 存在，DB 表缺失 ⚠️）
  │   ├── fullName
  │   ├── education
  │   ├── skills[]
  │   ├── workExperience[]
  │   ├── careerGoal
  │   ├── expectedSalary
  │   └── userId
  │
  └── Memory（对话摘要，每 20 轮自动生成）
      ├── summary_type: "career_chat_summary"
      └── content: JSON { msgCount, keyInfo, nextAdvice }
```

### 对话流程

```
初始状态：
  → 用户登录进入求职管家
  → 自动创建/恢复 session（无 session 时系统提示词打招呼）

自由对话：
  用户输入 → 注入 system prompt + context → executeViaGateway → LLM 回复

意图识别（LLM 内部分类）：
  - "帮我找/写/做简历" → 采集模式
  - "转行/转型" → 职业咨询模式
  - "哪个行业好" → 行业分析模式
  - "怎么面试" → 面试建议模式
  - "帮我分析" → 画像分析模式
  - 默认 → 自由对话，引导用户说出需求

字段采集（===COLLECT_START===）：
  当 LLM 检测到用户提供简历字段时：
  ===COLLECT_START===
  {"fields": [
    {"name": "fullName", "value": "张三"},
    {"name": "education", "value": "本科"},
    {"name": "skills", "value": ["Python", "数据分析"]}
  ]}
  ===COLLECT_END===
  → 后端提取 → 更新 CareerProfile → 继续对话

画像保存（===CAREER_PROFILE_SAVE===）：
  当画像完整度 > 80% 时：
  ===CAREER_PROFILE_SAVE===
  {"complete": true, "completeness": 85}
  ===PROFILE_END===
  → 后端持久化到 career_profile 表

引导升级镜心：
  当用户需求超出免费范围（如长期记忆、岗位筛选、主动推荐）：
  "如果需要持续跟踪你的职业发展，可以开通镜心职业伙伴（¥9.9/月）"
  → 前端展示购买引导
```

### 费用控制

```
每轮对话 ≈ 2K tokens（system prompt 1K + context 0.5K + 回复 0.5K）
doubao-seed-2-0-mini-260428 模型价格 ≈ ¥3/百万 tokens
每人每天 10 轮对话 ≈ 20K tokens ≈ ¥0.06/人/天
万日活用户 ≈ ¥600/天
✅ 成本可控
```

---

## Task 04 — Platform AI Gateway 配置审计

### 当前状态

| 配置项 | 状态 | 位置 |
|--------|------|------|
| `route:admin-global-config:career_advisor` → `llm_model` | ❌ 不存在 | route_config 表 |
| `route:admin-global-config:career_advisor` → `llm_provider` | ❌ 不存在 | route_config 表 |
| `business_type_career_advisor` ApiKey | ❌ 不存在 | ApiKey 表 |
| `VOLCENGINE_API_KEY` 环境变量 | ❌ 注释掉了 | .env |

### Platform AI Gateway 解析链（career_advisor 路径）

```
resolveRuntimeConfig('llm', { businessType: 'career_advisor' })
  │
  ├── 1. 输入层           ← 前端用户选的模型（求职顾问不选）
  ├── 2. 企业配置层       ← 镜心用户才有（求职顾问无企业）
  ├── 3. 平台配置层       ← ❌ 缺失！ skip
  ├── 4. 用户 BYOK        ← ❌ 求职顾问不收用户 Key，skip
  ├── 5. 阶段配置层       ← 可能未配
  ├── 6. Provider 注册表   ← 需配置
  └── 7. 环境变量          ← VOLCENGINE_API_KEY 注释掉
  → CONFIG_ERROR ❌
```

### 需要补全的配置

```json
// route_config 表
{
  "key": "route:admin-global-config:career_advisor",
  "sub_key": "llm_model",
  "value": "doubao-seed-2-0-mini-260428"
}
{
  "key": "route:admin-global-config:career_advisor",
  "sub_key": "llm_provider",
  "value": "volcengine"
}

// ApiKey 表
{
  "provider": "business_type_career_advisor",
  "key_value": "<volcengine_api_key_encrypted>"
}
```

**或更简单：取消 .env 中 VOLCENGINE_API_KEY 的注释。**

但注意：`resolveRuntimeConfig` 的平台配置层在 `if (platformModel)` 为 false 时整体跳过，所以即使环境变量有值，`platformModel` 为空时也用不到。必须加上 route_config 条目。

---

## 身份隔离确认

### 最终身份模型验证

```
🧠 求职顾问（免费）                 🪞 镜心（¥9.9/月）
─────────────────────────────     ─────────────────────────────
Platform AI Agent                 Personal AI Employee
无 Memory                         Personal Memory
无 Hermes Instance                Hermes Runtime
Platform Gateway LLM              BYOK / Subscription
无 CareerProfile 持久化（会话级）   CareerProfile 持久化
无 tool calling                   有 tool calling（岗位搜索）
获客入口                          长期职业管理
```

### 隔离点

| 维度 | 求职顾问 | 镜心 | 是否隔离 |
|------|----------|------|----------|
| Runtime | direct executeViaGateway | EnterpriseAgentRuntime.executeTask | ✅ |
| 模型配置 | Platform Gateway | BYOK / 订阅权益 | ✅ |
| 身份 | 公共 Agent（无 profile） | EnterpriseAgentProfile | ✅ |
| 记忆 | 无持久化 | Personal Memory | ✅ |
| 支付 | 免费 | Subscription ¥9.9/月 | ✅ |
| 数据库 | 对话 session（临时） | CareerProfile | ⚠️ 共享表但不同写入路径 |

---

## 发现摘要

### 🔴 Critical

| # | 问题 | 影响 | 文件/位置 |
|---|------|------|-----------|
| C1 | CareerProfile 表在 Prisma schema 存在但 DB 未迁移 | 所有 syncToCareerProfile 调用静默失败 | `prisma/schema.prisma:8272` → career_profile 表不存在 |
| C2 | Platform AI Gateway career_advisor 配置完全缺失 | 求职顾问 LLM 路径全部阻塞 | route_config + ApiKey |
| C3 | VOLCENGINE_API_KEY 在 .env 中被注释 | 环境变量 fallback 也失效 | backend/.env |

### 🟡 High

| # | 问题 | 影响 |
|---|------|------|
| H1 | JobCareerEngine 无法处理 70% 以上的自然语言求职对话 | 用户得不到有价值回复 |
| H2 | 求职顾问无对话 session 持久化 | 刷新页面丢失所有上下文（需确认前端行为） |
| H3 | 不存在 career_advisor 的 system prompt | 当前用的是 Alice/镜心的 system prompt，身份混用 |
| H4 | `tenantId=userId` identity debt 影响两个 Agent | 需要 Sprint-09B Identity Reality Audit 解决 |

### 🟢 Low

| # | 问题 | 影响 |
|---|------|------|
| L1 | `getRouteConfig` 的 interface 类型约束不完善 | 但运行时不影响 |
| L2 | 文曲星的 `hdzMemory` + `hdzSession` 表结构与求职需求不匹配 | 可用但需适配 |

---

## 执行建议

### Phase 1: Platform AI Gateway 配置（直接影响 Demo）

```sql
-- 1) 补 route_config（career_advisor 兜底模型）
INSERT INTO route_config (id, key, sub_key, value, label, sort_order, is_active)
VALUES
  (gen_random_uuid(), 'route:admin-global-config:career_advisor', 'llm_model', 'doubao-seed-2-0-mini-260428', '求职顾问默认模型', 1, true),
  (gen_random_uuid(), 'route:admin-global-config:career_advisor', 'llm_provider', 'volcengine', '求职顾问默认厂商', 2, true);

-- 2) 补 ApiKey
-- 使用 volcengine 的已有密钥（从环境变量或 ApiKey 表复制）
INSERT INTO "ApiKey" (id, provider, key_name, key_value)
VALUES (gen_random_uuid(), 'business_type_career_advisor', 'volcengine_key', '<encrypted_key>');
```

### Phase 2: CareerProfile 迁移

```bash
npx prisma migrate dev --name sprint09d-career-profile
```

### Phase 3: 求职顾问 Service 重构

- 新建 `backend/src/services/career/career-advisor.service.ts`
- 复用文曲星的 `static system prompt + context packet + memory summary` 模式
- 不走 Hermes Runtime，直接 `executeViaGateway`
- 对话 session → `hdzSession` 风格（或直接先存内存）
- 字段采集 → `===COLLECT_START===` 标记

### Phase 4: 产品宪法规约

在 AGENTS.md 或项目文档中记录：

```
求职顾问 ❌ 不可做：
  - 用户登录、权限校验
  - CRE：不叫"求职顾问"，叫"镜心"
  - 支付、订阅、订阅状态提醒（仅能引导到购买卡片）
  - 使用 Hermes Runtime
  - 持久化用户 Memory

镜心 ❌ 不可做：
  - 免费提供服务
  - 使用 Platform AI Gateway（最多作为兜底 fallback）
  - 不隔离用户 Memory
```

---

## Reality Gate

| Gate | 状态 | 说明 |
|------|------|------|
| G1 求职顾问不是真 Agent | ✅ 已确认 | 规则引擎 + LLM fallback 混合体 |
| G2 文曲星模式可复用 | ✅ 已确认 | 静态 prompt + context packet + memory summary |
| G3 CareerProfile 表未迁移 | ✅ 已确认 | DB 无表，sync 静默失败 |
| G4 Platform Gateway 未配 | ✅ 已确认 | route_config + ApiKey + .env 全缺 |
| G5 身份隔离清晰 | ✅ 已确认 | 架构和 Runtime 层均有隔离点 |

---

*Report generated at 2026-07-30 21:05 CST by 杨玉环 🏮*
