/**
 * scripts/validate-layer-deps.ts — 三层依赖强约束守卫
 *
 * 规则：
 *   workflow/   → 只能引用 workflow，禁止引用 observation/execution
 *   observation/ → 只能引用 workflow/observation，禁止引用 execution/replay-engine
 *   execution/   → 任意引用
 *
 * 用法：
 *   npx tsx scripts/validate-layer-deps.ts
 *   0 = pass, 1 = fail
 */

import fs from 'fs'
import path from 'path'

const SRC_DIR = path.resolve(new URL('.', import.meta.url).pathname, '../src')

const RULES: Record<string, { allow: string[]; forbid: string[] }> = {
  workflow: {
    allow: ['workflow'],
    forbid: ['observation', 'execution'],
  },
  observation: {
    allow: ['workflow', 'observation'],
    forbid: ['execution/replay-engine'],
  },
  execution: {
    allow: ['workflow', 'observation', 'execution'],
    forbid: [],
  },
}

function getLayer(relativePath: string): string | null {
  if (relativePath.startsWith('workflow/')) return 'workflow'
  if (relativePath.startsWith('observation/')) return 'observation'
  if (relativePath.startsWith('execution/')) return 'execution'
  return null
}

function scanImports(content: string): string[] {
  const imports: string[] = []
  // 静态 import
  const staticRe = /from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = staticRe.exec(content)) !== null) {
    imports.push(match[1])
  }
  // dynamic import
  const dynamicRe = /import\(['"]([^'"]+)['"]\)/g
  while ((match = dynamicRe.exec(content)) !== null) {
    imports.push(match[1])
  }
  // require
  const requireRe = /require\(['"]([^'"]+)['"]\)/g
  while ((match = requireRe.exec(content)) !== null) {
    imports.push(match[1])
  }
  return imports
}

function violates(layer: string, imports: string[]): string[] {
  const rule = RULES[layer]
  if (!rule) return []
  return imports.filter(imp => rule.forbid.some(f => imp.includes(f)))
}

function walkDir(dir: string): string[] {
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...walkDir(full))
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(full)
    }
  }
  return files
}

const errors: string[] = []

for (const file of walkDir(SRC_DIR)) {
  const relativePath = path.relative(SRC_DIR, file)
  const layer = getLayer(relativePath)
  if (!layer) continue

  const content = fs.readFileSync(file, 'utf-8')
  const imports = scanImports(content)
  const bad = violates(layer, imports)

  if (bad.length > 0) {
    errors.push(
      `❌ Layer violation: ${relativePath} (${layer})\n` +
        `   Forbidden imports: ${bad.join(', ')}`
    )
  }
}

if (errors.length > 0) {
  console.error('\n' + errors.join('\n\n'))
  process.exit(1)
}

console.log('✅ Layer dependency check passed')
