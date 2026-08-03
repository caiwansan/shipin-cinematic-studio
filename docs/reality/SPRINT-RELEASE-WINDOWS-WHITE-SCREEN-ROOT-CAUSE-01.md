# SPRINT-RELEASE-WINDOWS-WHITE-SCREEN-ROOT-CAUSE-01

> **掌柜 P0 指令（2026-08-04 04:37）**：Kunlun Media.exe 白屏属于 Release Reality Gate P0 阻断。
> **禁止**：猜 CSP / 猜资源嵌入 / 猜 WebView2 / 修改多个变量同时验证 / 连续发布 v1.0.x 热修。
> **目标**：找到普通 Windows 用户环境下白屏的**真实根因**，先建立诊断证据链。

---

## 1. 为什么停止打补丁

前三轮（v1.0.1→v1.0.4）每轮都有新发现，但没有一层层排除：

| 轮次 | 猜测 | 结果 |
|---|---|---|
| v1.0.1 | CSP 拦截内联脚本 + 缺 withGlobalTauri | 修了，仍白屏 |
| v1.0.3 | 资源未嵌入（custom-protocol feature 缺失） | 修了，仍白屏 |
| v1.0.4 | CSP3 nonce/hash 覆盖 unsafe-inline | 修了，仍白屏 |

**关键缺失**：没有任何一次拿到真实 Windows 运行时错误（Event Viewer / WebView2 console / 前端 runtime exception / 网络请求失败 / 启动 trace）。白屏可能发生在任何一层：

```
双击 exe → Tauri Runtime → WebView2 初始化 → 加载 index.html
→ HTML/CSS 渲染 → JS 执行 → API 请求 → 登录状态初始化 → 页面渲染
```

不知道失败在哪一层，任何修复都是碰运气。

---

## 2. 交付内容

### Task 01 — Desktop Runtime Diagnostic Mode ✅（代码完成，本地验证）

启动方式：

```
KunlunMedia.exe --debug        # 详细诊断（api.log 网络记录 + 悬浮诊断按钮）
KunlunMedia.exe --diag         # 强制诊断 Shell（跳过全部业务）
KunlunMedia.exe --debug --diag # 两者兼得
```

日志目录（默认总是写入，不依赖参数）：`%LOCALAPPDATA%\com.kunlun.desktop\logs\`

| 文件 | 内容 | 来源 |
|---|---|---|
| `startup.log` | Tauri 层启动时间线（app start / log_dir / 窗口创建）+ 前端 BOOT 五步 | Rust + 前端上报 |
| `webview.log` | 页面加载事件（STARTED/FINISHED + URL）+ open_workspace 记录 | Rust on_page_load |
| `api.log` | 全部 fetch 请求（方法/URL/状态/耗时） | 前端 fetch 拦截 |
| `error.log` | JS 异常（window.onerror/unhandledrejection）+ 网络失败 + Rust panic | 前端 + panic hook |

**Rust 侧**（`desktop/src-tauri/src/diag.rs`）：
- 四分区日志文件、同步 flush、section 白名单
- `install_panic_hook()`：进程崩溃堆栈也写 error.log（不依赖 app 状态）
- 主窗口显式创建 + `on_page_load` 记录页面加载（conf `create:false` 防重复）
- 新增命令：`diag_status`（环境/版本/WebView2 版本/模式）/ `diag_write` / `diag_read`

**前端侧**（`desktop/ui/index.html`）：
- `window.onerror` / `unhandledrejection` → error.log + 白屏红条（保留）
- fetch 全局包装 → api.log（CSP/网络层证据）
- BOOT 五步（纯壳对等映射，`[BOOT]` 前缀写 startup.log）：
  ```
  [BOOT] 0. html loaded
  [BOOT] 1. script executed
  [BOOT] 2. dom ready / api client ready
  [BOOT] 3. tauri bridge OK（diag_status）
  [BOOT] 4. 业务初始化（或 diag shell skip）
  [BOOT] 5. view rendered（login/main/diag）
  ```

### Task 02 — 脱离业务验证 Shell ✅（融合进 --diag 视图）

`--diag` 启动直接进入诊断视图（`desktop/ui/index.html` 内 `#view-diag`）：
- 三状态卡：**Tauri Runtime**（invoke 桥）/ **WebView2**（页面加载）/ **Frontend**（HTML/CSS/JS）
- 环境信息：app 版本 / OS / arch / WebView2 版本（注册表）/ 日志目录 / BOOT 步骤
- 四日志查看器（tab 切换）+ 📋 复制诊断报告（JSON 一键带走）
- **不加载**：登录 / API / License / Device / Plugin（boot 直接 return）

### Task 03 — Windows 真机采集 ✅（脚本就绪，待掌柜真机执行）

