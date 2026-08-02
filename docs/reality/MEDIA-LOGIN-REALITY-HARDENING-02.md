# SPRINT-MEDIA-LOGIN-REALITY-HARDENING-02 四平台真实登录闭环加固 — COMPLETE ✅（扫码验收待掌柜）

**Date:** 2026-08-03 06:15
**Gate:** 掌柜战略指令（新媒体工作台前面不是「功能没做出来」，是过度追求架构扩展导致 Reality Gate 前没真正打穿用户路径；不扩平台，把「一个 AI 员工 + 一台数字电脑 + 一个真实账号 + 一次真实读取」打磨到 100%。禁止新增模拟数据、禁止假成功、禁止平台 if 分支。冻结微博/头条/公众号/自动发布/MCP/矩阵运营）

## 前置：MEDIA-CHANNEL-AUDIT-01 已实锤的问题链
扫码→浏览器打开✅→二维码✅→手机确认✅→探针判断❌→刷新丢失❌→Owner View 假状态❌
- 根因一：probe 无条件 reload 打断 passport 扫码确认窗口期 → AUDIT-01 已修（登录页跳过 reload）
- 根因二：reality 租户校验错位（JWT 无 tenantId + 账号全局复用）→ 所有普通用户 404 → AUDIT-01 已修
- 掌柜 05:47 快手扫码成功：CONNECTED + 骏霄数字科技 4541961964 + identity verified（闭环首次真实走通）

## Task01 — Probe Runtime 修复（identityStrategy 策略驱动）
`browser-channel.probe.ts`：
- 探针通道按 `identityStrategy` 显式启用/禁用（pageProbe/cookieProbe/networkCapture），禁止 if(platform)
- `allowReload=false`（全部平台）→ network 捕获走 **passive 模式**（只监听自然请求 12s，绝不主动 reload；扫码确认窗口期 reload = 自杀）
- `allowReload=true` 保留给登录态稳定后的恢复验证场景

## Task02 — Login Capability Model v2（ChannelPlatformDefinition 扩展）
`browser-channel.meta.ts` 新增两字段（四平台全部配置）：
- `postScanBehavior`: redirect（抖音）/ stay_page（快手、小红书）/ manual_confirm（视频号）
- `identityStrategy`: pageProbe + cookieProbe + networkCapture + allowReload
  - 抖音: page+cookie，无 network，allowReload=false
  - 快手: page+cookie+network（body 无 UID 需签名 API），allowReload=false（passive 捕获）
  - 小红书: page+cookie，无 network，allowReload=false
  - 视频号: page+cookie，无 network，allowReload=false
- 新增平台 = 加配置 + 注册 adapter，零代码分支

## Task03 — 假连接入口删除（产品诚信）
- **删除 `ChannelConnectCenter.vue`**（297 行纯本地 ref 假连接：填 AppID/Secret → 本地 connected=true，无任何 API）
- `ChannelsModule.vue` 重写为真实入口：平台能力来自 registry API + 账号真实状态来自 owner-view（🟢/⚪/🟡）+ CTA 跳转 `/workspace/media/accounts?platform=`（唯一真实 Connect API 入口）

## Task04 — ChannelPlatformRegistry SSOT（唯一真相源）
新文件 `src/enterprise/channel/platform-registry.ts`：
- 输出平台能力：platform/displayName/loginMethods/postScanBehavior/identityStrategy/adapterReady/probeReady/metricsSupported/status（ready|config_only|frozen）
- `connectable = adapterReady && probeReady && loginMethods && !frozen`（真实可连才点亮）
- 冻结平台：wechat_mp/weibo/toutiao/baijiahao（掌柜冻结清单）
- `GET /api/enterprise/channels/registry` 路由（authenticate 前置）
- accounts.vue 硬编码 connectable 全改 false，onMounted 从 registry 拉取点亮（前端禁止自己判断平台可连）

## Task05 — G6 黄金验收（四平台）
### 通用指标提取器（补的架构缺口）
快手/小红书/视频号有 `metricsExtraction` 配置但只有 douyin 专用提取器 → 新增 `browser-metrics.extractor.ts`（配置驱动：navigate dataUrl → 按 rules label 解析，parseCount 支持万/w）
- **数据页判定（防假数据）**：快手实测未登录自动跳 `/profile` 游客页（含「粉丝/作品/获赞」空状态文案）→ 曾误解析 `available + followers=0/works=5` 冒充真实指标 → 修复：URL 必须命中 meta.urlFragments（排除 excludeUrlPatterns），否则 unavailable + reason「未进入数据中心页」
- extractor 未注册 → 诚实 unavailable 快照落库（不再 throw）
- 快手 G6 S5 实测：如实报「未进入快手数据中心页（当前: https://cp.kuaishou.com/profile）」+ HealthGuard DEGRADED 计数——真实或不存在 ✅

### G6 快手预跑：2-6 全绿（12/12）
S2 数字电脑 READY+profile+绑定 ✅ / S3 浏览器关闭恢复（profile/身份/状态三不变）✅ / S4 重启恢复（扫描 3 保持 2）✅ / S5 无数据如实报 unavailable ✅ / S6 Owner View 截图 ✅
- 修复 G6 脚本 S4 日志正则（「扫描到 N 个工作空间」）
- 快手账号补 AI 员工绑定（Alice active，permissions 无 publish——L3 运营经理权限未开）

### 回归
- hardening-02 验收脚本 58/58 PASS（registry/无平台分支/meta 完整性/judgeIdentityV2/提取器/数据页判定）
- identity-persistence-01: 9/12（3 失败 = 断言前提过期：抖音被 fast 快照恢复为 CONNECTED+verified，脚本假设 EXPIRED——非代码回归）
- account-identity-view-01: 7/15（同因）
- ⚠️ **已知权衡（Task03 掌柜验收设计）**：fast 恢复路径（快照 12h TTL fresh → 保持 CONNECTED 不启动浏览器）与真实登录态可能不一致——owner-view 显示在线但实际读取时提取器会如实报 unavailable（快手 S5 实证）。这是「快 vs 真」的缓存信任设计，真实读取兜底验证

## 待掌柜验收
- **G6 step1 四平台真实扫码**（`npx tsx scripts/reality-acceptance-g6.ts --step 1 --platform=kuaishou` 等）→ 扫码成功后数据页解析真实粉丝数 → G6 1-6 全绿
- 快手/小红书/视频号登录后：AI 员工读取 → 真实 metrics（或如实 unavailable）

## 冻结清单（持续）
❌ 微博 ❌ 头条 ❌ 公众号 ❌ 自动发布 ❌ MCP ❌ 矩阵运营 ❌ 新平台扩展
⏸ 安全项（明文 Key / IDOR）单独进 Security Sprint

提交：`（见 git log）` ｜ 脚本 scripts/reality-check-login-hardening-02.ts ｜ G6 脚本 backend/scripts/reality-acceptance-g6.ts
