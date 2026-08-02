# MEDIA-LOGIN-TIMELINE-kuaishou

**Sprint:** MEDIA-LOGIN-FULL-CHAIN-AUDIT-02（只审计，零代码修改）
**日期:** 2026-08-03 22:31（动态实测，真实浏览器）
**账号:** 10e0ea29（骏霄数字科技 / 4541961964）— DB: CONNECTED

## 实测时间线（2026-08-03 22:31:15 起）

```
 0.0s  connect start
14.0s  connect result → status=connected, accountName=「快手」（⚠️ displayName 冒充账号名！）, 无 externalAccountId
       （探针 authenticated=true 但身份提取失败 → accountName fallback 到平台显示名「快手」）
44.1s  poll0: url=cp.kuaishou.com/profile | state=INIT | loggedIn=true
       signals={page:TRUE, cookie:true, identity:FALSE, loginPage:false, credential:true} ⚠️
73.8s  poll1: 同上（page=true 但 URL 是 /profile 个人中心，非工作台）
103.8s poll2: 同上
133.8s poll3: 同上
163.8s poll4: 同上
```

## ⚠️ 假成功机制（问题C 实锤）

**URL = cp.kuaishou.com/profile（创作者个人中心页，非工作台 article/workbench/data）**

探针 page 信号代码（browser-channel.probe.ts）：
```js
if (urlFragments.some(f => url.includes(f))) return { page: true }   // 工作台专属 URL
...
return { page: markers 命中 ≥ 2 }                                    // ← 漏洞在这
```
/profile 页含「作品管理 / 创作服务 / 视频管理」等导航 marker → **markers 命中 ≥2 → page=true**，绕过 urlFragments 检查。

判定链：
```
page=true（markers 误判 /profile 为工作台）
cookie=true（bUserId + kwssectoken passport 会话有效）
identity=false（/profile 无「快手号:」明文）
authenticated = credential(true) && (identity(false) || page(true)) = TRUE ← 假成功
connect 返回 connected + accountName='快手'（displayName fallback，无 extId）← 假名
```

## 断点

1. **page 信号的 markers 分支不可信**：个人中心页（含工作台导航菜单）被误判为工作台。excludeUrlPatterns 只排除了 v./www. 域，**没排除 cp.kuaishou.com/profile**。
2. **authenticated 与身份提取解耦**：authenticated=true 而 identity=false → connect 用 `identity.accountName || meta.displayName` fallback 出「快手」假名 + externalAccountId 缺失，但 status=connected（假成功）。
3. **passport 账号登录 ≠ 创作者工作台登录**：passport 会话只证明「快手账号登录了」，/profile 是普通创作者个人中心，读不到创作数据（metrics extractor 会诚实 unavailable，但登录判定已假成功）。

## 遗留

- 「扫码后」动态段：本账号 passport 会话仍有效，未触发扫码。扫码→确认→进入工作台段依赖掌柜真机复测。
- 修复设计（见总报告）：page=true 必须 urlFragments 命中；快手登录后需自动导航到工作台 article。
