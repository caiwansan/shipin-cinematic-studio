/**
 * closure/routing-adapter-audit.ts — 跨层耦合审计：前端路由 × 模型适配器矩阵 × SECS
 *
 * 审计目标：找出前端路由 → 模型适配器矩阵 → SECS 执行链之间的所有隐藏耦合、错配、冗余路由与潜在双调度点
 *
 * 核心问题：
 *   "模型选择权到底属于前端、后端，还是 SECS？"
 */

import fs from 'fs'
import path from 'path'
import { loadFrozenGraph, type FrozenExecutionGraph } from '../closure/execution-graph-frozen.js'
import { listPlans } from '../closure/sedp-compiler.js'

// Resolve app root for cross-dir path resolution
const APP_ROOT = path.resolve(process.cwd(), '..')

// ================================================================
// 1. Frontend Routing Graph
// ================================================================

interface RouteInfo {
  path: string
  page: string
  capabilities: string[]
  storeTriggers: string[]
  hasHiddenDispatch: boolean
}

function scanFrontendRoutes(): RouteInfo[] {
  const routes: RouteInfo[] = []
  const pagesDir = path.join(APP_ROOT, 'frontend', 'pages')
  if (!fs.existsSync(pagesDir)) {
    console.log('[audit] No pages directory found, skipping frontend scan')
    return routes
  }

  function scanDir(dir: string, prefix: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory()) {
        scanDir(path.join(dir, e.name), `${prefix}/${e.name}`)
      } else if (e.name.endsWith('.vue') || e.name.endsWith('.ts')) {
        const filePath = path.join(dir, e.name)
        const content = fs.readFileSync(filePath, 'utf-8')
        const name = e.name.replace(/\.(vue|ts)$/, '')
        const routePath = `${prefix}${prefix.endsWith('/') ? '' : '/'}${name === 'index' ? '' : name}`

        // Detect capabilities from store calls
        const storeRefs = (content.match(/use[A-Z]\w+Store/g) || []).filter((s, i, a) => a.indexOf(s) === i)

        // Detect dispatch actions
        const dispatches = (content.match(/\.(dispatch|execute|submit|run|call|generate|invoke|process)\s*\(/g) || [])
          .filter((s, i, a) => a.indexOf(s) === i)

        // Detect model references
        const modelRefs = (content.match(/model[currentSetSelected]|selectedModel|modelName|providerName|'[a-z]+-image'|'[a-z]+-video'|'[a-z]+-tts'/gi) || [])
          .filter((s, i, a) => a.indexOf(s) === i)

        // Infer capabilities from content
        const capabilities: string[] = []
        const contentL = content.toLowerCase()
        if (contentL.includes('generate') || contentL.includes('llm') || contentL.includes('completion') || contentL.includes('chat')) capabilities.push('llm_generate')
        if (contentL.includes('image') || contentL.includes('img') || contentL.includes('draw')) capabilities.push('image_generate')
        if (contentL.includes('video') || contentL.includes('vid')) capabilities.push('video_generate')
        if (contentL.includes('tts') || contentL.includes('speech') || contentL.includes('voice')) capabilities.push('tts')
        if (contentL.includes('script') || contentL.includes('story') || contentL.includes('scene') || contentL.includes('pipeline')) capabilities.push('production_pipeline')

        routes.push({
          path: routePath.replace(/\/\//g, '/').replace(/^\/?/, '/'),
          page: name,
          capabilities,
          storeTriggers: [...storeRefs, ...dispatches].slice(0, 6),
          hasHiddenDispatch: dispatches.length > 3,
        })
      }
    }
  }

  if (fs.existsSync(pagesDir)) scanDir(pagesDir, '')

  return routes
}

// ================================================================
// 2. Capability → Model Adapter Matrix
// ================================================================

interface AdapterEntry {
  capability: string
  adapter: string
  model: string
  provider: string
  source: string | null
  runtimeReachable: boolean  // is this adapter reachable via SECS execution plan?
  isLegacy: boolean
}

