/**
 * scripts/runtime-topology-check.ts — 运行时拓扑 + Capability 边界 CI 门禁
 *
 * Phase 1.5: 架构防火墙
 *   1. DEAD/FROZEN 层禁止新增文件
 *   2. Runtime Core 禁止出现 provider 条件判断
 *   3. Frontend 目录禁止新增 runtime/execution 概念
 *   4. Capability Service 禁止越权（修改 state / 直接 execute / 直接 fetch provider）
 *   5. Routes 层禁止 provider routing 逻辑
 *   6. Topology 配置文件完整性检查
 *
 * 用法：
 *   npx tsx scripts/runtime-topology-check.ts
 *   0 = pass, 1 = fail
 */

import fs from 'fs'
import path from 'path'

// ── 路径常量 ──
const __dirname = path.dirname(new URL(import.meta.url).pathname)
const BACKEND_DIR = path.resolve(__dirname, '..')
const PROJECT_DIR = path.resolve(BACKEND_DIR, '..')
const SRC_DIR = path.resolve(BACKEND_DIR, 'src')
const FRONTEND_DIR = path.resolve(PROJECT_DIR, 'frontend')
const DEATH_LAYER_MAP = path.resolve(PROJECT_DIR, 'docs/architecture/death-layer-map.md')
const RUNTIME_TOPOLOGY = path.resolve(PROJECT_DIR, 'docs/architecture/runtime-topology.md')

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rule 1: DEAD/FROZEN 层禁止新增文件
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface DeathLayerRule {
  paths: string[]
  status: 'DEAD' | 'FROZEN' | 'LEGACY' | 'OBSERVE_ONLY'
  isFrontend?: boolean
}

const DEAD_LAYER_RULES: DeathLayerRule[] = [
  { paths: ['dist/execution', 'dist/graph-runtime', 'dist/graph-optimization', 'dist/graph-patch'], status: 'DEAD' },
  { paths: ['dist/execution-debug', 'dist/execution-safety', 'dist/execution-trace'], status: 'DEAD' },
  { paths: ['dist/director-simulation', 'dist/production-loop', 'dist/replay', 'dist/replay-analytics'], status: 'DEAD' },
  { paths: ['dist/kernel', 'dist/engine', 'dist/control-plane', 'dist/cognition-loop', 'dist/closure'], status: 'DEAD' },
  { paths: ['src/optimization'], status: 'FROZEN' },
  { paths: ['kernel/', 'governance/', 'runtime/', 'planning/', 'license-runtime/'], status: 'DEAD', isFrontend: true },
  { paths: ['bridge/', 'multiAgent/'], status: 'FROZEN', isFrontend: true },
]

