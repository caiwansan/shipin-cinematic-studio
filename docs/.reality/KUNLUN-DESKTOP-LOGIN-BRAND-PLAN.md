# KUNLUN-DESKTOP-LOGIN-BRAND-PLAN.md

> KUNLUN Desktop Branding — Task 02/03/04: Login Experience + Account Alignment + Implementation Plan
> 日期: 2026-08-07 (CST) | 状态: 📐 审计完成，方案待掌柜裁决
> 依据: 掌柜指令（Beta 0.1 Freeze Watch — 第一分钟体验 = 用户是否理解"这里管理我的 AI 员工"）

---

## 0. 现状审计（代码级实证）

### 0.1 当前 Desktop 登录首屏（desktop/ui/index.html 156-170 行）

```html
<div id="view-login" class="login-wrap hidden">
  <div class="login-box">
    <div class="logo">昆仑镜 <span>KUNLUN</span></div>   ← 纯文字 Logo（无图形）
    <h2>登录昆仑镜账号</h2>                                 ← 传统后台式标题
    <input id="login-account" placeholder="邮箱 / 手机号 / 账号" />
    <input id="login-password" type="password" placeholder="密码" />
    <button id="btn-login">登 录</button>
    <div class="muted">登录即完成设备激活（Steam/Adobe 激活模式…）</div>
  </div>
</div>
```

**现状判定**：
- ❌ 无品牌图形 Logo（只有文字"昆仑镜 KUNLUN"）
- ❌ 无产品定位语（第一眼看不出"AI 员工操作系统"）
- ❌ 无第三方登录入口（QQ/微信）
- ❌ 文案"登录昆仑镜账号"偏传统后台
- ✅ 居中卡片布局已正确（login-wrap flex 居中）
- ✅ 登录即设备激活机制已存在（Steam/Adobe 模式）

### 0.2 线上账号体系（backend 实证）

| 能力 | 路由 | 状态 |
|---|---|---|
| 手机号注册+密码 | POST /api/auth/register | ✅ 已有 |
| 手机号+密码登录 | POST /api/auth/login | ✅ 已有（account 兼容邮箱/手机/账号） |
| 短信验证码 | POST /api/auth/sms-code + sms-auth.ts（腾讯云 SDK，未配置时 MOCK） | ✅ 已有 |
| QQ OAuth | /api/auth/qq/authorize + /qq/status + /qq/callback（qq-oauth.ts，paymentSecret 存储配置，state 防 CSRF） | ✅ 已有 |
| 微信 OAuth | /api/auth/wechat/authorize + /wechat/status + /wechat/callback（wechat-oauth.ts，同构） | ✅ 已有 |
| JWT 签发 | fastify-jwt，payload { id, email, tokenVersion, organizationId } | ✅ 已有 |
| 企业身份 | organizationId 注入 JWT + governance_user 表（owner/admin/manager/member） | ✅ 已有 |
| 设备激活 | desktop/ticket + plugin/ticket（GETDEL 防重放） | ✅ 已有（S2.2） |

**关键结论：Cloud Identity Authority 完整存在，Desktop 零账号体系需求——只做 UI 接入。**

---

## 1. Desktop 登录体验设计

### 1.1 目标首屏（第一印象 = AI 员工管理系统）

```
┌─────────────────────────────────────────┐
│               （居中卡片 400px）           │
│                                         │
│            [ 昆仑镜图标 Logo ]            │  ← 图形 Logo（方案 A），非左上角
│                                         │
│             昆仑镜 AI OS                  │  ← 品牌名（大标题）
│       企业 AI 员工操作系统                 │  ← 定位语（产品心智一击）
│                                         │
│  ────────────────────────────────        │
│                                         │
│          [ 手机号 / 邮箱 / 账号 ]          │  ← 账号输入
│          [    密码 / 验证码    ]          │
│          [       登  录       ]          │
│                                         │
│  ── 或使用以下方式登录 ──                 │
│   [ 手机登录 ]  [ 微信登录 ]  [ QQ登录 ]   │  ← 第三方入口
│                                         │
│  用户协议 · 隐私政策                       │
└─────────────────────────────────────────┘
```

### 1.2 设计原则