`scripts/windows-diag-collect.ps1`（右键 PowerShell 运行）：
1. WebView2 Runtime 版本（`HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients` 三条路径）
2. Windows 事件日志（Event ID 1000/1001 应用崩溃 + WebView2/msedgewebview2 关键字）
3. `%LOCALAPPDATA%\com.kunlun.desktop\logs\` 全部日志
4. OS/安装目录/Edge 版本参考
5. 打包 `kunlun-diag-<时间戳>.zip` 到桌面

### Task 04 — 构建矩阵 ✅（CI workflow 就绪，待触发）

`diag-*` tag 触发 `.github/workflows/diag-matrix.yml`，矩阵三件套（同一 Tauri 壳，不同前端）：

| 版本 | 前端 | 失败 ⇒ 结论 |
|---|---|---|
| **A** KunlunMediaDiagA | 纯 HTML hello world（外部 JS 检测） | Tauri/WebView2/资源嵌入/CSP |
| **B** KunlunMediaDiagB | Vue 3 静态页（按钮 + hash 路由） | 前端框架层 |
| **C** KunlunMediaDiagC | 完整 Kunlun Media（含诊断模式） | 业务初始化层 |

判定矩阵：`A失败 → 壳层`；`A成功B失败 → 框架层`；`B成功C失败 → 业务层`。

产物 → GitHub Release（中间仓）→ `scripts/fetch-diag-matrix.sh` 拉取 → `aigc.fushtn.com/releases/desktop/diagnostic/`（**不进用户下载页**）。

### Task 05 — 产品验收重新定义 ✅（见 R0-DESKTOP-SHELL-REALITY.md）

G3 从「下载 exe → 白屏 → 修」改为五步验收：**安装 → 启动 → 看到诊断页 → 进入登录 → 进入工作台**。

---

## 3. 本地验证记录（Linux，custom-protocol 嵌入模式）

```
[2026-08-03T20:44:05.418Z][startup] === Kunlun Media startup === version=1.1.0 os=linux arch=x86_64 args=["./target/release/kunlun-desktop", "--debug", "--diag"] debug=true diag=true
[2026-08-03T20:44:05.418Z][startup] log_dir=/root/.local/share/com.kunlun.desktop/logs
[2026-08-03T20:44:05.418Z][startup] tauri builder setup enter
[2026-08-03T20:44:05.418Z][startup] creating main window label=main size=1080x720
[2026-08-03T20:44:05.568Z][startup] main window created label=main title=昆仑镜 Kunlun Desktop
[2026-08-03T20:44:05.568Z][startup] setup done — waiting for frontend BOOT handshake
[2026-08-03T20:44:06.205Z][webview] page load STARTED: tauri://localhost
[2026-08-03T20:44:06.219Z][webview] page load FINISHED: tauri://localhost
```

✅ 编译零错误（release + custom-protocol）｜✅ 启动时间线完整｜✅ 页面加载事件记录｜
⚠️ 已知限制：本地 WebKitGTK 不执行 JS（历史环境问题），BOOT 上报/前端日志需 Windows 真机验证。

---

## 4. 掌柜真机测试步骤

```
1. 下载诊断矩阵三件套（A/B/C 安装包）：
   https://aigc.fushtn.com/releases/desktop/diagnostic/
2. 依次安装并启动：
   ① 装 A → 启动 → 应看到 "Hello World" + "JS 执行 OK"
   ② 装 B → 启动 → Vue 页 + 按钮 +1 + 路由切换
   ③ 装 C → 启动 → 正常界面；若白屏执行下一步
3. 白屏时命令行收集日志：
   "C:\Users\<你>\AppData\Local\KunlunMediaDiagC\KunlunMediaDiagC.exe" --debug --diag
   （或开始菜单快捷方式目标后加 --debug --diag；诊断版 C 会直接进诊断页）
4. 运行采集脚本 scripts/windows-diag-collect.ps1 → 桌面 zip → 发回
```

**白屏判定**（按真实证据分层）：
- startup.log 写到哪一步断了 → 断点即根因层
- webview.log 有无 FINISHED → WebView2 是否完成加载
- error.log 有无 JS 异常 → 前端层证据
- api.log 有无请求 → 网络/API 层证据
- Event Viewer 有无 1000/1001 → 进程级崩溃证据

---

## 5. 提交

- `desktop/src-tauri/src/diag.rs`（新）— 诊断器
- `desktop/src-tauri/src/lib.rs` — 诊断接入 + 显式窗口 + 命令
- `desktop/src-tauri/tauri.conf.json` — create:false + version 1.1.0
- `desktop/src-tauri/Cargo.toml` — version 1.1.0
- `desktop/ui/index.html` — 诊断管线 + BOOT 五步 + 诊断视图
- `desktop/diag/a/*` `desktop/diag/b/*` — 矩阵变体 A/B
- `.github/workflows/diag-matrix.yml` — 矩阵 CI
- `scripts/fetch-diag-matrix.sh` / `scripts/windows-diag-collect.ps1` — 部署/采集
- `docs/reality/R0-DESKTOP-SHELL-REALITY.md` — 验收矩阵
