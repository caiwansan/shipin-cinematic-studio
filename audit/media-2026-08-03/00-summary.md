# 新媒体工作台第三方深度审计报告

**审计编号:** AUDIT-MEDIA-2026-08-03
**审计性质:** 第三方独立审计（前端 + 后端 + 数据库全链路）
**审计对象:** 昆仑镜新媒体工作台（AI 全渠道运营中心）
**审计时间:** 2026-08-03 01:00–02:00 (Asia/Shanghai)
**审计方法:** 逐文件通读 45 个后端文件 + 19 个前端页面/组件 + 6 个 API 封装 + 数据库 464 表（渠道域 16 表 SQL 实测），前后端路由逐条交叉比对

---

## 0. 审计结论摘要

| 维度 | 高危 | 中危 | 低危 | 信息 |
|------|------|------|------|------|
| 后端 | 10 | 15 | 10 | 11 |
| 前端 | 3 | 13 | 10 | 12 |
| 数据库 | 3 类（9 行明文） | 8 类 | 9 | 6 |
| **合计** | **16 类** | **36 类** | **29 类** | **29 类** |

**总体评价：**
- ✅ **登录链路是真实的**：扫码/短信登录 → 探针多信号判定 → 人工确认绑定 → AES 凭证回写，前后端状态机完全匹配，4 个平台有真实浏览器适配器，**不是假连接**。今日「扫码确认后 401」为平台风控拒绝（数据中心 IP + 无头环境指纹），非产品造假。
- 🔴 **但安全基线严重不达标**：租户隔离系统性缺失（全链路 IDOR）、9 行明文 API 密钥落库、企微凭证明文存储、Capability 鉴权形同虚设、微信回调未验签、Token 接口零鉴权、未注册死代码内含后门。
- 🟠 **诚实性有裂缝**：3 处「假控件/假连接」把模拟当真实展示（紧急停止假按钮、demo-token 假凭据、legacy 模拟授权页）；多处硬编码假数据冒充状态。
- 🟡 **架构债**：两套凭证存储格式、双轨用户体系（User vs governance_user）、40 个孤儿租户、0 行审计日志、无 RLS。

---

## 1. 高危发现（16 类）——必须立即修复

### 1.1 租户隔离系统性缺失：渠道全链路 IDOR（后端 H-02，最严重）
- **位置:** `services/enterprise/channel.service.ts` 全部账号级方法 + `routes/enterprise-channel-runtime.ts` 直接透传 `:id`
- **问题:** 所有方法只按 `id` 查库，**从不校验 tenantId/organizationId/ownerId**
- **攻击链（账号接管）:**
  1. 攻击者调 `POST /channels/runtime/<受害者账号id>/connect` → 打开受害者账号的持久化浏览器
  2. 用攻击者自己的抖音扫码登录
  3. `confirm-binding` → 攻击者 identity 写入受害者账号
  4. `refresh-credential` → 攻击者 cookie 加密写入受害者账号 → **受害者渠道账号被完全接管**
  5. `permission` 可将任意账号提权到 L3（发布权限）
- **影响:** 渠道账号接管、伪造绑定、跨租户读取指标/健康信息
- **同类问题:** 企微账号接口 IDOR（H-04，且返回含明文凭证完整记录）、Browser Workspace 全接口 IDOR（H-08，可跨租户 `deleteProfile=true` 物理删除他人浏览器 profile）、channels.ts 绑定列表 IDOR（M-10）、回调/同步服务层 IDOR（M-15）、`ensure-account` 无租户过滤（H-01）、绑定接口接受未校验 workspaceId（M-14）

### 1.2 明文凭据落库（数据库 H1/H2/H3 + 后端 H-05）
| 位置 | 内容 | 行数 |
|------|------|------|
| `provider_credential.encrypted_key` | 明文 API Key（`sk-e2e-*`），系统自己 `decrypt_error` | 3 |
| `UserModelConfigV2.llmApiKey` | **`sk-09746cbe...` 疑似真实 DeepSeek Key，2 账号共用**；`sk-shared-fallback-key` 4 用户共用 | 6 |
| `enterprise_channel_account.credential_encrypted` | 显式 `_encrypted:false` + 双重 JSON 编码（写入 bug） | 28/32 |
| 企微 `channel-account.service.ts` | 字段名 credentialEncrypted 实为明文 JSON（注释 `TODO: 接入真实 AES-256`） | — |
| `storage_configs.accessKey` | 腾讯云 SecretId 明文（SecretKey 却是加密的，同一对凭据两套处理） | 1 |

