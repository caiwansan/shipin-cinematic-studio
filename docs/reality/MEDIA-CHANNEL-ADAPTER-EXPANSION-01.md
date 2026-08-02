# SPRINT-MEDIA-CHANNEL-ADAPTER-EXPANSION-01 — 多平台渠道生产标准 — COMPLETE ✅

**Date:** 2026-08-03 00:10 CST
**Gate:** 掌柜战略指令（抖音已真人授权闭环 → 战略阶段切换：不做平台数量竞赛，做「每个平台达到抖音同等级 Reality Login 标准」；先小红书，再视频号，再快手）

## 总原则落地
「一个平台 = 一个 Browser Workspace 模板；禁止复制抖音代码；允许复用 BrowserRuntime / IdentityProbe / AuthStateMachine」
- 平台差异 100% 配置化（ChannelPlatformDefinition），全仓零 `if(platform==="douyin")` 式平台分支
- 架构：ChannelAccount → BrowserWorkspace → PlatformAdapter → IdentityProbe → AI Employee Runtime（保持）

## Task 01 平台接入标准化 ✅
`browser-channel.meta.ts` 升级为掌柜定义的 **ChannelPlatformDefinition** 标准结构：
```ts
{
  platform, displayName, loginUrl, workspaceUrl,
  loginMethods: ['qr'|'sms'],        // 替代 smsLogin boolean
  smsTabLabel,                        // 小红书「短信登录」vs 抖音「验证码登录」
  selectors: { loginPage?, workspace?, accountInfo? },
  identityRules: {
    cookies: [],                       // 关键 cookie（原 keyCookies switch 彻底移除）
    urlFragments: [], markers: [], loginPageMarkers: [],
    excludeUrlPatterns?: [],           // Task04 快手普通用户主页排除
    extractionRules: [{ field: 'userId'|'nickname'|'avatar'|'accountType',
                        method: 'hydration'|'regex'|'url', ... }]
  },
  metricsExtraction?: { dataUrl, rules: [{label, field}], recentContentSelector? }
}
```
- 已配置 8 平台（douyin/kuaishou/xiaohongshu/channels_wechat/wechat_mp/weibo/toutiao/baijiahao）
- probe 改为 extractionRules 驱动（hydration 遍历 _ROUTER_DATA/__NEXT_DATA__/__INITIAL_STATE__/__NUXT__ + 嵌套路径 a.b.c 取值；regex body 文本；url 当前 URL）

## Task 02 小红书接入（最高优先）✅
- 登录：creator.xiaohongshu.com/login → 扫码/短信（默认短信页，smsTabLabel=短信登录）→ 创作者中心
- 身份识别：userId/nickname/avatar/accountType 四字段 extractionRules 全覆盖（hydration user.userId/nickname/avatar + 小红书号正则 + url profile 兜底）；禁止 cookie 存在=登录（多信号判定）
- 持久化：profile 目录验证 ✅（/data/browser-profiles/xiaohongshu/{accountId} 含完整 Chrome 数据；二次 connect 复用同一 profile，不新建）
- 数据读取：metricsExtraction 配置（dataUrl=new/home + 粉丝/笔记/获赞/收藏 + recentContentSelector 笔记标题）；**未登录时诚实报错拒绝返回空数据**（实测：`[小红书Adapter] 小红书数据中心未解析到指标（可能未登录或页面结构变更），拒绝返回空数据`）

## Task 03 视频号接入 ✅
- 二维码成功 ≠ 登录成功：探针不因二维码存在判定登录；必须 URL 进 channels.weixin.qq.com/platform + markers 才认证
- 身份提取：finderInfo.nickname/finder_uin/head_url + 视频号正则 + gh_ 正则
- 状态机支持扫码后手机确认阶段（VERIFYING）

## Task 04 快手接入 ✅
- 登录成功但停留普通用户主页 ≠ 创作者工作台：excludeUrlPatterns 排除 v.kuaishou.com/profile、www.kuaishou.com/profile、v.kuaishou.com/u/
- 工作台 URL 精确匹配 cp.kuaishou.com/article|workbench|data|live|workspace

## Task 05 统一登录状态机 ✅
新文件 `login-state-machine.ts`：
```
INIT → OPEN_BROWSER → WAIT_LOGIN → USER_ACTION_REQUIRED → VERIFYING → AUTHENTICATED → CONNECTED → READY
```
- 所有平台共用枚举，禁止平台自定义状态；TRANSITIONS 白名单（非法迁移拒绝+告警）
- 会话级实例（adapter 持有 Map）；derive() 由探针结果驱动
- 兼容层：STATE_TO_LEGACY / LEGACY_TO_STATE（前端迁移期双态可用）
- **抖音 adapter 也输出标准 state**（映射，不改内部逻辑）——全平台统一

## Task 06 Owner View 渠道状态矩阵 ✅
`team.vue` 新增：
- 页面级**渠道状态矩阵**：AI员工(5) × 渠道(抖音/小红书/视频号/快手) → 🟢已连接 / 🟡等待授权 / ⚪未配置（account-status 实时拉取）+ 图例 + 管理渠道入口
- 员工详情**数字电脑区块**：员工负责渠道实时状态（🟢平台名+账号名 / 🟡等待授权 / ⚪未配置），点击跳渠道中心
- accounts.vue：smsLogin boolean → loginMethods 数组（与后端标准一致）

## Task 07 禁止提前做 ✅
- publish/schedule 诚实返回 failed（自动发布 Task 阶段禁用）；fetchInteractions/reply 空实现；零 mock

## ⚠️ 部署陷阱（再次踩坑，deploy.sh 已根治）
- pm2 前端进程名 **nuxt-frontend**（不是 frontend）；deploy.sh 重启 `frontend` 静默失败（|| true）→ Nitro 旧进程返回旧 index.html 引用已删 hash → **_nuxt 全 500**
- deploy.sh 第 29 行已改为 `pm2 restart nuxt-frontend`（带注释防回退）

## 验收（浏览器生产域 aigc.fushtn.com 实测）
**后端 10/10 PASS：**
- 状态机 4/4：douyin/xiaohongshu/channels_wechat/kuaishou 统一 state=WAIT_LOGIN（合法枚举）
- fetchMetrics 3/3：未登录诚实拒绝（400 + 平台名 + 明确错误消息，绝不 mock 0 数据）
- 持久化 3/3：profile 目录创建 + 二次 connect 复用

**前端 9/9 PASS：**
- 团队页渲染 / 渠道状态矩阵（4 平台列 × 5 员工行）/ 矩阵图例 🟢🟡⚪ / 员工详情数字电脑（3 台）/ 渠道中心含小红书/视频号/快手

截图：docs/reality/CHANNEL-EXPANSION-01-{matrix,computers}.png

## 冻结清单（持续）
❌ 自动发布/自动评论/自动私信/自动涨粉（Task 阶段禁用）
⏸ 下一步：真人扫码授权验证（小红书→视频号→快手）+ 微博/头条/公众号注册点亮（meta 已配置）
