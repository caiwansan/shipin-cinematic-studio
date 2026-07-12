# TD-001: Nitro SSR Chinese URL Slug 404 Root Cause Analysis

**状态**: Active | **优先级**: P1 (技术债) | **创建**: 2026-07-02

## 问题描述

`/knowledge/brand/{slug}` 路由中，slug 为中文（如"昆仑镜"）时，Nuxt 3 SSR 渲染内容完全正确，但 Nitro 返回 HTTP 404。

## 当前兼容措施

在 `nuxt.config.ts` 的 `compiled` hook 中，patch `nitro.mjs` 的 `defineRenderHandler`：

```js
if (ctx.response.statusCode === 404 && event.path.startsWith('/knowledge/') && ctx.response.body) {
  ctx.response.statusCode = 200
}
```

**这不是解决方案，仅用于 RC 阶段打通链路。**

## 已知线索

### 现象
- Vue SSR 渲染：正确（`renderToString` 无异常)
- SEO 元数据：正确输出（useHead)
- `_slug_.vue` 中的 `process.server && manifest.value` 分支正确执行
- `event.node.res.statusCode = 200` 被编译写入且被执行
- Nitro 返回的 `response.statusCode` 仍然是 404

### 关键代码路径
```
Nitro defineRenderHandler
  → renderer.defineRenderHandler (renderer.mjs)
    → VueApp.renderToString(ssrContext)
    → app:rendered hook
    → getResponseStatus(event) // ← 此时 status 可能是 404
    → return { body, statusCode: 404, ... }
  → ctx.response.statusCode = 404
  → setResponseStatus(event, 404) // 覆盖事件循环中任何 200 设置
```

### 推测根因

1. **Nuxt 3 的 `useFetch` 兼容层** — 在 SSR 模式下，`useFetch` 通过 `$fetch`（ofetch）调用内部 API。如果 client 端请求包含中文路径，`$fetch` 自动对 URL 编码。但在 Nuxt 的 `_asyncData` 系统中，可能因为编码/解码不匹配导致内部错误，最终被 catch 并设置 `ssrContext.payload.error`。

   → 本次改用 inline seed data（移除 `useFetch`）后 404 依然存在。
   → 意味着根因**不在 `useFetch`**。

2. **Nitro 路由匹配二次处理** — 在 h3 的 `eventHandler` 调用结束后，Nitro 检查 `event.handled`。`defineRenderHandler` 返回的对象 `{ body, statusCode, headers }` 通过 `handleHandlerResponse` 处理。该函数最终调用 `send(event, ...)` 或 `JSON.stringify(val)`。如果过程中 `event.handled` 未正确设置，Nitro 会抛出 `Cannot find any path matching`（404）。

   → 本次 patch 的位置在 `defineRenderHandler` **内部**，即在 `event.handled` 之前。说明 Nitro 没有进入 404 throw 路径，404 来自 `response.statusCode`。

3. **Vue SSR 内的 Nuxt 内部钩子** — `app:rendered` 或 `app:error` 钩子可能在 `event.node.res` 上设置了 404。Nuxt 3 的 `definePayloadReducer` 或 `payloadPlugin` 可能在解码中文 slug 时遇到问题。

4. **Nitro 的 URL 规范化** — `event.path` 在 Nitro 内部可能被 decode/encode，`/knowledge/brand/昆仑镜` 被转成 `/knowledge/brand/%E6%98%86%E4%BB%91%E9%95%9C`，导致路由匹配失效。但 renderer 确实被调用了。

## 需要进一步的排查方法

### 方法 A: 拦截 `renderToString` 输出
```ts
// 在 renderer.mjs 中，renderToString 完成后立即检查 statusCode
const _rendered = await renderer.renderToString(ssrContext).catch(...)
console.log('[TD-001] post-render statusCode:', event.node.res.statusCode)
```

### 方法 B: 构建最小复现
创建一个独立的 Nuxt 3 项目，只有中文 slug 的 SSR 页面，不使用 seed data，不使用 `useFetch`，观察状态码。

### 方法 C: 升级 Nuxt 版本
检查当前 Nuxt 版本，确认是否是已知 Bug（如 `nuxt/nuxt#28457` 之类）。如果是最新稳定版，考虑提交 issue。

## 当前 Nuxt 版本

```bash
# 需要运行验证
```

## 推荐解决方向

1. **（最优）重构路由结构** — 将中文 slug 改为 base64 或数字 ID：`/knowledge/brand/klj001`，完全规避中文 URL 问题
2. **（有效）使用 `nuxt.config` 的 `routeRules`** — 对 `/knowledge/**` 设置 `ssr: 'redirect'` 或自定义 handler
3. **（临时）保留 compiled hook patch** — 最小化 patch 范围，只对 `/knowledge/` 生效

## 相关文件

- `frontend/nuxt.config.ts` — compiled hook 中的 patch 代码（`// PATCH: Knowledge pages`）
- `frontend/.output/server/chunks/nitro/nitro.mjs` — 实际 patch 位置（build 产物）
- `frontend/.output/server/chunks/routes/renderer.mjs` — 页面渲染器
- `frontend/pages/knowledge/brand/[slug].vue` — 品牌知识页面
