import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/director-v2/__tests__/**/*.spec.ts',
      'src/director/v2/__tests__/**/*.test.ts',
      'src/director/v2/protocols/__tests__/**/*.test.ts',
      'src/kernel-v1/__tests__/**/*.test.ts',
      'src/providers/**/*.test.ts',
      'src/runtime/schema-validator/**/*.test.ts',
      'src/runtime/__tests__/**/*.test.ts',
    ],
  },
  resolve: {
    conditions: ['node', 'import', 'require'],
    mainFields: ['module', 'main'],
    extensions: ['.ts', '.js', '.mjs', '.json'],
    alias: {
      '@director-v2': path.resolve(__dirname, './src/director/v2'),
    },
  },
})
