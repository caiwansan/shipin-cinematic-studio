# MEDIA-LOGIN-TIMELINE-shipinhao

**Sprint:** MEDIA-LOGIN-FULL-CHAIN-AUDIT-02（只审计；含审计前已完成的根因修复记录）
**日期:** 2026-08-03 22:34（动态实测，真实浏览器）
**账号:** c4a1b25f（郑州骏霄数字科技有限公司 / sphpfkmVO5uy6NF）— DB: CONNECTED（审计前已修复恢复）

## 实测时间线（2026-08-03 22:34:00 起）

```
 0.0s  connect start
 2.0s  connect result → status=connected, accountName=郑州骏霄数字科技有限公司, externalAccountId=sphpfkmVO5uy6NF ✅
 7.4s  poll0: url=channels.weixin.qq.com/platform | loggedIn=true
       signals={page:true, cookie:true, identity:true, loginPage:false, credential:true} 三信号全绿 ✅
12.4s  poll1: 同上
17.2s  poll2: 同上
22.6s  poll3: 同上
27.9s  poll4: 同上
```

## 断点历史（审计期间发现并修复，最小改动）

### 根因① 配置张冠李戴（cookie 信号永远 false）
- 实测（2026-08-03 22:17 直测浏览器）：channels.weixin.qq.com 真实登录 cookie = **sessionid + wxuin**
- 旧配置：`cookies: ['wxuin', 'wxsid', 'rand_info', 'mm_lang']`（wxsid/rand_info/mm_lang 是**公众号** mp.weixin.qq.com 的 cookie）
- 结果：只命中 wxuin 1 个，永远凑不齐 ≥2 → cookie 信号永远 false → 扫码成功永不认证
- 修复：改为 `cookies: ['wxuin', 'sessionid']`（纯配置）

### 根因② 自杀式清理（connect 自毁登录态）
- connect 流程：探针未命中 → `clearLoginCache`（清平台域 cookie + localStorage）
- 探针因根因①永远未命中 → **每次 connect 都把真实登录 cookie 清掉** → 登录态被自己摧毁
- 修复：清理守卫——页面已进工作台 URL 或 keyCookies 命中 ≥2 时跳过清理（保护有效会话）

### 根因③（关联观察）登录态自动跳转
- 22:17:06 实测：login.html 打开后**自动 302 到 platform/**（残留登录态生效）→ 视频号属于「扫码后自动跳工作台」平台（与抖音同类）

## 结论

视频号修复后三信号全绿 + connect 直连成功 + PM2 重启保持（Recovery 扫描 3/3 保持）。**视频号现在是第二个「正确适配探针公式」的平台**（工作台 URL + 真实 cookie 配置）。

## 遗留

- 「扫码后」动态段：profile 已有有效登录态，未触发扫码。掌柜下次登录态失效后扫码可补全。
