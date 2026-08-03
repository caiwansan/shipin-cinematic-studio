# DESKTOP-JS-EXECUTION-BRANCH-PLANS — RCA-03 三分支执行预案

**Date:** 2026-08-04 07:30
**Gate:** 掌柜指令（A/B 结果前不修码；结果一出按分支启动，零等待）
**器材预验证:** ✅ DiagA/DiagB 已就绪（详见验证结论）

---

## 器材验证结论（掌柜开跑前完成）

| 验证项 | 结果 |
|---|---|
| 下载 URL 可达 | DiagA/DiagB 均 HTTP 200（nginx 直连） |
| sha256 与 sha256.txt 一致 | A=`64a58719...` B=`55a74f2a...` ✅ |
| NSIS 解包成功 | 均解出 kunlun-desktop.exe（7.9MB 级） |
| asset key 明文互斥 | DiagA: index.html+diag-a.js，**无** vue；DiagB: index.html+vue.global.prod.js，**无** diag-a.js → 构建矩阵精确正确 |
| git 源码 | desktop/diag/a（Hello World+外部JS）、diag/b（Vue+inline script）内容正确 |
| 同环境保证 | 三包同 Tauri 壳（2.11.5）同 05:30 构建同 WebView2 环境 → 对比有效 |

**结论：器材无瑕疵，掌柜跑即有效。**

---

## 分支 1：A✅ B❌ → DESKTOP-SHELL-EXECUTION-FIX-01（inline script 被阻断，掌柜 60%）

**证据链**：外部 JS 执行 OK（DiagA 正常）+ inline script 不执行（DiagB 白屏）+ 业务壳全 inline（C 白屏）
**核心嫌疑**：Tauri asset 协议对 inline script 的运行时处理（CSP 头注入 / nonce 注入 / script 标签重写）

**执行计划（诊断→修复→验证）**：
1. **T1 复现确认**：构建 C 变体 + 在 asset 上抓 Tauri 实际注入的响应头（CSP 头、X-Tauri-*、nonce）——用 WebView2 的 devtools 协议或日志（webview.log）
2. **T2 定位层**：三种 inline 形态对比构建（a=纯 inline 无外部 / b=inline+外部混合 / c=全部外部化）→ 精确到「inline 被拒」还是「inline+外部共存被拒」
3. **T3 修复候选（掌柜批准后实施，按优先级）**：
   - 首选：**外置 app.js**（业务 JS 全部外部化，与 DiagA 同构——DiagA 已验证外部 JS 可执行）
   - 备选：asset protocol 响应头审计修正（非 CSP 改法，是还原 Tauri 预期行为）
   - 兜底：调整 Shell 架构（多脚本拆分）
4. **T4 验证**：1.1.3 构建 → 掌柜真机 → G6 级验收（登录界面出现 + 探针五色全现）

## 分支 2：A✅ B✅ C❌ → SHELL-BOOTSTRAP-REALITY-FIX（业务页特有，掌柜 25%）

**证据链**：HTML/外部 JS/inline JS 全部正常（A/B 均成功）+ 业务壳白屏（C 失败）
**核心嫌疑**：C 的 script 内容执行后第一异常（boot 初始化 / invoke bridge / DOM 时序）
**注意**：与 RCA-03 静态结论（script 未执行）冲突 → **必须依赖 C 的 logs 终判**，若 logs 显示 script 未执行则矛盾 → 反查 C 与 A/B 的 asset 处理差异（CSP 修改配置只对 C 生效？`dangerousDisableAssetCspModification` 对 C 的 csp 字段处理）

**执行计划**：
1. **T1 logs 终判**：startup.log 有无 `[BOOT] 0. html loaded`；error.log 有无 JS 异常；webview.log 有无资源加载失败
2. **T2 差异审计**：C 与 A/B 的 tauri.conf.json diff（C 有 csp 字段 + dangerousDisableAssetCspModification，A/B 无）→ 若 A/B 无 csp 字段而 C 有 → **csp 字段本身就是变量**（即使理论 unsafe-inline 允许，运行时注入路径可审计）
3. **T3 修复**：按差异定位修正（可能是 csp 字段的运行时注入格式问题，或 script 内容特殊字符）
4. **T4 验证**：同分支 1

## 分支 3：A❌ B❌ → WINDOWS-WEBVIEW2-RUNTIME-REPAIR（环境级，掌柜 15%）

**证据链**：连纯 HTML+外部 JS 都不执行 → WebView2 引擎级故障
**执行计划**：
1. **T1 环境采集**：WebView2 注册表版本（Task 01 命令）+ Edge 组策略检查（`HKLM\SOFTWARE\Policies\Microsoft\Edge*`）+ 系统日志（Event Viewer WebView2 相关）
2. **T2 修复候选**：WebView2 Evergreen 修复重装（官方 bootstrapper）→ 若系统 Edge 策略禁用脚本则清策略
3. **T3 验证**：重装后 DiagA → Hello World → 再跑 1.1.2 业务壳

---

## 掌柜操作速查（跑完回传三样）

```powershell
# 1) DiagA 运行 → 期望「Hello World + JS 执行 OK（外部脚本）」
# 2) DiagB 运行 → 期望「Vue 静态页正常渲染 + 按钮可点」
#    下载: https://aigc.fushtn.com/releases/desktop/diagnostics/
# 3) 截图两张（A/B 各一）
# 4) WebView2 版本 + logs 四文件 + 已装 exe sha256（RCA-03 报告清单）
```

**判定：A/B 任一失败 → 直接看对应分支预案启动；双成功 → 分支 2 等 logs。**
