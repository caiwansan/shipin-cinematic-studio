// ============================================================
// 平台级 Deprecated Module Guard
// V4.2 — 用于锁住已进入 DEPRECATE 生命周期的模块的 URL 访问
//
// 用法：
//   在页面的 definePageMeta 中引用此 middleware：
//   definePageMeta({
//     middleware: ['deprecated-module'],
//     moduleName: 'customer-service'
//   })
//
// 检查逻辑：
//   - 从 runtimeConfig.public.customerServiceEnabled 读取 Flag
//   - 如果未启用且 moduleName 为 'customer-service'，返回 HTTP 410
// ============================================================

export default defineNuxtRouteMiddleware((to) => {
  const moduleName = to.meta.moduleName as string
  if (!moduleName) return

  const config = useRuntimeConfig()
  let isEnabled = false

  if (moduleName === 'customer-service') {
    isEnabled = (config.public as any).customerServiceEnabled === true
  }

  if (!isEnabled) {
    throw createError({
      statusCode: 410,
      statusMessage: '该功能已下线（Gone）',
      fatal: true,
    })
  }
})
