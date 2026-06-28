/**
 * closure/closure-engine.ts — Execution Graph Closure Engine
 *
 * Builds 3 graphs (static, execution, type) and classifies all nodes
 * as L0-L3. Outputs closure validation.
 */

import fs from 'fs'
import path from 'path'
import type { ClosureNode, ClosureSummary, LegacyClass } from './closure-types.js'

const SRC = path.resolve(__dirname, '..')

interface ImportEdge {
  from: string
  to: string
}

export class ClosureEngine {
  /** All .ts files under src */
  private allFiles: string[] = []
  /** Import graph: file -> files it imports */
  private staticGraph: Map<string, string[]> = new Map()
  /** Reverse import graph: file -> files that import it */
  private incoming: Map<string, string[]> = new Map()
  /** Known execution entry points */
  private entryPoints: string[] = []
  /** Files reachable from entry points (execution graph) */
  private executionReachable: Set<string> = new Set()
  /** Known type drift files */
  private knownTypeDrift: Set<string> = new Set()

  constructor() {
    this.scanFiles()
  }

  /** Scan all .ts files under src */
  private scanFiles(): void {
    const walk = (dir: string): string[] => {
      const result: string[] = []
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const e of entries) {
          const full = path.join(dir, e.name)
          if (e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules') {
            result.push(...walk(full))
          } else if (e.isFile() && e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) {
            result.push(full)
          }
        }
      } catch { /* skip */ }
      return result
    }
    this.allFiles = walk(SRC).map(f => path.relative(SRC, f))
    console.log(`[closure] scanned ${this.allFiles.length} TS files`)
  }

  /**
   * Build static import graph from a file
   * Simplified: extracts `from '...'` patterns
   */
  private resolveImports(fileContent: string, filePath: string): string[] {
    const targets = new Set<string>()

    const fromRE = /from\s+['"]([^'"]+)['"]/g
    let m: RegExpExecArray | null
    while ((m = fromRE.exec(fileContent)) !== null) targets.add(m[1])

    const dynamicRE = /import\s*\(\s*['"]([^'"]+)['"]/gs
    while ((m = dynamicRE.exec(fileContent)) !== null) targets.add(m[1])

    const requireRE = /require\s*\(\s*['"]([^'"]+)['"]/g
    while ((m = requireRE.exec(fileContent)) !== null) targets.add(m[1])

    // Resolve relative paths using absolute dir
    const resolved: string[] = []
    const absDir = path.resolve(SRC, filePath) // filePath is already relative
    const dir = path.dirname(absDir)
    for (const t of targets) {
      if (t.startsWith('.')) {
        const resolvedPath = path.resolve(dir, t)
        // Try .ts, /index.ts
        const relativeFromSrc = path.relative(SRC, resolvedPath)
        const candidates = [
          relativeFromSrc + '.ts',
          relativeFromSrc + '/index.ts',
          relativeFromSrc.replace(/\.js$/, '.ts'),
          resolvedPath + '.ts',
          resolvedPath + '/index.ts',
          resolvedPath.replace(/\.js$/, '.ts'),
        ]
        for (const c of candidates) {
          if (fs.existsSync(path.join(SRC, c))) {
            resolved.push(c)
            break
          }
        }
      }
    }
    return resolved
  }

  /**
   * Build static import graph for all files
   */
  buildStaticGraph(): void {
    for (const file of this.allFiles) {
      const fullPath = path.join(SRC, file)
      try {
        const content = fs.readFileSync(fullPath, 'utf-8')
        const imports = this.resolveImports(content, file)
        this.staticGraph.set(file, imports)
        for (const imp of imports) {
          if (!this.incoming.has(imp)) this.incoming.set(imp, [])
          this.incoming.get(imp)!.push(file)
        }
      } catch {
        this.staticGraph.set(file, [])
      }
    }
    console.log(`[closure] static graph built: ${this.staticGraph.size} nodes`)
  }

  /**
   * Set known execution entry points
   */
  setEntryPoints(entries: string[]): void {
    this.entryPoints = entries
  }

  /**
   * Compute execution graph reachability from entry points
   */
  computeExecutionGraph(): void {
    const visited = new Set<string>()
    const queue = [...this.entryPoints]
    while (queue.length > 0) {
      const file = queue.shift()!
      if (visited.has(file)) continue
      visited.add(file)
      const imports = this.staticGraph.get(file) || []
      for (const imp of imports) {
        if (!visited.has(imp)) queue.push(imp)
      }
    }
    this.executionReachable = visited
    console.log(`[closure] execution graph: ${visited.size} nodes reachable from ${this.entryPoints.length} entry points`)
  }

  /**
   * Classify all files into L0-L3
   */
  classify(): ClosureNode[] {
    const nodes: ClosureNode[] = []
    const knownL2Patterns = ['fallback', 'default', 'shadow', 'legacy', 'old', 'backup', 'deprecated']

    for (const file of this.allFiles) {
      const inStatic = this.incoming.has(file) && this.incoming.get(file)!.length > 0
      const inExec = this.executionReachable.has(file)
      const typeDrift = this.knownTypeDrift.has(file)
      const isLegacyName = knownL2Patterns.some(p => file.toLowerCase().includes(p))
      const incomingCount = this.incoming.get(file)?.length || 0

      let lClass: LegacyClass
      let action: ClosureNode['action']
      let reason: string

      if (!inStatic && !inExec) {
        lClass = 'L0_DEAD'
        action = 'DELETE'
        reason = 'No import references, no execution path'
      } else if (inStatic && !inExec && !typeDrift) {
        lClass = 'L1_ISOLATED'
        action = 'DELETE'
        reason = 'Referenced in static graph only, not reachable at runtime'
      } else if (inExec && (isLegacyName || typeDrift)) {
        lClass = 'L3_COUPLED'
        action = 'REFACTOR'
        reason = `Reachable in execution graph${isLegacyName ? ' + legacy naming' : ''}${typeDrift ? ' + type drift' : ''}`
      } else if (inExec && isLegacyName) {
        lClass = 'L2_SHADOW'
        action = 'ASSERT_INJECT'
        reason = 'Execution reachable via legacy/forked path'
      } else if (typeDrift) {
        lClass = 'L2_SHADOW'
        action = 'REFACTOR'
        reason = 'Type drift detected'
      } else {
        // Active path — skip classification
        continue
      }

      nodes.push({
        file,
        class: lClass,
        reason,
        staticIncoming: incomingCount,
        executionReachable: inExec,
        typeDrift,
        action,
      })
    }

    return nodes
  }

  /**
   * Generate closure summary
   */
  summarize(nodes: ClosureNode[]): ClosureSummary {
    const classification: Record<LegacyClass, number> = {
      L0_DEAD: 0,
      L1_ISOLATED: 0,
      L2_SHADOW: 0,
      L3_COUPLED: 0,
    }

    const violations: ClosureNode[] = []
    for (const n of nodes) {
      classification[n.class]++
      if (n.class === 'L2_SHADOW' || n.class === 'L3_COUPLED') {
        violations.push(n)
      }
    }

    // Score: base 100, deduct penalties relative to total files
    const total = this.allFiles.length || 1
    let score = 100
    score -= (classification.L0_DEAD / total) * 20
    score -= (classification.L1_ISOLATED / total) * 10
    score -= (classification.L2_SHADOW / total) * 30
    score -= (classification.L3_COUPLED / total) * 40
    score = Math.max(0, Math.round(score))

    const active = this.allFiles.length - nodes.length
    const typeDrifts = nodes.filter(n => n.typeDrift).map(n => n.file)

    return {
      graph: {
        totalFiles: this.allFiles.length,
        staticGraphSize: this.staticGraph.size,
        executionGraphSize: this.executionReachable.size,
        unreachableNodes: this.allFiles.length - this.executionReachable.size,
      },
      classification,
      violations: violations.slice(0, 50), // top 50
      typeDrifts: typeDrifts.slice(0, 30),
      finalScore: score,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Run full closure analysis
   */
  async run(): Promise<{
    nodes: ClosureNode[]
    summary: ClosureSummary
    report: string
  }> {
    console.log('[closure] Starting full closure analysis...\n')

    this.buildStaticGraph()

    // Auto-detect entry points
    const bootFiles = ['bootstrap/runtime-boot.ts', 'index.ts', 'cognition-loop/loop-engine.ts',
      'queue/capability-dispatcher.ts', 'queue/worker-runtime.ts', 'showrunner/showrunner-core.ts']
    // Find all route files
    const routerFiles = this.allFiles.filter(f =>
      f.startsWith('routes/') && !f.includes('test')
    )
    const mainEntry = this.allFiles.find(f => f === 'index.ts')
    const allEntries = [...bootFiles.filter(f => this.allFiles.includes(f)), ...(mainEntry ? [mainEntry] : [])]
    this.setEntryPoints(allEntries)

    this.computeExecutionGraph()

    // Classify
    const nodes = this.classify()

    // Find known type drift patterns
    this.detectTypeDrift()

    // Reclassify with type drift info
    const nodesFinal = this.classify()

    const summary = this.summarize(nodesFinal)
    const report = this.generateReport(nodesFinal, summary)

    return { nodes: nodesFinal, summary, report }
  }

  /**
   * Scan for type drift patterns
   */
  private detectTypeDrift(): void {
    const knownDriftPatterns = [
      'interface duplicate', 'legacy.*interface', 'old.*type',
      'deprecated.*type', 'backup.*type',
    ]

    for (const file of this.allFiles) {
      const fullPath = path.join(SRC, file)
      try {
        const content = fs.readFileSync(fullPath, 'utf-8').toLowerCase()
        if (knownDriftPatterns.some(p => {
          const regex = new RegExp(p, 'i')
          return regex.test(content)
        })) {
          this.knownTypeDrift.add(file)
        }
      } catch { /* skip */ }
    }
  }

  private generateReport(nodes: ClosureNode[], summary: ClosureSummary): string {
    const lines: string[] = []
    lines.push('# 🧭 Legacy Closure Report')
    lines.push('')
    lines.push(`**Generated:** ${summary.timestamp}`)
    lines.push(`**Source root:** ${SRC}`)
    lines.push('')
    lines.push('## 1. Graph State')
    lines.push('')
    lines.push(`| Metric | Value |`)
    lines.push(`|--------|-------|`)
    lines.push(`| Total TS files | ${summary.graph.totalFiles} |`)
    lines.push(`| Static graph size | ${summary.graph.staticGraphSize} |`)
    lines.push(`| Execution graph size | ${summary.graph.executionGraphSize} |`)
    lines.push(`| Unreachable nodes | ${summary.graph.unreachableNodes} |`)
    lines.push('')
    lines.push('## 2. Legacy Classification')
    lines.push('')
    lines.push(`| Class | Count | Interpretation |`)
    lines.push(`|-------|-------|----------------|`)
    lines.push(`| **L0 — Dead Code** | ${summary.classification.L0_DEAD} | No imports, no execution path → DELETE |`)
    lines.push(`| **L1 — Isolated** | ${summary.classification.L1_ISOLATED} | Static ref only, not runtime → DELETE |`)
    lines.push(`| **L2 — Shadow Path** | ${summary.classification.L2_SHADOW} | Execution reachable via legacy branch → ASSERT |`)
    lines.push(`| **L3 — Coupled Legacy** | ${summary.classification.L3_COUPLED} | Runtime-coupled legacy → REFACTOR |`)
    lines.push(`| **Active (unclassified)** | ${summary.graph.totalFiles - nodes.length} | In execution graph, no legacy markers |`)
    lines.push('')
    lines.push('## 3. Execution Violations')
    lines.push('')
    if (summary.violations.length === 0) {
      lines.push('✅ **Zero execution violations** — execution graph is pure.')
    } else {
      lines.push(`${summary.violations.length} violations found:\n`)
      lines.push('| File | Class | Action | Reason |')
      lines.push('|------|-------|--------|--------|')
      for (const v of summary.violations) {
        lines.push(`| \`${v.file}\` | ${v.class} | ${v.action} | ${v.reason} |`)
      }
    }
    lines.push('')
    lines.push('## 4. Type Drift')
    lines.push('')
    if (summary.typeDrifts.length === 0) {
      lines.push('✅ **No type drift detected.**')
    } else {
      lines.push(`${summary.typeDrifts.length} type drift sources:\n`)
      for (const t of summary.typeDrifts) {
        lines.push(`- \`${t}\``)
      }
    }
    lines.push('')
    lines.push('## 5. Closure Score')
    lines.push('')
    lines.push(`**CLOSURE_SCORE: ${summary.finalScore}/100**`)
    lines.push('')
    if (summary.finalScore >= 90) {
      lines.push('✅ **Execution graph is closed.** Legacy exists in static graph only.')
    } else if (summary.finalScore >= 70) {
      lines.push('⚠️ **Partial closure.** Some legacy branches reachable at runtime.')
    } else {
      lines.push('❌ **Execution graph is open.** Legacy code is runtime-reachable.')
    }

    return lines.join('\n')
  }
}

// CLI
if (process.argv[1]?.includes('closure-engine')) {
  runCLI()
}

function runCLI() {
  const engine = new ClosureEngine()
  engine.run().then(result => {
    console.log(result.report)
    const outPath = path.join(SRC.replace('/src/', '/'), 'reports/legacy-closure-report.md')
    fs.mkdirSync(path.dirname(outPath), { recursive: true })
    fs.writeFileSync(outPath, result.report)
    console.log(`\nReport written to: ${outPath}`)
  }).catch(err => {
    console.error('Closure analysis failed:', err)
    process.exit(1)
  })
}