- **紧急动作:** 吊销轮换 `sk-09746cbe...`；清除 9 行明文；修复双重编码写入路径；统一凭证存储格式（AES-256-GCM `{cipher,payload}`）。

### 1.3 CRYPTO_ENCRYPTION_KEY 未配置时把密钥打印到日志（后端 H-10）
- **位置:** `services/crypto.service.ts:15-22`
- **问题:** 未设置环境变量时自动生成随机密钥并 `console.error` **明文打印**；且密钥仅存内存，**重启后所有渠道 cookie 凭证无法解密（登录态全丢）**
- **建议:** fail-fast 强制配置；密钥入 KMS；日志严禁输出密钥

### 1.4 企业微信回调未验签 + Token 接口零鉴权（后端 H-06/H-07）
- **位置:** `wecom-callback.controller.ts:68-108`（POST 回调只查参数存在不验签，`wecom-crypto.ts` 的验签函数从未被调用）；`:112-168`（token/stats、token/invalidate、token/health 三个接口**无任何鉴权**）
- **影响:** 伪造回调事件 → 自动创建 P1 动作；任何人可失效任意企微账号 access_token（DoS）+ 触发真实企微调用
- **另:** 账号选取为全局 `findFirst` 第一条 CONNECTED（无租户维度），GET 验证与两种凭证格式不兼容（M-11）

### 1.5 Capability 鉴权形同虚设（后端 H-03）
- **位置:** `channel-permission.service.ts:80-119`
- **问题:** `getGovCapabilities()` 是恒返回 `[]` 的 TODO stub → 权限检查永远跳过；中间件从不传 `channelAccountId` → 归属校验也被跳过
- **影响:** 所谓「Capability-based permission check（所有 Channel API）」完全失效

### 1.6 生产注册假适配器：视频号/微博/B站/QQ 返回硬编码假数据（后端 H-09）
- **位置:** `extended.adapter.ts`（fetchMetrics 返回 8500 粉丝等假数据、publish 直接 status:success + 伪造 URL）
- **影响:** 违反「禁止 mock」冻结规则；AI 运营基于假数据决策；假发布成功

### 1.7 未注册死代码内含后门（后端 I-01，潜在定时炸弹）
- **位置:** `routes/media-platform.ts` 整个文件**未注册**（index.ts 无 import），但内含：
  - `:54` 硬编码 `Authorization: Bearer demo-token` → 注入 demo 租户身份（auth 绕过）
  - `/media/browser/navigate` 任意 URL 导航（SSRF）、`/media/browser/cookies` 直接返回会话 cookie
  - 5 个 handler 引用未定义变量 `orgId`（功能已损坏）
- **结论:** 一旦被注册即同时引爆 auth 绕过 + SSRF + cookie 泄露。**建议删除或按安全基线重写**

### 1.8 前端「假控件/假连接」三连（前端 H-01/H-02/H-03）
| 编号 | 位置 | 问题 |
|------|------|------|
| H-01 | `media-department/employees.vue:342` | **「停止全部AI操作」紧急停止按钮是纯前端假控件**——只翻转本地布尔 + console.log，后端真实 `emergency-stop` 端点从未被调用。用户以为 AI 已停，实际毫无效果 |
| H-02 | `media-department/employees.vue:176,353` | 创建员工向导收集用户 API Key（承诺不存明文），但请求体**根本不含 apiKey**——敏感凭据被静默丢弃 |
| H-03 | `media-department/settings/channels.vue:154,209` | `isLoggedIn` 硬编码 true + 无 token 时发 `Bearer demo-token` 假凭据 + 硬编码生产域调后端 **legacy 模拟授权**接口（后端自认 `fakeToken + simulated:true`）——**把假连接当真实「已连接」展示** |

---

## 2. 中危发现（36 类）——重点摘要

