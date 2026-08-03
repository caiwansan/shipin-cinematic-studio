# R0 Desktop Shell Reality — 桌面发行验收矩阵

> **掌柜 2026-08-04 定调**：昆仑镜已从「开发环境」进入「用户发行环境」。
> 以前「后端 API 200 + 浏览器访问正常 = 产品正常」；现在「普通用户双击 exe 能看到界面 = 产品正常」。
> 发行阶段切换到 **Desktop Reality Engineering**，不能用 Web 项目调试习惯。
> 本验收矩阵替代旧 G3「下载 exe → 白屏 → 修」的修补循环。

---

## 验收链路（五步，全部通过 = R0 PASS）

```
R0.0 普通 Windows 电脑
  ↓
R0.1 安装（双击 setup，无开发环境）
  ↓
R0.2 启动（看到诊断页/界面，非白屏）
  ↓
R0.3 进入登录
  ↓
R0.4 进入工作台
```

| 步 | 验收点 | 通过标准 | 失败时的证据要求（不修，先取证） |
|---|---|---|---|
| R0.1 | 安装 | 双击安装成功、开始菜单/快捷方式出现、无杀毒拦截或可说明 | 安装日志截图、杀毒软件名 |
| R0.2 | 启动 | 窗口出现且**渲染内容**（诊断页或正常界面），非纯白/黑屏 | `--debug --diag` 启动 + 采集脚本 zip（logs + Event Viewer + WebView2 版本） |
| R0.3 | 登录 | 登录页可见可输入，登录成功进入主界面 | error.log + api.log |
| R0.4 | 工作台 | 启动线上工作台窗口，业务页面可见 | webview.log + 工作台截图 |

## 白屏分层判定（RCA 证据链）

```
双击 exe
 │
 ├─ startup.log 无任何记录        → Rust 层未启动（缺 VC++ runtime / 被杀毒拦 / 双击未生效）
 ├─ startup.log 有，webview.log 无 → WebView2 初始化失败（Runtime 缺失/损坏/版本过低）
 ├─ webview.log 无 FINISHED       → 页面加载中断（资源嵌入损坏 / custom protocol 失败）
 ├─ webview.log FINISHED，error.log 有 JS 异常 → 前端执行错误（CSP/语法/API）
 ├─ 各日志正常，api.log 无请求     → 前端 JS 未执行（WebView2 版本兼容）
 └─ 全部正常仍白屏                → 渲染层（CSS/布局）问题
```

## 当前状态

- [x] Task 01 诊断模式（代码完成，本地验证）
- [x] Task 02 诊断 Shell（--diag 视图，代码完成）
- [x] Task 03 采集脚本（windows-diag-collect.ps1）
- [x] Task 04 构建矩阵（CI 就绪，diag-* tag 触发）
- [x] Task 05 本文档
- [ ] **掌柜真机执行 A/B/C 矩阵 + 采集**（阻塞点）
- [ ] 根因确认 → 针对性修复 → R0 全绿

## 纪律

- ❌ 无真实证据不修白屏
- ❌ 不修改多个变量同时验证（一次只动一个层）
- ❌ 诊断版不进用户下载页（releases/desktop/diagnostic/ 仅测试）
- ✅ 修复必须附「哪一层、什么证据、修什么」三段式说明
