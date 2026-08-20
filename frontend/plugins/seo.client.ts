/// 客户端插件：从后端读取站点配置，更新页面 head（SEO + GEO 结构化数据）
export default defineNuxtPlugin(async () => {
  try {
    const data = await $fetch('/api/system/config', { responseType: 'json' })
    if (!data || typeof data !== 'object') return

    const config = data as Record<string, string>
    const headConfig: Record<string, any> = {}
    const meta: Array<Record<string, string>> = []
    const script: Array<Record<string, any>> = []

    // ── 基础 SEO ──
    if (config.site_title) headConfig.title = config.site_title
    if (config.site_description) {
      meta.push({ name: 'description', content: config.site_description })
      meta.push({ property: 'og:description', content: config.site_description })
    }
    if (config.site_name) {
      meta.push({ property: 'og:title', content: config.site_name })
    }
    if (config.site_keywords) {
      meta.push({ name: 'keywords', content: config.site_keywords })
    }
    if (config.og_image) {
      meta.push({ property: 'og:image', content: config.og_image })
    }
    if (config.site_domain) {
      meta.push({ property: 'og:url', content: config.site_domain })
    }

    // ── GEO 结构化数据 ──
    if (config.geo_enable === 'true') {
      // JSON-LD 结构化数据（优先使用自定义，否则用默认 Organization）
      let jsonld: Record<string, any>
      try {
        jsonld = JSON.parse(config.geo_structured_data || '{}')
      } catch {
        jsonld = {
          '@context': 'https://schema.org',
          '@type': config.geo_brand_type || 'Organization',
          name: config.geo_brand_name || config.site_name,
          description: config.geo_brand_description || config.site_description,
          url: config.geo_brand_url || `https://${config.site_domain}`,
          logo: config.geo_brand_logo || `https://${config.site_domain}/logo.png`,
        }
      }
      script.push({ type: 'application/ld+json', innerHTML: JSON.stringify(jsonld) })

      // Speakable 结构化数据（语音搜索优化）
      if (config.geo_speakable_enable === 'true' && config.geo_speakable_selector) {
        const speakable = {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          speakable: {
            '@type': 'SpeakableSpecification',
            cssSelector: config.geo_speakable_selector.split(',').map((s: string) => s.trim()),
          },
          url: config.geo_brand_url || `https://${config.site_domain}`,
        }
        script.push({ type: 'application/ld+json', innerHTML: JSON.stringify(speakable) })
      }

      // GEO 高级 Robots Meta
      if (config.geo_meta_robots_advanced) {
        meta.push({ name: 'robots', content: config.geo_meta_robots_advanced })
      }

      // Open Graph 扩展
      if (config.geo_open_graph_enable === 'true') {
        if (config.geo_og_type) meta.push({ property: 'og:type', content: config.geo_og_type })
        if (config.geo_og_locale) meta.push({ property: 'og:locale', content: config.geo_og_locale })
        if (config.geo_brand_name) meta.push({ property: 'og:site_name', content: config.geo_brand_name })
      }

      // Twitter Card
      if (config.geo_twitter_card_enable === 'true') {
        meta.push({ name: 'twitter:card', content: 'summary_large_image' })
        if (config.site_description) meta.push({ name: 'twitter:description', content: config.site_description })
        if (config.geo_brand_name) meta.push({ name: 'twitter:title', content: config.geo_brand_name })
        if (config.og_image) meta.push({ name: 'twitter:image', content: config.og_image })
      }

      // Hreflang 多语言
      if (config.geo_hreflang_enable === 'true' && config.geo_hreflang_default) {
        const link: Array<Record<string, string>> = []
        link.push({ rel: 'alternate', hreflang: config.geo_hreflang_default, href: config.geo_brand_url || `https://${config.site_domain}` })
        if (config.geo_hreflang_default !== 'x-default') {
          link.push({ rel: 'alternate', hreflang: 'x-default', href: config.geo_brand_url || `https://${config.site_domain}` })
        }
        headConfig.link = link
      }

      // Canonical
      if (config.geo_canonical_base) {
        headConfig.link = [...(headConfig.link || []), { rel: 'canonical', href: config.geo_canonical_base }]
      }

      // Article Publisher（供 AI 引用来源）
      if (config.geo_article_publisher) {
        meta.push({ name: 'author', content: config.geo_article_publisher })
        meta.push({ name: 'publisher', content: config.geo_article_publisher })
      }

      // 实体声明 meta（GEO 特有）
      if (config.geo_entity_type) {
        meta.push({ name: 'entity:type', content: config.geo_entity_type })
      }
      if (config.geo_entity_description) {
        meta.push({ name: 'entity:description', content: config.geo_entity_description.slice(0, 200) })
      }
    }

    if (meta.length > 0) headConfig.meta = meta
    if (script.length > 0) headConfig.script = script

    useHead(headConfig)
  } catch {
    // 静默失败，用构建时的默认值
  }
})
