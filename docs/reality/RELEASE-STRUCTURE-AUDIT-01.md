# SPRINT-RELEASE-STRUCTURE-AUDIT-01 — Kunlun Media Desktop 发行物结构审计

> **掌柜 P0 指令（2026-08-04 04:58）**：不再围绕白屏打转。先做 Artifact Structure Review——
> 「Kunlun Media.exe 作为昆仑镜生态入口，这个封装结构是否符合长期产品架构？」
> 只回答结构问题，不改代码。

**结论先行：结构方向正确——是模式 B（Desktop Runtime Shell），不是模式 A（完整桌面应用），与掌柜判断一致。**
**但作为商业发行物有 4 个缺口：无自动升级 / 工作台加载失败无降级页 / 无离线状态页 / 凭据明文落盘。**

---

## Task 01 — 安装后目录树

本地为 Linux 沙箱，无法真机安装。以下为 **NSIS 解包实证 + tauri/NSIS 配置确定性推断**（真机 `tree /F` 验证命令附后）。

**tauri.conf.json 实证**：`installMode: "currentUser"`、`targets: ["nsis"]`、`bundle.resources` 未配置、无 updater 配置。

```
%LOCALAPPDATA%\Programs\Kunlun Media\        ← currentUser 模式（非 C:\Program Files）
├── kunlun-desktop.exe       7,853,568 B      ← 唯一业务文件（解包实证）
└── uninstall.exe                              ← NSIS 安装时生成
```

**注意**：
- ❌ 无 `resources/` —— bundle.resources 未配置，Tauri 不生成该目录
- ❌ 无 `icons/` / `locales/` —— 图标编译进 exe 资源段；NSIS 简体中文语言包编译进安装器，均不落盘
- ❌ 无 `updater/` —— **无升级机制**（见 Task 06-1）
- 前端资源不落盘 —— custom-protocol 嵌入模式（Task 03）

**真机验证命令**（待掌柜）：
```bat
tree /F "%LOCALAPPDATA%\Programs\Kunlun Media"
```

## Task 02 — exe 职责边界

Rust 侧全部命令（lib.rs 实证，共 8 个）：

| 命令 | 职责域 |
|---|---|
| generate_device_fingerprint | 设备管理（随机 UUID，禁硬件序列号） |
| save_credentials / get_credentials / clear_credentials | 本地身份/凭据 |
| open_workspace | 安全桥接（域名白名单 + 新窗口开线上工作台） |
| diag_status / diag_write / diag_read | 运行时诊断 |

**边界判定 ✅**：exe = Desktop Shell + 安全桥接 + 本地身份 + 设备管理 + 插件生命周期（前端调用云端 authorized-plugins/start/stop API）。
**不含**：业务逻辑 / AI 推理 / 工作台代码 / 数据库（代码零 DB 依赖，全部 HTTP API）。

## Task 03 — 资源边界

**Tauri embedded asset mode 确认 ✅**（ARTIFACT-AUDIT-01 已解压实证）：

```
exe 内嵌（brotli 压缩 5,782 B）
└── /index.html   ← 唯一前端资产，20,643 B 单文件（内联 CSS/JS）
```

无独立 `assets/ js/ css/` 文件。custom-protocol `tauri://localhost` 运行时解压提供。
⚠️ 特性：**壳内无任何工作台代码**——应用中心列表/插件状态均运行时从云端 API 拉取渲染。

## Task 04 — 本地数据目录

```
%APPDATA%\com.kunlun.desktop\              ← app_data_dir（Roaming）
└── credentials.json                        ← tauri-plugin-store，明文 JSON
    { device_id, device_token, device_fingerprint,
      access_token, user_name, organization_id }
%LOCALAPPDATA%\com.kunlun.desktop\logs\   ← app_log_dir（RCA-01 诊断器）
├── startup.log    （总是写）
├── webview.log    （总是写）
├── api.log        （--debug 时前端上报）
└── error.log      （panic + 前端 JS 错误）
```

**禁止项检查**：
- ✅ license 永久缓存：无（license 校验在云端，本地仅存 device_token 作心跳凭据）
- ✅ 用户密码明文：无（登录后只存 access_token）
- ✅ API KEY：无
- ✅ 插件代码：无（插件云端执行，本地仅授权状态视图）
- ⚠️ **access_token/device_token 明文 JSON 落盘**（tauri-plugin-store 无加密）—— 已知安全项，在 Security Sprint 冻结清单内

