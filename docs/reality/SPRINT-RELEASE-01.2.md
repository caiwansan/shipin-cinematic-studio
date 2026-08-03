# SPRINT-RELEASE-01.2 Desktop Startup Reality Fix — COMPLETE ✅

**Date:** 2026-08-04 02:50
**Gate:** 掌柜真机反馈（G3 阻塞）：安装成功但打开空白页面。第一次真实用户路径抓出的 P0。**只修启动白屏，生态代码/License/Plugin/工作台零修改。**

## 白屏根因（三重证据链）

### Diagnostic 03 → tauri.conf.json 检查
```
"build": { "frontendDist": "../ui" }   ← 单文件壳（ECO-11.2 设计，非 Nuxt）
"app.security.csp": "default-src 'self'; connect-src ...; style-src ... 'unsafe-inline'"
```
- `desktop/ui/index.html` = 18KB 自包含应用（唯一 `<script>` 是第 96 行**内联脚本**，三个视图默认全 `hidden`，JS 运行后才 showLogin/showMain）
- CSP 无 `script-src` → 继承 `default-src 'self'` → **内联脚本必被拦截**

### Diagnostic 02 → 本地复现（同一 CSP 头 + Chrome）
```
"Executing inline script violates the following Content Security Policy directive
 'default-src 'self'' ... The action has been blocked." (source: line 96)
→ DOM: view-login / view-main 全部保持 hidden → 白屏
```
**对照组**：加 `script-src 'self' 'unsafe-inline'` → `view-login` hidden 被 JS 移除 → 界面恢复 ✅

### 第二缺陷（CSP 修复后的隐藏杀手）
- index.html: `isTauri = !!(window.__TAURI_INTERNALS__)`（WebView 恒 true）→ `window.__TAURI__.core.invoke(...)`
- **Tauri v2 全局 API 需 `withGlobalTauri: true`**（未配置 → `__TAURI__` undefined → ReferenceError）
- `boot()` 无 try/catch 包裹 `invoke('get_credentials')` → boot 中断 → showLogin 永不执行 → 依旧白屏

### Diagnostic 01 → 产物级铁证（strings 对比 exe 二进制）
| 版本 | 二进制内 CSP | 结果 |
|------|-------------|------|
| 1.0.0 | `default-src 'self'`（无 script-src） | 白屏 |
| 1.0.1 | `default-src 'self'; script-src 'self' 'unsafe-inline'; ...` | 修复 ✅ |

## 修复（提交 `86345e0a` + `f3971615`，2 文件）
`desktop/src-tauri/tauri.conf.json`：
1. `"csp"` 增加 `script-src 'self' 'unsafe-inline'`
2. `"app": { "withGlobalTauri": true }`
3. version 1.0.0 → 1.0.1（desktop/package.json 同步）

## 构建链附带修复（提交 `f3971615`）
- `fetch-desktop-release.sh`：资产选择按 `_{version}_` 精确匹配（原取第一个 .exe，字母序 1.0.0 排在 1.0.1 前会拉错）
- `desktop-release.yml`：build 后清理 bundle 目录（Cargo 缓存命中时旧版本 exe 残留 → 多资产污染 Release）+ publish 前 `gh release delete --cleanup-tag`（幂等重发布）

## Reality Gate 复验
| Gate | 状态 |
|------|------|
| G1 Artifact | ✅ 2,026,222B + sha256 68f97605…（1.0.1 新产物） |
| G2 Download | ✅ 完整下载 + hash 与 latest.json 一致 + attachment |
| G3 Install/Startup | ⏳ **待掌柜真机重测**（v1.0.1） |
| G4-G8 | 未开始（按掌柜指令暂停，G3 通过前不推进） |

## 诊断方法沉淀（下次白屏类问题直接用）
1. **tauri.conf.json 三查**：frontendDist 指向存在？CSP 是否拦内联脚本（无 script-src 且页面用内联脚本 = 必白屏）？withGlobalTauri 是否开启（页面用 `window.__TAURI__` 时必配）？
2. **本地复现**：HTTP server 带相同 CSP 头 + chrome headless `--enable-logging=stderr` 抓 `Refused/blocked` + `--dump-dom` 验证视图 hidden 状态
3. **产物验证**：7z 解 NSIS 包 → `strings kunlun-desktop.exe | grep 'script-src'`（CSP 编译进二进制，可对比新旧版本）
4. Tauri v2 将 frontendDist **嵌入二进制**（NSIS 包内无独立 resources/ 目录属正常）

## 经验教训
- **Tauri v2 默认 CSP 陷阱**：`default-src 'self'` 下内联脚本全灭——单文件壳应用必须显式 `script-src 'unsafe-inline'`（或改用外部脚本 + hash）
- **Tauri v2 全局 API 陷阱**：`window.__TAURI__` 需 `withGlobalTauri: true`；`__TAURI_INTERNALS__` 恒存在但只是 IPC 内部
- 1.9MB 小安装包正常（Tauri v2 前端资源嵌入二进制 + WebView2 引导下载模式）

## 待掌柜
1. 下载 v1.0.1 重装：`https://aigc.fushtn.com/releases/desktop/windows/KunlunMedia-1.0.1-setup.exe`
2. 双击启动 → 应看到**登录界面**（非白屏）
3. 反馈：登录界面出现？登录昆仑镜账号是否成功？
