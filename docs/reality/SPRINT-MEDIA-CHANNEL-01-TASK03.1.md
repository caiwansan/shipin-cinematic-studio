# SPRINT-MEDIA-CHANNEL-01 · Task 03.1 — DouyinBrowserAdapter Reality Runtime

**Date:** 2026-08-02 06:40 CST
**Gate:** 掌柜批准（Task 02 审阅通过，附 03.1.1~03.1.4 执行约束 + G1~G6 Reality Gate）
**Commit:** `b96ad7ec` ｜ **状态:** COMPLETE ✅

---

## 交付总览

```
EnterpriseChannelService
  │
  ├─ AdapterRegistry (resolveAdapter)
  │     └─ channelType=douyin → DouyinBrowserAdapter
  │           └─ wrap BrowserRuntimeService (唯一 Playwright 执行层)
  │                 └─ Chromium (google-chrome) → 抖音创作者中心
  │
  └─ Credential Layer（adapter 零凭证存储）
        ├─ getCredential(accountId)     → AES-256-GCM 解密
        └─ updateCredential(accountId)  → AES-256-GCM 加密回写
```

## 03.1.1 Adapter 实现 ✅

新增 `backend/src/enterprise/channel/adapters/douyin-browser.adapter.ts`

- `DouyinBrowserAdapter implements EnterpriseChannelAdapter`（v1.0 冻结接口）
- **职责边界**：只做浏览器执行；不含企业权限 / AI员工逻辑 / UI逻辑 / DB 业务逻辑
- **publish/schedule/reply**：诚实返回禁用（`自动发布在 Task 03 阶段禁用`），不 mock 不假装成功
- **登录态检测**：二维码/登录标记 → waiting_login；工作台特征（内容管理/数据）→ connected；不确定诚实返回 waiting_login
- **指标抓取**：候选选择器 + 页面文本正则（粉丝/获赞/作品），解析失败明确报错（含页面片段），**禁止 mock**

## 03.1.2 吸收旧能力（move/wrap 不 copy）✅

| 旧资产 | 处置 | 说明 |
|--------|------|------|
| BrowserRuntimeService（media 域） | **wrap 复用** | Playwright 执行层唯一化；仅新增 `restoreCookies()`（凭证注入，不落盘） |
| MediaPlatformService | 不触碰（deprecated） | 含 base64 伪加密 + 旧表业务逻辑，不进入新链路 |
| PlatformAdapter（Page 参数接口） | 不触碰（deprecated） | 旧接口，无实现类，不复制 |
| browser-agent.adapter.ts（小红书专有） | 不触碰（deprecated） | 旧实现 |
| media-platform 路由（死路由） | **不恢复** | 掌柜指令：注册新 Runtime 链路，不简单恢复旧 route |

**零双实现**：DouyinBrowserAdapter 内部全部通过 `browserRuntime` 单例操作浏览器，无任何 Playwright 重复代码。

## 03.1.3 注册 Runtime ✅

- `ChannelService.resolveAdapter(platform)`：AdapterRegistry 解析（未注册渠道明确报错）
- `ChannelService.connectChannel / fetchMetrics / refreshChannelCredential / getChannelHealth`：Runtime 编排方法
- 新路由 `backend/src/routes/enterprise-channel-runtime.ts`：
  - `POST /api/enterprise/channels/runtime/:id/connect`
  - `GET  /api/enterprise/channels/runtime/:id/metrics`
  - `POST /api/enterprise/channels/runtime/:id/refresh-credential`
  - `GET  /api/enterprise/channels/runtime/:id/health`
- index.ts 注册 `DouyinBrowserAdapter`（Credential 注入回调）+ Runtime 路由
- **旧模拟路由保留**（channels.ts `simulated: true` connect 不修改、不被引用）

## 03.1.4 Credential 流程验证 ✅

```
Adapter (零凭证存储)
  → channelAccountId
  → 注入回调 getCredential()     （ChannelService → AES 解密）
  → runtime 恢复 cookie 使用
  → refreshCredential() 取新 cookie
  → 注入回调 persistCredential() （ChannelService → AES 加密落库）
```

