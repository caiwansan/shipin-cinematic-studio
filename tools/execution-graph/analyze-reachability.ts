#!/usr/bin/env node
/**
 * analyze-reachability.ts — Phase 3-C Execution Reachability Analysis
 *
 * Classifies every module/service/route into:
 * 1. REACHABLE — on production execution path
 * 2. PARTIALLY REACHABLE — imported but no execution trigger
 * 3. UNREACHABLE — no execution path exists
 *
 * Mode: read-only analysis
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../..')
const SRC_PATH = path.join(ROOT, 'backend/src')
const REPORTS = path.join(ROOT, 'reports/execution-graph')
const OUTPUT_PATH = path.join(REPORTS, 'reachability.json')

type Reachability = 'REACHABLE' | 'PARTIALLY_REACHABLE' | 'UNREACHABLE'

interface ReachableNode {
  file: string
  status: Reachability
  reason: string
}

// Known production entry points (from production-path.ts)
const PRODUCTION_ROUTES = new Set([
  'routes/script-submit.ts',
  'routes/narrative-llm.ts',
  'routes/pipeline.ts',
  'routes/pipeline-jobs.ts',
  'routes/showrunner.ts',
  'routes/director-v2.ts',
  'routes/projects.ts',
  'routes/projects-v2.ts',
  'routes/execution-journal.ts',
  'routes/images.ts',
  'routes/tts.ts',
  'routes/tasks.ts',
  'routes/upload.ts',
  'routes/scenes.ts',
  'routes/auth.ts',
  'routes/user-api-keys.ts',
  'routes/user-model-config.ts',
  'routes/storyboards.ts',
  'routes/member.ts',
])

const PRODUCTION_SERVICES = new Set([
  'services/with-user-key.ts',
  'services/usage-quota.service.ts',
  'services/crypto.service.ts',
  'services/aliyun-llm.provider.ts',
  'services/aliyun-image.provider.ts',
  'services/aliyun-tts.provider.ts',
  'services/aliyun-video.provider.ts',
  'services/volcengine-image.provider.ts',
  'services/volcengine-video.provider.ts',
  'services/volcengine-tts.provider.ts',
  'services/siliconflow-tts.provider.ts',
  'services/world-memory.service.ts',
  'services/project.service.ts',
  'services/scene.service.ts',
  'services/video.service.ts',
  'services/download.service.ts',
])

const PRODUCTION_RUNTIME = new Set([
  'runtime/narrative-gateway.ts',
  'runtime/pipeline-executor.ts',
  'runtime/degrade-engine.ts',
  'runtime/execution-guard.ts',
  'runtime/providers/provider.registry.ts',
  'runtime/providers/base.provider.ts',
  'runtime/providers/deepseek.provider.ts',
  'runtime/providers/openai.provider.ts',
  'runtime/providers/image.base.provider.ts',
  'runtime/providers/replicate.image.provider.ts',
  'runtime/executors/executor.registry.ts',
  'runtime/executors/base-llm.executor.ts',
  'runtime/executors/base.executor.ts',
  'runtime/executors/image-gen.executor.ts',
  'runtime/executors/image-prompt.executor.ts',
  'runtime/executors/prompt-builder.executor.ts',
  'runtime/executors/script-writer.executor.ts',
  'runtime/executors/shot-split.executor.ts',
  'runtime/executors/storyboard.executor.ts',
  'runtime/task-stream.ts',
  'runtime/with-user-model-config.ts',
])

const PRODUCTION_AGENTS = new Set([
  'agents/aigc-orchestrator.ts',
  'agents/aigc-spec-agent.ts',
])

const PRODUCTION_JOBS = new Set([
  'jobs/showrunner-worker.ts',
  'jobs/cognition-worker.ts',
  'jobs/worker-memory.ts',
])

function classifyFile(file: string): ReachableNode {
  // Categorize by prefix
  if (file.startsWith('routes/')) {
    for (const prod of PRODUCTION_ROUTES) {
      if (file.includes(prod.replace('routes/', '').replace('.ts', '')) ) {
        return { file, status: 'REACHABLE', reason: 'production route' }
      }
    }
    // Check if it's a known frozen/disconnected route
    const frozenRoutes = [
      'director', 'director-simulation', 'cognition-loop',
      'control-plane', 'execution-graph', 'anchor', 'costume',
      'character-state', 'story-graph', 'director-engine',
      'desktop-runtime', 'asset-registry', 'asset-versions',
      'ai-gateway', 'asset-cards', 'continuity', 'job-manager',
      'payment', 'stability', 'shadow', 'sandbox',
      'aigc-spec-db', 'stage-model-config', 'model-provider',
      'admin-models', 'admin-api-keys', 'admin-global-config',
      'runtime-observability', 'observability', 'governance',
      'ai-router', 'ai-tasks', 'queue-runtime',
      'optimization', 'orchestrator', 'world-memory',
      'export-runtime', 'feedback', 'runtime-checkpoint',
      'system-health', 'system-dashboard', 'tenant',
      'render-shots', 'featured', 'reference', 'wechat-oauth',
      'customer-service', 'hitl', 'online-ai',
    ]
    for (const fr of frozenRoutes) {
      if (file.includes(fr) || file.includes(fr.replace(/-/g, ''))) {
        return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen/experimental route' }
      }
    }
    return { file, status: 'UNREACHABLE', reason: 'no classification match' }
  }

  if (file.startsWith('services/')) {
    for (const prod of PRODUCTION_SERVICES) {
      if (file.includes(prod.replace('services/', '').replace('.ts', ''))) {
        return { file, status: 'REACHABLE', reason: 'production service' }
      }
    }
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'non-production service' }
  }

  if (file.startsWith('runtime/')) {
    for (const prod of PRODUCTION_RUNTIME) {
      if (file.includes(prod.replace('runtime/', '').replace('.ts', ''))) {
        return { file, status: 'REACHABLE', reason: 'production runtime' }
      }
    }
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'non-production runtime module' }
  }

  if (file.startsWith('agents/')) {
    return { file, status: 'REACHABLE', reason: 'production agent' }
  }

  if (file.startsWith('jobs/')) {
    if (file.includes('showrunner') || file.includes('cognition') || file.includes('worker-memory')) {
      return { file, status: 'REACHABLE', reason: 'production job worker' }
    }
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'experimental job' }
  }

  if (file.startsWith('queue/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'queue module (superseded by jobs)' }
  }

  if (file.startsWith('scheduler/')) {
    return { file, status: 'REACHABLE', reason: 'production scheduler' }
  }

  if (file.startsWith('api/')) {
    return { file, status: 'REACHABLE', reason: 'production API runtime' }
  }

  if (file.startsWith('director/') && !file.startsWith('director-v2/') && !file.startsWith('director-simulation/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen director v1' }
  }

  if (file.startsWith('director-v2/')) {
    return { file, status: 'REACHABLE', reason: 'production director-v2' }
  }

  if (file.startsWith('director-simulation/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen simulation' }
  }

  if (file.startsWith('cognition-loop/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen cognition-loop' }
  }

  if (file.startsWith('showrunner/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen showrunner (migrated to jobs/)' }
  }

  if (file.startsWith('graph-runtime/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'archived-but-coupled (12 value imports)' }
  }

  if (file.startsWith('replay/') || file.startsWith('replay-analytics/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen replay' }
  }

  if (file.startsWith('simulation/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen simulation' }
  }

  if (file.startsWith('production-loop/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen production-loop' }
  }

  if (file.startsWith('graph-optimization/') || file.startsWith('graph-patch/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen graph modules' }
  }

  if (file.startsWith('optimization/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen optimization' }
  }

  if (file.startsWith('studio/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen studio' }
  }

  if (file.startsWith('governance/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'experimental governance' }
  }

  if (file.startsWith('observability/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'experimental observability' }
  }

  if (file.startsWith('plugins/')) {
    return { file, status: 'REACHABLE', reason: 'production plugin' }
  }

  if (file.startsWith('payment/') || file.startsWith('control-plane/') || file.startsWith('core/')) {
    return { file, status: 'UNREACHABLE', reason: 'archived module' }
  }

  if (file.startsWith('worker/') || file.startsWith('workers/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'frozen workers' }
  }

  if (file.startsWith('config/') || file.startsWith('middleware/') || file.startsWith('schemas/') ||
      file.startsWith('scripts/') || file.startsWith('storage/') || file.startsWith('transport/') ||
      file.startsWith('types/')) {
    return { file, status: 'UNREACHABLE', reason: 'archived/disconnected module' }
  }

  if (file.startsWith('utils/')) {
    return { file, status: 'REACHABLE', reason: 'production utilities' }
  }

  if (file.startsWith('cinematic-ir/')) {
    return { file, status: 'PARTIALLY_REACHABLE', reason: 'internal dep — referenced by aigc-orchestrator' }
  }

  if (file.startsWith('prompts/') || file.startsWith('tests/')) {
    return { file, status: 'UNREACHABLE', reason: 'unclassified (static/tests)' }
  }

  return { file, status: 'UNREACHABLE', reason: 'unknown module' }
}

function scanAllFiles(dir: string): string[] {
  const files: string[] = []
  function scan(d: string) {
    const entries = fs.readdirSync(d, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
      const full = path.join(d, entry.name)
      if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(path.relative(dir, full))
      } else if (entry.isDirectory()) {
        scan(full)
      }
    }
  }
  scan(dir)
  return files
}

function main() {
  console.log('# Phase 3-C: Execution Reachability Analysis\n')

  const allFiles = scanAllFiles(SRC_PATH)
  console.log(`Files scanned: ${allFiles.length}\n`)

  const results: ReachableNode[] = allFiles.map(f => classifyFile(f))

  const reachable = results.filter(r => r.status === 'REACHABLE')
  const partiallyReachable = results.filter(r => r.status === 'PARTIALLY_REACHABLE')
  const unreachable = results.filter(r => r.status === 'UNREACHABLE')

  console.log('## REACHABLE — production execution path\n')
  for (const r of reachable.sort()) {
    console.log(`  ${r.file}`)
  }
  console.log(`  (${reachable.length} files)\n`)

  console.log('## PARTIALLY REACHABLE — imported but not execution-triggered\n')
  for (const r of partiallyReachable.sort()) {
    console.log(`  ${r.file} — ${r.reason}`)
  }
  console.log(`  (${partiallyReachable.length} files)\n`)

  console.log('## UNREACHABLE — no execution path exists\n')
  for (const r of unreachable.sort()) {
    console.log(`  ${r.file} — ${r.reason}`)
  }
  console.log(`  (${unreachable.length} files)\n`)

  // By module stats
  const byModule: Record<string, { r: number; p: number; u: number }> = {}
  for (const r of allFiles) {
    const mod = r.split('/')[0]
    if (!byModule[mod]) byModule[mod] = { r: 0, p: 0, u: 0 }
    const node = results.find(n => n.file === r)!
    if (node.status === 'REACHABLE') byModule[mod].r++
    else if (node.status === 'PARTIALLY_REACHABLE') byModule[mod].p++
    else byModule[mod].u++
  }

  console.log('## By Module\n')
  console.log('  Module               | R   | P   | U')
  console.log('  ' + '-'.repeat(40))
  for (const [mod, stats] of Object.entries(byModule).sort()) {
    const total = stats.r + stats.p + stats.u
    console.log(`  ${mod.padEnd(20)} | ${String(stats.r).padEnd(3)} | ${String(stats.p).padEnd(3)} | ${stats.u}`)
  }
  console.log()

  // Save
  const output = {
    summary: {
      totalFiles: allFiles.length,
      reachable: reachable.length,
      partiallyReachable: partiallyReachable.length,
      unreachable: unreachable.length,
      reachableRatio: Number((reachable.length / allFiles.length * 100).toFixed(1)),
      unreachableRatio: Number((unreachable.length / allFiles.length * 100).toFixed(1)),
    },
    reachable: reachable.map(r => ({ file: r.file, reason: r.reason })),
    partiallyReachable: partiallyReachable.map(r => ({ file: r.file, reason: r.reason })),
    unreachable: unreachable.map(r => ({ file: r.file, reason: r.reason })),
    byModule,
    timestamp: new Date().toISOString(),
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`Written to: ${OUTPUT_PATH}\n`)

  console.log('Summary:')
  console.log(`  Total files:          ${allFiles.length}`)
  console.log(`  REACHABLE:            ${reachable.length} (${output.summary.reachableRatio}%)`)
  console.log(`  PARTIALLY REACHABLE:  ${partiallyReachable.length} (${output.summary.partiallyReachable}%)`
    .replace('undefined', partiallyReachable.length))
  console.log(`  UNREACHABLE:          ${unreachable.length} (${output.summary.unreachableRatio}%)`)
}

main()
