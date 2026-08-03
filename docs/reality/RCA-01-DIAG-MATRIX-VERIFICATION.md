# RCA-01 Diagnostic Matrix 真机验证清单（掌柜执行）

> **目标**：用三件套（A/B/C）在掌柜 Windows 真机跑一遍，拿到**确定性证据链**定位白屏发生在哪一层。
> **原则**：每件只做一件事——A 失败 ⇒ Tauri/WebView2/资源层；B 失败 ⇒ 前端框架层；C 失败 ⇒ 业务初始化层。
> 白屏定位后只允许补 P0（工作台失败降级页、离线状态页），不做其他扩展。

## 下载（内部测试仓，不进用户下载页）

构建完成后（GitHub Release `diag-1.1.1`）：

| 变体 | 文件 | 判定含义 |
|---|---|---|
| A | `KunlunMediaDiagA_1.1.1_x64-setup.exe` | 纯 HTML hello world：失败 ⇒ Tauri/WebView2/资源/CSP 层 |
| B | `KunlunMediaDiagB_1.1.1_x64-setup.exe` | Vue3 静态页：失败 ⇒ 前端框架层 |
| C | `KunlunMediaDiagC_1.1.1_x64-setup.exe` | 完整壳（含诊断模式）：失败 ⇒ 业务初始化层 |

## 测试步骤（按顺序，每件独立安装）

```
1. 安装 A → 双击 exe → 观察窗口
   期望：彩色 hello world 页面 + 无控制台报错
2. 卸载 A → 安装 B → 双击 → 观察
   期望：Vue 静态页（按钮可点、路由可切）
3. 卸载 B → 安装 C → 双击 → 观察
   期望：昆仑镜登录页（品牌色、输入框）
```

**每件都要跑诊断模式**（白屏时日志最有用）：

```
C 版：kunlun-desktop.exe --debug --diag
      （或用快捷方式目标加参数：右键快捷方式 → 目标末尾加 " --debug --diag"）
```

## 日志位置（C 版 + A/B 版同样生效）

```
%LOCALAPPDATA%\com.kunlun.desktop\logs\
├── startup.log    —— Tauri 启动时间线（总在写）
├── webview.log    —— 页面加载事件 STARTED/FINISHED（总在写）
├── api.log        —— 前端网络请求（--debug 时）
└── error.log      —— panic / JS 错误
```

## 判定矩阵（拿到日志后对照）

| 现象 | 日志特征 | 根因层 |
|---|---|---|
| A 白屏 | webview.log 无 STARTED / startup.log 卡 setup | Tauri/WebView2/资源 |
| A 白屏 | webview.log 有 STARTED 无 FINISHED | WebView2 加载挂起 |
| A 白屏 | error.log 有 JS 错误 | 资源/CSP |
| B 白屏但 A 正常 | — | 前端框架层 |
| C 白屏但 A/B 正常 | error.log 业务初始化错误 | 业务层 |
| 登录页正常、点应用白屏 | webview.log workspace 窗口 STARTED 无 FINISHED / 无记录 | 工作台窗口线上加载 |
| 一切正常 | startup.log 完整 + FINISHED | 真机无白屏 → 换场景（断网/首次安装） |

## 结果回传

```
打包 %LOCALAPPDATA%\com.kunlun.desktop\logs\ 整个目录 → 发给 OpenClaw
或贴 startup.log + webview.log + error.log 关键行
```

## 记录要点

1. 每件安装后的首屏现象（白屏/黑屏/正常/转圈）
2. 是否弹出 WebView2 错误页（黄色感叹号/证书错误/导航错误）
3. 断网启动 vs 联网启动差异
4. 日志文件时间戳（确认是本次运行产生）

---

## 附录 A：技术总监判定表（2026-08-04 05:15 定稿）

> 纪律：**禁止修改业务代码**。所有修改必须建立在诊断证据之后。diag-1.1.2 继续构建不阻塞三件套真机。

### 三层判定

| 结果组合 | 判定 | 排查层 |
|---|---|---|
| A 失败 | 不是 Vue/业务 | Tauri 配置 / WebView2 / CSP / Windows 环境 |
| A 成功 + B 失败 | HTML 可以，Vue runtime 有问题 | Vue hydration / JS bundle / CSP / asset path |
| A+B 成功 + C 失败 | 范围收窄到业务 | 登录 → Device → License → open_workspace → 线上工作台 |

### 嫌疑排序（技术总监补充）

1. **第一嫌疑：Workspace Token 注入生命周期**（跨 WebView 身份桥接）——token 注入太早 → 线上应用不知道用户是谁 → 跳转异常 → 白屏
   - 判定方法（diag-1.1.2 日志时间线，UTC ISO8601 毫秒级）：
     - `token inject begin/end` vs `page STARTED/FINISHED` 顺序
     - FINISHED 后出现 `NAVIGATE: */login*` → token 未生效（被清/太早）
     - FINISHED 后无 NAVIGATE 且 title 正常 → 渲染层
2. **第二嫌疑：Workspace 页面错误边界缺失**——线上页面报错（401/403/timeout/JS exception）但 Desktop 无「加载失败/请检查网络/重新登录」展示 → 白屏
3. **第三嫌疑：WebView2 环境**——概率低（登录 Shell 已能打开，基础环境大概率正常）

### 每件必录 5 项

1. 是否显示页面（白屏/黑屏/正常/转圈）
2. 启动日志 startup.log
3. WebView 日志 webview.log
4. error.log
5. api.log

---

## 附录 B：时间线判定标准（技术总监 2026-08-04 05:16 定稿）

diag-1.1.2 最有价值的数据是**时间线**（每条日志 UTC ISO8601 毫秒级），不是单个日志。

### 情况 1：Token 注入过早（高概率嫌疑）

```
T0 create workspace window
T1 token inject begin
T2 token inject end
T3 page STARTED
T4 page FINISHED
T5 NAVIGATE /login
```

**结论**：Workspace 加载成功，但身份桥接失败。修复方向（非业务改动）：调整生命周期为 `page ready → inject token → reload/auth bootstrap`。

### 情况 2：Token 正常但页面渲染失败

```
STARTED / FINISHED
无 /login 导航
title = 工作台
页面空白
```

**结论**：身份链可能正常。查：前端异常 / API 首屏数据 / workspace runtime error。

### 情况 3：Workspace URL 根本没成功加载

```
open_workspace
URL created
WebView created
（无 FINISHED）
```

**结论**：进入 WebView2 网络 / HTTPS / DNS / CSP / 代理环境排查。

### 真机回传仅需五项（不贴大量截图）

每版本：1. 是否显示 ｜ 2. startup.log ｜ 3. webview.log ｜ 4. error.log ｜ 5. api.log
尤其 C 版关键节点：`open_workspace` → `token inject` → `page FINISHED` → `navigate`

### 当前状态裁定（总监）

```
ECO-11.3 Local Runtime ✅
Release Artifact ✅
Desktop Shell Architecture ✅
RCA Diagnostic Framework ✅
白屏根因 ⏳ 等证据
业务修复 ❌ 暂停 / 功能扩展 ❌ 暂停 / 生态扩展 ❌ 暂停
```
