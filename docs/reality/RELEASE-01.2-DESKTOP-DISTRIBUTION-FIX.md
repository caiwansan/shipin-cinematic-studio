# RELEASE-01.2 Desktop Distribution Reality Fix — 发行现实修正

**Date:** 2026-08-04 05:35
**Gate:** 技术总监 + 产品经理裁定（2026-08-04 05:20）——「RCA-02 诊断方向没有错，但 Release-01 商品发行链路还没有达到真机验收条件。现在让用户跑诊断包属于顺序错误。必须先修正发行现实，再继续真机。」

## 裁定背景：两个发行现实问题

### 问题一：下载页面还是 1.0.4，怎么真机？
- 源码修复 → diag-1.1.1/1.1.2 → GitHub 内部测试 Release → ❌ 官网仍指向 1.0.4
- 用户路径：aigc.fushtn.com → 下载桌面版 → KunlunMedia-1.0.4-setup.exe → 白屏
- **掌柜真机测到的是旧发行物，不是诊断版本 → 污染 RCA**

### 问题二：下载页要求独立登录账号（产品错误）
- 下载页属于**公共发行层**，不属于用户中心
- 旧入口 `/user/download` 带 `middleware: auth` → 用户访问被登录墙拦截
- 正确模型：游客 → 官网 → 下载 → 安装 → 客户端登录（账号身份从 Desktop App 开始，不是下载页）

## 执行

### Task 01：官方下载版本同步 ✅
- diag-1.1.2 三件套构建完成（success）→ 下载 + sha256 校验（ghfast.top 镜像加速）
- **C 版（完整壳 + RCA-02 埋点）→ 官网正式版 1.1.2**
  - `windows/KunlunMedia-1.1.2-setup.exe`（sha256 `b04f5efa…`）
- **A/B 诊断包 → 官网域内 `/releases/desktop/diagnostics/`**（不进入 latest.json/下载页，仅供内部诊断）
- `latest.json` 更新：version=1.1.2 / downloadUrl / sha256 / size / notes
- 验证：latest.json ✅ / 下载页 200 ✅ / 1.1.2 exe 匿名下载 200 ✅ / DiagA 匿名 200 ✅

### Task 02：下载页去登录化 ✅
- `/user/download` 旧页：移除 `middleware: auth` + 重写为客户端跳转
- **SSOT 重定向**：`enterprise-redirect.global.ts` Case 4：`/user/download` → 301 `/download/desktop`
- 路由白名单补齐：`route-guard.ts` + `preload.ts` knownPaths 加 `/download/desktop`（此前缺失 → 客户端导航会被 404 拦截的隐藏 bug）
- 残留引用清理：`layouts/user.vue` 侧边栏「客户端下载」+ `workspace/ecom-image/workbench/[id].vue` 链接 → `/download/desktop`
- 下载页保留：版本 / SHA256 / 更新说明 / 安装要求（已有）

### Task 03：真机入口重定义 ✅
- **唯一真机路径**：官网 `aigc.fushtn.com/download/desktop` → 下载最新版 1.1.2 → 安装 → 诊断测试
- 禁止：GitHub Release 下载 / 内部 diag URL 作为用户入口
- A/B 诊断包仅官网域内 `/releases/desktop/diagnostics/`（内部测试用，非用户入口）

## 发布流程（后续自动化方向）

```
代码版本 → Windows Build（GitHub Actions）→ Artifact Repository（官网 /releases/desktop/）
→ latest.json → /download/desktop → 用户下载最新 exe
```

当前为半自动（人工同步 + sha256 校验 + latest.json 更新）；完整 CI/CD 推送 Artifact Repository 待后续 sprint。

## 验收清单

| 项 | 结果 |
|---|---|
| latest.json version = 1.1.2 | ✅ |
| /download/desktop 公开访问（无登录墙） | ✅ |
| KunlunMedia-1.1.2-setup.exe 匿名下载 200 | ✅ |
| /user/download 301 → /download/desktop | ✅（客户端 middleware，浏览器验证） |
| 下载页显示版本/SHA256/更新说明 | ✅ |
| A/B 诊断包官网域内可用 | ✅ |

## 状态

```
发行链路 ✅ 打通（官网 = 1.1.2）
真机验收资格 ✅ 恢复
RCA-02 白屏根因 ⏳ 等真机证据（用官网 1.1.2，非诊断包）
```

**待掌柜**：官网下载 1.1.2 → 安装 → 白屏复现 → 回传 `%LOCALAPPDATA%\com.kunlun.desktop\logs\` → RCA-02 分层判定。
