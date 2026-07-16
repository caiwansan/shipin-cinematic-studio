/**
 * narrative-bootstrap.ts - NOS 启动自检
 *
 * 后端启动后执行的自检：
 * 1. 验证所有 Runtime 文件可加载
 * 2. 执行一次 Integrity Check（Phase 1.5）
 *
 * 路由注册已提前到 listen 前（在 index.ts 中 inline 完成）
 *
 * 领域隔离：仅 Novel Domain
 */

import { narrativeRuntime } from './index.js'
import { narrativeConfig } from './narrative-config.js'

let initialized = false

export async function bootstrapNarrativeRuntime(): Promise<void> {
  if (initialized) return

  console.log('[NOS] 🟢 Narrative Runtime bootstrap started (post-listen)')

  // Step 0: 确保配置已加载（异步，从 env/文件读取），然后输出
  await narrativeConfig.ensureConfigLoaded()
  console.log(`[NOS] ⚙️  Runtime Config: ${narrativeConfig.getStartupLog()}`)

  // Step 1: 验证所有 Runtime 文件可加载
  const runtimeList = [
    'character', 'event', 'timeline',
    'relationship', 'knowledge', 'world', 'foreshadow',
    'inventory', 'organization',
  ]

  const availableRuntimes = runtimeList.filter(name => {
    try {
      const rt = (narrativeRuntime as any)[name]
      return rt && typeof rt.initialize === 'function'
    } catch {
      return false
    }
  })

  console.log(`[NOS] ✅ ${availableRuntimes.length}/${runtimeList.length} Runtimes loaded: ${availableRuntimes.join(', ')}`)

  // Step 2: Integrity Check 自检（延迟执行，不阻塞启动）
  scheduleIntegrityCheck().catch(err => {
    console.warn(`[NOS] ⚠️ Integrity check scheduled failed: ${err.message}`)
  })

  initialized = true
}

/**
 * 延迟执行 Integrity Check（等所有服务就绪后）
 */
async function scheduleIntegrityCheck(): Promise<void> {
  // 延迟 10 秒，等待所有服务完全启动
  await new Promise(resolve => setTimeout(resolve, 10000))

  const fs = await import('fs')
  const path = await import('path')
  const dataDir = path.resolve(process.cwd(), 'data/runtime/narrative')

  try {
    if (!fs.existsSync(dataDir)) {
      console.log('[NOS] Integrity check: no data directories found - skipped')
      return
    }

    const projectIds = fs.readdirSync(dataDir).filter((dir: string) => {
      const charFile = path.join(dataDir, dir, 'character', 'characters.json')
      return fs.existsSync(charFile)
    })

    if (projectIds.length === 0) {
      console.log('[NOS] Integrity check: no initialized projects found - skipped')
      return
    }

    for (const projectId of projectIds) {
      try {
        const report = await narrativeRuntime.integrityCheck(projectId)
        if (report.passed) {
          console.log(`[NOS] ✅ Post-startup integrity check PASS for project ${projectId}`)
        } else {
          console.warn(`[NOS] ⚠️ Post-startup integrity check FAIL for project ${projectId}: ${report.stats.errors} errors, ${report.stats.warnings} warnings`)
          const topErrors = report.issues.filter(i => i.severity === 'error').slice(0, 3)
          for (const e of topErrors) {
            console.warn(`[NOS]   ERROR [${e.runtime}] ${e.message}`)
          }
        }
      } catch (err) {
        console.warn(`[NOS] ⚠️ Integrity check failed for project ${projectId}: ${(err as Error).message}`)
      }
    }
  } catch (err) {
    console.warn(`[NOS] ⚠️ Integrity scan failed: ${(err as Error).message}`)
  }
}

/** 获取 Narrative Runtime 实例（供其他模块引用） */
export function getNarrativeRuntime() {
  return narrativeRuntime
}