实测：`connectAccount` 加密 payload = `{"cipher":"aes-256-gcm","payload":"..."}`；`getCredential` 解密还原 `{cookieData, note}`。**无第二套凭证体系**。

---

## Reality 验证（生产实测，api-server 4002）

| # | 验证项 | 结果 |
|---|--------|------|
| R1 | connectAccount AES-256-GCM 落库 → getCredential 解密 | ✅ |
| R2 | resolveAdapter('douyin') → DouyinBrowserAdapter | ✅ |
| R3 | healthCheck → Chromium 真实启动（playwright + google-chrome） | ✅ `{"platform":"douyin","status":"connected"}` |
| R4 | connect → 真实打开 creator.douyin.com → 未登录态 | ✅ `waiting_login`（含扫码指引） |
| R5 | refreshCredential 无浏览器会话 | ✅ 诚实 `{ok:false, error:'浏览器会话不存在'}`（不 mock） |
| R6 | Runtime 路由鉴权 | ✅ 未鉴权 401 |
| R7 | 编译 | ✅ 新文件零错误；全仓 1961（基线 1963，净修复 2） |
| R8 | 生产重启 | ✅ online，/api/health 200，`注册渠道: douyin` |

---

## 环境修复记录（npm install 副作用，非 Task 03.1 功能改动）

**触发**：安装 playwright 时 npm 按 lock 修正 node_modules（changed 128），使 tsx ESM loader 首次完整生效 → 暴露 3 类 pre-existing 问题（此前 tsx 处于退化 CJS 模式掩盖了它们）：

| 问题 | 根因 | 修复 |
|------|------|------|
| `require is not defined`（document-parser） | 动态 import 链中 .ts 转 ESM，require 不可用 | `require('mammoth')` → `import mammoth from 'mammoth'`（node CJS interop） |
| `does not provide an export named`（@platform/*，144 处引用） | esbuild CJS 产物用 `__export` 辅助 → cjs-module-lexer 识别失败 | platform/{errors,context,events,lifecycle,plugins} package.json 加 `type: module`（真 ESM 转译）+ tsconfig paths 优先 `.ts` 源码 |
| re-export 不存在符号 / 大小写 bug / type-only 当值导入 | pre-existing 源码 bug（CJS 宽松模式掩盖） | StructuredGeneration 删死导出；geoFaqRepository→geoFAQRepository；ActionPlan 等改 `import type` |
| uuid@14 ESM-only 被提升 | package.json `^14.0.1` 未锁 CJS 版本 | 固定 `^9.0.1`（CJS 兼容） |

**原则**：全部为最小改动修复（不改业务逻辑），`git stash` 验证与 Task 03.1 代码无关；修复后 tsc 错误数不升反降。

---

## 暂时禁止事项遵守 ✅

❌ 未做 accounts.vue ｜ ❌ 未动 dashboardData ｜ ❌ 未做 AI 运营建议 ｜ ❌ 未做自动发布 ｜ ❌ 未做多渠道复制

---

## Task 03.2 Reality Gate 准备

| Gate | 内容 | 状态 |
|------|------|------|
| G1 身份 | organization → channelAccount | 链路就绪（EnterpriseChannelAccount 已含 organizationId） |
| G2 凭证 | connect → AES → DB → restore → usable | 链路就绪（R1/R5 验证） |
| G3 Runtime | ChannelService → DouyinBrowserAdapter → Playwright → creator center | **已跑通**（R3/R4） |
| G4 数据 | fetchMetrics 返回 followers/views/likes/comments | 待真实登录后实测（抓取逻辑已实现，禁 mock） |
| G5 权限 | 普通 AI 员工 publish=false；管理员授权 publish=true | AgentChannelBinding 已冻结，待 Task 03.2 断言 |
| G6 失败恢复 | cookie 失效/session 过期/浏览器异常 → connected → expired/error | 逻辑已实现（登录态检测 + 诚实报错），待 Task 03.2 断言 |

**下一步**：Task 03.2 — 真实扫码登录一个抖音账号 → refresh-credential 回写 → fetchMetrics 真实抓取 → 按 G1~G6 验收。