| 原则 | 落地 |
|---|---|
| 品牌第一眼 | Logo 置顶居中 + 产品名 + 定位语三段式 |
| 非网页感 | 原生质感卡片（圆角 16px、宣纸白底、细线边框、S8.0 令牌）、无浏览器导航 |
| 非聊天入口 | 无任何对话/气泡元素；焦点 = "登录进入你的 AI 员工团队" |
| 登录即激活 | 保留现有"设备激活"提示，弱化为卡片底部细字 |
| 第三方登录 | 手机（验证码）/微信/QQ 三入口，与线上同源 |

### 1.3 登录卡片结构（最终形态）

```
[ 昆仑镜图形 Logo 80px ]
昆仑镜 AI OS                    (20px 粗体, --kl-ink)
企业 AI 员工操作系统             (13px, --kl-ink-sub)

[ 手机号 / 邮箱 / 账号 ]        (输入框 1)
[     密 码     ]              (输入框 2, 切换"短信验证码"模式)
[ 获取验证码 ]                  (短信模式副操作)
[     登  录     ]             (主按钮, 天青)

──────── 或 ────────
[ 手机号登录 ] [ 微信登录 ] [ QQ登录 ]   (三个等宽次级按钮)

登录即完成设备激活（Steam/Adobe 模式，随机设备标识，不采集硬件序列号）  (10px muted)
用户协议 · 隐私政策                                                      (10px muted 链接)
```

---

## 2. Desktop Login Architecture（账号对齐）

```
┌──────────────────────────────────────────────┐
│            Cloud Identity Authority          │
│  (JWT + organizationId + tokenVersion 续期)  │
│  手机号密码 / 短信 / QQ OAuth / 微信 OAuth     │
└────────────────────┬─────────────────────────┘
                     │ HTTPS (CORS: tauri.localhost)
┌────────────────────▼─────────────────────────┐
│              Desktop Login (壳内)            │
│  复用线上全部登录 API（零新端点）              │
│  success → accessToken → save_credentials    │
└────────────────────┬─────────────────────────┘
                     │ invoke (IPC, 本地 store)
┌────────────────────▼─────────────────────────┐
│     Enterprise / Personal Account Session    │
│  device 激活 + 员工发现 + 授权 + 执行         │
└──────────────────────────────────────────────┘
```

**约束（掌柜冻结）**：
- ✅ Desktop 复用 Cloud Identity Authority
- ✅ 禁止 Desktop 创建独立账号体系
- ✅ 禁止本地保存账号密码（仅 store 保存 accessToken/device 凭据，密码零落盘）
- ✅ 登录态统一由 JWT 驱动，organizationId 贯穿

---

## 3. Implementation Plan（实施计划——待批准后执行）

### 3.1 图标替换方案

