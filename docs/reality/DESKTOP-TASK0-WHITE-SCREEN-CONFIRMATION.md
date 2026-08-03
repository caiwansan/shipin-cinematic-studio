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
