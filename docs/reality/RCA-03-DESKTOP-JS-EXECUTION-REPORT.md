# RCA-03-DESKTOP-JS-EXECUTION-REPORT — WebView2 JavaScript Execution Audit

**Date:** 2026-08-04 07:10
**Gate:** 掌柜指令（发行链已证，白屏进入 Layer 1 执行环境；只诊断不修码；回答五问，不交修复）
**核心判定（服务器静态证据）：** 「浏览器内核没有执行 JS」**成立**——1.1.2 的 inline script 从未开始执行；「JS 执行了但应用自己挂了」**排除**。

---

## 五问直答

### 1. WebView2 版本？
- **配置层**（tauri.conf.json 已确认）：`webviewInstallMode: { type: downloadBootstrapper, silent: true }` → **Evergreen 模式**，启动时自动静默安装/更新最新 WebView2 Runtime，不依赖系统版本
- **实际版本**：待掌柜回传（命令见文末清单）——截图已有 CSS 渲染 → WebView2 已运行（不是未安装场景）

### 2. A/B/C 矩阵结果？
**零新构建**——RCA-01 的 diag-matrix 产物已在服务器（与 1.1.2 同时刻 05:30 构建、同 Tauri 壳同 WebView2 环境）：

| 变体 | 内容 | 测试点 | 产物（sha256） |
|---|---|---|---|
| A | 纯 HTML Hello World + **外部 JS**（diag-a.js） | HTML 加载 + 外部 JS 执行 | `KunlunMediaDiagA_1.1.0_x64-setup.exe` `64a58719...` |
| B | Vue 3 静态页（vue.global.prod.js + **inline script**） | **inline script 执行** + 框架层 | `KunlunMediaDiagB_1.1.0_x64-setup.exe` `55a74f2a...` |
| C | 完整业务壳（全 inline script） | 业务初始化层 | 1.1.2（掌柜已跑 = **白屏**） |

A/B 下载：`https://aigc.fushtn.com/releases/desktop/diagnostics/`（不进用户下载页，仅诊断）

### 3. JS 第一行有没有执行？
**没有。连 script 第一行都没执行。** 静态证据链（服务器侧，无需 Windows）：

```
1. asset JS 语法检查：node --check ✅（排除语法错误导致整块跳过）
2. script 结构：唯一一个 <script> 在 body @8100，无 defer/async/type=module
3. L53: probe('#00ff00'); // 脚本已执行  ← script 开头哨兵（probe 定义后立即调用）
4. probe() 动态创建 fixed 8x8 色块（深色 #0e0f1a 背景上极显眼）
5. 掌柜截图：任何探针（含绿色）零出现 → script 从未开始执行
6. 自洽闭环：window.onerror 未触发（无红色错误条）+ 登录视图默认 hidden（JS 未解除）
   + 探针 JS 动态创建（不存在）→ 截图 = script 未执行的完美预期
```

### 4. error.log 有没有异常？
**待掌柜回传**（`%LOCALAPPDATA%\com.kunlun.desktop\logs\` 四文件 startup/webview/api/error）。静态预测：error.log 大概率**无 JS 异常**——因为 script 未执行，window.onerror 无从触发；但 startup.log 可证 boot 步骤缺失（`[BOOT] 0. html loaded` 应为空）。

### 5. boot() 为什么没有把 hidden 解除？
**boot() 从未被调用。** boot() 在 script 最后一行 L473 直接调用（无 onload 包裹）；script 未执行 → boot() 未定义 → showLogin() 未调用 → `#view-login` 的 `hidden` 类未移除 → 登录界面不显示。CSS 背景色（静态）+ 空内容区 = 唯一可见结果。

---

## 判定矩阵（掌柜跑完 A/B 后，一锤定音）

| DiagA | DiagB | 结论 |
|---|---|---|
| ✅ 正常 | ✅ 正常 | WebView2 JS 正常；C 白屏 = 业务页特有 → 需 C 的 logs 终判 |
| ✅ 正常 | ❌ 白屏 | **inline script 不执行实锤**（掌柜 40% 嫌疑）→ Tauri asset 协议/CSP 对 inline 的运行时处理 |
| ❌ 白屏 | ❌ 白屏 | WebView2/环境级 JS 全灭（组策略/运行时损坏）→ 重装 WebView2 方向 |

注意 DiagA/B 与 1.1.2 同壳同时刻构建 → **对比完全同环境**，结果即答案。

## 掌柜动作清单（一次拿齐三证据）

```powershell
# 1) 下载并运行 DiagA（期望：Hello World + "JS 执行 OK（外部脚本）"）
#    https://aigc.fushtn.com/releases/desktop/diagnostics/KunlunMediaDiagA_1.1.0_x64-setup.exe
# 2) 下载并运行 DiagB（期望：Vue 静态页正常渲染 + 按钮可点）
#    https://aigc.fushtn.com/releases/desktop/diagnostics/KunlunMediaDiagB_1.1.0_x64-setup.exe

# 3) WebView2 版本（Task 01）
Get-ItemProperty "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue | Select-Object pv, name
Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" -ErrorAction SilentlyContinue | Select-Object pv, name

# 4) logs 四文件：%LOCALAPPDATA%\com.kunlun.desktop\logs\{startup,webview,api,error}.log
# 5) 已安装 exe sha256（交叉验证安装包身份）
Get-FileHash "$env:LOCALAPPDATA\Programs\Kunlun Media\kunlun-desktop.exe" -Algorithm SHA256
```

**冻结不变：不修 CSP / 不改 script / 不改 Tauri config / 不发版本。**