| 步骤 | 动作 | 文件 |
|---|---|---|
| 1 | SVG 矢量母版制作（方案 A 确认后） | icon-master.svg |
| 2 | 导出 6 尺寸产物（精确缩放，非拉伸） | icon-1024.png / icon.png / 32x32.png / icon.ico(多帧) |
| 3 | 替换 icons/ 目录文件 | desktop/src-tauri/icons/* |
| 4 | 新增 NSIS 安装器图标 | installer-icon.ico |

### 3.2 Tauri icon 更新方案

```jsonc
// tauri.conf.json（仅 icon 数组，其余不动）
"icon": [
  "icons/32x32.png",
  "icons/icon.png",
  "icons/icon.ico",
  "icons/icon-1024.png"
]
// 新增（NSIS 安装器独立图标）：
"bundle": {
  "windows": {
    "nsis": {
      "installerIcon": "icons/installer-icon.ico",
      "uninstallerIcon": "icons/installer-icon.ico"
    }
  }
}
```

### 3.3 Windows installer icon 更新

- 随 3.2 的 nsis.installerIcon 配置生效（Tauri v2 NSIS 支持）
- 构建验证：安装器 exe 图标 / 卸载器图标 / 快捷方式图标三处一致

### 3.4 登录窗口 UI 调整方案

| 改动 | 位置 | 类型 |
|---|---|---|
| Logo 图形置顶居中 | view-login HTML + CSS | 静态 UI |
| 品牌名 + 定位语 | 同上 | 静态文案 |
| 手机号/邮箱/账号 输入保留 | 同上 | 保留现有逻辑 |
| 密码 ↔ 短信验证码 切换 | doLogin JS + 新增 smsCode 分支 | 逻辑接入（复用现有 sms-auth API） |
| 微信/QQ 登录按钮 | 新增 OAuth 流程（复用 /api/auth/qq|wechat/authorize + status） | 逻辑接入 |
| 用户协议/隐私链接 | 底部链接 | 静态 |

**第三方登录实现要点**（Desktop OAuth 无浏览器跳转的适配）：
- QQ/微信 authorize 返回二维码/短链 → 壳内弹窗展示 → status 轮询 → 拿到 JWT
- 与线上 mobile.vue 同构（fetch /api/auth/qq/authorize + status 轮询模式），零新端点
- 若第三方 OAuth 需要浏览器环境（微信扫码），用壳内 WebView 子窗口承载

### 3.5 QQ/微信登录同步方案

```
Desktop 点击 [微信登录]
  ↓
fetch /api/auth/wechat/authorize → 返回二维码链接/短链
  ↓
壳内二维码视图（或系统浏览器打开 + status 轮询）
  ↓
用户扫码确认
  ↓
fetch /api/auth/wechat/status → 成功 → accessToken + user
  ↓
save_credentials → 与账号密码登录同一 JWT 会话路径
```

**一致性**：与线上登录产出的 JWT 完全同源（同一 user.id + organizationId），Desktop/Web 双端同一身份。

### 3.6 风险分析

| 风险 | 等级 | 缓解 |
|---|---|---|
| QQ/微信 OAuth 在 Desktop WebView 的扫码体验 | 中 | 复用线上已验证的 authorize+status 轮询；微信扫码用系统浏览器 + 轮询兜底 |
| 短信验证码发送限额/费用 | 低 | 复用现有 sms-auth（未配 SDK 时 MOCK，生产需配腾讯云） |
| 图标替换影响构建 | 低 | SVG 母版精确导出 + tauri build 回归验证 |
| 登录页改动影响现有登录链路 | 低 | 只改 UI 层 + 新增 OAuth 分支；账号密码路径逻辑不动 |
| Freeze Watch 边界 | — | 零业务功能新增、零架构改动、零员工/市场/运行时修改 |

---

## 4. 验收标准（Gate）

| # | 检查项 | 判定标准 |
|---|---|---|
| LG1 | 第一印象 | 打开 Desktop 0.5s 内："这是我的昆仑镜 AI 员工团队入口"，非"聊天软件" |
| LG2 | 品牌呈现 | 图形 Logo + 昆仑镜 AI OS + 企业 AI 员工操作系统 三段式完整 |
| LG3 | 登录可用 | 账号密码登录回归通过（已有账号实测） |
| LG4 | 第三方登录 | 手机验证码 / QQ / 微信 入口可用（或按掌柜优先级分阶段） |
| LG5 | 身份对齐 | Desktop 登录后与线上同 JWT 身份，organizationId 一致 |
| LG6 | 无本地密码 | 密码零落盘（仅 store 保存 token/device） |
| LG7 | 构建回归 | tauri build 通过，安装器/图标/登录页三处一致 |

---

## 5. 实施顺序建议（掌柜批准后）

```
Phase 1（低风险，先做）:
  图标方案确认 → SVG 母版 → 6 尺寸替换 → NSIS 图标配置 → tauri build 验证
  + 登录页 Logo/品牌名/定位语 UI 调整（纯静态）

Phase 2（接入线上体系）:
  手机验证码登录（复用 sms-auth）
  QQ 登录（复用 qq-oauth authorize+status）
  微信登录（复用 wechat-oauth）

Phase 3（体验打磨，可选）:
  首启欢迎引导与登录衔接（S8.2 已有基础）
  用户协议/隐私页链接落地
```

---

## 6. 结论

```
现状: 登录首屏 = 传统文字表单（无品牌图形/定位语/第三方入口）; 线上账号体系完整可用
方案: 品牌三段式登录卡 + 手机/微信/QQ 复用 Cloud Identity + 图标全家桶替换
架构: Desktop 零独立账号，全部复用线上 Authority（JWT + organizationId）
风险: 低; Freeze Watch 合规（纯 UI + 登录接入，零业务/架构改动）
```

**待掌柜裁决：**
1. 图标方案 A / B / C？（推荐 A「昆仑镜面」）
2. Phase 1 是否先行？（图标 + 登录页静态调整）
3. Phase 2 第三方登录优先级？（手机 > QQ > 微信？）