### 后端（15）
- **M-01** 抖音登录接口把响应体前 250 字符拼进返回值泄漏给前端（`douyin-browser.adapter.ts:524-536`）
- **M-02** 短信验证码发送无频率限制（短信轰炸，sessionId 可猜 `douyin:<accountId>`）
- **M-03** `fetchMetrics` 结尾关闭共享持久化浏览器实例 → **打断正在进行的扫码登录**
- **M-04** 浏览器实例与状态机 Map 永不清理（内存泄漏，Chromium 进程堆积）
- **M-05** Token 缓存按 corpId 键控跨租户串号 + corpsecret 明文拼进 URL query
- **M-06** WeComAdapterService 单例可变状态（多账号操作互相覆盖）
- **M-07** 回调去重非原子（竞态误入死信）+ eventId 弱哈希碰撞
- **M-08** 互动信号关键词命中自动创建 P1 动作（无人工确认）+ 去重键过粗
- **M-09** 未知路由默认放行 CHANNEL_READ（默认允许而非默认拒绝）
- **M-10** channels.ts 绑定列表接口 IDOR
- **M-11** 微信回调 GET 验证取全局第一条 CONNECTED 账号
- **M-12** 登录状态轮询单次开销大 + 会话数无上限（资源耗尽风险）
- **M-13** 状态流转先置位后执行，失败不回滚（显示「工作中」实际没起来）
- **M-14** 绑定接口接受未校验的 browserWorkspaceId
- **M-15** 回调/同步/统计服务资源级方法普遍无租户校验

### 前端（13）
- **M-01** `useMediaApi.ts` 9 个死 API 调用（auth/login、tasks 等后端全无 → 404，`runTask` 依赖的 createTask 是死路）
- **M-02** `createTask` 硬编码 `tenantId: 'tenant-955d2b1a'`
- **M-03** `media/index.vue` 硬编码「5 名 AI 员工」+ `dashboardData` 永远不赋值 → 指标永久「待接入」
- **M-04** `accounts.vue` 已连接卡片硬编码「AI 员工：Alice 运营总监」冒充真实授权
- **M-05** `employees.vue` `hasOrganization=true` 硬编码 + 状态字段错位（消费 runtimeStatus 却只写 status → 永远显示 Draft）
- **M-06** `analytics.vue` template 块内混入 import 语句（页面顶部乱码）
- **M-07** `stores/auth.ts` token 明文存 localStorage + 非 HttpOnly/Secure cookie（注释与实现矛盾）
- **M-08** `middleware/auth.ts` admin 路由仅验 token 存在、无角色校验
- **M-09** `settings.vue` 把 tenantId 写进 localStorage `organizationId`（orgId/tenantId 混用）
- **M-10** media-department 全系静默失败（console.warn 吞错，用户零提示）
- **M-11** `ai-employees.vue` 用 `name.includes('c')` 匹配员工（误匹配风险）
- **M-12** `talent.vue:124` v-html 渲染 AI 内容未转义（存储型 XSS 面）
- **M-13** `team.vue` 员工×渠道归属写死（与真实绑定错位）

### 数据库（8）
- **M1** 核心渠道表几乎无外键（16 张表仅 4 张有 FK；enterprise_channel_account 自身 0 个 FK）
- **M2** **26 行幽灵账号**：30/32 租户不存在（affc9201/d4568766/2adf05ef 任何表都查无此人）、28/29 组织不存在、29/29 owner 是 User 表 id 但 owner_type='gov_user'（id 空间错位）
- **M3** recruitment_channel_mapping 24 行全指向不存在的职位（jobs 表 0 行）
- **M4** 全库无 RLS（0 策略）+ 应用以 postgres 超级用户直连（多租户仅靠应用层 WHERE）
- **M5** channel_operation_log 唯一约束 `(workspace_id, action, target)` 阻断重试写入（日志表不该有 UNIQUE）
- **M6** 4/4 浏览器会话全部 RUNNING、1 个 8h+ 无健康检查（僵尸会话）
- **M7** ID 类型/格式混乱（uuid vs text、`phase-a/t1/default` 混用）+ User/governance_user 双轨（仅 45/131 邮箱重叠、40 个孤儿租户）
- **M8** governance_audit_log、channel_operation_log、enterprise_interaction 全部 0 行（治理不可追溯）

---

## 3. 低危（29 类）——要点

