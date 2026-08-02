# MEDIA-LOGIN-TIMELINE-douyin

**Sprint:** MEDIA-LOGIN-FULL-CHAIN-AUDIT-02（只审计，零代码修改）
**日期:** 2026-08-03 22:30（动态实测，真实浏览器）
**账号:** 08a0f643（南坡万 / 88130666815）— DB: CONNECTED

## 实测时间线（2026-08-03 22:30:14 起）

```
 0.0s  connect start（POST /channels/runtime/:id/connect）
 5.7s  connect result → status=connected, accountName=南坡万, externalAccountId=88130666815
       （profile 内已有真实登录态 → 探针直接认证，未走扫码）
11.9s  poll0: url=creator.douyin.com/creator-micro/home | state=AUTHENTICATED | loggedIn=true
       signals={page:true, cookie:true, identity:true, loginPage:false, credential:true}
17.8s  poll1: 同上（工作台 URL + 三信号全绿）
23.4s  poll2: 同上
29.6s  poll3: 同上
35.5s  poll4: 同上
```

## 登录链路还原（抖音 = 黄金基线）

```
扫码确认 → 抖音自动 302 跳转 creator.douyin.com/creator-micro/home（工作台 URL）
       → cookie: sessionid/sid_guard/uid_tt/passport_csrf_token 写入
       → page=true（urlFragments 命中 creator.douyin.com/creator-micro）
       → identity=true（DOM「抖音号: xxx」+ hydration user.nickname/sec_uid）
       → authenticated = credential(cookie&&!loginPage) && (identity||page) = true ✅
```

## 结论

**抖音成功原因 = 平台特性恰好匹配探针公式**：
1. 扫码确认后**自动跳转工作台 URL** → page 信号天然成立
2. 登录 cookie 名称与配置**完全一致**（sessionid/sid_guard/uid_tt 都是真实登录 cookie，无游客 cookie 混入）
3. 工作台 DOM 含「抖音号:」明文 → identity 提取稳定

**抖音是探针公式的唯一理想适配者**。其余三平台失败/假成功，本质都是「平台行为与公式假设不符」，详见总审计报告。

## 遗留

- 「扫码后」动态段：本账号已有登录态（fast 恢复），未触发扫码。扫码段时序依赖掌柜真机复测（G6 step1）。
