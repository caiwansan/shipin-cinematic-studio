import { resolve } from 'path'
import { fileURLToPath } from 'url'

export default defineNuxtConfig({
  ssr: false,
  telemetry: false,
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],
  compatibilityDate: '2024-12-01',
  nitro: {
    preset: 'node-server',
    minify: false,
    esbuild: {
      options: { 
        tsconfigRaw: {},
        minify: false,
      }
    },
    experimental: { node: true },
    routeRules: {},
    hooks: {},
    plugins: [],
  },
  vite: {
    build: {
      minify: false,
      cssMinify: false,
      rollupOptions: {
        maxParallelFileOps: 2,
      },
      target: 'es2015',
    },
    esbuild: false,
    optimizeDeps: {
      esbuildOptions: {
        mainFields: ['module', 'main'],
      },
    },
    experimental: {
      maxConcurrentRequests: 1,
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
  app: {
    buildAssetsDir: '/_nuxt/',
    head: {
      title: '昆仑镜 - AI 短剧制作平台',
      meta: [
        { name: 'description', content: '从剧本到成片，AI 全自动完成短剧制作。' },
        { property: 'og:title', content: '昆仑镜 - AI 短剧制作平台' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
      ],
    },
  },
})
