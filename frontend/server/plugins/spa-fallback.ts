export default defineNitroPlugin((nitroApp) => {
  // Nitro ssr:false 模式下对 SPA 路由返回 404 状态码但带正确 HTML 内容
  // 拦截 render:response，把非 API/非静态资源的 404 改为 200
  nitroApp.hooks.hook('render:response', (response, { event }) => {
    if (response.statusCode === 404) {
      const path = event.path || ''
      // 只修复前端 SPA 路由（非 API、非 _nuxt 资源）
      if (!path.startsWith('/api/') && !path.startsWith('/_nuxt/') && !path.startsWith('/__')) {
        response.statusCode = 200
      }
    }
  })
})
