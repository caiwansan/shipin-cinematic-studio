# SPRINT-DESKTOP-AUTH-ARCHITECTURE-AUDIT-01 — Desktop Shell 认证架构审计

**Date:** 2026-08-04 05:50
**Type:** 只读审计（零代码改动）
**Gate:** 技术总监裁定（2026-08-04）——停止 RCA-02 扩展与一切白屏补丁；白屏不是单点 bug，是「Desktop Shell ↔ Cloud Workspace 身份桥接」架构问题的暴露。先审计架构，再修根。
**冻结：** ❌ 改 Tauri ❌ 改 CSP ❌ 改 index.html ❌ 改工作台业务 ❌ 新补丁发布

---

## 0. 审计结论（TL;DR）

1. **白屏是两个产品层问题，当前被当作一个修**——Layer 1（Desktop Shell Reality）与 Layer 2（Workspace Launch Reality）必须分离验收（见 §7 Task 01）。
2. **token 注入存在确定性竞态**：`open_workspace` 注释写「加载完成后注入」，实际 `build()` 后立即 `eval()`——在 WebView2 初始文档（about:blank / opaque origin）执行 `localStorage.setItem` 会抛 SecurityError，token 写入失败，线上工作台无身份。
3. **localStorage 注入不符合产品级发行要求**：把 Web 登录态复制进客户端再塞回 Web，产生双生命周期 + 竞态 + 跨窗口失效问题。正确模型 = Desktop Session Exchange（Steam 模式）。
4. **推荐方案**：Desktop 持 accessToken（已有）→ `POST /api/desktop/session/exchange`（一次性 ticket）→ 服务端签发域内会话 → workspace 窗口以会话身份加载，**零注入零竞态**。
5. **ECO-11.3 生态基础设施无问题**；暴露的是「开发工具 → 商业桌面产品」最后一道门：Desktop 与 Cloud 的身份边界。

---

## 1. 当前认证链完整链路图（谁生成 / 谁保存 / 谁注入 / 谁消费）

```
┌─ Desktop Shell（KunlunMedia.exe, Tauri v2）──────────────────────────┐
│  ui/index.html（本地页，frontendDist=../ui）                          │
│                                                                      │
│  ① doLogin: POST https://aigc.fushtn.com/api/auth/login             │
│      （账号+密码，backend fastify-jwt 签发）                          │
│  ② save_credentials → tauri-plugin-store credentials.json           │
│      + 内存 AppState.session（access_token 双存）                    │
│  ③ 点「启动」→ launchApp(slug, entry)                                │
│      invoke('open_workspace', { url, access_token })                 │
│      url = https://aigc.fushtn.com/workspace/media                   │
│  ④ Rust open_workspace: WebviewWindowBuilder.build()                 │
│      → 立即 eval("window.__KUNLUN_DESKTOP__={};                      │
│                   localStorage.setItem('auth_token','<token>');")    │
└──────────────────────────────────────────────────────────────────────┘
                              │ 新窗口「昆仑镜工作台」1440×900
                              ▼ 导航
┌─ Cloud Workspace（https://aigc.fushtn.com/workspace/media）──────────┐
│  Nuxt SPA（SSR=false 的客户端渲染）                                   │
│  ⑤ plugins/auth-init.client.ts → getAuthToken()                      │
│      utils/auth/token.ts：内存闭包 → localStorage『auth_token』      │
│  ⑥ middleware/auth.ts: /workspace/* 是保护路由                        │
│      !auth.isAuthenticated → restoreSession() → 仍无 →               │
│      navigateTo('/?showLogin=1&redirect=/workspace/media')            │
│  ⑦ API 请求：Authorization: Bearer <token>（api-kernel）             │
└──────────────────────────────────────────────────────────────────────┘
```

| 环节 | 谁生成 | 谁保存 | 谁消费 | 生命周期 |
|---|---|---|---|---|
| JWT accessToken | backend `/api/auth/login`（`fastify.jwt.sign`，payload: id/email/tokenVersion/organizationId） | Shell credentials.json + 内存 | Nuxt auth store → API Bearer | 登录时生成；`/api/auth/refresh` 续期；tokenVersion 变更即失效（单设备登录检查） |
| localStorage auth_token | **Rust eval 注入**（open_workspace） | WebView2 localStorage（workspace 窗口 origin） | Nuxt getAuthToken | **窗口创建瞬间一次性注入，无刷新/续期路径** |
| cookie auth_token | 仅 Web 端正常登录流程写入（`setAuthToken` 兼容层） | —— | —— | **Desktop 注入路径不写 cookie**（SSR/服务端侧无身份） |
| 设备凭据 device_id/device_token | Shell 登录后 ensureDevice | credentials.json | Shell 自身（license/heartbeat） | 与 workspace 会话**完全脱钩** |

---

## 2. token 注入生命周期分析（核心嫌疑，代码级实锤）

### 2.1 注释与实现不符

`desktop/src-tauri/src/lib.rs` `open_workspace`：

