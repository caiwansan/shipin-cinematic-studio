# ADR-021: Desktop Shell Identity Boundary（桌面壳身份边界规则）

- **Status:** Accepted（总监冻结 2026-08-04）
- **Date:** 2026-08-04
- **Owner:** 技术总监 / 杨玉环
- **关联:** SPRINT-DESKTOP-AUTH-ARCHITECTURE-AUDIT-01（e3b5867f）、SPRINT-DESKTOP-SESSION-EXCHANGE-01（d3f3fe6f）、ECO-11.3
- **范围:** Kunlun Media.exe 及未来所有桌面应用（Kunlun Novel / PPT / Recruit / 企业 AI 员工桌面端 / macOS / Linux Shell）

---

## 1. 上下文

Kunlun Media.exe 1.1.2 真实发行包出现「启动白屏」。RCA-02 审计发现根因候选集中在 `open_workspace` 的 token 注入：

```rust
// 旧实现（禁止）
webview.eval("localStorage.setItem('auth_token', '<jwt>')")
```

技术总监裁定（2026-08-04）：白屏不是单点 bug，而是「Desktop Shell ↔ Cloud Workspace 身份桥接」架构问题。AUDIT-01 确认 localStorage 注入方案存在确定性竞态（build 后立即 eval → about:blank opaque origin → SecurityError）且不符合商业发行要求（生命周期错误、身份边界错误、XSS 面扩大、多窗口状态分裂、无法区分 Web/Desktop 用户）。

## 2. 决策

### 2.1 Desktop Shell 职责（唯一允许）

```
Desktop Shell
│
├── 用户启动
├── 设备绑定（Device 注册）
├── License 状态
├── 应用入口（Application Launcher）
└── Session 建立（一次性 ticket issue，不落凭据）
```

### 2.2 能力禁令（永久，架构红线）

**Kunlun Media.exe 及未来所有桌面壳禁止：**

- ❌ 写 Web localStorage（任何 origin）
- ❌ 注入 JWT / access token 到任何 WebView 页面
- ❌ eval 身份凭据相关 JS
- ❌ 模拟浏览器登录、修改网页状态、管理 Web 用户态

**禁止原因**：允许一次 = 未来 Media/Novel/PPT/Recruit/macOS/Linux 全部复制同一身份架构问题；Desktop 沦为「Web Auth Provider」必然腐化。

### 2.3 身份模型（替代方案，冻结）

- Desktop 持 JWT + Device + License + Organization → `POST /api/desktop/session/issue` → 一次性 ticket（60s，七字段绑定：ticket_id/user_id/organization_id/device_id/app_slug/issued_at/expires_at/used_at，一次性消费）
- Workspace 只持 ticket → `POST /api/desktop/session/exchange` → HttpOnly Secure Cookie（kunlun_session）+ 短期 accessToken
- 刷新保持：`POST /api/desktop/session/bootstrap`（cookie 换新 token）
- 身份最终由服务端确认（Identity / Organization / License Authority），Desktop 与 Workspace 身份永不交叉

### 2.4 双模式共存（保护 Web 生态）

- Browser User：JWT Bearer（现有体系不动）
- Desktop User：kunlun_session HttpOnly Cookie（新增）
- 禁止为 Desktop 改坏 Web 用户路径

## 3. 后果

**正面**：身份边界清晰、防跨设备 ticket 劫持（G9 隔离测试）、多应用统一入口一次设计正确、可审计（服务端区分 Desktop/Web 会话）。

**负面/成本**：需要新增三个后端接口 + Shell 改造 + Nuxt 插件；短期 accessToken 仍落内存/localStorage（短期、可被 cookie 续期，后续 Security Sprint 收敛）。

**迁移**：SPRINT-DESKTOP-SESSION-EXCHANGE-01（PENDING，等 Task 0 白屏窗口证据）落地后，旧 eval 注入路径整体删除。

## 4. 验收锚点

- SESSION-EXCHANGE-01 Task 04 Reality Gate（含 G9 身份隔离测试）全绿
- 代码审查：`grep -r "localStorage.setItem" desktop/src-tauri desktop/ui` 无凭据注入残留
- 未来新增桌面应用必须通过本 ADR 审查
