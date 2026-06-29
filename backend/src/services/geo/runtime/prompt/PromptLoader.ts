// ============================================================
// Prompt Loader — KMKI-RUNTIME-007
// 从 prompts/ 目录加载 .md 文件到 PromptRegistry
// 文件命名约定: {category}/{name}/v{version}.md
// ============================================================

import * as fs from 'fs'
import * as path from 'path'
import { promptRegistry, type PromptSpec } from './PromptRegistry'

const PROMPTS_DIR = path.resolve(__dirname, './prompts')

/** 扫描 prompts 目录并注册所有发现的 prompt */
export function loadPromptsFromDir(): number {
  if (!fs.existsSync(PROMPTS_DIR)) {
    console.log(`[PromptLoader] Prompts directory not found: ${PROMPTS_DIR}`)
    return 0
  }

  let count = 0

  const scanDir = (dir: string, category: string = '') => {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        const subCategory = category ? `${category}.${entry.name}` : entry.name
        scanDir(fullPath, subCategory)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const spec = parsePromptFile(fullPath, category)
        if (spec) {
          promptRegistry.register(spec)
          count++
        }
      }
    }
  }

  scanDir(PROMPTS_DIR)
  console.log(`[PromptLoader] Loaded ${count} prompts from ${PROMPTS_DIR}`)
  return count
}

/** 尝试从文件头解析版本号（文件名中的 v{number}） */
function parseVersionFromFilename(filename: string): string {
  const match = filename.match(/v(\d+(?:\.\d+)*)/i)
  return match ? match[1] : '1.0.0'
}

/** 将文件名解析为 prompt key */
function parseKeyFromFilename(filename: string): string {
  // 去掉 .md 后缀
  let name = filename.replace(/\.md$/, '')
  // 去掉 v1/v2 版本后缀
  name = name.replace(/[._-]v\d+(\.\d+)*$/i, '')
  return name
}

/** 解析单个 .md prompt 文件 */
function parsePromptFile(filePath: string, category: string): PromptSpec | null {
  const content = fs.readFileSync(filePath, 'utf-8')
  const filename = path.basename(filePath)
  const name = parseKeyFromFilename(filename)
  const version = parseVersionFromFilename(filename)

  // 查找 frontmatter 风格的元数据（--- 包裹的区域）
  const metadata: Record<string, string> = {}
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
  if (frontmatterMatch) {
    const fmLines = frontmatterMatch[1].split('\n')
    for (const line of fmLines) {
      const sepIdx = line.indexOf(':')
      if (sepIdx > 0) {
        metadata[line.slice(0, sepIdx).trim()] = line.slice(sepIdx + 1).trim()
      }
    }
  }

  // 分离 system 和 user prompt（--- 作为分隔）
  const body = frontmatterMatch ? content.slice(frontmatterMatch[0].length) : content
  const parts = body.split(/---\n/m).filter((p) => p.trim())

  const key = category ? `${category}.${name}` : name

  return {
    key,
    version,
    system: parts[0]?.trim() || body.trim(),
    user: parts[1]?.trim(),
    metadata: {
      description: metadata['description'],
      capabilities: metadata['capabilities']?.split(',').map((s) => s.trim()),
      author: metadata['author'],
      updatedAt: metadata['updated'],
    },
  }
}
