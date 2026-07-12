// resolve-alias.mjs
// Loader hook to resolve @platform/* aliases at runtime for tsx
// Used via: tsx --loader ./resolve-alias.mjs src/index.ts

import { resolve as resolveTs } from 'tsx/esm/api'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PLATFORM_DIR = path.resolve(__dirname, '..', 'platform')

export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('@platform/')) {
    const rest = specifier.slice('@platform/'.length)
    // Try .ts first (for tsx), then .js
    const tsPath = path.join(PLATFORM_DIR, rest)
    const resolved = tsPath.endsWith('.ts') || tsPath.endsWith('.js') 
      ? tsPath 
      : tsPath + '.ts'
    
    const fileUrl = new URL('file://' + resolved).href
    return { url: fileUrl, shortCircuit: true }
  }
  return defaultResolve(specifier, context, defaultResolve)
}