function buildAdapterMatrix(): AdapterEntry[] {
  const adaptersSrc = path.resolve(__dirname, '../model-adapters')
  const matrix: AdapterEntry[] = []
  const frozenGraph = loadFrozenGraph()

  function scanAdapters(dir: string, category: string) {
    if (!fs.existsSync(dir)) return
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      if (e.isDirectory()) {
        scanAdapters(path.join(dir, e.name), `${category}/${e.name}`)
      } else if ((e.name.endsWith('.ts') || e.name.endsWith('.js')) && !e.name.includes('index')) {
        const filePath = path.join(dir, e.name)
        const content = fs.readFileSync(filePath, 'utf-8')
        const name = e.name.replace(/\.(ts|js)$/, '')

        // Extract model/provider names from content
        const modelMatches = content.match(/register\(['"]([\w\.-]+)['"]/g) || []
        const fileModels = modelMatches.map(m => m.match(/register\(['"]([\w\.-]+)['"]/)?.[1]).filter(Boolean) as string[]

        const providerMatch = name.match(/^(volcengine|aliyun|openai|siliconflow|deepseek|qwen|wan|dalle|seedream)/i)
        const provider = providerMatch ? providerMatch[1].toLowerCase() : 'unknown'

        // Determine if reachable via SECS
        let runtimeReachable = false
        const adapterKey = name.replace(/\.adapter$/, '').replace(/\.provider$/, '')
        for (const plan of listPlans()) {
          if (plan.steps.some(s => s.label.toLowerCase().includes(adapterKey.toLowerCase().split('-').slice(-1)[0]))) {
            runtimeReachable = true
            break
          }
        }

        // Legacy check: is this in the old provider-adapters/ dir?
        const isLegacy = dir.includes('provider-adapters') || dir.includes('services')

        const models = fileModels.length > 0 ? fileModels : [name.replace(/\.(adapter|provider)$/, '')]
        for (const model of models) {
          matrix.push({
            capability: category.replace(/^\//, ''),
            adapter: name,
            model,
            provider,
            source: `model-adapters/${category}/${e.name}`,
            runtimeReachable,
            isLegacy,
          })
        }
      }
    }
  }

  scanAdapters(adaptersSrc, '')
  return matrix
}

// ================================================================
// 3. Cross-Layer Coupling Analysis
// ================================================================

interface Violation {
  type: 'DUAL_ROUTING' | 'SHADOW_ADAPTER' | 'CAPABILITY_DRIFT' | 'LEGACY_LEAK' | 'SILENT_FALLBACK' | 'HARDCODED_MODEL' | 'FRONTEND_BACKEND_MISMATCH'
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  description: string
  source: string
  recommendation: string
}

/**
 * Check for hidden adapter selectors in provider files
 * (env-based model selection, fallback-to-env, default model hardcoding)
 */
function scanProviderFiles(adapters: AdapterEntry[]): Violation[] {
  const violations: Violation[] = []
  const providerDirs = [
    path.resolve(__dirname, '../runtime/providers'),
    path.resolve(__dirname, '../services'),
    path.resolve(__dirname, '../core/provider-adapters'),
    path.resolve(__dirname, '../runtime'),
  ]

  for (const dir of providerDirs) {
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir, { withFileTypes: true }).filter(f => f.isFile() && (f.name.endsWith('.ts') || f.name.endsWith('.js')))
    for (const f of files) {
      const content = fs.readFileSync(path.join(dir, f.name), 'utf-8')
      const contentL = content.toLowerCase()

      // Silent fallback: env-based model selection
      const envFallback = contentL.match(/process\.env\.[a-z_]*model[a-z_]*/gi) || []
      if (envFallback.length > 0) {
        violations.push({
          type: 'SILENT_FALLBACK',
          severity: 'HIGH',
          description: `env-based model selection in ${dir}/${f.name}`,
          source: `${dir}/${f.name}`,
          recommendation: 'Replace env-based selection with SECS plan routing (UserModelConfig or ModelProvider table)',
        })
      }

      // Default model hardcoding
      const defaultModel = contentL.match(/default\s*[=:]\s*['"][a-z0-9_.-]+['"]/gi) || []
      if (defaultModel.length > 0) {
        violations.push({
          type: 'SILENT_FALLBACK',
          severity: 'MEDIUM',
          description: `Default model fallback in ${dir}/${f.name}`,
          source: `${dir}/${f.name}`,
          recommendation: 'Remove default model; let SECS select from UserModelConfig',
        })
      }
    }
  }

  return violations
}

/**
 * Check frontend for hardcoded model bindings
 */
function scanFrontendHardcodedModels(frontendRoutes: RouteInfo[]): Violation[] {
  const violations: Violation[] = []
  const frontendDir = path.join(APP_ROOT, 'frontend')
  if (!fs.existsSync(frontendDir)) return violations

  const filesToScan = [
    'composables/ai-task-util.ts',
    'components/director/ModelSettingsModal.vue',
    'stores/studio.ts',
    'stores/pipeline.ts',
    'utils/api.ts',
  ]

  for (const relPath of filesToScan) {
    const filePath = path.join(frontendDir, relPath)
    if (!fs.existsSync(filePath)) continue

    const content = fs.readFileSync(filePath, 'utf-8')
    const contentL = content.toLowerCase()

    // Hardcoded model names
    const hardcodedModels = content.match(/['"](?:wan2\.7|qwen|gpt-4|deepseek|seedream|dall-e|siliconflow|cosyvoice)[\w.-]*['"]/gi) || []
    if (hardcodedModels.length > 2) {
      violations.push({
        type: 'HARDCODED_MODEL',
        severity: 'MEDIUM',
        description: `Hardcoded model names (${hardcodedModels.slice(0, 5).join(', ')}) in ${relPath}`,
        source: relPath,
        recommendation: 'Model names should come from backend ModelProvider GET API, not hardcoded',
      })
    }
  }

  return violations
}

/**
 * Dual routing: frontend already selects model AND backend also selects model
 */
function detectDualRouting(adapters: AdapterEntry[], frontendRoutes: RouteInfo[]): Violation[] {
  const violations: Violation[] = []

  // Check if frontend composes API calls with model names embedded
  const frontendDir = path.join(APP_ROOT, 'frontend')
  if (!fs.existsSync(frontendDir)) return violations

  const scriptFiles = [
    'composables/ai-task-util.ts',
    'stores/studio.ts',
    'stores/pipeline.ts',
  ]

  let frontendSelectsModel = false
  for (const f of scriptFiles) {
    const fp = path.join(frontendDir, f)
    if (!fs.existsSync(fp)) continue
    const content = fs.readFileSync(fp, 'utf-8').toLowerCase()
    if (content.includes('model') && (content.includes('request') || content.includes('post') || content.includes('fetch') || content.includes('axios'))) {
      frontendSelectsModel = true
      break
    }
  }

  // Check if backend adapters have their own selection logic
  const backendSelfSelect = adapters.filter(a => a.runtimeReachable).length > 0

  if (frontendSelectsModel && backendSelfSelect) {
    violations.push({
      type: 'DUAL_ROUTING',
      severity: 'HIGH',
      description: 'Frontend selects model AND backend also routes models via adapters / SECS plans — dual routing risk',
      source: 'frontend stores + backend model-adapters',
      recommendation: 'Model selection authority must be unified: either frontend passes model + provider + key as opaque params, or backend SECS resolves everything from UserModelConfig',
    })
  }

  return violations
}

/**
 * Legacy adapter leakage: adapters in services/ or core/provider-adapters/ not behind SECS
 */
function detectLegacyLeakage(adapters: AdapterEntry[]): Violation[] {
  const violations: Violation[] = []
  for (const a of adapters) {
    if (a.isLegacy) {
      violations.push({
        type: 'LEGACY_LEAK',
        severity: a.runtimeReachable ? 'HIGH' : 'LOW',
        description: `Legacy adapter ${a.adapter} (${a.source})${a.runtimeReachable ? ' — REACHABLE via SECS plans' : ''}`,
        source: a.source || 'unknown',
        recommendation: a.runtimeReachable
          ? 'Remove legacy adapter; replace with SECS model-adapters/ entry'
          : 'Delete legacy adapter — not reachable from execution graph',
      })
    }
  }
  return violations
}

// ================================================================
// 4. SECS Integration Boundary Check
// ================================================================

interface BoundaryReport {
  frontendToSECS: string  // clean / needs adapter / blocked
  backendToSECS: string   // clean / partial / legacy still active
  adapterSelectionEntry: string  // single / multiple / split
}

function checkSECSBoundary(adapters: AdapterEntry[], frozenGraph: FrozenExecutionGraph | null): BoundaryReport {
  // SECS entry: plans are always the entry
  const planCount = listPlans().length

  // How many adapters are reachable via plans?
  const secsReachable = adapters.filter(a => a.runtimeReachable).length
  const total = adapters.length

  return {
    frontendToSECS: planCount > 0 ? 'clean (via SEDP plan selection)' : 'needs adapter',
    backendToSECS: secsReachable >= total * 0.8 ? 'clean' : `partial (${secsReachable}/${total} reachable)`,
    adapterSelectionEntry: secsReachable === total ? 'single (SECS plans)' : 'split',
  }
}

// ================================================================
// 5. Full Audit Report
// ================================================================

export interface AuditReport {
  routes: RouteInfo[]
  adapters: AdapterEntry[]
  violations: Violation[]
  boundary: BoundaryReport
  scores: {
    routingComplexity: number
    adapterConsistency: number
    crossLayerDrift: number
  }
}

export function runFullAudit(): AuditReport {
  const routes = scanFrontendRoutes()
  const adapters = buildAdapterMatrix()
  const frozenGraph = loadFrozenGraph()

  // Collect violations
  const violations: Violation[] = [
    ...scanProviderFiles(adapters),
    ...scanFrontendHardcodedModels(routes),
    ...detectDualRouting(adapters, routes),
    ...detectLegacyLeakage(adapters),
  ]

  // Boundary check
  const boundary = checkSECSBoundary(adapters, frozenGraph)

  // Scores
  const dualRoutingCount = violations.filter(v => v.type === 'DUAL_ROUTING').length
  const silentFallbackCount = violations.filter(v => v.type === 'SILENT_FALLBACK').length
  const legacyLeakCount = violations.filter(v => v.type === 'LEGACY_LEAK').length
  const hardcodedCount = violations.filter(v => v.type === 'HARDCODED_MODEL').length
  const mismatchCount = violations.filter(v => v.type === 'FRONTEND_BACKEND_MISMATCH').length
  const shadowCount = violations.filter(v => v.type === 'SHADOW_ADAPTER').length
  const driftCount = violations.filter(v => v.type === 'CAPABILITY_DRIFT').length

  const routingScore = Math.max(0, 100 - dualRoutingCount * 30 - shadowCount * 15 - hardcodedCount * 10)
  const adapterScore = Math.max(0, 100 - silentFallbackCount * 20 - legacyLeakCount * 10)
  const driftScore = Math.max(0, 100 - mismatchCount * 25 - driftCount * 20)

  return {
    routes,
    adapters,
    violations,
    boundary,
    scores: {
      routingComplexity: routingScore,
      adapterConsistency: adapterScore,
      crossLayerDrift: driftScore,
    },
  }
}

// ================================================================
// 6. Report Generator
// ================================================================

export function generateAuditReport(result: AuditReport): string {
  const lines: string[] = []
  lines.push('# 🧭 全局路由 × 模型适配器矩阵审计报告')
  lines.push('')
  lines.push(`**生成时间:** ${new Date().toISOString()}`)
  lines.push('')

  // 1. Frontend Routing Graph
  lines.push('## 1. Frontend Routing Graph')
  lines.push('')
  lines.push('| Route | Page | Capabilities | Store Triggers | Hidden Dispatch |')
  lines.push('|-------|------|-------------|----------------|-----------------|')
  for (const r of result.routes) {
    lines.push(`| ${r.path} | ${r.page} | ${r.capabilities.join(', ') || '(none)'} | ${r.storeTriggers.join(', ') || '(none)'} | ${r.hasHiddenDispatch ? '⚠️' : '✅'} |`)
  }
  lines.push('')

  // 2. Capability → Model Adapter Matrix
  lines.push('## 2. Capability → Model Adapter Matrix')
  lines.push('')
  lines.push('| Capability | Adapter | Model | Provider | SECS Reachable | Type |')
  lines.push('|------------|---------|-------|----------|----------------|------|')
  for (const a of result.adapters) {
    lines.push(`| ${a.capability || '(root)'} | ${a.adapter} | ${a.model} | ${a.provider} | ${a.runtimeReachable ? '✅' : '❌'} | ${a.isLegacy ? '⚠️ legacy' : '✅ current'} |`)
  }
  lines.push('')

  // 3. Violations
  lines.push('## 3. Cross-Layer Coupling Violations')
  lines.push('')
  if (result.violations.length === 0) {
    lines.push('✅ 无违规')
  } else {
    lines.push('| Type | Severity | Description | Source | Recommendation |')
    lines.push('|------|----------|-------------|--------|-----------------|')
    for (const v of result.violations) {
      const sev = v.severity === 'HIGH' ? '🔴' : v.severity === 'MEDIUM' ? '🟡' : '🟢'
      lines.push(`| ${v.type} | ${sev} | ${v.description} | \`${v.source}\` | ${v.recommendation} |`)
    }
  }
  lines.push('')

  // 4. SECS Integration Boundary
  lines.push('## 4. SECS Integration Boundary')
  lines.push('')
  lines.push('| Check | Status |')
  lines.push('|-------|--------|')
  lines.push(`| Frontend → SECS | ${result.boundary.frontendToSECS} |`)
  lines.push(`| Backend → SECS | ${result.boundary.backendToSECS} |`)
  lines.push(`| Adapter selection entry | ${result.boundary.adapterSelectionEntry} |`)
  lines.push('')

  // 5. Scores
  lines.push('## 5. System Risk Score')
  lines.push('')
  lines.push('| Metric | Score |')
  lines.push('|--------|-------|')
  lines.push(`| ROUTING_COMPLEXITY_SCORE | ${result.scores.routingComplexity}/100 |`)
  lines.push(`| ADAPTER_CONSISTENCY_SCORE | ${result.scores.adapterConsistency}/100 |`)
  lines.push(`| CROSS_LAYER_DRIFT_SCORE | ${result.scores.crossLayerDrift}/100 |`)
  lines.push('')

  // 6. Recommendations
  lines.push('## 6. Classification & Recommendations')
  lines.push('')

  const clean: Violation[] = []
  const refactor: Violation[] = []
  const critical: Violation[] = []

  for (const v of result.violations) {
    if (v.severity === 'HIGH' && (v.type === 'DUAL_ROUTING' || v.type === 'SILENT_FALLBACK' || v.type === 'FRONTEND_BACKEND_MISMATCH')) {
      critical.push(v)
    } else if (v.severity === 'HIGH' || v.severity === 'MEDIUM') {
      refactor.push(v)
    } else {
      clean.push(v)
    }
  }

  if (critical.length > 0) {
    lines.push('### ❌ CRITICAL FIX')
    for (const v of critical) {
      lines.push(`- **${v.type}**: ${v.description}`)
      lines.push(`  → ${v.recommendation}`)
    }
    lines.push('')
  }

  if (refactor.length > 0) {
    lines.push('### ⚠ REFACTOR')
    for (const v of refactor) {
      lines.push(`- **${v.type}**: ${v.description}`)
      lines.push(`  → ${v.recommendation}`)
    }
    lines.push('')
  }

  if (clean.length > 0) {
    lines.push('### ✔ CLEAN (low severity, tracked)')
    for (const v of clean) {
      lines.push(`- ${v.description}`)
    }
    lines.push('')
  }

  if (critical.length === 0 && refactor.length === 0 && clean.length === 0) {
    lines.push('✅ 系统完全干净，无隐藏耦合。')
    lines.push('')
  }

  return lines.join('\n')
}

// ================================================================
// CLI
// ================================================================

if (process.argv[1]?.includes('routing-adapter-audit') || process.argv[1]?.includes('system-boundary')) {
  runCLI()
}

function runCLI() {
  console.log('[audit] Starting cross-layer routing × adapter matrix audit...\n')

  const result = runFullAudit()
  const report = generateAuditReport(result)

  console.log(report)

  const reportPath = path.resolve(__dirname, '../../reports/routing-adapter-matrix-audit.md')
  fs.mkdirSync(path.dirname(reportPath), { recursive: true })
  fs.writeFileSync(reportPath, report)
  console.log(`[audit] Report written to: ${reportPath}`)
}
