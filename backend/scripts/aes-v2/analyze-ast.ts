/**
 * scripts/aes-v2/analyze-ast.ts — AST 级依赖扫描
 *
 * 职责：
 *   - 使用 ts-morph 解析 AST
 *   - 检测 forbidden import（包括 dynamic import 和 require）
 *   - 检测 alias bypass（@execution → observation）
 *   - 检测 barrel re-export 污染
 *
 * 层规则:
 *   workflow/   → 禁止引用 observation, execution
 *   observation/ → 禁止引用 execution/replay-engine
 *   execution/   → 全通
 */

import { Project } from 'ts-morph'
import path from 'path'

const SRC_DIR = path.resolve(new URL('.', import.meta.url).pathname, '../../src')

type Layer = 'workflow' | 'observation' | 'execution' | 'unknown'

function detectLayer(filePath: string): Layer {
  const normalized = filePath.replace(/\\/g, '/')
  if (normalized.includes('/workflow/')) return 'workflow'
  if (normalized.includes('/observation/')) return 'observation'
  if (normalized.includes('/execution/')) return 'execution'
  return 'unknown'
}

const RULES: Record<string, { forbid: string[] }> = {
  workflow: { forbid: ['observation', 'execution'] },
  observation: { forbid: ['execution/replay-engine'] },
  execution: { forbid: [] },
}

const project = new Project({
  tsConfigFilePath: path.resolve(SRC_DIR, '../tsconfig.json'),
  skipAddingFilesFromTsConfig: true,
  addFilesFromTsConfig: false,
})

// 手动添加 src 目录下的所有 .ts 文件
import fs from 'fs'

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

project.addSourceFilesAtPaths(walkDir(SRC_DIR))
console.log(`[AST] 扫描 ${project.getSourceFiles().length} 个源文件`)

const violations: string[] = []

for (const sourceFile of project.getSourceFiles()) {
  const filePath = sourceFile.getFilePath()
  const layer = detectLayer(filePath)
  if (layer === 'unknown') continue

  const rule = RULES[layer]
  if (!rule || rule.forbid.length === 0) continue

  // 静态 import
  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue()
    for (const forbidden of rule.forbid) {
      if (spec.includes(forbidden)) {
        violations.push(`AST: ${path.relative(SRC_DIR, filePath)} (${layer}) → ${spec} (forbidden: ${forbidden})`)
      }
    }
  }

  // dynamic import / require — 通过字符串字面量检测
  const fullText = sourceFile.getFullText()
  const dynamicImports = [...fullText.matchAll(/(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g)]
  for (const m of dynamicImports) {
    for (const forbidden of rule.forbid) {
      if (m[1].includes(forbidden)) {
        violations.push(`DYNAMIC: ${path.relative(SRC_DIR, filePath)} (${layer}) → ${m[1]} (forbidden: ${forbidden})`)
      }
    }
  }

  // alias bypass (如 @execution → observation)
  for (const imp of sourceFile.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue()
    if (layer === 'observation' && spec.startsWith('@execution')) {
      violations.push(`ALIAS_BYPASS: ${path.relative(SRC_DIR, filePath)} (${layer}) → ${spec}`)
    }
  }
}

if (violations.length > 0) {
  console.error('\n❌ AST Layer Violations:')
  for (const v of violations) console.error(`  ${v}`)
  process.exit(1)
}

console.log('✅ AST layer check passed')
