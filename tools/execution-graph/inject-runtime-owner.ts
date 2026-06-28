#!/usr/bin/env node
/**
 * inject-runtime-owner.ts — Phase 4.1 Step 1
 * 
 * Injects __RUNTIME_OWNER__ export into every runtime module.
 * No logic changes. No structural changes.
 * 
 * Usage: node inject-runtime-owner.ts [--dry-run]
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(import.meta.dirname, '../../backend/src')
const DRY_RUN = process.argv.includes('--dry-run')

interface OwnerDef {
  entry: string
  mode: 'SYNC' | 'ASYNC' | 'WORKER' | 'TOOL' | 'OBSERVE' | 'LEGACY' | 'SHADOW'
}

// Ownership map
const OWNER_MAP: Record<string, OwnerDef> = {
  // runtime core
  'runtime/narrative-gateway.ts':           { entry: 'narrative-gateway', mode: 'SYNC' },
  'runtime/pipeline-executor.ts':            { entry: 'narrative-gateway', mode: 'SYNC' },
  'runtime/degrade-engine.ts':               { entry: 'narrative-gateway', mode: 'SYNC' },
  'runtime/execution-guard.ts':              { entry: 'narrative-gateway', mode: 'SYNC' },
  'runtime/task-stream.ts':                  { entry: 'narrative-gateway', mode: 'SYNC' },
  'runtime/with-user-model-config.ts':       { entry: 'narrative-gateway', mode: 'SYNC' },

  // executors
  'runtime/executors/executor.registry.ts':  { entry: 'pipeline-executor', mode: 'SYNC' },
  'runtime/executors/base.executor.ts':      { entry: 'pipeline-executor', mode: 'SYNC' },
  'runtime/executors/base-llm.executor.ts':  { entry: 'pipeline-executor', mode: 'SYNC' },
  'runtime/executors/image-gen.executor.ts': { entry: 'pipeline-executor', mode: 'SYNC' },
  'runtime/executors/image-prompt.executor.ts': { entry: 'pipeline-executor', mode: 'SYNC' },
  'runtime/executors/prompt-builder.executor.ts': { entry: 'pipeline-executor', mode: 'SYNC' },
  'runtime/executors/script-writer.executor.ts':  { entry: 'pipeline-executor', mode: 'SYNC' },
  'runtime/executors/shot-split.executor.ts':     { entry: 'pipeline-executor', mode: 'SYNC' },
  'runtime/executors/storyboard.executor.ts':     { entry: 'pipeline-executor', mode: 'SYNC' },

  // providers
  'runtime/providers/provider.registry.ts':  { entry: 'provider.registry', mode: 'TOOL' },
  'runtime/providers/base.provider.ts':      { entry: 'provider.registry', mode: 'TOOL' },
  'runtime/providers/deepseek.provider.ts':  { entry: 'provider.registry', mode: 'TOOL' },
  'runtime/providers/openai.provider.ts':    { entry: 'provider.registry', mode: 'TOOL' },
  'runtime/providers/image.base.provider.ts':{ entry: 'provider.registry', mode: 'TOOL' },
  'runtime/providers/replicate.image.provider.ts': { entry: 'provider.registry', mode: 'TOOL' },

  // routes (production)
  'routes/script-submit.ts':                 { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/narrative-llm.ts':                 { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/pipeline.ts':                      { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/pipeline-jobs.ts':                 { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/showrunner.ts':                    { entry: 'narrative-gateway', mode: 'ASYNC' },
  'routes/director-v2.ts':                   { entry: 'director-api', mode: 'OBSERVE' },
  'routes/projects.ts':                      { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/projects-v2.ts':                   { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/execution-journal.ts':             { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/images.ts':                        { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/execution-images.ts':              { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/tts.ts':                           { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/tasks.ts':                         { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/upload.ts':                        { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/scenes.ts':                        { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/auth.ts':                          { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/admin-auth.ts':                    { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/user-api-keys.ts':                 { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/user-model-config.ts':             { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/storyboards.ts':                   { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/member.ts':                        { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/video-tasks.ts':                   { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/universe-images.ts':               { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/wechat-oauth.ts':                  { entry: 'narrative-gateway', mode: 'SYNC' },
  'routes/ai-tasks.ts':                      { entry: 'narrative-gateway', mode: 'SYNC' },

  // routes (frozen)
  'routes/shadow.ts':                        { entry: 'shadow', mode: 'SHADOW' },
  'routes/sandbox.ts':                       { entry: 'sandbox', mode: 'SHADOW' },
  'routes/control-plane.ts':                 { entry: 'control-plane', mode: 'LEGACY' },
  'routes/control-plane-v2.ts':              { entry: 'control-plane', mode: 'LEGACY' },
  'routes/execution-graph.ts':               { entry: 'execution-graph', mode: 'LEGACY' },
  'routes/director.ts':                      { entry: 'director-v1', mode: 'LEGACY' },
  'routes/director-simulation.ts':           { entry: 'director-simulation', mode: 'LEGACY' },
  'routes/cognition-loop.ts':                { entry: 'cognition-loop', mode: 'LEGACY' },

  // jobs (production)
  'jobs/showrunner-worker.ts':               { entry: 'worker-registry', mode: 'WORKER' },
  'jobs/cognition-worker.ts':                { entry: 'worker-registry', mode: 'WORKER' },
  'jobs/worker-memory.ts':                   { entry: 'worker-registry', mode: 'WORKER' },

  // jobs (experimental)
  'jobs/job-queue.ts':                       { entry: 'worker-registry', mode: 'WORKER' },
  'jobs/job-store.ts':                       { entry: 'worker-registry', mode: 'WORKER' },
  'jobs/llm-pool.ts':                        { entry: 'worker-registry', mode: 'WORKER' },
  'jobs/reflection-engine.ts':               { entry: 'worker-registry', mode: 'WORKER' },

  // agents
  'agents/aigc-orchestrator.ts':             { entry: 'narrative-gateway', mode: 'SYNC' },
  'agents/aigc-spec-agent.ts':               { entry: 'narrative-gateway', mode: 'SYNC' },
  'agents/character.agent.ts':               { entry: 'narrative-gateway', mode: 'SYNC' },
  'agents/image.agent.ts':                   { entry: 'narrative-gateway', mode: 'SYNC' },
  'agents/portrait-prompt.agent.ts':         { entry: 'narrative-gateway', mode: 'SYNC' },
  'agents/scene-image-prompt.agent.ts':      { entry: 'narrative-gateway', mode: 'SYNC' },
  'agents/scheduler.ts':                     { entry: 'narrative-gateway', mode: 'SYNC' },

  // services (production)
  'services/with-user-key.ts':               { entry: 'narrative-gateway', mode: 'SYNC' },
  'services/usage-quota.service.ts':         { entry: 'narrative-gateway', mode: 'SYNC' },
  'services/crypto.service.ts':              { entry: 'narrative-gateway', mode: 'SYNC' },
  'services/world-memory.service.ts':        { entry: 'narrative-gateway', mode: 'SYNC' },
  'services/project.service.ts':             { entry: 'narrative-gateway', mode: 'SYNC' },
  'services/scene.service.ts':               { entry: 'narrative-gateway', mode: 'SYNC' },
  'services/video.service.ts':               { entry: 'narrative-gateway', mode: 'SYNC' },
  'services/download.service.ts':            { entry: 'narrative-gateway', mode: 'SYNC' },

  // aliyun providers
  'services/aliyun-llm.provider.ts':         { entry: 'provider.registry', mode: 'TOOL' },
  'services/aliyun-image.provider.ts':       { entry: 'provider.registry', mode: 'TOOL' },
  'services/aliyun-tts.provider.ts':         { entry: 'provider.registry', mode: 'TOOL' },
  'services/aliyun-video.provider.ts':       { entry: 'provider.registry', mode: 'TOOL' },

  // volcengine providers
  'services/volcengine-image.provider.ts':   { entry: 'provider.registry', mode: 'TOOL' },
  'services/volcengine-tts.provider.ts':     { entry: 'provider.registry', mode: 'TOOL' },
  'services/volcengine-video.provider.ts':   { entry: 'provider.registry', mode: 'TOOL' },

  // siliconflow
  'services/siliconflow-tts.provider.ts':    { entry: 'provider.registry', mode: 'TOOL' },

  // scheduler
  'scheduler/agent-pool.ts':                 { entry: 'narrative-gateway', mode: 'SYNC' },
  'scheduler/aggregation-layer.ts':          { entry: 'narrative-gateway', mode: 'SYNC' },
  'scheduler/graph-scheduler.ts':            { entry: 'narrative-gateway', mode: 'SYNC' },
  'scheduler/graph.instance.ts':             { entry: 'narrative-gateway', mode: 'SYNC' },
  'scheduler/index.ts':                      { entry: 'narrative-gateway', mode: 'SYNC' },
  'scheduler/resource-router.ts':            { entry: 'narrative-gateway', mode: 'SYNC' },

  // api
  'api/runtime/index.ts':                    { entry: 'narrative-gateway', mode: 'SYNC' },
  'api/runtime/runtime.controller.ts':       { entry: 'narrative-gateway', mode: 'SYNC' },
  'api/runtime/runtime.routes.ts':           { entry: 'narrative-gateway', mode: 'SYNC' },
  'api/runtime/runtime.service.ts':          { entry: 'narrative-gateway', mode: 'SYNC' },
  'api/runtime/run.model.ts':               { entry: 'narrative-gateway', mode: 'SYNC' },
  'api/runtime/dto/runtime.dto.ts':          { entry: 'narrative-gateway', mode: 'SYNC' },
  'api/runtime/graph.adapter.ts':            { entry: 'narrative-gateway', mode: 'SYNC' },

  // plugins
  'plugins/auth.ts':                         { entry: 'narrative-gateway', mode: 'SYNC' },
  'plugins/cors.ts':                         { entry: 'narrative-gateway', mode: 'SYNC' },
  'plugins/runtime-context.ts':              { entry: 'narrative-gateway', mode: 'SYNC' },

  // utils
  'utils/index.ts':                          { entry: 'narrative-gateway', mode: 'SYNC' },
  'utils/redis-state.ts':                    { entry: 'narrative-gateway', mode: 'SYNC' },

  // director-v2 (all OBSERVE)
  'director-v2/index.ts':                    { entry: 'director-api', mode: 'OBSERVE' },
  'director-v2/constitution-compiler.ts':    { entry: 'director-api', mode: 'OBSERVE' },
  'director-v2/director-bridge.ts':          { entry: 'director-api', mode: 'OBSERVE' },
  'director-v2/runtime/api-surface.ts':      { entry: 'director-api', mode: 'OBSERVE' },
  'director-v2/runtime/cinematic-intent.ts': { entry: 'director-api', mode: 'OBSERVE' },
  'director-v2/runtime/director-projection.ts': { entry: 'director-api', mode: 'OBSERVE' },
  'director-v2/runtime/semantic-energy.ts':  { entry: 'director-api', mode: 'OBSERVE' },
  'director-v2/diagnostics/director-field.ts':   { entry: 'director-api', mode: 'OBSERVE' },
  'director-v2/diagnostics/system-diagnostics.ts':{ entry: 'director-api', mode: 'OBSERVE' },
  'director-v2/diagnostics/golden-suite.ts':     { entry: 'director-api', mode: 'OBSERVE' },
}

// Also handle asset runtime modules as SHADOW
const ASSET_SHADOW = [
  'runtime/asset-state-audit.ts',
  'runtime/asset-state-guard.ts',
  'runtime/asset-state-machine.ts',
  'runtime/asset-state-transition.ts',
]

for (const f of ASSET_SHADOW) {
  OWNER_MAP[f] = { entry: 'asset-state', mode: 'SHADOW' }
}

// Frozen/experimental jobs as SHADOW
const SHADOW_JOBS = [
  'jobs/intent-engine-v3/index.ts',
  'jobs/intent-engine-v3/intent-classifier.ts',
  'jobs/intent-engine-v3/intent-router.ts',
  'jobs/intent-engine-v3/intent-strength-analyzer.ts',
  'jobs/intent-engine-v3/narrative-elasticity-engine.ts',
  'jobs/multi-scenario-v4/director-selection-brain.ts',
  'jobs/multi-scenario-v4/index.ts',
  'jobs/multi-scenario-v4/scenario-evaluator.ts',
  'jobs/multi-scenario-v4/scenario-generator.ts',
  'jobs/multi-scenario-v4/scenario-simulator.ts',
  'jobs/index.ts',
]

for (const f of SHADOW_JOBS) {
  OWNER_MAP[f] = { entry: 'shadow-jobs', mode: 'SHADOW' }
}

// Graph modules as SHADOW
const SHADOW_GRAPH = [
  'graph-runtime/index.ts',
  'graph-runtime/compiler/graph.compiler.ts',
  'graph-runtime/core/edge.contract.ts',
  'graph-runtime/core/graph.types.ts',
  'graph-runtime/core/node.schema.ts',
  'graph-runtime/registry/node.registry.ts',
  'graph-runtime/runtime/context.ts',
  'graph-runtime/runtime/edge.resolver.ts',
  'graph-runtime/runtime/graph.runtime.ts',
  'graph-runtime/runtime/node.executor.ts',
  'graph-runtime/validator/graph.validator.ts',
]

for (const f of SHADOW_GRAPH) {
  OWNER_MAP[f] = { entry: 'graph-runtime', mode: 'SHADOW' }
}

// Queue modules as SHADOW
const SHADOW_QUEUE = [
  'queue/capability-dispatcher.ts',
  'queue/job-events.ts',
  'queue/mock-provider.ts',
  'queue/queue-manager.ts',
  'queue/redis.ts',
  'queue/task-queue.ts',
  'queue/worker-runtime.ts',
]

for (const f of SHADOW_QUEUE) {
  OWNER_MAP[f] = { entry: 'queue-legacy', mode: 'SHADOW' }
}

// Showrunner v1 as LEGACY
const LEGACY_SHOWRUNNER = [
  'showrunner/index.ts',
  'showrunner/showrunner-core.ts',
  'showrunner/narrative-understanding.ts',
  'showrunner/emotional-engine.ts',
  'showrunner/structural-planner.ts',
  'showrunner/execution-orchestrator.ts',
  'showrunner/production-strategist.ts',
]

for (const f of LEGACY_SHOWRUNNER) {
  OWNER_MAP[f] = { entry: 'showrunner-v1', mode: 'LEGACY' }
}

// Cognition loop as LEGACY
const LEGACY_COGNITION = [
  'cognition-loop/index.ts',
  'cognition-loop/director-cognition-loop.engine.ts',
  'cognition-loop/director-intent-state.ts',
  'cognition-loop/intent-enforcement.ts',
  'cognition-loop/intent-feedback-analyzer.ts',
]

for (const f of LEGACY_COGNITION) {
  OWNER_MAP[f] = { entry: 'cognition-loop', mode: 'LEGACY' }
}

const OWNER_STUB = `// @phase4-owner

export const __RUNTIME_OWNER__ = `

function injectOwner(filePath: string, owner: OwnerDef): boolean {
  const fullPath = path.join(ROOT, filePath)
  if (!fs.existsSync(fullPath)) return false

  let content = fs.readFileSync(fullPath, 'utf-8')

  // Skip if already has owner
  if (content.includes('__RUNTIME_OWNER__')) {
    return false
  }

  // Find position to inject: after last import but before first export/function
  // Simple approach: inject at end of file
  const stub = `${OWNER_STUB}${JSON.stringify(owner, null, 2)};\n\n`
  
  if (!DRY_RUN) {
    fs.writeFileSync(fullPath, content.trimEnd() + '\n\n' + stub)
  } else {
    console.log(`[DRY-RUN] Would inject owner into: ${filePath} → ${owner.mode}/${owner.entry}`)
  }
  return true
}

function main() {
  console.log('# Phase 4.1 — Inject Runtime Ownership\n')
  if (DRY_RUN) console.log('  MODE: DRY RUN (no files modified)\n')

  let injected = 0
  let skipped = 0
  let notFound = 0

  const entries = Object.entries(OWNER_MAP).sort(([a], [b]) => a.localeCompare(b))

  for (const [filePath, owner] of entries) {
    const fullPath = path.join(ROOT, filePath)
    if (!fs.existsSync(fullPath)) {
      notFound++
      continue
    }

    if (injectOwner(filePath, owner)) {
      injected++
    } else {
      skipped++
    }
  }

  console.log(`  Injected:   ${injected}`)
  console.log(`  Skipped:    ${skipped} (already have owner or not found)`)
  console.log(`  Not found:  ${notFound}`)
  console.log()

  // By mode summary
  const byMode: Record<string, number> = {}
  for (const owner of Object.values(OWNER_MAP)) {
    byMode[owner.mode] = (byMode[owner.mode] || 0) + 1
  }

  console.log('  By mode:')
  for (const [mode, count] of Object.entries(byMode).sort()) {
    console.log(`    ${mode.padEnd(10)} ${count}`)
  }
  console.log()

  if (DRY_RUN) {
    console.log('  Run without --dry-run to apply.')
  }
}

main()
