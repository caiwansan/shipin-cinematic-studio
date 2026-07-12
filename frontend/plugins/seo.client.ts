// 客户端插件：从后端读取站点配置，更新页面 head
export default defineNuxtPlugin(async () => {
  try {
    const data = await $fetch('/api/system/config', { responseType: 'json' })
    if (!data || typeof data !== 'object') return

    const config = data as Record<string, string>

    const headConfig: Record<string, any> = {}

    if (config.site_title) headConfig.title = config.site_title
    if (config.site_description) {
      headConfig.meta = [
        { name: 'description', content: config.site_description },
        { property: 'og:description', content: config.site_description },
      ]
    }
    if (config.site_name) {
      headConfig.meta = [
        ...(headConfig.meta || []),
        { property: 'og:title', content: config.site_name },
      ]
    }
    if (config.site_keywords) {
      headConfig.meta = [
        ...(headConfig.meta || []),
        { name: 'keywords', content: config.site_keywords },
      ]
    }
    if (config.og_image) {
      headConfig.meta = [
        ...(headConfig.meta || []),
        { property: 'og:image', content: config.og_image },
      ]
    }
    if (config.site_domain) {
      headConfig.meta = [
        ...(headConfig.meta || []),
        { property: 'og:url', content: config.site_domain },
      ]
    }

    useHead(headConfig)
  } catch {
    // 静默失败，用构建时的默认值
  }
})