- 抖音 `humanType` 逐字输入实现错误：`indexOf` 取首次出现位置 → 结尾重复字符被截断（**小红书发布内容被截断**，`browser-agent.adapter.ts:296-302`）
- `executeAction` 的 evaluate/upload 原语未暴露路由（潜在 RCE 后门，接入时需白名单）
- 登录状态响应透出本地绝对路径与页面文本样本（信息泄露）
- 会话 cookie 明文落盘 `/tmp/browser-sessions/*.json` + sessionId 路径穿越（当前仅死代码调用，潜在）
- 错误信息直接回显内部细节（`message: e.message` 遍布 runtime 路由）
- **SKILL.md 与实现冲突**：技能文档禁止指纹伪造，`browser-runtime.service.ts:158-197` 却主动抹 webdriver/写死 hardwareConcurrency/timezone（政策与实现背离，合规风险）
- 抖音二维码放大用 `execSync('python3')` 同步执行（阻塞事件循环）
- waitForLogin 异常恢复会打断已成功的扫码页
- 图片 URL fetch 目标来自页面内容（与任意导航组合成 SSRF 链，`ssrf-protection.ts` 已存在未使用）
- 前端：token-bridge 暴露全局 token 读写、auth-fetch 读 legacy key、登录诊断面板留在生产页、错误消息透传、N+1 健康检查、硬编码 `https://aigc.fushtn.com` 绝对地址、`finishConnect` 超时后无条件回退 refresh-credential 并提示「连接成功！」（未确认真实登录态）、taskStats 写死零值假统计、空 Bearer 头
- 数据库：3 个渠道类型无 Provider 定义、占位密钥（enc_test_gpt_key）、种子/测试数据混杂（phase-a/reality-test/fake UUID）、usage_logs 634K 行 181MB 无保留策略、channel_verification_session 索引冗余

---

## 4. 正面结论（做对的）

1. **扫码登录链路真实可信**：探针多信号（页面特征/Cookie/身份提取）判定登录态、拒绝「仅 cookie 残留」假登录、凭证 AES 加密落库、绑定需人工确认——设计正确（后端 I-07）；前端 3s 轮询、防重入、jsQR 裂图自修复、与后端 `channels/runtime/browser/*` 全部匹配（前端 I-02）
2. **4 个可连接平台都有真实浏览器适配器**（douyin/kuaishou/xiaohongshu/channels_wechat），非假连接（前端 I-02、后端注册链核对）
3. **诚实空态页**：content/shop/customers/messages/analytics 纯静态产品展示 + 明确「待接入」，零 mock（前端 I-05）
4. **MediaAgentRoster 锁定卡明确标注「模板待注册」**，不产生假员工数据（前端 I-10）
5. **招聘指挥中心数据全真实**，visitor 模式明确标注「预览」不冒充（前端 I-08）
6. **数据库 9 项 FK 一致性校验全过**、external_account_id 无重复、时间字段无异常（DB 4.4）
7. **`User.passwordHash` 为 bcrypt 合规哈希**（DB H3 关联检查）
8. **状态机设计**（login-state-machine TRANSITIONS 白名单 + 非法迁移告警、auth-session 授权状态机）结构清晰（后端 I-08）
9. **前端 10 处 v-html 中 9 处为静态 SVG 字符串**，唯一动态数据点已标中危（前端 I-11）

---

## 5. 修复优先级路线图

### P0（紧急，本周）
1. **吊销轮换真实 DeepSeek Key**（`sk-09746cbe...`）并清除 9 行明文密钥
2. **修 `credential_encrypted` 双重编码写入 bug**，强制 `_encrypted:true` 才允许落库
3. **渠道全链路补租户归属校验**（`assertAccountBelongsTo`）：channel.service 所有账号级方法 + runtime 路由 + browser-workspace 路由 + channels.ts 绑定接口
4. **删除/禁用 4 个假适配器注册**（视频号/微博/B站/QQ）
5. **删除或安全重写 `routes/media-platform.ts`**（未注册死代码 + demo-token 后门 + SSRF + cookie 直出）
6. **CRYPTO_ENCRYPTION_KEY 强制配置 + fail-fast**，禁止密钥进日志

