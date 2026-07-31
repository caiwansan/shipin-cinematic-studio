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
if (process.client) {
  fetch('/api/system/config')
    .then(r => r.ok ? r.json() : null)
    .then((cfg: any) => {
      if (!cfg) return
      const title = cfg.seo_title || cfg.site_title
      const desc = cfg.seo_description || cfg.site_description
      const keywords = cfg.seo_keywords || cfg.site_keywords
      const domain = cfg.site_domain || 'aigc.fushtn.com'
      const ogImage = cfg.og_image
        ? (cfg.og_image.startsWith('http') ? cfg.og_image : `https://${domain}${cfg.og_image}`)
        : `https://${domain}/logo.png`
      useHead({
        title,
        meta: [
          { name: 'description', content: desc },
          { name: 'keywords', content: keywords },
          { property: 'og:title', content: title },
          { property: 'og:description', content: desc },
          { property: 'og:image', content: ogImage },
          { property: 'og:url', content: `https://${domain}/` },
        ],
      })
    })
    .catch(() => {})
}
</script>
