# RCA-02 Desktop Runtime Root Cause Audit — 启动链覆盖度审计

> **掌柜指令（2026-08-04 05:08）**：不要再修白屏现象，要证明白屏发生在启动链哪一层。
> Debug 思维 → Reliability Engineering 思维。只做诊断：❌ 业务代码 ❌ UI ❌ CSP 猜测 ❌ 新功能。
> 提交：`e47bfc66`（验证清单）+ 本文档（纯审计，零代码改动）

## 一、启动链 11 步覆盖度矩阵（Task 01 审计结论）

| # | 启动链步骤 | 覆盖 | 日志位置 |
|---|---|---|---|
| 1 | Process Start | ✅ | diag.rs `=== Kunlun Media startup ===`（含 version/os/arch/args/debug/diag） |
| 2 | Rust initialized | ✅ | lib.rs `tauri builder setup enter` |
| 3 | Window created | ✅ | lib.rs `creating main window` / `main window created` |
| 4 | WebView2 created | ✅（隐含） | 主窗口 build 成功 + page load STARTED |
| 5 | URL loaded | ⚠️ **仅主窗口** | on_page_load STARTED/FINISHED（主窗口） |
| 6 | DOMContentLoaded | ⚠️ 近似 | 前端 bootMark('0. html loaded')（script 执行，非事件本身） |
| 7 | JS bootstrap start | ✅ | bootMark('1. script executed') |
| 8 | Vue mount success | ⚠️ 壳原生 JS 无 Vue | 线上工作台（Nuxt）不可见，靠 api.log 推断 |
| 9 | API request/response | ✅ | api.log（前端 fetch 包装，--debug） |
| 10 | Login page rendered | ✅ | bootMark('5. view rendered: login/main/diag') |
| 11 | 工作台窗口加载 | ❌ **无任何日志** | 只有一行 `open_workspace -> url` |

## 二、关键缺口（按严重度）

### 🔴 GAP-1：工作台窗口（"workspace"）无加载日志
- **位置**：lib.rs `open_workspace` —— `WebviewWindowBuilder::new(&app, "workspace", ...).build()` **未挂 on_page_load**
- **后果**：白屏最可能场景（登录页正常 → 点工作台 → 白屏）发生后，日志只有 `open_workspace -> https://aigc.fushtn.com/...`，**无法区分**：URL 未开始加载 / 加载中挂起 / 加载完成但渲染失败 / token 注入失败
- **修复（diag-1.1.2，诊断埋点非业务）**：工作台窗口挂 on_page_load，记录 STARTED/FINISHED + URL

### 🟠 GAP-2：环境采集不完整（Task 03）
- **已有**：DiagStatus 含 os/arch/webview_version（注册表 pv 读取）
- **缺**：Windows 具体版本号（os 仅 "windows"）、显卡、杀毒软件、代理设置、语言区域
- **修复（diag-1.1.2）**：DiagStatus 加 windows_version（注册表 CurrentVersion/NT）、language；显卡/杀毒/代理走诊断页提示用户自查清单（代码侵入最小化）

### 🟠 GAP-3（审计发现，业务问题不修改）：token 注入时机
- **位置**：lib.rs open_workspace —— `build()` 后**立即** `webview.eval(token 注入)`
- **注释宣称**「页面加载完成后注入 token」但代码是 build 后立即执行（页面未 ready，eval 可能落空）
- **影响**：工作台窗口加载成功但 localStorage 无 token → 工作台显示未登录/白屏（候选根因之一）
- **处置**：RCA-02 不修改；GAP-1 日志就位后可用 api.log 实测验证（工作台窗口 api 请求是否带 token）

## 三、三件套判定矩阵（Task 02，diag-1.1.1 构建中）

| 结果 | 结论 | 下一步 |
|---|---|---|
| A 失败 | Tauri/WebView2/资源/CSP 层 | 环境采集（Task03）+ 系统 WebView2 修复 |
| A 成功 B 失败 | Vue 构建/框架层 | 检查 B 的 Vue 资源加载 |
| B 成功 C 失败 | 业务初始化层 | diag-1.1.2 完整日志细定位（GAP-1 埋点） |
| 全成功 | 壳本身无白屏 | 白屏在线上工作台窗口 → GAP-1/GAP-3 是定位关键 |

## 四、执行计划（严格诊断，零业务改动）

```
diag-1.1.1（构建中）→ 掌柜真机跑 A/B/C → 判定层级
        ↓
diag-1.1.2：GAP-1 工作台窗口埋点 + GAP-2 环境字段（纯诊断代码）
        ↓
掌柜复测白屏场景 → startup/webview/api/error 四日志完整证据链
        ↓
唯一根因定位 → 写 RCA-02 结论 → 掌柜批准后才动业务代码
```

## 五、路线（掌柜 05:08 冻结）

RCA-02 → Release-01.2 稳定安装包 → Task01 真机五轮 → AI内容运营经理 Reality → USER-CENTER
❌ 不进入 ECO-12 ❌ updater ❌ 商城 ❌ 生态扩展
⏸ SECURITY-DESKTOP-01（credentials.json 明文 token）单独 Sprint
