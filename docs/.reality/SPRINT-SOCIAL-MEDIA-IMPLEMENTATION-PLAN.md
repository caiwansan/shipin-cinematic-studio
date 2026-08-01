# SPRINT-SOCIAL-MEDIA-IMPLEMENTATION-PLAN — 新媒体运营产品工程实施拆解

**Date:** 2026-08-02 01:45
**Gate:** 掌柜批准（✅ 审计通过 ✅ 旧设计废弃 ✅ 新架构批准 ✅ 不修 /media-department ✅ Phase 1 从真实账号连接开始）
**性质:** 工程实施拆解计划。**本 Sprint 零代码**，等掌柜确认后按 Phase 拆正式 Sprint。

---

## 0. 执行总纲

```
依赖链：DB Migration → Backend Module → Capability/模板注册 → Frontend 迁移 → Hermes Runtime 接线
每个 Phase 独立 Reality Gate，过 Gate 才进下一 Phase。
铁律：创建员工 = 部署员工（provision 链）；无真实 API 不发布；平台不托管企业 Key。
```

---

## 1. 数据库 Migration 顺序（M1→M4，按依赖排）

### M1 — 核心发布域（Phase 1 前置）
```
SocialAccount          id/orgId/platform(wechat_mp|video_account|douyin|xiaohongshu|bilibili|weibo|zhihu)
                       accountName/accountId/avatar/credentialId→ProviderCredential
                       status(pending_auth|active|token_expired|revoked)
                       publishEnabled/messageEnabled/agentBindings[]/lastSyncAt/lastPublishAt
SocialPost             id/orgId/accountId/agentId?/title/body/mediaUrls[]/platform
                       status(draft|compliance_passed|queued|published|failed|rejected)
                       complianceResult Json/dedupResult Json
                       platformPostId/platformUrl/publishedAt/metricsSnapshotId?
SocialMetricsSnapshot  id/orgId/accountId/postId?/date
                       followers/reads/likes/comments/shares/collects/forwards
```
依赖：ProviderCredential（已存在 r1_5_credential_lifecycle migration）；Organization SSOT。

### M2 — 互动客户域（Phase 4 前置，Phase 1 先建表不建服务）
```
SocialMessage          id/orgId/accountId/postId?/direction(inbound|outbound)
                       sender/content/messageTime/intent(咨询|投诉|合作|采购线索|闲聊)
                       customerValue Float?/status(new|ai_replied|human_handoff|closed)/handledBy
CustomerProfile        id/orgId/platform/platformUserId/identity/industry
                       intentScore Int/valueLevel(普通|潜客|高价值|VIP|合作伙伴)
                       conversionProbability Float/lastInteractionAt/tags[]/linkedAgentId?
```

### M3 — 运营治理域（Phase 3 前置）
```
ComplianceRule         id/platform/ruleType(sensitive_word|content_limit|time_rule|case)
                       keyword/description/severity/enabled
DailyOperationReport   id/orgId/reportDate/generatedBy(agentId)
                       publishedCount/interactions/newCustomers/messagesHandled
                       aiTasksCompleted/anomalies/tomorrowPlan/costAttribution Json
```

### M4 — 商业权益扩展（Phase 5 前置）
- `EnterpriseSubscription.snapshotFeatures` Json 内扩新媒体权益（不新增套餐系统，Commerce Authority 复用）：
  `maxSocialAccounts / maxPublishPerDay / platforms[] / aiEmployeeSlots`（与 snapshot_max_employees 并行）
- `EnterpriseEntitlement` 增加 media 计数字段（沿用 used/limit 模式，参考 checkAgentCapability 实现）

**Migration 工程规范**：一次一个领域，每 M 独立可回滚；沿用现有 `MANUAL_SQL_REPORT.md` 流程记录；新媒体表全部归 `organizationId`（Organization SSOT），禁止硬编码企业 ID。

---

## 2. Backend Module 顺序（B1→B6）

