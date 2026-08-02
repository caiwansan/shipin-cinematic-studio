# MEDIA-LOGIN-TIMELINE-xiaohongshu

**Sprint:** MEDIA-LOGIN-FULL-CHAIN-AUDIT-02（只审计，零代码修改）
**日期:** 2026-08-03 22:33（动态实测，真实浏览器）
**账号:** 45663e51 — DB: WAITING_LOGIN（从未登录成功过，extId=NULL、无身份快照、无 workspace）

## 实测时间线（2026-08-03 22:33:37 起）

```
 0.0s  connect start
13.0s  connect result → status=waiting_login, loginUrl=www.xiaohongshu.com/explore
       （登录入口：主站 → 点「登录」→ 弹窗 qrcode-img 二维码）
18.5s  poll0: url=www.xiaohongshu.com/login?redirectPath=... | state=WAIT_LOGIN | loggedIn=false
       signals={page:false, cookie:false, identity:false, loginPage:TRUE, credential:false}
       qr=img（二维码提取成功 ✅）
21.6s  poll1: 同上
26.8s  poll2: 同上
29.8s  poll3: 同上
35.2s  poll4: 同上
```

## 登录前状态（正确）

未登录 → 主站 explore 被 302 到 /login?redirectPath=... → 弹窗出码（qr=img）→ 探针正确判 loginPage=true 未认证。**二维码生成链路正常**。

## 断点预测（扫码后——基于代码路径分析，待掌柜扫码实测确认）

小红书 meta 配置：
- `postScanBehavior: 'stay_page'`（扫码确认后**停留主站**，不跳转）
- urlFragments 全部是 `creator.xiaohongshu.com/...`（创作者中心）
- cookies: `['web_session', 'customerClientId', 'gid']`（web_session=登录 cookie；gid/customerClientId=游客就有）
- extractionRules 依赖「小红书号: xxx」正则 + hydration `user.*`（创作者中心 JS 变量）

**扫码确认后预期**：
```
手机确认 → 主站弹窗关闭，停留 www.xiaohongshu.com（或 /login 消失回 explore）
       → cookie: web_session 写入（登录成立）+ gid/customerClientId 游客已有 → cookie≥2 可能 true
       → page=false（URL 永不命中 creator.xiaohongshu.com → 永不跳工作台）❌
       → identity=false（主站 DOM 无「小红书号:」格式；hydration user.* 只在创作者中心）❌
       → authenticated = cookie(true) && (identity(false) || page(false)) = FALSE ← 永不认证
```

**这就是「小红书扫码成功但无法登录」的统一断点**：探针公式要求「工作台 URL 或工作台身份」，但小红书扫码确认后**停留在主站**——平台行为（stay_page）与探针假设（跳工作台）不符。

## 遗留

- 「扫码后」段需掌柜真机扫码补全实测（G6 step1 小红书）。
- 修复设计（见总报告）：登录确认后自动导航到 creator.xiaohongshu.com/new/home（工作台），使 page 信号成立。
