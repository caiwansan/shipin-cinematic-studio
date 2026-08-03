# SPRINT-RELEASE-ARTIFACT-AUDIT-01 — KunlunMedia-1.0.4.exe 发行物实锤审计

> **掌柜 P0 质疑（2026-08-04 04:52）**：安装包只有 1.9MB，「不符合一个完整桌面应用发行物的直觉」，怀疑是空壳 launcher。
> 指令：禁止修改代码，先证明 exe 里有什么。

**结论先行：1.9MB 是真实的完整 Tauri 应用，不是空壳。三个矛盾事实（单文件嵌入 ✅ / 白屏 ✅ / 1.9MB ✅）已统一：交付物完整，白屏是运行时问题，不是交付物缺失。**

---

## Task 01 — 安装包解包（NSIS）

`Kunlun.Media_1.0.4_x64-setup.exe`（2,026,345 B ≈ 1.93MB）解包：

```
Kunlun.Media_1.0.4_x64-setup.exe
├── $PLUGINSDIR/            # NSIS 插件（System/nsDialogs/nsis_tauri_utils/StartMenu/NSISdl）
└── kunlun-desktop.exe      # 7,853,568 B ≈ 7.5MB（PE32+ x86-64，6 sections）
```

安装器仅含主程序，**前端无独立文件**——符合 Tauri custom-protocol 嵌入模式（资源编入二进制，不是旁置文件）。1.93MB 安装包 = NSIS 压缩 7.5MB exe（Rust 静态链接 + 单文件前端 + 依赖系统 WebView2），**体积合理**。

## Task 02 — 二进制分析

- **Rust 壳**：`.text` 5MB 代码 + `.rdata` 2.2MB 数据，标准 Rust release 二进制
- **版本**：tauri 2.11.5（CI 构建，路径 `C:\Users\runneradmin\.cargo\registry\...`）
- **业务命令**（strings 实证）：`save_credentials / get_credentials / clear_credentials / generate_device_fingerprint / open_workspace`（device 注册体系）
- **插件**：tauri-plugin-store / shell / window / webview / app / menu / tray / path / image
- **无** Nuxt/Vue production bundle（无 `_nuxt` / `chunks` / `createApp`）——前端是手写单文件壳

## Task 03 — 前端产物检查（决定性证据）

通过解析 Tauri v2 embedded asset 表（phf map：`/index.html` → brotli 压缩流 5,782 B），**成功解压出嵌入的 index.html 全文 20,643 B**：

```
<!DOCTYPE html><html lang="zh-CN"><head>
<meta charset="UTF-8">
<title>昆仑镜 Kunlun Desktop</title>
...
```

与仓库 `8333c8c7:desktop/ui/index.html`（20,653 B）**内容一致**（差异仅为 tauri 序列化换行/`/>` 格式），**构建可复现** ✅

嵌入的前端是**功能完整客户端壳**，含：
- 登录页：`POST /api/auth/login` → aigc.fushtn.com（API_BASE 可被 `window.__KUNLUN_API__` 覆盖，默认生产域）
- 应用中心：`refreshApps()` 拉应用列表（9 工作台入口）
- Device 注册：fingerprint → `/api/ecosystem/devices/register` → device_token
- 插件授权状态 + 本地运行时（注释明标 ECO-11.3）
- 心跳吊销轮询 + logout 清凭据
- 视图：`view-login` / `view-main`（本地渲染）

## Task 04 — 运行时网络审计（代码级推断，真机验证待掌柜）

启动链路（boot()）：
```
无 token → showLogin()                    # 本地页面，无网络依赖
有 token → ensureDevice() → showMain()    # refreshApps/Plugins/Device 拉线上 API
点应用   → launchApp() → open_workspace   # 新 WebView 窗口打开线上工作台
```

Rust `open_workspace`（8333c8c7 lib.rs 实证）：
```rust
WebviewWindowBuilder::new(&app, "workspace", WebviewUrl::External(url))
    .title("昆仑镜工作台").inner_size(1440.0, 900.0).build()
```
域名白名单：仅 `https://aigc.fushtn.com` / `http://127.0.0.1:3000` / `http://localhost:3000`。

## Task 05 — 发行模式判定

**模式 B（桌面启动器）+ 本地登录/凭据壳的混合体，不是模式 A（离线完整应用）。**

```
KunlunMedia.exe
 ├─ 本地：登录页 + 应用中心列表 + Device/License 注册 + 凭据管理（WebView2 渲染本地嵌入页面）
 └─ 业务：open_workspace 新窗口打开线上 https://aigc.fushtn.com/workspace/...（WebView2 外部导航）
```

- 对「下载→安装→打开→看到昆仑镜桌面中心→进入 AI 员工」目标：**可接受**，前提是 WebView2 存在、网络可达、线上页面稳定
- 对「离线安装、本地拥有完整工作台」目标：**不满足**——工作台本体在线上

## 对白屏问题的重定位

**白屏有两个候选发生点，此前 v1.0.1~v1.0.4 的修补只覆盖了第一点：**

| 候选点 | 位置 | 证据需求 |
|---|---|---|
| ① 本地壳白屏 | 启动后 view-login/view-main 渲染失败 | 本地 index.html JS 异常（error.log）/ 页面未 FINISHED（webview.log） |
| ② 工作台白屏 | 登录后 open_workspace 窗口加载线上 URL 失败 | workspace 窗口的 webview.log URL 记录 / 网络可达性 |

RCA-01 诊断模式（14d7e8e3 已落地）的 `webview.log` 记录**两个窗口**的页面加载事件，`error.log` 记录两个窗口的 JS 异常——真机跑一次 `--debug --diag` 即可定位白屏发生在哪一层、哪个 URL。

## 审计产物

- 审计工作目录：`audit/v1.0.4/`（setup.exe / unpacked / 解出的嵌入 index.html）
- 嵌入前端原文：`/tmp/v104-embedded-index.html`（20,643 B）
- 提交：无代码改动（本 sprint 纯审计）