## Task 05 — 网络边界

**Desktop 启动后全部出网请求**（前端 index.html 实证 + CSP connect-src 实证）：

```
本地壳（embedded index.html）→ https://aigc.fushtn.com
  POST /api/auth/login
  GET  /api/ecosystem/applications
  POST /api/ecosystem/devices/register
  GET  /api/ecosystem/devices/me
  GET  /api/ecosystem/devices/{id}/authorized-plugins
  POST /api/ecosystem/devices/{id}/heartbeat
  POST /api/ecosystem/devices/{id}/plugins/{pid}/heartbeat|start|stop|uninstall

工作台窗口（open_workspace）→ https://aigc.fushtn.com 全业务域
  （工作台本体/Agent/插件中心全部在线上，窗口级独立加载）
```

- ✅ **桌面不直连数据库**（零 DB 代码）
- ✅ 域名白名单：仅 `https://aigc.fushtn.com` / `127.0.0.1:3000` 调试（lib.rs 实证）
- ✅ CSP：`connect-src 'self' https://aigc.fushtn.com 127.0.0.1:4002`
- 边界与掌柜允许清单 `/api/auth /api/device /api/license /api/plugin /api/application` 一致 ✅

## Task 06 — 产品架构判断

### 架构图（代码实证）

```
KunlunMedia.exe  ── 7.5MB 单二进制，0 业务资源落盘
│
├─ Identity Authority     登录桥 / access_token / user_name / organization_id
├─ Device Authority       随机指纹 → 云端注册 → device_token → 心跳续命
├─ License Authority      云端校验（本地无 license 缓存）
├─ Plugin Lifecycle       授权插件列表 + 本地运行时启停状态（ECO-11.3）
│
└─ open_workspace ──→ WebView2 新窗口 ──→ https://aigc.fushtn.com
                          Online Workspace（9 工作台入口 / AI 员工 / 素材库…）
                          KAOR Cloud Runtime（Agent/插件云端执行）
```

### 判定：**B — Desktop Runtime Shell**（与掌柜判断一致）

符合昆仑镜冻结原则 ✅：
- ✅ 本地 App 不执行第三方代码（壳零业务逻辑）
- ✅ 插件不携带本地代码（runtimeLocal 仅为声明状态，执行在云端）
- ✅ AI Runtime 云端执行（工作台窗口即云端 UI）
- ✅ 身份/设备/授权 Authority 收敛在壳 → 未来多端（macOS/Linux）可复用同一套 shell

### 5 个产品问题审计

| # | 问题 | 现状 | 判定 |
|---|---|---|---|
| 1 | 桌面壳版本升级机制 | **无**：Cargo.toml 无 tauri-plugin-updater，plugins={} 空，仅 NSIS 手动覆盖安装 | ❌ 商业缺口 |
| 2 | 工作台打开失败降级页 | 白名单拒绝 → Err 文案；**线上 URL 加载失败（断网/5xx）无监听无降级页**——workspace 窗口未挂 on_page_load/错误处理 | ❌ 缺口 |
| 3 | 用户知道进入在线工作台 | ✅ 应用列表明示「启动即打开线上工作台」+ 窗口标题「昆仑镜工作台」 | ✅ |
| 4 | 离线基础状态页 | 本地壳可离线渲染（登录页/壳 UI 在本地），但 refreshApps 失败仅 alert，**无专门离线状态设计** | ⚠️ 部分 |
| 5 | 插件中心从 Shell 承载 | ✅ 壳已承载设备状态/授权插件列表/本地运行时启停视图；安装/计费在线上工作台，结构可演进 | ✅ 方向正确 |

### 结论

**封装结构符合昆仑镜「桌面 Shell + 云端生态」战略方向，Authority 分层正确、网络边界干净、资源边界最小化（7.5MB 单文件）。**
商业发行前必修：**① 自动升级（updater）② 工作台窗口失败降级页 ③ 离线状态页 ④ 凭据加密存储（Security Sprint 清单）**。
四项均为结构级缺口，与白屏 RCA 独立——**建议先收白屏诊断证据（矩阵构建已完成），再排这四个结构补强**。

## 审计产物

- 报告：`docs/reality/RELEASE-STRUCTURE-AUDIT-01.md`
- 提交：无代码改动（纯审计）
- 前置证据：`docs/reality/RELEASE-ARTIFACT-AUDIT-01.md`（安装包解包 + 嵌入前端解压原文）
