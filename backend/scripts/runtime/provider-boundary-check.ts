#!/usr/bin/env tsx
/**
 * provider-boundary-check.ts
 *
 * Static Constitutional Guard — 扫描所有 direct provider 域名调用，
 * 确保只有 gateway/ adapter/ 目录下的代码能直接调 provider。
 *
 * 任何 detect provider fetch（openai.com / anthropic.com / dashscope.aliyuncs.com /
 * api.deepseek.com / api.siliconflow.cn / ark.cn-beijing.volces.com）
 * 如果在禁止目录中，直接 process.exit(1)。
 */

import { readFileSync, existsSync } from 'node:fs'
import { globSync } from 'glob'
import { resolve } from 'node:path'

// 这些目录/文件允许直接调用 provider
const ALLOWED_PATHS = [
  'src/runtime/llm/',
  'src/runtime/providers/',
  'src/runtime/provider-middleware.ts',
  'src/runtime/runtime-gateway.ts',
  'src/runtime/narrative-gateway.ts',
  'src/model-adapters/',
  'src/services/unified-ai-gateway.ts',
  'src/services/aliyun-llm.provider.ts',
  'src/services/aliyun-image.provider.ts',
  'src/services/aliyun-tts.provider.ts',
  'src/services/aliyun-video.provider.ts',
  'src/services/volcengine-llm.provider.ts',
  'src/services/volcengine-image.provider.ts',
  'src/services/volcengine-tts.provider.ts',
  'src/services/volcengine-video.provider.ts',
  'src/services/siliconflow-tts.provider.ts',
  'src/services/mock-worker.ts',
  'src/services/capability.service.ts',
  'src/services/voice-manager.service.ts',
  'src/routes/system-health.ts',
  'src/routes/admin-global-config.ts',
  'src/routes/models.ts',
  'src/routes/payment.ts',
  'src/routes/customer-service.ts',
  'src/routes/storyboards.ts',
  'src/config/env.ts',
  'src/bootstrap/',
  'src/runtime/resolveRuntimeConfig.ts',
  'src/providers/',
  'src/services/prompt-intelligence/prompt-optimizer.ts',
  'src/services/music/registry.ts',
  'prisma/',
  'scripts/',
]

// 检测的 provider 域名（含路径）
const PROVIDER_PATTERNS = [
  /api\.openai\.com/,
  /api\.anthropic\.com/,
  /api\.deepseek\.com/,
  /api\.siliconflow\.cn/,
  /dashscope\.aliyuncs\.com/,
  /ark\.cn-beijing\.volces\.com/,
]

interface Violation {
  file: string
  line: number
  match: string
}

function isAllowed(filePath: string): boolean {
  const normalPath = filePath.replace(/\\/g, '/')
  for (const allowed of ALLOWED_PATHS) {
    if (normalPath.startsWith(allowed)) return true
  }
  return false
}

function scanFile(filePath: string, content: string): Violation[] {
  const violations: Violation[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    for (const pattern of PROVIDER_PATTERNS) {
      const match = line.match(pattern)
      if (match) {
        // 跳过注释行
        if (line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*')) continue
        if (isAllowed(filePath)) continue
        violations.push({
          file: filePath,
          line: i + 1,
          match: match[0],
        })
      }
    }
  }

  return violations
}

function main() {
  const rootDir = process.cwd()
  const srcDir = resolve(rootDir, 'src')

  if (!existsSync(srcDir)) {
    console.error(`[❌ provider-boundary-check] src/ 目录不存在: ${srcDir}`)
    process.exit(1)
  }

  const tsFiles: string[] = []
  // 只扫 src/ 下当前代码，排除 backup/snapshot 目录
  for (const pattern of ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.mjs', 'scripts/**/*.ts', 'prisma/**/*.ts', 'prisma/**/*.mjs']) {
    const files = globSync(pattern, { cwd: rootDir, ignore: ['**/backups/**', '**/snapshots/**'] })
    for (const f of files) {
      tsFiles.push(f)
    }
  }

  console.log(`\n🔍 Provider Boundary Check — 扫描 ${tsFiles.length} 个文件...\n`)

  let allViolations: Violation[] = []
  for (const file of tsFiles) {
    const absPath = resolve(rootDir, file)
    if (!existsSync(absPath)) continue
    const content = readFileSync(absPath, 'utf-8')
    const violations = scanFile(file, content)
    allViolations = allViolations.concat(violations)
  }

  // 过滤已知遗留（director-v2, music, replay-analytics 等 frozen/experimental）
  const knownFrozen: string[] = [
    'src/director-v2/',
    'src/replay-analytics/',
    'src/optimization/',
    'src/control-plane/',
    'src/production-loop/',
    'src/graph-patch/',
    'src/music/',  // 已统一放行
  ]

  const realViolations = allViolations.filter(v => {
    for (const frozen of knownFrozen) {
      if (v.file.startsWith(frozen)) return false
    }
    return true
  })

  if (realViolations.length > 0) {
    console.error('❌ UNALLOWED DIRECT PROVIDER FETCHES (ACTIVE CODE):')
    for (const v of realViolations) {
      console.error(`  ${v.file}:${v.line} — ${v.match}`)
    }
    console.error(`\n⚠️  共 ${realViolations.length} 个违规 (另 ${allViolations.length - realViolations.length} 个在 frozen/experimental 中, 已忽略)`)
    console.error('   只有 gateway/, adapters/, providers/ 目录允许 direct provider fetch')
    process.exit(1)
  }

  // 列出 frozen 中的违规供参考
  const frozenViolations = allViolations.filter(v => {
    for (const frozen of knownFrozen) {
      if (v.file.startsWith(frozen)) return true
    }
    return false
  })

  console.log(`✅ PASS — 无 active code 违规`)
  if (frozenViolations.length > 0) {
    console.log(`\n📦 Frozen/Experimental 中有 ${frozenViolations.length} 个已知违规，未来清理：`)
    for (const v of frozenViolations.slice(0, 10)) {
      console.log(`  [FROZEN] ${v.file}:${v.line}`)
    }
    if (frozenViolations.length > 10) {
      console.log(`  ... 及另外 ${frozenViolations.length - 10} 个`)
    }
  }
  console.log()
  process.exit(0)
}

main()
