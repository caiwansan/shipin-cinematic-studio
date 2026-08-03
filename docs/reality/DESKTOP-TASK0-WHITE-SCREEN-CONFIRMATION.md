# TASK-0: 白屏窗口身份确认 — 判定 = 分支 A（Layer 1 Desktop Shell）

**Date:** 2026-08-04 06:20
**Sprint:** SPRINT-DESKTOP-AUTH-ARCHITECTURE-AUDIT-01 → Task 0（总监裁定：SESSION-EXCHANGE-01 启动前置条件）
**判定:** ⛔ **分支 A — Layer 1（Desktop Shell 自身未渲染）**；SPRINT-DESKTOP-SESSION-EXCHANGE-01 **不启动**
**证据来源:** 掌柜真机截图 `8B880421B25224427396C97B71BB9DD6_1785793838184_282fff.png`（1624x1127，150% DPI ≈ 1080x720 窗口）

---

## 1. 判定依据（截图像素级证据链）

### 1.1 窗口标题 = 「昆仑镜 Kunlun Desktop」（主 Shell 窗口）

- OCR（tesseract chi_sim+eng，3x 放大标题栏）：`Kunlun Desktop` + 窗口控制按钮 `_ 0 x`
- `desktop/ui/index.html` `<title>昆仑镜 Kunlun Desktop</title>` 精确匹配
- **不是「昆仑镜工作台」**（那是 open_workspace 创建的线上窗口，Layer 2）

### 1.2 内容区 = 深色空屏（CSS 已渲染，DOM 零内容）

- 主体背景色 `RGB(14,15,26)` = `index.html` `:root --bg: #0e0f1a` **逐字节匹配** → WebView2 已加载 HTML + CSS 生效
- 内容区 OCR 完全无文字（登录框/侧边栏/诊断视图均无）→ **登录/主/诊断三视图全部保持 `hidden`**
- 非背景像素仅 9.45%，均为灰色窗口装饰 → 无任何 UI 元素

### 1.3 前端 JS 零执行（决定性）

- RCA-01 诊断探针（脚本顶层同步执行 `probe('#00ff00')` 等 5 色 8x8 块，左上角排布）：**绿/黄/青/品红/红全部零出现**
- JS 执行路径：脚本顶层 probe → boot() → get_credentials invoke → showLogin/showMain → 探针逐个点亮
- 探针全灭 = 脚本第一行未执行 → `boot()` 未运行 → 三个 `hidden` 视图永不显示 → 深色空屏
- **此证据与发行包是否含探针无关**：即便旧版无探针，JS 正常执行必然显示登录视图（含「登录昆仑镜账号」等文字），OCR 不可能全空

## 2. 已排除项

| 嫌疑 | 结论 |
|---|---|
| token 注入竞态（open_workspace eval） | ❌ 无关——那是「昆仑镜工作台」窗口（Layer 2）；本截图是主 Shell 窗口 |
| CSP 配置禁内联脚本 | ❌ tauri.conf.json `script-src 'self' 'unsafe-inline'` 允许 |
| JS 语法错误 | ❌ `node --check` 通过（20813 字符，无语法问题） |
| 构建链路（frontendDist） | ❌ `frontendDist: "../ui"` 正常，CSS 渲染证明资源已加载 |
| 页面未加载 | ❌ CSS 生效证明 index.html 已加载 |

## 3. 剩余断点（下一层二分）

WebView2 页面加载完成但前端脚本未执行。需要 `%LOCALAPPDATA%\com.kunlun.desktop\logs\`（Rust 侧 on_page_load 埋点默认写入，无需 --debug）：

| webview.log 证据 | 判定 | 方向 |
|---|---|---|
| 有 `page load FINISHED` + startup.log 无前端 `[BOOT]` | 页面加载完成，JS 执行层被阻断 | **CSP 执行层最大嫌疑**：Release-01.3 历史（CSP3 下 unsafe-inline 被 hash 覆盖）；01.4 用 `dangerousDisableAssetCspModification:true` 绕开，需确认 1.1.2 发行包实际生效（Tauri 2.11.5 行为） |
| 无 `page load FINISHED` | 页面加载中断 | 资源协议/加载层（asset 协议、WebView2 Runtime 版本） |
| 有前端 `[BOOT]` 步骤 | JS 已执行 | 截图时机问题 → 等 5 秒再截一张 |

## 4. 执行结论（冻结）

- ⛔ **SPRINT-DESKTOP-SESSION-EXCHANGE-01 不启动**（Layer 2 方案，非当前问题）
- ⛔ 不改 token 注入 / 不改 CSP / 不改 index.html / 不发新版本
- ✅ 进入 Layer 1 排查：WebView2 Runtime / asset 加载 / CSP 执行层 / Windows 环境
- 下一证据：掌柜打包 logs 四文件 + （可选）启动后等 5 秒再截一张

---

## 5. 离线核查（logs 到达前先行缩小，Tauri 2.11.5 源码级）

### P0-1 CSP 执行层 — 源码配置理论正确（嫌疑降级）
- `tauri-2.11.5/src/manager/mod.rs`：`dangerous_disable_asset_csp_modification.can_modify("script-src")` → 仅当允许修改才做 nonce/hash 替换
- `tauri-utils-2.9.3/src/config.rs:2507`：`Flag(f) => !f` —— 配置 `true` → `can_modify=false` → **不注入 nonce/hash** → CSP 原样（`script-src 'self' 'unsafe-inline'`）→ 内联 JS 应被允许
- 前提：**发行包 tauri.conf.json = 源码**（未被旧缓存/旧配置覆盖）→ 归入 P0-3 验证

### P0-2 WebView2 脚本协议层 — 理论正常（嫌疑降级）
- `src/protocol/asset.rs`：MIME 由魔数+扩展名检测（`MimeType::parse`），HTML → text/html，无异常路径
- 单文件内联 shell（无外部 JS/CSS）→ 无构建时 hash 注入干扰

### P0-3 构建产物不一致 — **升级头号嫌疑** ⭐⭐⭐⭐⭐
- 「1.1.2」**无任何版本定义**：git tags 仅到 v1.0.4；Cargo.toml=1.1.0 / tauri.conf.json=1.1.0 / package.json=1.0.4 三处不一致
- 本地 releases 目录 = 1.0.0 占位符（2026-06-04，Electron 时代）；publish.sh 为旧 Electron 脚本；Tauri 构建走 build.sh，但 1.1.2 构建过程/产物不在仓库可溯
- **发行包溯源断链**：无法从源码验证 1.1.2 内嵌的 tauri.conf.json / ui/index.html 内容

### logs 30 秒定案清单（掌柜动作）
1. `startup.log` 首行 `version=` → 对照 1.1.2（不一致 = P0-3 实锤）
2. `webview.log` 有无 `page load FINISHED`（无 = 加载中断；有 = 进入 JS 执行层）
3. `startup.log` 有无前端 `[BOOT]` 行（有 = JS 已执行，截图时机问题）
4. `error.log` 有无 `JS ERROR` / `PANIC`（有 = 直接定根因）
