/**
 * tsx-resolve-fix.js — 修复 tsx 在 commonjs 项目中对 .js import 的解析
 *
 * 用法：node --require ./tsx-resolve-fix.js ./src/director-v2/__chaos__/run-chaos-test.ts
 *
 * tsx v4 在 commonjs 模式下加载 .ts 文件时，遇到 import "...js" 不会自动匹配 .ts 文件。
 * 这个 hook 将 .js 导入重写为 .ts 导入。
 */

const Module = require('module')
const path = require('path')
const fs = require('fs')

const originalResolve = Module._resolveFilename

Module._resolveFilename = function (request, parent, ...args) {
  // 只在 .ts 文件的 import 中处理 .js → .ts 映射
  if (
    request.endsWith('.js') &&
    parent?.filename?.endsWith('.ts') &&
    !request.startsWith('/') &&
    !request.startsWith('.') === false
  ) {
    // 尝试多种解析策略
    const baseDir = path.dirname(parent.filename)
    const resolvedPath = path.resolve(baseDir, request)

    // 尝试 .js → .ts
    const tsPath = resolvedPath.replace(/\.js$/, '.ts')
    if (fs.existsSync(tsPath)) {
      return originalResolve.call(this, tsPath, parent, ...args)
    }

    // 尝试 .js → /index.ts
    const indexPath = path.join(resolvedPath.replace(/\.js$/, ''), 'index.ts')
    if (fs.existsSync(indexPath)) {
      return originalResolve.call(this, indexPath, parent, ...args)
    }
  }

  return originalResolve.call(this, request, parent, ...args)
}
