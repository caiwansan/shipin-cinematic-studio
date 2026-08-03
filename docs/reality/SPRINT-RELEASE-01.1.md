# SPRINT-RELEASE-01.1 Kunlun Desktop Artifact Repository

**Date:** 2026-08-04 02:11
**Gate:** 掌柜方向确认（2026-08-04 02:11）：**GitHub 只作为开发构建链，不作为用户下载入口。昆仑镜必须拥有自己的 Desktop Artifact Repository，用户始终从昆仑镜官网下载应用。**

## 战略调整

```
之前：GitHub Release = 下载入口 ❌
现在：GitHub = 构建工具（内部中间仓，用户不可见）
     用户下载入口 = Kunlun Mirror Artifact Repository（aigc.fushtn.com）✅
```

原因：① 国内部分用户无法访问 GitHub ② 昆仑镜需要形成自己的产品闭环 ③ Desktop App 属于昆仑镜生态资产

用户链路：
```
用户 → aigc.fushtn.com → 昆仑镜下载中心 → Kunlun Media.exe → 安装 → 登录昆仑镜 → Device 注册 → License 校验 → AI员工插件运行
```

## 严格范围
✅ Desktop 安装包存储 / 下载 API / 版本管理 / latest.json / Tauri updater 支持 / 下载页面入口
❌ GitHub 下载入口 / 用户看到 GitHub 地址 / 新商城 / 支付系统 / 插件扩展 / 用户中心 / 新工作台改造

## Task 01 — Artifact Storage ✅
- 目录：`/www/wwwroot/aigc.fushtn.com/releases/desktop/{windows,signatures}`
- nginx：`location ^~ /releases/`（autoindex off 防目录列表 + octet-stream + X-Content-Type-Options + 仅 exe/msi/zip 加 attachment 下载语义）
- 验证：目录请求 404（不暴露结构）/ latest.json 200 JSON（无 attachment）/ exe 200 + attachment ✅
- **关键发现：本机（VM-16-10-opencloudos）就是 aigc.fushtn.com 服务器本体**（daily-audit.sh 全本机路径），无需 SSH

## Task 02 — Release Metadata ✅
- `latest.json`：掌柜结构（product/version/platform/downloadUrl/publishedAt/signature）+ 完整性命名字段（sha256/size/notes）+ Tauri updater 兼容块（platforms.windows-x86_64.{signature,url}）
- 下载 URL：相对路径 `/releases/desktop/windows/KunlunMedia-<version>-setup.exe`（同域 aigc.fushtn.com）
- 校验文件：`signatures/KunlunMedia-<version>-setup.exe.sha256`（sha256sum 格式）
- exe 命名规范化：`KunlunMedia-1.0.0-setup.exe`（CI 原始名 Kunlun.Media_1.0.0_x64-setup.exe）
- 预留：windows/macos/linux 目录（本 sprint 只 Windows）

## Task 03 — Build Pipeline ✅
- GitHub Actions 继续作为构建链（**构建工具，非下载平台**）
- `push tag v*` 触发：build-windows（tauri build NSIS）→ publish（GitHub Release 中间仓）→ **服务器 fetch-desktop-release.sh 拉取 → 昆仑镜仓库**
- 无 token 约束下的最优解：GitHub Release 仅作中间产物仓（用户不可见）；将来有服务器上传凭证可演进为 CI 直接上传
- 踩坑修复：publish 失败 = GITHUB_TOKEN 默认 read-only → workflow 顶层 `permissions: contents: write` ✅

## Task 04 — 下载入口 ✅（已部署上线）
- 新页 `frontend/pages/download/desktop.vue`：`/download/desktop`
  - 产品信息卡（版本/大小/更新时间实时读 latest.json）
  - 下载按钮 → `/releases/desktop/windows/KunlunMedia-<version>-setup.exe`
  - 三步说明（下载→安装→启动）+ SHA256 展示
  - **零 GitHub 字样**，域名仅 aigc.fushtn.com
- 导航入口：`config/navigation.ts` primaryNav 新增「⬇️ 下载桌面版」→ /download/desktop
- 上线验证（2026-08-04 02:40）：页面 HTTP 200 + DOM 断言「下载 Kunlun Media 1.0.0」「Windows 10 / 11」「1.9 MB」（latest.json 实时数据渲染）+ 截图 `RELEASE-01.1-download-page.png`

## Task 05 — Reality Gate
| Gate | 状态 |
|------|------|
| G1 Artifact（服务器真实 exe + HTTP 200 + 大小>0 + hash 正常） | ✅ PASS（2,017,595 bytes + sha256 6434eb61…） |
| G2 下载 Reality（普通浏览器无登录下载 exe 成功） | ✅ PASS（完整下载 + hash 与 latest.json 一致 + attachment 语义） |
| G3 安装 Reality（无 Node/Rust 普通 Windows 双击安装启动） | ⏳ 待掌柜真机 |
| G4 Identity Reality（User→Org→Device→LocalApp） | ⏳ 待真机（Device 注册链路已存在于 ECO sprint） |
| G5 License Reality（ACTIVE→运行→EXPIRED→停止→Renew→恢复） | ⏳ 待真机 |
| G6 Plugin Reality（AI内容运营经理：安装→授权→启动→工作台） | ⏳ 待真机 |
| G7 Product Reality（下载→安装→登录→使用） | ⏳ 待真机 |
| G8 Distribution Reality（无开发环境国内普通用户仅访问官网完成安装启动） | ⏳ 待真机 |

## 架构原则冻结（已写入 AGENTS.md）
```
Desktop Distribution Rule:
GitHub is internal build infrastructure only.
All end-user application downloads MUST be served through Kunlun Mirror Artifact Repository.
No user-facing GitHub download dependency.
```

## 当前发布状态
- CI 全链路 success：`v1.0.0`（build-windows ✅ publish ✅）
- GitHub Release v1.0.0 资产：Kunlun.Media_1.0.0_x64-setup.exe（1.9MB，中间仓）
- 昆仑镜仓库：`https://aigc.fushtn.com/releases/desktop/windows/KunlunMedia-1.0.0-setup.exe` ✅

## 待掌柜
1. 前端部署完成后浏览器验证 `/download/desktop` 页面
2. 真机下载 → 安装 → 启动（G3）
3. 真机登录 → Device 注册 → License 校验 → 插件运行（G4-G6）
4. 国内普通用户全链路（G8）