```
B1  media-workspace 路由骨架（Phase 1）
    backend/src/routes/media-workspace.ts
    挂载 /api/workspace/media/*（注册进 index.ts，Tenant Guard 复用）
    端点：overview / accounts / posts / metrics（先空实现+401 保护，不返回假数据）

B2  account.service + wechat-mp adapter（Phase 1 核心）
    backend/src/services/media/account.service.ts
      —— SocialAccount CRUD + 授权闭环 + credential 加密存取（复用 ProviderCredential 加密标准）
    backend/src/services/media/platforms/wechat-mp.adapter.ts
      —— 真实微信公众平台 API（见 §6），adapter 接口遵循 PlatformAdapter 抽象（保留接口，废弃 Playwright 实现）

B3  sync.worker（Phase 1）
    backend/src/services/media/sync.worker.ts
      —— 定时拉取（账号数据/图文数据/用户数据）→ SocialMetricsSnapshot + AgentMemory（embeddingVector 模式复用）
      —— 独立队列，失败重试，全部落 usage_logs

B4  publish.service（Phase 3）
    backend/src/services/media/publish.service.ts
      —— 草稿→compliance→dedup→真实 API 发布→SocialPost 状态机
      —— compliance.service.ts（ComplianceRule 规则引擎）+ dedup.service.ts（AgentMemory embedding 相似度）

B5  message/customer.service（Phase 4）
    backend/src/services/media/message.service.ts（私信聚合+意图识别+真人接管路由）
    backend/src/services/media/customer.service.ts（CustomerProfile 价值分层 scoring）

B6  report.service（Phase 5）
    backend/src/services/media/report.service.ts（DailyOperationReport 生成，AI+真实数据，全量埋 agent_outcome）

接线规范：所有业务动作经 outcome-registry 埋 agent_outcome + usage_logs 记成本；禁自建结果表。
```

---

## 3. Frontend 页面迁移策略

### 3.1 旧 /media-department（不修不删）
- 保留文件可访问（冻结清单风格），`workspaces.ts` 状态 `preview→hidden`，note 改「已废弃，迁移至 /workspace/media」
- 导航移除首页入口；旧 `useMediaApi.ts` 标记 deprecated 不删除
- 旧员工创建端点（POST /media-department/employees 只写 profile）**冻结停用**，新入口一律走 provision

### 3.2 新 /workspace/media（Nuxt pages 自动路由）
```
frontend/pages/workspace/media/
├── index.vue        Dashboard（今日运营状态/员工运行状态/待办/日报入口——真实数据）
├── accounts.vue     账号中心（授权/健康度/同步状态/解绑）
├── content.vue      内容中心（热点→日历→草稿→合规→发布队列→已发布）
├── messages.vue     消息中心（Phase 4）
├── customers.vue    客户中心（Phase 4）
├── analytics.vue    数据中心（真实图表，无空壳）
└── team.vue         AI 团队（5 岗卡片：部署状态/今日任务/执行记录/成本）
```
- `frontend/config/workspaces.ts` 注册 `media`（初始 preview，Phase 2 过 Gate 后 stable）
- 复用 KunlunNav / 企业工作台样式；新增 `composables/workspace/useMediaApi.ts`（只调真实端点）

### 3.3 Phase 1 最小页面集
index + accounts + content 三页（够真实发布一条内容），其余页面 Phase 推进时补齐，**禁止空壳页面先行**。

---

## 4. Hermes AgentTemplate 注册方案

### 4.1 模板注册（M0 数据迁移或 seed，与 M1 同批）
```
code=media_director   workspace=["media"]            defaultCapabilities=["media.planning.strategy","media.planning.calendar","media.analytics.report"]
code=media_planner    workspace=["media"]            defaultCapabilities=["media.planning.trend","media.planning.competitor","media.planning.calendar"]
code=media_producer   workspace=["media"]            defaultCapabilities=["media.produce.article","media.produce.script","media.produce.image","media.produce.adapt"]
code=media_cs         workspace=["media"]            defaultCapabilities=["media.customer.reply","media.customer.lead","media.customer.handoff"]
code=media_analyst    workspace=["media"]            defaultCapabilities=["media.analytics.performance","media.analytics.value","media.analytics.report"]
defaultRuntime="openclaw" / defaultMemoryPolicy={"namespace":"tenant_<org>_media_<role>"}
```
> 注：现有 AgentTemplate 无 seed 记录（模板注册入口待实施时确认：admin API 或 SQL migration，二选一统一）。