```rust
/// 启动线上工作台（新 WebView 窗口；加载完成后注入 token 到 localStorage）  ← 注释
...
let webview = WebviewWindowBuilder::new(...).build()...;   // ① 窗口创建，导航刚开始
if let Some(token) = access_token {
    let js = format!("...localStorage.setItem('auth_token','{}');", token);
    webview.eval(&js)...;                                  // ② 立即 eval，无等待
}
```

注释承诺「加载完成后注入」，实现是「build 后立即 eval」。**RCA-02 审计已发现此点（GAP-3），1.1.2 的埋点正是为验证它而加。**

### 2.2 竞态时序（WebView2 生命周期 vs token 注入）

```
t0  WebviewWindowBuilder.build() 返回（初始文档 about:blank，opaque origin）
t1  webview.eval(js)  ← 立即执行
    ├─ 若执行于 about:blank：localStorage 访问 → SecurityError（opaque origin 无 storage）
    │   → eval 报错 → open_workspace 返回 Err → Shell invoke reject（launchApp 无 .catch
    │     → 主窗口 unhandledrejection → error.log 记录）
    ├─ 若 WebView2 排队到导航后执行：与 Nuxt hydration 竞态
    │   ├─ Nuxt 先读 localStorage（空）→ auth middleware → redirect /?showLogin=1
    │   └─ eval 后写 → token 已迟到，首屏无身份
t2  导航 https://aigc.fushtn.com/workspace/media
t3  page STARTED → Nuxt JS 执行 → auth bootstrap
t4  page FINISHED
```

**三种失败模式，webview.log 可区分**：
- **F1**：`token inject begin` 时间戳 < `page STARTED` → 注入发生在导航前 → 最大概率写入失败
- **F2**：error.log 出现 `UNHANDLED REJECTION`（eval 返回 Err，launchApp 无 catch）→ 注入明确失败
- **F3**：时序正常但 `DOCUMENT_TITLE` 不变化 / NAVIGATE 到 `/?showLogin=1` → 注入成功但身份未被首屏消费（或前端层问题）

### 2.3 附加问题清单

- **launchApp 无 .catch**（ui/index.html:341）→ open_workspace Err 静默吞掉，用户无感知（只有 error.log）
- **注入不写 cookie** → 与 Web 正常登录态不一致；若线上切换为 SSR/服务端会话判定，注入即失效
- **token 明文在 eval JS 中** → 若被注入脚本读取可窃取（XSS 面）；eval 字符串本身也可能被 webview 日志/调试器记录
- **credentials.json 明文存 access_token**（掌柜已知安全项，Security Sprint 处理）
- **refresh 无落点**：Desktop 持 accessToken 过期后无 refresh 路径，workspace 窗口一旦打开，其登录态无法由 Desktop 续期

---

## 3. localStorage 注入方案产品级评估

| 维度 | 评估 | 结论 |
|---|---|---|
| 竞态风险 | 注入时机与导航/hydration 天然竞态，无同步保证 | ❌ 高 |
| 生命周期一致性 | Desktop 与 Web 双 token 副本，无同步机制 | ❌ 高 |
| 安全性 | token 进 localStorage = XSS 可读；eval 注入可被拦截/篡改 | ❌ 中高 |
| 多窗口/多应用 | 每个 workspace 窗口各自注入，状态分裂 | ❌ 高 |
| 服务端配合 | 服务端无法区分「Desktop 会话」与「Web 会话」 | ❌ 缺失 |
| 产品语义 | 客户端「复制」登录态给网页，违背身份边界（Steam/Adobe 模式） | ❌ 架构错误 |

**判定：localStorage 注入不应作为产品级方案。** 可作为过渡，但根方案必须是服务端会话交换。

---

## 4. 推荐方案：Desktop Session Exchange（Steam 模式）

### 4.1 目标形态

```
Desktop（Identity + License + Launcher）
  │  已持 accessToken（登录所得）
  │  POST /api/desktop/session/exchange  { ticket, deviceId, appSlug }
  │        ↑ ticket = Desktop 生成一次性随机串（60s 有效，用后即焚）
  ▼
Backend：校验 JWT + 设备绑定 + ticket 一次性 → 签发域内 session cookie
  │        （HttpOnly, Secure, SameSite=Lax, domain=aigc.fushtn.com）
  ▼
Workspace 窗口加载 https://aigc.fushtn.com/workspace/media?ticket=xxx
  → Nuxt desktop-session 插件读 ticket → POST exchange → 种 cookie → 清理 URL
  → 后续请求携带会话 cookie（或换短期 accessToken 注入内存）
```

**关键点**：
- Desktop 只做「设备身份 + License + 应用启动」，**不做 Web 登录态复制**
- 会话由服务端签发，Desktop 与 Workspace 通过一次性 ticket 握手
- ticket 走 URL query 仅用于交换（60s 一次性），交换后 `history.replaceState` 清除，不落服务器日志（或走 fragment `#ticket=`）
- 与现有 JWT/tokenVersion 单设备机制兼容：exchange 仍校验 accessToken + tokenVersion

### 4.2 候选方案对比

