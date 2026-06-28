/**
 * scripts/aes-v3/ast-baseline.ts — AST 层结构基准线
 *
 * 职责：对三层架构的 import 结构生成稳定哈希。
 * 当代码结构意外变化时哈希变化，用于：
 *   1. 代码审查前置提醒（"你的改动影响了架构依赖"）
 *   2. 版本间对比（"v2.1 的架构 vs v2.2 的架构是否一致"）
 *
 * 注意：SHA256(import 结构) ≠ SHA256(graph 依赖树)
 * 它们本来就不相等——我们只做基线偏离检测，不做跨层一致性证明。
 */

import { Project } from 'ts-morph'
import path from 'path'
import { sha256, normalize } from './hash-utils.js'
import { walkDir } from './walk-utils.js'

const PROJECT_ROOT = path.resolve(new URL('.', import.meta.url).pathname, '../..')

export function computeASTBaseline(): { hash: string; fileCount: number } {
  const project = new Project({
    tsConfigFilePath: path.join(PROJECT_ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: true,
    addFilesFromTsConfig: false,
  })

  const srcDir = path.join(PROJECT_ROOT, 'src')
  project.addSourceFilesAtPaths(walkDir(srcDir))

  // 仅关注三层目录的结构
  const layerStructure: Record<string, string[]> = {
    workflow: [],
    observation: [],
    execution: [],
  }

  for (const sourceFile of project.getSourceFiles()) {
    const fp = sourceFile.getFilePath().replace(/\\/g, '/')
    let layer: string | null = null
    if (fp.includes('/workflow/')) layer = 'workflow'
    else if (fp.includes('/observation/')) layer = 'observation'
    else if (fp.includes('/execution/')) layer = 'execution'
    if (!layer) continue

    const relativePath = path.relative(srcDir, fp)
    const imports = sourceFile.getImportDeclarations().map(i => ({
      spec: i.getModuleSpecifierValue(),
      namedImports: i.getNamedImports().map(n => n.getName()).sort(),
      defaultImport: i.getDefaultImport()?.getText() || null,
    }))

    layerStructure[layer].push(
      `${relativePath}:${normalize(imports)}`
    )
  }

  for (const layer of Object.keys(layerStructure)) {
    layerStructure[layer].sort()
  }

  const hash = sha256(normalize(layerStructure))
  const fileCount = Object.values(layerStructure).reduce((a, b) => a + b.length, 0)

  return { hash, fileCount }
}
