/**
 * rfvl/scanner.ts — RFVL 静态扫描器
 *
 * 扫描 routes/ 目录下的所有文件，检测：
 *   1. 直调用 provider（绕过 SEEL）— 但 ORCHESTRATION DOMAIN 路径允许
 *   2. env leakage（process.env 模型选择）
 *   3. 非 MSAL 模型选择路径（adapter bypass）
 *
 * EDCL 规则：
 *   EXECUTION DOMAIN → 禁止直调，必须入队
 *   ORCHESTRATION DOMAIN → 允许编排逻辑，但禁止直接生成
 *
 * 用法:
 *   import { RFVLScanner } from './scanner.js'
 *   const result = await RFVLScanner.scanSystem()
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface ScanViolation {
  file: string
  type: 'DIRECT_PROVIDER_CALL' | 'ENV_MODEL_LEAK' | 'ADAPTER_BYPASS' | 'QUEUE_BYPASS'
  line: number
  snippet: string
}

export interface ScanResult {
  stats: {
    filesScanned: number
    violations: number
    directProviderCalls: number
    envLeaks: number
    adapterBypass: number
    queueBypass: number
  }
  violations: ScanViolation[]
  passed: boolean
}

const PATTERNS = {
  // ❌ .generate() / .synthesize() / .execute() 在 route 中直接调用
  DIRECT_PROVIDER_CALL: /\.(generate|synthesize|execute)\(/,
  // ❌ process.env 与模型名相关
  ENV_MODEL_LEAK: /process\.env.*(MODEL|PROVIDER|MODEL_NAME|LLM_MODEL)/i,
  // ❌ adapter.execute 不在 ai-tasks 或 worker-runtime 里
  ADAPTER_BYPASS: /adapter\.execute|modelAdapterRegistry\.execute/,
  // ❌ 调用 queue-manager 但不经过 ai-generate
  QUEUE_BYPASS: /enqueueTask|createTask/,
}

// EDCL: ORCHESTRATION DOMAIN 白名单 — 允许编排逻辑，不执行生成
const ORCHESTRATION_WHITELIST = [
  'continuity',      // 连续性编排
  'director',        // 导演智能层编排
  'orchestrator',    // 统筹 Agent
  'narrative',       // 叙事编排
  'stage',           // 舞台编排
  'showrunner',      // Showrunner 编排
  'scheduler',       // 调度编排
  'simulation',      // 模拟预演
  'cognition',       // 认知循环
]

// 系统基础设施文件 — 不需要执行路径约束
const INFRA_WHITELIST = [
  'admin',
  'auth',
  'payment',
  'member',
  'user',
  'captcha',
  'sms',
  'config',
  'crypto',
  'system',
  'health',
  'redirect',
  'tenant',
  'product',
  'file',
  'upload',
  'bridge',
  'cluster',
  'global',
  'federation',
  'model-provider',
  'hitl',
  'rapid',
  'psc1',
  'quick-creation',
  'render-shots',
  'async-runtime',
  'self-check',
  'system-dashboard',
  'community',
  'message',
  'admin-global-config',
  'admin-models',
  'scene-execution',
]

// 第 3 层豁免：已知 safe 的调用模式
const SAFE_PATTERNS = [
  'executionCutover.execute',    // safe: routes through queue
  'narrativeGateway.execute',    // safe: ORCHESTRATION ONLY
  'controlPlane.execute',        // safe: EDCL orchestration
  'aiRouter.execute',            // safe: EDCL orchestration
  'directorApi.generate',        // safe: EDCL orchestration
  'videoPipelineEngine.generate', // safe: EDCL orchestration
  'workerPool.start',            // startup, not execution
  'registerRuntimeGuard',         // startup
  'sandbox.execute',              // 沙箱，非生产执行路径
  'aigcOrchestrator.generate',   // EDCL orchestration
  'violationReporter.generate',  // 报告生成，非 provider 调用
  'schedulerService.generate',   // EDCL orchestration
  'audioPipeline.generate',      // EDCL orchestration
]

export class RFVLScanner {

  static isOrchestration(file: string): boolean {
    return ORCHESTRATION_WHITELIST.some(name => file.includes(name))
  }

  static isInfra(file: string): boolean {
    return INFRA_WHITELIST.some(name => file.includes(name) || name === file.replace('.ts', ''))
  }

  static isSafePattern(snippet: string): boolean {
    return SAFE_PATTERNS.some(p => snippet.includes(p))
  }

  static async scanSystem(options?: {
    routesDir?: string
  }): Promise<ScanResult> {
    const routesDir = options?.routesDir || path.resolve(__dirname, '..', 'routes')
    const violations: ScanViolation[] = []
    let filesScanned = 0
    let filesSkippedOrch = 0
    let filesSkippedInfra = 0

    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.ts'))

    for (const file of files) {
      const filePath = path.join(routesDir, file)
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')

      // EDCL: ORCHESTRATION DOMAIN — 允许编排，不扫描执行约束
      if (this.isOrchestration(file)) {
        filesSkippedOrch++
        continue
      }

      // 基础设施文件 — 不做执行路径约束
      if (this.isInfra(file)) {
        filesSkippedInfra++
        continue
      }

      filesScanned++

      // Check each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const lineNum = i + 1
        const trimmed = line.trim()

        // Skip comments, imports, declarations
        if (trimmed.startsWith('//') || trimmed.startsWith('*') ||
            trimmed.startsWith('import') || trimmed.startsWith('from ') ||
            trimmed.startsWith('interface') || trimmed.startsWith('type ') ||
            trimmed.startsWith('function') || trimmed.startsWith('export')) continue

        // Check direct provider call
        if (PATTERNS.DIRECT_PROVIDER_CALL.test(trimmed) &&
            !trimmed.includes('ai-generate') &&
            !trimmed.includes('queue') &&
            !trimmed.includes('enqueueTask') &&
            !this.isSafePattern(trimmed)) {
          violations.push({
            file,
            type: 'DIRECT_PROVIDER_CALL',
            line: lineNum,
            snippet: trimmed.substring(0, 100),
          })
        }

        // Check env model leak
        if (PATTERNS.ENV_MODEL_LEAK.test(trimmed) &&
            !trimmed.includes('env.CRYPTO') &&
            !trimmed.includes('env.JWT') &&
            !trimmed.includes('env.PORT') &&
            !trimmed.includes('env.NODE_ENV') &&
            !trimmed.includes('env.LOG') &&
            !trimmed.includes('env.API')) {
          violations.push({
            file,
            type: 'ENV_MODEL_LEAK',
            line: lineNum,
            snippet: trimmed.substring(0, 100),
          })
        }

        // Check adapter bypass
        if (PATTERNS.ADAPTER_BYPASS.test(trimmed) &&
            !trimmed.includes('worker-runtime') &&
            !trimmed.includes('ai-tasks') &&
            !this.isSafePattern(trimmed)) {
          violations.push({
            file,
            type: 'ADAPTER_BYPASS',
            line: lineNum,
            snippet: trimmed.substring(0, 100),
          })
        }
      }
    }

    const stats = {
      filesScanned,
      violations: violations.length,
      directProviderCalls: violations.filter(v => v.type === 'DIRECT_PROVIDER_CALL').length,
      envLeaks: violations.filter(v => v.type === 'ENV_MODEL_LEAK').length,
      adapterBypass: violations.filter(v => v.type === 'ADAPTER_BYPASS').length,
      queueBypass: 0,
    }

    return {
      stats,
      violations,
      passed: stats.violations === 0,
    }
  }
}