| 方案 | 竞态 | 安全 | 服务端改动 | 客户端改动 | 推荐 |
|---|---|---|---|---|---|
| A. 修正 eval 时机（等 Finished 再注入） | 仍有 hydration 竞态 | 低（localStorage XSS 面不变） | 无 | 小 | ⚠️ 仅过渡 |
| B. ticket + session cookie（HttpOnly） | 无（导航即带身份） | 高（cookie 防 XSS 读取） | 中（exchange 接口） | 中 | ✅ **推荐** |
| C. URL fragment 直传 accessToken | 无 | 低（token 进 URL/历史） | 无 | 小 | ❌ 应急可考虑 |
| D. Tauri http 插件服务端种 cookie | 无 | 高 | 中 | 中 | 次选（第三方 cookie 策略风险） |

### 4.3 安全设计要点（exchange 接口）

- ticket：`crypto.randomUUID()`，Redis/DB 存 60s，一次性（用过删除）
- 校验链：JWT 有效（tokenVersion 一致）→ device_id 与 License 绑定 → ticket 未用未过期
- 产出：HttpOnly session cookie（domain=aigc.fushtn.com，short TTL 如 2h）+ 可选短时 accessToken
- 审计：exchange 成功/失败落 auditLog（deviceId, appSlug, ip）
- 防滥用：ticket 限速（单 device 10/min）、失败计数

---

## 5. 最小迁移路径

```
Phase 0（已就绪）：RCA-02 埋点（webview.log 时间线）→ 白屏位置定位（Task 01）
Phase 1（过渡修复，架构不变）：
  - open_workspace 等 on_page_load Finished 后注入（修正注释/实现偏差）
  - launchApp 加 .catch → 失败显示错误 + error.log
  - 注入同时写 cookie（与 Web 登录态对齐）
  ⚠️ 仅止血，不解决架构问题
Phase 2（根方案）：
  - backend: POST /api/desktop/session/exchange（ticket 一次性）
  - Desktop: 启动前生成 ticket → open_workspace url 带 ticket
  - Nuxt: plugins/desktop-session.client.ts（读 ticket → exchange → 清 URL）
Phase 3（产品收敛）：
  - Desktop 首页 = 欢迎回来/我的 AI 员工/许可证+设备状态/启动按钮（R0）
  - Workspace 启动 = token bridge → loaded（R1）
  - credentials.json access_token 加密（Security Sprint）
```

---

## 6. 当前启动架构事实（与掌柜裁定对照）

- ✅ **已确认**：1.1.2 主窗口 = 本地 Shell（ui/index.html，登录/应用列表/插件/设备），**不会自动进工作台**——掌柜建议的「Shell 首页 → 启动 → 工作台」两层结构**已在 1.1.2 成立**
- ⚠️ 白屏窗口待确认：掌柜打开 exe 看到的是「昆仑镜 Kunlun Desktop」（主窗口，本地 Shell）还是「昆仑镜工作台」（workspace 窗口）——**这决定 Layer 1 / Layer 2**
- ❌ main.js（Electron 壳）+ web/（旧版全站 SPA 打包）为**历史遗留**，不参与 1.1.2 发行（tauri.conf.json frontendDist=../ui）

---

## 7. RELEASE-REALITY-02 Task 01：白屏位置确认（掌柜真机）

打开 exe 后截图，看窗口标题：

| 窗口标题 | 判定 | 进入层 | 主查 |
|---|---|---|---|
| **昆仑镜 Kunlun Desktop**（本地 Shell 白屏） | Shell 未渲染 | **Layer 1**（Tauri/WebView2/CSP/静态资源/安装环境） | webview.log 主窗口 STARTED/FINISHED；diag A 包 |
| **昆仑镜工作台**（workspace 窗口白屏） | Shell ✅ 已成功 | **Layer 2**（token 生命周期/登录态桥接/WebView 注入/Nuxt auth） | webview.log token inject 时间戳 vs STARTED（§2.2 F1/F2/F3） |
| 两个窗口都白屏 | 全链路 | 双 Layer | 先 Layer 1 |

**价值**：一步砍掉 80% 排查范围。日志回传后按 §2.2 三种失败模式逐行对照 → 输出启动时间线实况 → 判定唯一层级。

---

## 8. 冻结清单（持续）

❌ 改 Tauri ❌ 改 CSP ❌ 改 index.html ❌ 改工作台业务 ❌ 白屏补丁 ❌ 新发布
⏸ Task02 AI 内容运营经理（商品价值验证前，先保证 安装→登录→打开应用→进入工作台→调用AI员工 链路成立）
⏸ credentials.json 明文（Security Sprint）

**审计依据文件**：`desktop/src-tauri/src/lib.rs`（open_workspace 注入实现）、`desktop/src-tauri/src/diag.rs`（四日志）、`desktop/ui/index.html`（doLogin/launchApp）、`desktop/src-tauri/tauri.conf.json`（frontendDist/windows/CSP）、`backend/src/plugins/auth.ts`（JWT 认证）、`backend/src/routes/auth.ts`（login/refresh 签发）、`frontend/utils/auth/token.ts`（auth_token 唯一来源）、`frontend/middleware/auth.ts`（保护路由跳转）、`frontend/plugins/auth-init.client.ts`（会话恢复）、`frontend/stores/auth.ts`（token 双写）
