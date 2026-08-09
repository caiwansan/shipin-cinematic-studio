<template>
  <div>
    <!-- APP-PROBE removed -->
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
// 兼容 ?admin 查询参数 → 重定向到 /admin/
if (process.client) {
  const params = new URLSearchParams(window.location.search)
  if (params.has('admin')) {
    const target = '/admin/aigc/login'
    window.location.replace(target)
  }
}

// Sprint-ADMIN-IA-REALITY-03 T01: 动态 SEO head（官网/前台统一读 SystemConfig）
// 分享卡片修复：SSR 首屏也注入 og 标签（社交爬虫不执行 JS，客户端注入无效）
const { data: systemCfg } = await useFetch('/api/system/config')
const cfg: any = systemCfg.value || {}
const siteTitle = cfg.seo_title || cfg.site_title || '昆仑镜'
const siteDesc = cfg.seo_description || cfg.site_description || 'AI 短剧创作 · 数字办公 · 智能工作台'
const siteKeywords = cfg.seo_keywords || cfg.site_keywords || '昆仑镜,AI短剧,AI创作,短剧制作'
const siteDomain = cfg.site_domain || 'aigc.fushtn.com'
const ogImage = cfg.og_image
  ? (cfg.og_image.startsWith('http') ? cfg.og_image : `https://${siteDomain}${cfg.og_image}`)
  : `https://${siteDomain}/og-cover.png`
useHead({
  title: siteTitle,
  meta: [
    { name: 'description', content: siteDesc },
    { name: 'keywords', content: siteKeywords },
    { property: 'og:title', content: siteTitle },
    { property: 'og:description', content: siteDesc },
    { property: 'og:image', content: ogImage },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { property: 'og:image:type', content: 'image/png' },
    { property: 'og:url', content: `https://${siteDomain}/` },
    { property: 'og:type', content: 'website' },
    { property: 'og:locale', content: 'zh_CN' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
})
</script>