### 4.2 创建 = 部署（冻结规则落地）
```
POST /api/enterprise/agent-runtime/provision（复用现有端点）
  → EnterpriseAgentProfile（agentType=media_*，runtimeStatus=active）
  → EnterpriseAgentInstance（agentId/namespace，runtimeStatus=active）
  → HermesProfileBinding（Hermes 子代理身份）
```
- 停用 /media-department/employees 直写 profile 路径
- 历史 media-department profile 数据：Phase 2 迁移（runtimeStatus=draft 的要么补 provision 激活，要么标记废弃）

### 4.3 执行链路
- `executeTask` 复用 enterprise-agent-runtime 现有链路（resolveRuntimeConfig → BYOK 模型解析 → agent-brain 执行）
- 新媒体任务模板：AgentSchedule（daily/cron）+ AgentGoal（goalType=content/outreach/analyze）挂 media_* agent

---

## 5. Capability 注册清单（CapabilityContract，category 对齐现有枚举）

| capability code | category | 说明 |
|-----------------|----------|------|
| media.planning.strategy | Planning | 每日策略/任务拆解 |
| media.planning.trend | Analysis | 行业热点抓取 |
| media.planning.competitor | Analysis | 竞品分析 |
| media.planning.calendar | Planning | 内容日历 |
| media.produce.article | Generation | 文章生成 |
| media.produce.script | Generation | 视频脚本 |
| media.produce.image | Generation | 配图生成 |
| media.produce.adapt | Transformation | 多平台适配改写 |
| media.customer.reply | Generation | 私信/评论回复 |
| media.customer.lead | Analysis | 潜客识别 |
| media.customer.handoff | Publishing | 真人接管路由 |
| media.analytics.performance | Analysis | 数据复盘 |
| media.analytics.value | Analysis | 客户价值评分 |
| media.analytics.report | Analysis | 运营日报生成 |
| media.compliance.check | Validation | 合规检查（平台侧） |
| media.dedup.check | Validation | 内容去重（embedding） |
| media.sync.pull | Integration | 平台数据同步 |
| media.publish.dispatch | Publishing | 真实 API 发布 |

注册方式：CapabilityContract 记录 + CapabilityGrant 授权（按模板 defaultCapabilities 批量授予）；`media.*` 与 `recruitment.*`/`career.*` 平级命名空间。

---

## 6. Phase 1 微信公众平台接入方案（真实 API，零 mock）

### 6.1 前置条件（商务阻塞项，需掌柜确认）
| 项 | 说明 |
|----|------|
| 公众号凭证 | appid/secret（企业资产 → ProviderCredential 加密存储，禁明文） |
| 公众号类型 | 认证服务号（群发/发布接口权限）；订阅号仅素材管理+客服消息（限制每日群发 1 次）→ Phase 1 用「草稿箱+发布」接口路径 |
| IP 白名单 | 服务器 IP 加入公众号白名单（access_token 获取前提） |

### 6.2 授权闭环（account.service）
```
appid/secret（ProviderCredential 加密）
  → GET /cgi-bin/token（access_token 2h 缓存 + 过期刷新，真实实现）
  → GET /cgi-bin/user/get（关注者列表）→ 账号信息落 SocialAccount
  → 健康检查（token 有效性 → status=active / token_expired）
```

### 6.3 发布闭环（publish.service + wechat-mp.adapter）
```
草稿（title/body/图片素材）
  → POST /cgi-bin/material/add_material（永久素材，图片）
  → POST /cgi-bin/draft/add（图文草稿）
  → POST /cgi-bin/freepublish/submit（发布，替代受限群发接口）→ SocialPost.status=published
  → POST /cgi-bin/freepublish/get（发布状态回查）
```

### 6.4 数据回流（sync.worker）
```
GET /datacube/getusersummary（粉丝增减）→ SocialMetricsSnapshot
GET /datacube/getarticlesummary（图文阅读/分享/收藏）→ SocialMetricsSnapshot
GET /cgi-bin/comment/listall（评论）→ SocialMessage（Phase 4 接线）
```

### 6.5 Phase 1 明确不做
❌ 多平台（只微信公众平台） ❌ 自动发布审批流 ❌ 客服自动回复 ❌ mock/假数据

---

## 7. Reality Gate 验收标准

