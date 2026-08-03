# SPRINT-DESKTOP-SESSION-EXCHANGE-01 — Desktop → Cloud Workspace 正式身份桥

**Date:** 2026-08-04 05:50
**Status:** ⏸ PENDING — 等待 Task 0（白屏窗口身份确认）通过后启动
**Gate:** 技术总监裁定（2026-08-04，AUDIT-01 验收通过）——取消「WHITE-SCREEN-FIX」命名，围绕症状修；以「身份桥」为目标修根
**冻结：** ❌ 白屏补丁 ❌ 改 CSP ❌ 改 index.html 业务 ❌ 生态新功能 ❌ AI 员工商品化前加功能
**命名纪律：** 本 sprint 目标 = 完成 Desktop → Cloud Workspace 正式身份桥（不是修白屏）

---

## 0. 启动前置条件（Task 0：白屏窗口身份确认 — 掌柜真机）

打开 1.1.2，截图白屏窗口标题：

| 标题 | 判定 | 分支 |
|---|---|---|
| **昆仑镜 Kunlun Desktop**（本地 Shell 白屏） | Layer 1（Shell/WebView2/发行资源层） | ⛔ 本 sprint 不启动 → 回 WebView2/发行资源层排查 |
| **昆仑镜工作台**（线上窗口白屏） | Layer 2（token 注入竞态，AUDIT-01 实锤） | ✅ 启动本 sprint |

配套证据：`%LOCALAPPDATA%\com.kunlun.desktop\logs\` 打包回传，按 AUDIT-01 §2.2（F1 inject<STARTED / F2 UNHANDLED REJECTION / F3 title 不变）逐行对照。

**Reality 纪律：不跳过证据。即使 token 竞态高度可疑，也必须先确认窗口层。**

---

## 1. 架构目标（冻结）

```
Desktop（Identity + License + Launcher）          Cloud（Workspace + AI Agent + Data）
┌─────────────────────────────┐                 ┌──────────────────────────────┐
│ 用户登录 → 持 accessToken    │                 │  Nuxt SPA                     │
│ Device 注册 / License 查询    │                 │  desktop-session 插件          │
│ Application Launcher         │                 │  auth middleware              │
└──────────────┬──────────────┘                 └──────────────┬───────────────┘
               │ ① issue（Bearer JWT + deviceId）               │
               ▼                                                │
        POST /api/desktop/session/issue                         │
               │ ← { ticket（一次性 60s）}                       │
               │ ② 打开 workspace URL?ticket=xxx                │
               └────────────────────────────────────────────────►│
                                                         ③ exchange {ticket}
                                                                    │
                                                            服务端校验（ticket 已绑定
                                                            userId/deviceId/org/license）
                                                                    │
                                                            ④ Set-Cookie HttpOnly Secure
                                                              + 短期 accessToken
                                                                    │
                                                            ⑤ 清理 URL → 刷新保持（cookie）
└────────────────────────────────────────────────────────────────────┘
        身份由服务端最终确认（Identity/Organization/License Authority）
