import { fileURLToPath } from 'url'
import { resolve } from 'path'

export default defineNuxtConfig({
  ssr: false,
  telemetry: false,
  sourcemap: false,
  alias: {
    'shared': resolve(fileURLToPath(import.meta.url), '..', '..', 'shared'),
    'workspaces': resolve(fileURLToPath(import.meta.url), '..', 'workspaces'),
  },
  nitro: {
    preset: 'node-server',
    minify: false,
    sourceMap: false,
    experimental: { node: true },
    routeRules: {
      '/login': { redirect: '/' },
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Content-Security-Policy': "default-src 'self'",
        },
      },
    },
    hooks: {},
    plugins: [],
  },
  vite: {
    build: {
      minify: false,
      cssMinify: false,
      sourcemap: false,
      target: 'esnext',
      rollupOptions: {
        maxParallelFileOps: 1,
        cache: false,
        output: {
          manualChunks: undefined,
          inlineDynamicImports: true,
        },
      },
    },
    esbuild: false,
  },
  devtools: { enabled: false },
  modules: ['@nuxtjs/tailwindcss'],
  tailwindcss: { viewer: false, exposeConfig: false, configPath: 'tailwind.config.js' },
  compatibilityDate: '2024-12-01',
  app: {
    buildAssetsDir: '/_nuxt/',
    head: { title: '昆仑镜' },
  },
})
