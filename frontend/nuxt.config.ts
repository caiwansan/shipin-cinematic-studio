import { fileURLToPath } from 'url'
import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs'
import { resolve } from 'path'

// P3-lite: Build version injection
const BUILD_VERSION = process.env.BUILD_VERSION || `dev-${Date.now()}`
const BUILD_TIME = process.env.BUILD_TIME || new Date().toISOString()

export default defineNuxtConfig({
  ssr: true,
  telemetry: false,
  css: [
    '~/assets/styles/enterprise-tokens.css',
    '~/assets/styles/recruitment-tokens.css',
    '~/assets/styles/media-tokens.css',
  ],
  alias: {
    'shared': resolve(fileURLToPath(import.meta.url), '..', '..', 'shared'),
    'workspaces': resolve(fileURLToPath(import.meta.url), '..', 'workspaces'),
  },
  runtimeConfig: {
    public: {
      buildVersion: BUILD_VERSION,
      buildTime:"1779780208",
      // @deprecated V4.2 — Customer Service 业务废弃
      customerServiceEnabled: false
    },
  },
  nitro: {
    preset: 'node-server',
    esbuild: {
      options: { tsconfigRaw: {} }
    },
    experimental: {
      node: true,
    },
    routeRules: {
      '/login': { redirect: '/' },
      // 桌面端旧工作台：浏览器访问降级为 client-only（SSR 渲染会访问 window.electronAPI 直接 500）
      '/studio/v2': { ssr: false },
      // 小说工作台：登录后使用的旧工作台，SSR 无 SEO 价值且自身存在 hydration mismatch → client-only
      '/hdz': { ssr: false },
      // 商城：商品数据客户端 API 加载，SSR 无 SEO 收益；登录态恢复会造成 hydration mismatch → client-only
      '/mall': { ssr: false },

      // 📍 SSOT Route Redirect Phase 1 — unified in middleware/enterprise-redirect.global.ts
      // FRONTEND-RECRUITMENT-ENTRY-CONSOLIDATION-01 SubTask 1: Nuxt config redirects removed,
      // all legacy path redirects consolidated into a single middleware.

      // 🛡️ 全局安全响应头部
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
          'Referrer-Policy': 'no-referrer-when-downgrade',
          'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' https: https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com https://dashscope-result-wlcb.oss-cn-wulanchabu.aliyuncs.com; connect-src 'self' https://aigc.fushtn.com http://127.0.0.1:* ws://127.0.0.1:*; font-src 'self' data:; object-src 'none'; frame-ancestors 'none';",
        },
      },
      // 📄 HTML 页面 — 允许爬虫缓存
      '/': {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
      },
      '/about': {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
      },
      '/pricing': {
        headers: {
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
      },
      '/community': {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=3600',
        },
      },
      '/community/post/**': {
        headers: {
          'Cache-Control': 'public, max-age=300, s-maxage=3600',
        },
      },
    },
    plugins: ['~/server/plugins/preload.ts', '~/server/plugins/spa-fallback.ts'],
    hooks: {
      'compiled': () => {
        const publicDir = resolve(fileURLToPath(import.meta.url), '..', '.output/public')
        const serverDir = process.env.NITRO_OUTPUT_DIR || resolve(fileURLToPath(import.meta.url), '..', '.output/server')

        // 1) Patch nitro.mjs: eager import renderer chunk
        try {
          const nitroFile = resolve(serverDir, 'chunks/nitro/nitro.mjs')
          if (existsSync(nitroFile)) {
            let content = readFileSync(nitroFile, 'utf-8')
            const lazyPattern = "const _lazy_nbtyqx = () => import('../routes/renderer.mjs');"
            const eagerPattern = "const _lazy_nbtyqx = (() => { const p = import('../routes/renderer.mjs'); return () => p; })();"
            if (content.includes(lazyPattern)) {
              content = content.replaceAll(lazyPattern, eagerPattern)
              writeFileSync(nitroFile, content, 'utf-8')
              console.log('[nitro:compiled] ✅ Patched renderer.mjs import from lazy to eager in nitro.mjs')
            }
          }
        } catch (err) {
          console.error('[nitro:compiled] ⚠️ nitrom.mjs patch:', err)
        }

        // 2) Patch all built JS files: replace require('~/...') with window.__tc
        try {
          const nuxtDir = resolve(publicDir, '_nuxt')
          if (existsSync(nuxtDir)) {
            const files = readdirSync(nuxtDir).filter(f => f.endsWith('.js'))
            let patchedCount = 0
            for (const file of files) {
              const fp = resolve(nuxtDir, file)
              let content = readFileSync(fp, 'utf-8')
              const original = content

              // 万能替换：把所有 require("~/xxx")、require('~/xxx')、require( "~/xxx" ) 替换为 window.__tc
              // 注意：不替换 node modules 中的 require（如 import() 转译的）
              content = content.replace(
                /require\s*\(\s*["']~\/[^"']+["']\s*\)/g,
                `window.__tc`
              )

              if (content !== original) {
                writeFileSync(fp, content, 'utf-8')
                patchedCount++
              }
            }
            if (patchedCount > 0) {
              console.log(`[nitro:compiled] ✅ Patched require('~/...') in ${patchedCount} JS files (using window.__tc)`)
            }
          }
        } catch (err) {
          console.error('[nitro:compiled] ⚠️ require patch:', err)
        }

        // 3) BuildId fallback
        try {
          const verDir = '_nuxt'
          const metaDir = resolve(publicDir, verDir, 'builds', 'meta')
          if (existsSync(metaDir)) {
            const files = readdirSync(metaDir).filter(f => f.endsWith('.json') && f !== 'latest.json')
            if (files.length > 0) {
              const content = readFileSync(resolve(metaDir, files[0]), 'utf-8')
              writeFileSync(resolve(metaDir, 'latest.json'), content, 'utf-8')
              console.log(`[nitro:compiled] ✅ latest.json written (buildId: ${files[0].replace('.json','')})`)
            }
          }
        } catch (err) {
          console.error('[nitro:compiled] ⚠️ latest.json:', err)
        }

        // 4) Validate build + sync _nuxt static assets to nginx webroot
        try {
          const { execSync } = require('child_process')
          const scriptsDir = resolve(publicDir, '..', '..', 'scripts')
          // Validate build integrity first
          execSync('node ' + resolve(scriptsDir, 'build-validator.mjs'), { stdio: 'inherit' })
          // Sprint-ADMIN-IA-REALITY-01-B: 孤儿页面 CI 检查（未登记路由 → build warning）
          execSync('node ' + resolve(scriptsDir, 'route-ownership-check.mjs'), { stdio: 'inherit' })
          // Then sync
          execSync('node ' + resolve(scriptsDir, 'asset-sync.mjs'), { stdio: 'inherit' })
          // Generate release metadata
          execSync('node ' + resolve(scriptsDir, 'release-meta.mjs'), { stdio: 'inherit' })
        } catch (err) {
          console.error('[nitro:compiled] ❌ Build validation or asset sync failed:', err.message)
          process.exit(1)
        }
      }
    },
  },
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  compatibilityDate: '2024-12-01',
  app: {
    buildAssetsDir: '/_nuxt/',
    head: {
      title: '昆仑镜 - AI 短剧制作平台',
      meta: [
        { name: 'description', content: '从剧本到成片，AI 全自动完成短剧制作。角色设计、场景生成、分镜创作、视频合成，你只需要讲一个故事。' },
        { property: 'og:title', content: '昆仑镜 - AI 短剧制作平台' },
        { property: 'og:description', content: '输入一个故事，AI 自动生成一部好剧。昆仑镜，你的 AI 影视导演。' },
        { property: 'og:image', content: 'https://aigc.fushtn.com/logo.png' },
        { property: 'og:url', content: 'https://aigc.fushtn.com/' },
        { property: 'og:type', content: 'website' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
        { rel: 'apple-touch-icon', href: '/logo.png' },
      ],
      script: [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: '昆仑镜',
            description: 'AI 短剧制作平台',
            url: 'https://aigc.fushtn.com',
            logo: 'https://aigc.fushtn.com/logo.png',
            sameAs: [
              'https://aigc.fushtn.com',
            ],
          }),
        },
        {
          src: '/__tc-bridge.js?v=' + BUILD_VERSION,
          type: 'text/javascript',
          tagPosition: 'head',
        },
      ],
    },
  },
  vite: {
    build: {
      rollupOptions: {
        maxParallelFileOps: 50,
      },
    },
    optimizeDeps: {
      esbuildOptions: {
        mainFields: ['module', 'main'],
      },
    },
    esbuild: {
      legalComments: 'none',
    },
  },
  tailwindcss: {
    viewer: false,
    exposeConfig: false,
    config: {
      blocklist: [],
      safelist: [],
    },
  },
})