```

**关键原则（AUDIT-01 裁定）**：
- Desktop **不注入 localStorage**、不 eval token——只做「设备身份 + License + 启动 + ticket 发放」
- Workspace 不接触长期身份——只消费一次性 ticket 换服务端签发的会话
- 浏览器用户 JWT 体系**完全保留**，两种身份共存（cookie 会话 / Bearer JWT）

---

## 2. Task 01：后端 Session Exchange（backend）

### 2.1 新增 `POST /api/desktop/session/issue`（Desktop 调）

- 鉴权：`authenticate`（Bearer JWT，tokenVersion 单设备校验已有）
- 输入：`{ deviceId, appSlug }`
- 校验链（AUDIT-01 §4.3）：
  1. JWT 有效（userId 解析）
  2. deviceId 存在且 **ACTIVE**（Device 表）
  3. organization 匹配（JWT organizationId ↔ device 归属）
  4. license 允许（appSlug 对应 License 有效）
- 输出：`{ ticket }`（crypto.randomUUID，服务端登记，60s 过期，一次性）
- **Ticket 表字段（总监冻结 2026-08-04，不可删减）**：
  ```
  ticket_id       PK（crypto.randomUUID）
  user_id         签发用户
  organization_id 签发组织
  device_id       签发设备（防跨设备复用）
  app_slug        目标应用（Media/Novel/PPT 统一入口预留）
  issued_at       签发时间
  expires_at      issued_at + 60s
  used_at         NULL=未用；非 NULL=已消费
  ```
- **一次性消费（冻结）**：`used_at != null => reject`（防重放）
- **防「复制 URL + ticket 到另一台机器」**（G9 依据）：exchange 时校验来源 device（WebView UA/指纹 与 issue 时 device_id 绑定不一致 → 拒绝）；即使 60s 内被复制，跨设备必然失败
- 审计：auditLog 直写（prisma.auditLog，tenantId=orgId）

### 2.2 新增 `POST /api/desktop/session/exchange`（workspace 窗口调）

- 鉴权：**无 JWT**（窗口没有长期身份；安全性完全依赖一次性 ticket）
- 输入：`{ ticket }`
- 校验：ticket 存在 → 未 used → 未过期（60s）
- 输出：
  - `Set-Cookie: kunlun_session=<sid>; HttpOnly; Secure; SameSite=Lax; Domain=aigc.fushtn.com; Max-Age=7200`
  - body `{ ok: true, accessToken: <short-lived>, expiresIn: 7200 }`
- ticket 标记 used（防重放）
- 审计：exchange 成功/失败落 auditLog

### 2.3 新增 `POST /api/desktop/session/bootstrap`（刷新保持）

- 鉴权：cookie（kunlun_session）→ 校验服务端 sid → 返回新短期 accessToken
- 用途：workspace 窗口刷新后，Nuxt 插件无 token 但带 cookie → bootstrap 换 token → 保持登录

### 2.4 兼容性约束（不破坏 Web 用户）

- 现有 JWT Bearer 认证**不动**（auth.ts 保持）
- 新接口独立文件 `backend/src/routes/desktop-session.ts`，路由前缀 `/api/desktop/session/*`
- cookie 会话只作用于 workspace 窗口（同域），Web 浏览器用户不受影响

---

## 3. Task 02：Desktop Shell 改造（src-tauri + ui）

### 3.1 `lib.rs open_workspace` 重构

- ❌ 删除：`webview.eval("localStorage.setItem('auth_token',...)")`
- ✅ 改为：`open_workspace(url)` — URL 由前端拼好带 `?ticket=xxx`；Rust 只负责窗口创建 + 导航 + 埋点
- 保留：域名白名单、on_navigation/on_page_load/on_document_title_changed 埋点（可观测性资产）

### 3.2 `ui/index.html launchApp` 重构

```
launchApp(slug, entry):
  ① POST /api/desktop/session/issue（Bearer access_token + device_id + appSlug）
     → { ticket }
  ② invoke('open_workspace', { url: WORKSPACE_BASE + entry + '?ticket=' + ticket })
  ③ 失败 → 显示错误（不再静默吞，加 .catch + error.log）
```

- 删除：`access_token` 作为参数传给 open_workspace（Rust 不再接触 token）
- `doLogin` 登录流程不动（accessToken 仍存 credentials.json，用于 issue）

### 3.3 Shell 能力禁令（总监冻结 2026-08-04，架构红线，永久生效）

**Kunlun Media.exe 永远禁止：**

- ❌ 写 Web localStorage（任何 origin）
- ❌ 注入 JWT / access token 到任何 WebView 页面
- ❌ eval 任何身份凭据相关 JS

**原因**：否则未来插件生态、桌面多应用（Kunlun Media/Novel/PPT.exe）、多平台（Win/macOS/Linux）会继续踩同一坑。Shell 与 Web 身份的边界 = Desktop 持 JWT/Device/License，Workspace 只持一次性 ticket，二者永不交叉。

### 3.3 安全细节

- ticket 不走日志（diag.log 只记 ticket 长度或 hash）
- open_workspace 的 diag 埋点同步调整（token inject 日志删除 → 记 session issue 时间点）

---

## 4. Task 03：Workspace 接入（frontend）

### 4.1 新增 `plugins/desktop-session.client.ts`

```
① 检测 URL query `ticket`（仅 /workspace/* 且无 auth_token 时）
② POST /api/desktop/session/exchange { ticket }（credentials 默认，读 Set-Cookie）
③ 成功 → setAuthToken(短期 accessToken)（现有机制，内存+localStorage）→ history.replaceState 清 ticket
④ 失败/过期 → 静默（走现有登录弹窗路径，不阻塞 Web 用户）
```

### 4.2 刷新保持

- auth-init.client.ts 增强：无 token 时先试 `/api/desktop/session/bootstrap`（带 cookie）→ 有会话则恢复，无则走原逻辑
- **不破坏**：浏览器用户（无 cookie 无 ticket）路径零变化

### 4.3 双模式（总监冻结：两个入口共存，禁止为 Desktop 改坏 Web）

```
Nuxt Middleware
  |
  |── Browser User：JWT（Authorization Bearer，现有体系不动）
  |
  └── Desktop User：HttpOnly Session（kunlun_session cookie，本 sprint 新增）
```

### 4.4 兼容矩阵

| 场景 | 身份来源 | 行为 |
|---|---|---|
| Desktop 启动（ticket） | exchange → cookie + 短期 token | 登录 ✅ |
| Desktop 刷新 | bootstrap（cookie） | 保持 ✅ |
| 浏览器用户 | JWT Bearer（现状） | 不变 ✅ |
| ticket 过期/重放 | — | 走登录弹窗（安全降级）✅ |

---

## 5. Task 04：Reality Gate（验收标准）

### 5.1 自动化脚本 `scripts/reality-check-desktop-session-exchange.ts`

- issue → exchange → bootstrap 全链路（mock WebView 或用 curl 模拟窗口）
- ticket 一次性（重放拒绝）、过期（61s 后拒绝）、非法 device（拒绝）、license 失效（拒绝）
- Web 用户 JWT 回归（现有 auth 测试全绿）

### 5.2 真机验收链（掌柜，Task 04 裁定）

```
下载 exe → 安装 → 登录 → 启动 AI 内容运营经理
→ 进入工作台（无白屏）
→ 刷新页面（仍保持登录）          ← cookie bootstrap
→ 关闭重新打开 exe（设备授权仍有效）← issue 再签发
→ 打开日志：无 localStorage 注入记录
```

### 5.2.1 G9 身份隔离测试（总监新增，冻结）

验证：

```
用户A Desktop → ticket A
用户B Desktop → ticket B
A 的 ticket 不能打开 B 的 workspace（跨用户/跨组织/跨设备均拒绝）
```

原因：Desktop Session Exchange 是未来 Kunlun Media / Novel / PPT 多产品统一入口，身份隔离必须一次设计正确。

### 5.3 完成定义

- Desktop → Workspace 首次启动**零白屏**（Layer 2 目标）
- 全程无 eval token 注入（代码审查 + 日志证据）
- 服务端可区分 Desktop 会话与 Web 会话（auditLog deviceId 字段）

---

## 6. 里程碑

```
Task 0 白屏窗口确认（掌柜真机）→ 分支决策
Task 1 后端 exchange 三接口 + 审计（可独立验收）
Task 2 Shell 改造（删 eval + launchApp 重构）
Task 3 Workspace 插件 + 刷新保持
Task 4 Reality Gate（自动化 + 真机链）
```

**依赖**：Task 1 完成后 Task 2/3 可并行；Task 4 收尾。

---

## 7. 冻结清单（持续，掌柜最终调度）

❌ 白屏补丁（围绕症状修） ❌ 改 CSP ❌ 改 index.html 业务 ❌ 生态新功能 ❌ ECO-12 ❌ AI 内容运营经理开发
✅ 本 sprint 是入口打磨的第一步：安装 → 登录 → 启动 → 进工作台 → 刷新保持 → 设备授权持久

**正确路线（掌柜 2026-08-04 冻结）：**

```
白屏定位 → Session Exchange → Desktop Reality Gate → AI内容运营经理 Business Reality → 用户中心商业入口
```

这条顺序符合昆仑镜从「技术平台」进入「商业产品」的节奏。
