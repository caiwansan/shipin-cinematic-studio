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