### Phase 1 — 账号连接 MVP
| Gate | 要求 |
|------|------|
| E1 | 真实授权闭环：appid/secret → access_token → 账号信息落库（SocialAccount.status=active） |
| E2 | **真实发布一条内容**：草稿→发布→平台可见（platformPostId/platformUrl 真实） |
| E3 | 真实数据回流：粉丝数/阅读数拉取落 SocialMetricsSnapshot（DB 可查，非手工插入） |
| E4 | 凭证加密：DB 无明文 secret（ProviderCredential 标准） |
| E5 | 零 mock：全链路无假数据/假状态；无 Playwright |
| E6 | 生产域浏览器实测：授权→发布→数据 全流程截图 |

### Phase 2 — AI Employee Runtime
| Gate | 要求 |
|------|------|
| E1 | 创建员工 = 部署：profile+runtimeStatus=active+instance+binding 四件套齐 |
| E2 | 5 模板可 provision（media_* 全部可用） |
| E3 | 员工真实执行任务：usage_logs + agent_outcome 落库（BYOK 真实调用） |
| E4 | 旧 employees 直写 profile 路径停用 |

### Phase 3 — 内容运营闭环
| Gate | 要求 |
|------|------|
| E1 | AgentSchedule 每日闭环连续 7 天无人值守（热点→日历→生成→合规→去重→发布→同步） |
| E2 | 合规/去重真实生效（违规内容拦截 + 重复内容拒绝，均有 DB 记录） |
| E3 | 全部动作 agent_outcome + usage_logs 归因完整 |

### Phase 4 — 客户运营
| Gate | 要求 |
|------|------|
| E1 | 私信/评论真实接入（messageEnabled 权限）→ SocialMessage 落库 |
| E2 | 潜客识别 → CustomerProfile（intentScore/valueLevel/conversionProbability 真实计算） |
| E3 | 真人接管链路（human_handoff + handledBy=userId） |

### Phase 5 — 商业化
| Gate | 要求 |
|------|------|
| E1 | DailyOperationReport 真实生成（AI + 真实数据 + 成本归因） |
| E2 | 新媒体套餐上架（Commerce Authority：Product→Order→Subscription→Entitlement） |
| E3 | ROI 罗盘展示真实成本/真实价值（禁估算，同 AGENT-OUTCOME-01 冻结） |

---

## 8. Phase 拆分与工时粗估（掌柜确认后拆正式 Sprint）

| Sprint | 内容 | 依赖 | 阻塞项 |
|--------|------|------|--------|
| Sprint-MEDIA-01 | M1 migration + B1/B2 + wechat-mp adapter + 授权闭环 | 公众号 appid/secret | **商务前置** |
| Sprint-MEDIA-02 | B3 sync.worker + 前端 accounts/index 页 + E1/E3 Gate | 01 | — |
| Sprint-MEDIA-03 | 发布闭环（B4 简化版）+ content 页 + E2 Gate | 01/02 | — |
| Sprint-MEDIA-04 | 5 模板注册 + provision 接线 + team 页（Phase 2 Gate） | 01-03 | — |
| Sprint-MEDIA-05 | M3 + 内容运营闭环（Phase 3 Gate） | 04 | — |
| Sprint-MEDIA-06 | M2 + 消息/客户服务 + 页面（Phase 4 Gate） | 05 | 企业微信商务 |
| Sprint-MEDIA-07 | M4 + 日报 + 套餐 + ROI（Phase 5 Gate） | 06 | 套餐定价 |

---

## 9. 冻结清单（新媒体产品线）

❌ Playwright 浏览器自动化（废弃，不修不补）
❌ 假发布/假数据同步/假渠道状态（Phase 1 Gate E5 强制）
❌ 平台托管企业 Key（BYOK 冻结）
❌ 账号凭证明文/base64（必须 ProviderCredential 加密）
❌ 自建结果表（统一 agent_outcome）
❌ Workspace 级模型配置（KMKI Runtime Principle）
❌ /media-department 直写 profile 创建员工（冻结停用）
⏸ /media-department 旧页面：hidden 保留，不删除
⏸ 新媒体套餐上架：Phase 5 才允许（先有真实能力再卖权益）

**锚点索引**：AgentTemplate 模型 `schema.prisma:6952`；EnterpriseAgentInstance `:6976`；provision 端点 `enterprise-agent-runtime.ts:87`；createAndActivateAgent `enterprise-agent-runtime.service.ts:272`；CapabilityContract `schema.prisma:4828`；EnterpriseSubscription snapshot `:2972`；workspaces.ts `frontend/config/workspaces.ts`；旧 employees 直写 `enterprise-agent-runtime.ts:551`