### P1（高，两周内）
7. 微信回调验签 + 回调账号租户解析；Token 接口加鉴权
8. Capability 鉴权接入真实 Role/Capability 或移除假检查
9. 企微凭证统一 AES 加密存储（迁移 28 行明文）
10. 修复前端 3 个假控件（紧急停止接真实端点 / 移除 API Key 收集或真实发送 / channels.vue 下线或接真实链路）
11. 浏览器会话生命周期管理（空闲 TTL + 进程退出钩子 + 僵尸清理）

### P2（中，一个月内）
12. 渠道表补外键 + 清理 26 行幽灵账号 + 24 行孤儿职位映射
13. 收敛双轨用户体系与 tenant/org 命名规范；清理种子数据
14. 短信验证码限流；fetchMetrics 不关闭共享实例；轮询节流
15. 审计日志落库（governance_audit_log 启用）
16. 前端死 API 清理 + dashboardData 接线 + 状态字段错位修复

### P3（低，持续）
17. RLS 或至少数据库账号权限收敛（应用不应使用超级用户）
18. SKILL.md 与指纹伪装实现取一致（删反检测注入或改红线）
19. 统一凭证解密单一入口；删除 saveSession/restoreSession 明文落盘
20. 清理 usage_logs 保留策略、占位密钥、测试数据

---

## 6. 今日扫码登录问题（与本审计的关联）

- 现象：掌柜扫码 + 手机确认后，页面跳转 creator.xiaohongshu.com 但返回 **401**，登录态未建立
- 审计结论：**链路本身正确**（前后端状态机匹配、探针判定真实），401 为**小红书平台风控拒绝**（数据中心 IP 段 + 无头浏览器指纹被标记）。数据库证据：该账号 13 次验证会话、状态 WAITING_LOGIN，无假数据
- 相关代码风险：M-03（fetchMetrics 关闭共享浏览器会打断登录）、L-09（waitForLogin 异常恢复打断扫码）可能加剧失败率，但非根因
- 建议：换手机号验证码登录链路绕开扫码风控；或提升指纹伪装一致性（需与 L-07 SKILL 红线冲突决策）

---

## 7. 审计覆盖清单

**后端 45 文件全通读**：routes/（6：enterprise-channel-runtime、enterprise-channel、enterprise-channel-center.routes、channels、browser-workspace.routes、media-platform）；services/media/（4：browser-runtime.service、media-platform.service、browser-agent.adapter、platform-adapter）；enterprise/channel/（18：callback-event.service、channel-adapter.interface、channel.adapter、customer-identity.service、extended.adapter、identity-probe、interaction-feed.service、interaction-signal.service、login-state-machine、mock.adapter、token-cache、token.service、wecom-adapter、wecom-callback.controller、wecom-client、wecom-crypto、wecom-adapter.service、channel-account.service 等）；adapters/（7：browser-channel.adapter、douyin-browser.adapter、login-detector、browser-channel.meta、browser-channel.probe、douyin-identity.probe、browser-channels）；关联服务（8：browser-auth-session、browser-trajectory、browser-workspace、channel-browser-session、channel-operation-log、channel-provider、channel.service、agent-channel-binding）；channel-skills/（3 SKILL.md）；辅助核对 index.ts/plugins/auth.ts/crypto.service.ts/constants/schema.prisma

**前端 19 页面/组件 + 6 API 封装 + 4 插件/中间件全通读**：pages/workspace/media/ 9/9、pages/media-department/ 6/6、pages/workspace/enterprise/ 4、components/media/ 9/9、composables 5、utils 3、plugins 4、middleware/auth.ts、stores/auth.ts、layouts/enterprise-workspace.vue、pages/workspace/index.vue

**数据库 SQL 实测 27 项**：464 表确认、16 渠道表全列/索引/约束、明文密钥扫描（60 敏感列）、孤儿校验 5 组、状态分布、一致性核验 9 项、RLS/授权检查、种子与时间线分析（详见 db-audit.md）

**详细分报告：**
- 后端: `/root/.openclaw/workspace/audit-tmp/backend-audit.md`
- 前端: `/root/.openclaw/workspace/audit-tmp/frontend-audit.md`
- 数据库: `/root/.openclaw/workspace/audit-tmp/db-audit.md`

---

*本报告由第三方审计流程生成，所有结论均附文件:行号或 SQL 验证证据，可复核。*
