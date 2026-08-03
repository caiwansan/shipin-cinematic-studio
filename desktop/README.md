# Kunlun Desktop Shell — 构建说明（Windows 优先）

> ECO-11.2 掌柜冻结：Windows 优先（Tauri v2 + WebView2），本机（Linux 服务器）仅承载
> 后端 API + Reality Gate；Tauri 工程在 Windows 开发机上构建。

## 目录结构

```
desktop/
├── package.json            # npm 脚本（tauri dev / build / icon）
├── ui/index.html           # Shell UI（登录 → 应用列表 → 插件授权 → 设备信息 → 启动工作台）
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json     # Windows 优先：bundle.targets=nsis；WebView2 downloadBootstrapper
    ├── capabilities/default.json  # 权限：core + store + shell.open
    ├── icons/              # 占位图标（构建前用 npx tauri icon 生成全套）
    └── src/
        ├── main.rs         # 入口
        ├── lib.rs          # 窗口 + 命令：设备指纹/凭据存取/启动线上工作台（域名白名单）
```

## 首次构建（Windows 开发机）

```bash
# 前置：Node.js 18+、Rust stable、VS Build Tools（C++）、WebView2（Win10/11 自带）
cd desktop
npm install

# 生成全套图标（32x32.png → icons/）
npx tauri icon src-tauri/icons/icon.png

# 开发模式（本地窗口调试）
npm run dev

# 生产构建（NSIS 安装包 → src-tauri/target/release/bundle/nsis/Kunlun Desktop_0.1.0_x64-setup.exe）
npm run build
```

## 生产配置

- API 地址：`ui/index.html` 中 `API_BASE = 'https://aigc.fushtn.com'`（线上），
  本地调试改 `http://127.0.0.1:4002` 并在 `lib.rs` 白名单追加。
- 启动工作台：新 WebView 窗口打开 `https://aigc.fushtn.com/{workspaceEntry}`，
  加载后注入 `auth_token` 到 localStorage（复用现有 auth 双写机制）。
- 设备指纹：随机 uuid v4（掌柜冻结：禁 CPU/硬盘/MAC 序列号绑定）。
- 凭据存储：tauri-plugin-store → `credentials.json`（deviceId/deviceToken/accessToken）。

## 安全边界（Shell 专属）

| 项 | 实现 |
|---|---|
| 域名白名单 | `lib.rs::open_workspace` 仅允许 aigc.fushtn.com（+ 本地调试域） |
| 凭据 | store 持久化；accessToken 内存态；deviceToken 仅 heartbeat 用 |
| 吊销 | 60s 心跳轮询；服务端 allowed:false → 本地强制登出 |
| 更新 | 未来接 tauri-plugin-updater（ECO-11.4） |

## 冻结禁止（本 Sprint 不实现）

❌ 本地插件代码执行 ❌ 第三方代码加载 ❌ 本地 AI 推理 ❌ 支付系统修改 ❌ 工作台重构
