import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '~': resolve(__dirname),
      'shared': resolve(__dirname, '..', '..', 'shared'),
      'workspaces': resolve(__dirname, 'workspaces'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['**/tests/**/*.test.ts'],
  },
})
