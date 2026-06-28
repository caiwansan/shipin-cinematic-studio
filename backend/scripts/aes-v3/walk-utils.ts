/**
 * scripts/aes-v3/walk-utils.ts — 文件遍历工具
 */

import fs from 'fs'
import path from 'path'

export function walkDir(dir: string): string[] {
  const files: string[] = []
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...walkDir(full))
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(full)
      }
    }
  } catch { /* 目录不存在时静默跳过 */ }
  return files
}
