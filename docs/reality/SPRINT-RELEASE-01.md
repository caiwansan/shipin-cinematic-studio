# SPRINT-RELEASE-01 Desktop Installer Reality

**Date:** 2026-08-04 01:00
**Gate（掌柜 2026-08-04 指令）:** 昆仑镜第一次进入「开发态 → 产品发行态」Reality Gate。ECO-01~11.3 证明生态操作系统成立；Release-01 要证明**生态产品可以交付给真实用户**。暂停 Task01 真机验收（验收入口不存在——没有 exe 就没有普通用户路径），先补 Distribution 一环。

## 核心结论（Reality Audit 实锤）

```
ECO-11.2 Desktop Shell ✅  →  ECO-11.3 Local Plugin Runtime ✅
        ↓
Release Pipeline ❌（desktop-release.yml 是 Electron 时代残留，从未构建过）
        ↓
Windows Installer ❌（无 target/bundle、无 exe、releases/desktop/ 仅旧 yml 残留）
        ↓
普通用户无法获得安装包 ❌
```

Task01 不是失败，是**验收入口不存在**。缺的是 SaaS 产品 vs 开发 Demo 的最后一公里：`.exe 发布链路`。

## 范围（只做一件事：让普通 Windows 用户拿到 Kunlun Media 1.0.0 exe）

❌ 新功能 ❌ 插件扩展 ❌ 商城 ❌ 用户中心 ❌ AI内容运营经理业务 ❌ 新平台

## Task 01：Windows Build Pipeline（✅ 已完成本地验证）
- `desktop-release.yml` 重写：Tauri v2 `windows-latest` 单 job（npm install → `tauri build` NSIS → scp 服务器）
- 版本管理：productName **Kunlun Media** / version **1.0.0**（tauri.conf/Cargo.toml/package.json 三处同步，提交 `bbfa8ebb`）
- 构建链路修复（提交 `7f451a7b`）：
  - lib.rs `url.parse::<tauri::Url>()`（E0282）+ `webview.eval()` 替代 `webview.webview()`（E0599，Tauri 2.11.5 API 变化）
  - 图标 RGB→RGBA + `icon.ico`（Windows 资源必需）+ `icon-1024.png`
  - 移除 unused import/variable，零 warning
- 本地 Linux Reality 验证：Rust 1.97.1（清华镜像）编译全通，kunlun-desktop release 6.1MB
- ⛔ **阻塞：GitHub 凭证失效**（HTTPS PAT Invalid + SSH publickey denied）→ 无法 push/触发 CI → exe 待凭证

## Task 02：Release Storage（✅ 已完成）
- 目录 `/www/wwwroot/aigc.fushtn.com/releases/desktop/`（nginx `try_files $uri @nuxt` 直服，零配置改动）
- `latest.json`（Tauri updater 格式：version/notes/pub_date/platforms.windows-x86_64.signature+url）公网 HTTP 200 已验证
- `README.md` 发布纪律：仅发布物落盘，签名私钥不落盘
- 待填：exe + signature（CI 产物）

## Task 03：下载入口（⏸ 等 exe 存在后做，防入口指向 404 假成功）
- 只加一个入口：首页「AI中心/应用中心/插件中心」→ 下载桌面版；或插件中心顶部「获取 Kunlun Media Desktop」
- 不做商城；入口解析 latest.json 取 url

## Task 04：安装包 Reality Gate（待 exe）

| Gate | 标准 |
| ---- | ---------------- |
| G1 | Windows 双击安装成功 |
| G2 | 无 Node/Rust 环境要求 |
| G3 | 开始菜单存在 |
| G4 | 登录成功 |
| G5 | Device 注册成功 |
| G6 | 工作台可打开 |
| G7 | AI内容运营经理插件入口存在 |
| G8 | **产品发行真实性**：无开发环境（无 Node/Rust/VS/源码/命令行）的普通 Windows 用户，只收到一个下载地址，可完成安装并启动 |

通过后 → Phase A Task01 真机五轮 → Task02 AI内容运营经理 Business Reality → USER-CENTER（用户中心依然不能提前做）

## 路线图（掌柜 2026-08-04 调整）

```
原：Task01 真机验收 → Task02 AI内容运营经理 Reality
改：Release-01 Desktop Installer → Task01 真机验收 → Task02 AI内容运营经理 Business Reality → USER-CENTER
```

## 架构结论（掌柜确认记录）
这次不是「缺安装包」这么简单，是昆仑镜第一次进入「开发态 → 产品发行态」的 Reality Gate。
- ECO-01~11.3 证明：**生态操作系统成立**
- Release-01 要证明：**生态产品可以交付给真实用户**
- 长期方案：GitHub Actions（Windows runner）为唯一发布管道——未来 exe 自动更新/插件更新/License 检查都依赖它；服务器 SSH/PAT 不作为长期方案

## 阻塞清单
- [ ] GitHub PAT（repo 权限）或 SSH deploy key（掌柜提供）→ push → Actions 出 exe
- [ ] exe 到位后：填 latest.json signature + 建 Task03 入口 + G1-G7 验收
