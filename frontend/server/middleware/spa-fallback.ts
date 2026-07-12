export default defineEventHandler((event) => {
  // 对所有 SPA 路由始终返回 200（不触发 Nuxt 的 404）
  // Nitro 的 renderer 会自动处理 SPA shell 渲染
})