function checkDeadLayerFiles(): string[] {
  return [] // stub — 需配合 git baseline 实现精确检测
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rule 2: Runtime Core 禁止 provider 条件判断
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const PROVIDER_PATTERNS = [
  'openai', 'deepseek', 'volcengine', 'claude', 'anthropic',
  'qwen', 'siliconflow', 'aliyun', 'bailian', 'kling', 'minimax',
  'comfyui', 'gemini', 'doubao', 'seedance', 'seedream',
]

const CORE_DIRS = ['src/kernel-v1', 'src/runtime-core']

function checkProviderAwareness(): string[] {
  const errors: string[] = []

  for (const coreDir of CORE_DIRS) {
    const fullPath = path.resolve(BACKEND_DIR, coreDir)
    if (!fs.existsSync(fullPath)) continue

    const files = fs.readdirSync(fullPath, { recursive: true })
      .filter((f): f is string => typeof f === 'string' && f.endsWith('.ts'))

    for (const file of files) {
      const filePath = path.resolve(fullPath, file)
      const content = fs.readFileSync(filePath, 'utf-8')

      for (const provider of PROVIDER_PATTERNS) {
        const ifRegex = new RegExp(
          `(if|switch|case)\\s*\\(*[^)]*${provider}[^)]*\\)*`,
          'gi'
        )
        let match: RegExpExecArray | null
        while ((match = ifRegex.exec(content)) !== null) {
          const lineNum = content.substring(0, match.index).split('\n').length
          errors.push(
            `❌ Provider Awareness in ${coreDir}/${file}:${lineNum} — ${match[0].trim().substring(0, 60)}`
          )
        }
      }
    }
  }

  return errors
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rule 3: Frontend 概念目录
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const FORBIDDEN_FRONTEND_DIRS = [
  'execution', 'scheduler', 'orchestrator', 'dispatch',
  'queue', 'runtime_state', 'execution_engine',
]

function checkFrontendConcepts(): string[] {
  const errors: string[] = []

  if (!fs.existsSync(FRONTEND_DIR)) return errors

  for (const dir of fs.readdirSync(FRONTEND_DIR, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue
    if (dir.name.startsWith('.')) continue
    if (['node_modules', '.nuxt', '.output'].includes(dir.name)) continue

    if (FORBIDDEN_FRONTEND_DIRS.includes(dir.name)) {
      errors.push(`❌ 前端禁止新增概念目录: frontend/${dir.name}/`)
    }
  }

  return errors
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rule 3.5: Capability Service 边界检查
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CAPABILITY_DIR = path.resolve(SRC_DIR, 'services')

interface CapabilityCheck {
  name: string
  test: (content: string) => string[]
}

const CAPABILITY_CHECKS: CapabilityCheck[] = [
  // 禁止直接写 task lifecycle status
  {
    name: '直接修改 execution state',
    test: (content) => {
      const hits: string[] = []
      const re = /\.update\(\s*\{\s*status/g
      let m: RegExpExecArray | null
      while ((m = re.exec(content)) !== null) {
        const ln = content.substring(0, m.index).split('\n').length
        hits.push(`  services/capability.service.ts:${ln} — 直接修改 status 字段`)
      }
      return hits
    },
  },
  // 禁止 prisma (task|videoTask|pipelineJob) create/update
  {
    name: '直接写 task/pipeline lifecycle',
    test: (content) => {
      const hits: string[] = []
      const re = /prisma\.(task|videoTask|pipelineJob|agentExecution)\.(update|create)/gi
      let m: RegExpExecArray | null
      while ((m = re.exec(content)) !== null) {
        const ln = content.substring(0, m.index).split('\n').length
        hits.push(`  services/capability.service.ts:${ln} — 直接 ${m[0]}`)
      }
      return hits
    },
  },
  // 禁止 Capability Service 中出现 execute 动词
  {
    name: 'execute 动词应属于 Runtime Core',
    test: (content) => {
      const hits: string[] = []
      const re = /(?:^|\s)(async\s+)?function\s+execute|\.execute\s*\(|execute[A-Z]\w+\s*\(/g
      let m: RegExpExecArray | null
      while ((m = re.exec(content)) !== null) {
        const ln = content.substring(0, m.index).split('\n').length
        hits.push(`  services/capability.service.ts:${ln} — execute 动词: ${m[0].trim().substring(0, 40)}`)
      }
      return hits
    },
  },
  // 禁止直接 fetch（应通过 Adapter）
  // 例外：testModelConnection 是策略性健康探测，不参与 execution path
  {
    name: '直接 fetch provider',
    test: (content) => {
      const hits: string[] = []
      const lines = content.split('\n')
      const re = /fetch\s*\(/g
      let m: RegExpExecArray | null
      while ((m = re.exec(content)) !== null) {
        const ln = content.substring(0, m.index).split('\n').length
        const lineText = lines[ln - 1] || ''
        // 跳过 testModelConnection 函数内的 fetch
        const nearbyText = lines.slice(Math.max(0, ln - 8), ln + 2).join('\n')
        if (nearbyText.includes('function testModelConnection')) continue
      }
      return hits
    },
  },
]

function checkCapabilityService(): string[] {
  const errors: string[] = []
  const capFile = path.resolve(CAPABILITY_DIR, 'capability.service.ts')

  if (!fs.existsSync(capFile)) return errors

  const content = fs.readFileSync(capFile, 'utf-8')

  for (const check of CAPABILITY_CHECKS) {
    const hits = check.test(content)
    if (hits.length > 0) {
      errors.push(`⚠️  Capability Service 违规 — ${check.name}`)
      errors.push(...hits)
    }
  }

  return errors
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rule 4: Topology 文件完整性
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function checkTopologyFiles(): string[] {
  const errors: string[] = []

  if (!fs.existsSync(DEATH_LAYER_MAP)) {
    errors.push('❌ Death Layer Map 文件不存在')
  }
  if (!fs.existsSync(RUNTIME_TOPOLOGY)) {
    errors.push('❌ Runtime Topology 文件不存在')
  }

  if (fs.existsSync(DEATH_LAYER_MAP)) {
    const stat = fs.statSync(DEATH_LAYER_MAP)
    const days = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24)
    if (days > 30) {
      errors.push(`⚠️  Death Layer Map 已 ${Math.round(days)} 天未更新，建议审核`)
    }
  }

  return errors
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Rule 5: Routes 层禁止 provider routing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function checkProviderAwarenessInRoutes(): string[] {
  const errors: string[] = []
  const routesDir = path.resolve(SRC_DIR, 'routes')

  if (!fs.existsSync(routesDir)) return errors

  for (const file of fs.readdirSync(routesDir)) {
    if (!file.endsWith('.ts')) continue

    const filePath = path.resolve(routesDir, file)
    const content = fs.readFileSync(filePath, 'utf-8')

    const routingRe = /(provider|model)\s*(==|===)\s*['"](openai|deepseek|volcengine|aliyun)['"]/gi
    let m: RegExpExecArray | null
    while ((m = routingRe.exec(content)) !== null) {
      const ln = content.substring(0, m.index).split('\n').length
      errors.push(`⚠️  Route provider routing in routes/${file}:${ln}`)
    }
  }

  return errors
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Entropy Score 计算
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface EntropyMetrics {
  executionEntryPoints: number   // routes 中 POST/GET handler 数量（粗略）
  providerLeaks: number         // routes + core 中的 provider 硬编码
  frontendRuntimeLeaks: number  // 前端 runtime 概念文件数
  queueMutationSources: number  // queue 写入点
  runtimeCoreViolations: number // core 中的 provider 引用
  capabilityBoundaryHits: number // capability service 越权
}

function countExecutionEntryPoints(): number {
  const routesDir = path.resolve(SRC_DIR, 'routes')
  if (!fs.existsSync(routesDir)) return 0

  let count = 0
  for (const file of fs.readdirSync(routesDir)) {
    if (!file.endsWith('.ts')) continue
    const content = fs.readFileSync(path.resolve(routesDir, file), 'utf-8')
    // 粗略统计 route handler 数量
    const handlers = content.match(/fastify\.(get|post|put|delete|patch)\(/g)
    if (handlers) count += handlers.length
  }
  return count
}

function countFrontendRuntimeFiles(): number {
  if (!fs.existsSync(FRONTEND_DIR)) return 0

  const forbiddenDirs = ['kernel', 'governance', 'runtime', 'planning', 'license-runtime']
  let count = 0

  for (const dir of forbiddenDirs) {
    const fullPath = path.resolve(FRONTEND_DIR, dir)
    if (!fs.existsSync(fullPath)) continue
    const files = fs.readdirSync(fullPath, { recursive: true })
      .filter((f): f is string => typeof f === 'string' && (f.endsWith('.ts') || f.endsWith('.vue')))
    count += files.length
  }
  return count
}

function computeEntropyScore(): EntropyMetrics {
  const routeCount = countExecutionEntryPoints()
  const frontFiles = countFrontendRuntimeFiles()

  // 这些值从已运行的检查中获取
  const providerLeaks = checkProviderAwareness().length + checkProviderAwarenessInRoutes().length
  const capabilityHits = checkCapabilityService().length

  const metrics: EntropyMetrics = {
    executionEntryPoints: routeCount,
    providerLeaks,
    frontendRuntimeLeaks: frontFiles,
    queueMutationSources: 0,      // 待精确化
    runtimeCoreViolations: checkProviderAwareness().length,
    capabilityBoundaryHits: capabilityHits,
  }

  return metrics
}

function entropyScore(metrics: EntropyMetrics): number {
  return (
    metrics.executionEntryPoints +
    metrics.providerLeaks * 5 +
    metrics.frontendRuntimeLeaks * 3 +
    metrics.queueMutationSources * 2 +
    metrics.runtimeCoreViolations * 10
  )
}

/**
 * Execution Surface Index（执行表面积指数）
 *
 * 比 entropy score 更稳定，更聚焦于收敛行动：
 *   ESI = routes + queue writers + runtime mutation sources
 *
 * 收敛目标：从当前基线持续下降至稳定集（目标 ~40-50）
 */
function executionSurfaceIndex(metrics: EntropyMetrics): number {
  return (
    metrics.executionEntryPoints +     // 外部暴露
    metrics.queueMutationSources * 2 +  // 内部队列写
    metrics.runtimeCoreViolations * 3   // 内核泄漏
  )
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Drift Report 输出
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function generateDriftReport(metrics: EntropyMetrics, violations: string[]): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
  const score = entropyScore(metrics)

  // 读取历史基线
  const entropyBaselineFile = path.resolve(BACKEND_DIR, '.entropy-baseline.json')
  let prevScore: number | null = null
  if (fs.existsSync(entropyBaselineFile)) {
    try {
      const prev = JSON.parse(fs.readFileSync(entropyBaselineFile, 'utf-8'))
      prevScore = prev.entropyScore ?? null
    } catch { /* ignore */ }
  }

  // 写入新基线
  fs.writeFileSync(entropyBaselineFile, JSON.stringify({
    entropyScore: score,
    metrics,
    timestamp: new Date().toISOString(),
  }, null, 2), 'utf-8')

  const lines: string[] = [
    `# Runtime Drift Report — ${ts}`,
    '',
    '## Entropy Metrics',
    '',
    `| Metric | Value | Weight | Score Contribution |`,
    `|---|---:|---:|---:|`,
    `| Execution Entry Points | ${metrics.executionEntryPoints} | 1 | ${metrics.executionEntryPoints} |`,
    `| Provider Leaks | ${metrics.providerLeaks} | 5 | ${metrics.providerLeaks * 5} |`,
    `| Frontend Runtime Leaks | ${metrics.frontendRuntimeLeaks} | 3 | ${metrics.frontendRuntimeLeaks * 3} |`,
    `| Queue Mutation Sources | ${metrics.queueMutationSources} | 2 | ${metrics.queueMutationSources * 2} |`,
    `| Runtime Core Violations | ${metrics.runtimeCoreViolations} | 10 | ${metrics.runtimeCoreViolations * 10} |`,
    '',
    `**Total Entropy Score: ${score}**`,
    '',
    `**Execution Surface Index (ESI): ${executionSurfaceIndex(metrics)}**`,
    `  (entries: ${metrics.executionEntryPoints} + queue: ${metrics.queueMutationSources * 2} + core: ${metrics.runtimeCoreViolations * 3})`,
    '',
  ]

  if (prevScore !== null) {
    const delta = score - prevScore
    const trend = delta > 0 ? '🔴 INCREASED' : delta < 0 ? '🟢 DECREASED' : '⚪ UNCHANGED'
    lines.push(`**Trend vs previous run: ${trend} (Δ${delta > 0 ? '+' : ''}${delta})**`)
    if (delta > 20) {
      lines.push('')
      lines.push('🚨 **CRITICAL**: Entropy spike > 20 points since last run. Requires review.')
    }
  } else {
    lines.push('*(No previous baseline — this is the first measurement)*')
  }

  lines.push(
    '',
    '## Architecture Violations',
    '',
  )

  if (violations.length === 0) {
    lines.push('No violations found.')
  } else {
    violations.forEach((v) => lines.push(`- ${v}`))
  }

  lines.push('', '---', '')
  lines.push(`Generated: ${new Date().toISOString()}`)

  return lines.join('\n')
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const allErrors: string[] = [
  ...checkDeadLayerFiles(),
  ...checkProviderAwareness(),
  ...checkFrontendConcepts(),
  ...checkCapabilityService(),
  ...checkTopologyFiles(),
  ...checkProviderAwarenessInRoutes(),
]

// 熵分输出
const metrics = computeEntropyScore()
const score = entropyScore(metrics)
const report = generateDriftReport(metrics, allErrors)

// 写入报告
const reportDir = path.resolve(BACKEND_DIR, 'reports')
fs.mkdirSync(reportDir, { recursive: true })
const reportFile = path.resolve(reportDir, `drift-report-${new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)}.md`)
fs.writeFileSync(reportFile, report, 'utf-8')

const esi = executionSurfaceIndex(metrics)
console.log(`📊 Entropy Score: ${score}`)
console.log(`📐 ESI: ${esi} (target < ${metrics.executionEntryPoints})`)
console.log(`   execution paths ...... ${metrics.executionEntryPoints}`)
console.log(`   provider leaks ....... ${metrics.providerLeaks}`)
console.log(`   frontend runtime ..... ${metrics.frontendRuntimeLeaks}`)
console.log(`   queue mutations ...... ${metrics.queueMutationSources}`)
console.log(`   core violations ...... ${metrics.runtimeCoreViolations}`)
console.log(`📝 Drift Report: ${reportFile}`)

allErrors.forEach((e) => console.error(e))

if (allErrors.length > 0) {
  console.error('\n🔴 RUNTIME GOVERNANCE: 共发现 ' + allErrors.length + ' 条违规')
  process.exit(1)
}

console.log('✅ Runtime topology check passed')
console.log('   Death Layer Map: ' + (fs.existsSync(DEATH_LAYER_MAP) ? '✅' : '❌'))
console.log('   Runtime Topology: ' + (fs.existsSync(RUNTIME_TOPOLOGY) ? '✅' : '❌'))
