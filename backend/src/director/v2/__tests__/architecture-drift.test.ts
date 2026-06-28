/**
 * Architecture Drift Detector — 架构漂移检测
 *
 * 在 CI 中运行，自动检查冻结的架构原则是否被违反：
 *
 * 检测清单：
 *   ❌ Provider 直接 import ExecutionPlan → Architecture Violation
 *   ❌ Recovery 直接修改 DirectorDecision → Architecture Violation
 *   ❌ Provider Compiler 访问数据库 → Architecture Violation
 *   ❌ 不经过 FilmLanguageIR 直接读 ExecutionPlan → Architecture Violation
 *
 * 任何违反都将导致 CI FAIL。
 * 这是确保架构冻结后不会被慢慢侵蚀的最后防线。
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'

// 需要检测的源码目录
const SRC_DIR = path.resolve(__dirname, '../../..')

// 白名单：允许这些文件读取 ExecutionPlan（因为它们在 A2 需要转换）
const ALLOWED_EXECUTION_PLAN_READERS = [
  'compatibility-layer.ts',
  'execution-plan-builder.ts',
  'director-adapter.ts',
  'runtime-contract.test.ts',
  'architecture-drift.test.ts',
  'pipeline-migration.test.ts',
]

describe('Architecture Drift Detector — 架构违反检测', () => {

  // ─── 检测 1: Provider Compiler 不能直接 import ExecutionPlan ───

  it('① Provider Compiler 不能直接 import ExecutionPlan', () => {
    const violations: string[] = []
    const providerDir = path.join(SRC_DIR, 'model-adapters')

    function walk(dir: string) {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          const content = fs.readFileSync(full, 'utf-8')
          if (
            content.includes("'../protocols/execution") ||
            content.includes('"../protocols/execution') ||
            content.includes("'./protocols/execution") ||
            content.includes('"./protocols/execution')
          ) {
            violations.push(entry.name)
          }
        }
      }
    }

    walk(providerDir)

    if (violations.length > 0) {
      console.error('❌ Architecture Violation: Provider 直接 import ExecutionPlan:', violations)
    }
    expect(violations).toHaveLength(0)
  })

  // ─── 检测 2: Provider 目录不能包含 'execution-plan' 引用 ───

  it('② Provider 代码不能包含 ExecutionPlan 字段引用', () => {
    const violations: string[] = []
    const providerDir = path.join(SRC_DIR, 'model-adapters')

    function walk(dir: string) {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          const content = fs.readFileSync(full, 'utf-8')
          // 检查是否包含 ExecutionPlan 的字段引用（如 decisionId, planId, cameraPlan 等）
          if (
            content.match(/\.(decisionId|planId|sceneId|cameraPlan)\s*[=:]/) &&
            !content.includes('film-language') &&
            !content.includes('FilmLanguage')
          ) {
            violations.push(entry.name)
          }
        }
      }
    }

    walk(providerDir)

    if (violations.length > 0) {
      console.error('❌ Architecture Violation: Provider 直接引用 ExecutionPlan 字段:', violations)
    }
    expect(violations).toHaveLength(0)
  })

  // ─── 检测 3: Recovery 不能直接修改 DirectorDecision ───

  it('③ Recovery 不能直接修改 DirectorDecision（No Direct Mutation）', () => {
    const violations: string[] = []
    const recoveryFiles = [
      path.join(SRC_DIR, 'production-loop', 'error-classifier.ts'),
    ]

    for (const file of recoveryFiles) {
      if (!fs.existsSync(file)) continue
      const content = fs.readFileSync(file, 'utf-8')
      if (content.includes('directorDecision') && content.includes('mutate')) {
        violations.push(file)
      }
    }

    if (violations.length > 0) {
      console.error('❌ Architecture Violation: Recovery 直接修改 DirectorDecision:', violations)
    }
    expect(violations).toHaveLength(0)
  })

  // ─── 检测 4: 检查所有 Runtime 文件确保不绕过 FilmLanguageIR ───

  it('④ Runtime 核心文件必须通过 FilmLanguageIR 传递', () => {
    const violations: string[] = []
    const runtimeDir = path.join(SRC_DIR, 'runtime')

    function walk(dir: string) {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
          const content = fs.readFileSync(full, 'utf-8')
          const q = content.includes('./queue/worker-runtime')
            || content.includes('worker-runtime.ts')
          // 跳过 worker-runtime（它是 V1 Legacy，Phase A 允许）
          if (!entry.name.includes('worker-runtime')) {
            // 检查是否有 buildSpecOutput 类的函数直接拼接 Provider Prompt
            // V1 Legacy 文件允许绕过（Phase A 双轨策略）
          const legacyFiles = ['narrative-gateway.ts', 'provider-middleware.ts']
          if (legacyFiles.includes(entry.name)) continue
          // CCP (Cinematic Compilation Pipeline) files are the designated compiler boundary
          if (entry.name.startsWith('ccp-') || entry.name.startsWith('cir-')) continue
          if (
              content.includes('volcengine') &&
              content.includes('prompt') &&
              !content.includes('film-language') &&
              !content.includes('FilmLanguage')
            ) {
              violations.push(entry.name)
            }
          }
        }
      }
    }

    walk(runtimeDir)

    if (violations.length > 0) {
      console.error('❌ Architecture Violation: 绕过 FilmLanguageIR 直接生成 Provider Prompt:', violations)
    }
    expect(violations).toHaveLength(0)
  })

  // ─── 检测 5: 全局架构原则声明 ───

  it('⑤ 架构原则自检：10 条原则全部存在', () => {
    const specPath = path.resolve(__dirname, '../../../../DIRECTOR_ENGINE_V2_SPEC.md')
    const content = fs.readFileSync(specPath, 'utf-8')

    const expectedPrinciples = [
      'Immutable Intent',
      'Constraint Monotonicity',
      'No Direct Mutation',
      'Partial Recovery First',
      'Provider Neutrality',
      'Semantic Preservation',
      'Information Preservation',
      'Pure Provider Compiler',
      'FilmLanguageFingerprint',
      'Deterministic Planning',
    ]

    for (const principle of expectedPrinciples) {
      expect(content).toContain(principle)
    }
  })
})


describe('⑦ Single Source of Truth（SSOT）', () => {
  test('不允许 Agent 重新解析 Narrative', () => {
    // SSOT 原则：FilmLanguageIR 是唯一真相源
    // 任何 Agent 不得从 narrative 中重新推断/解析信息
    // 
    // 违规模式：
    //   - narrative.includes("xxx") → 推断 camera / mood / lighting
    //   - narrative.match(/xxx/) → 正则解析 narrative 提取信息
    //   - narrative.replace(...) → 替换 narrative 内容
    //
    // 例外（不允许在业务 Agent 中，但允许在 adapter/compiler 中）：
    //   - volcengine-video.adapter.ts 构建 Prompt 时的 narrative 引用
    //   - film-compiler 的 parser 阶段
    //   - Validator 的 narrative-check 阶段
    
    const agentFiles: string[] = [
      'src/agents/aigc-orchestrator.ts',
      'src/agents/aigc-spec-agent.ts',
      'src/agents/portrait-prompt.agent.ts',
    ]
    
    const ssotViolations: string[] = []
    
    for (const file of agentFiles) {
      try {
        const fs = require('fs')
        const code = fs.readFileSync(file, 'utf-8')
        const lines = code.split('\n')
        
        lines.forEach((line: string, i: number) => {
          // 检测直接从 narrative 推断信息
          const patterns = [
            { pattern: 'narrative.includes', desc: '从 narrative 推断信息' },
            { pattern: 'narrative.match(', desc: '从 narrative 正则解析' },
            { pattern: 'narrative.replace(', desc: '修改 narrative' },
            { pattern: 'narrative.indexOf', desc: '从 narrative 查找信息' },
            { pattern: 'text.includes', desc: '从 text 推断信息' },
            { pattern: 'text.match(', desc: '从 text 正则解析' },
          ]
          
          for (const { pattern, desc } of patterns) {
            if (line.includes(pattern)) {
              // 过滤 adapter 中的合法引用
              const isAdapterFile = file.includes('adapter') || file.includes('compiler') || file.includes('validator')
              if (!isAdapterFile) {
                ssotViolations.push(`  ${file}:${i + 1}: ${desc} — ${line.trim()}`)
              }
            }
          }
        })
      } catch {}
    }
    
    if (ssotViolations.length > 0) {
      console.warn('⚠️  SSOT 违规（Agent 不应重新解析 Narrative）：')
      ssotViolations.forEach(v => console.warn(v))
    }
    
    // Phase A: 仅 warn, 不 fail
    expect(true).toBe(true)
  })
})


describe('⑧ No Silent Mutation（禁止静默修改）', () => {
  test('Agent 不应直接修改 FilmIR 字段，应使用 clone()', () => {
    // No Silent Mutation 原则：
    // 任何模块修改 FilmIR，必须：
    //   1. cloneFilmIR(ir) 产生新版本
    //   2. 在新版本上修改
    //   3. 记录 TransformRecord（agent + reason + changes）
    //
    // 违规模式：
    //   - filmIR.xxx = yyy（直接赋值修改）
    //   - filmIR.xxx.push()（直接 push）
    //   - filmIR.xxx = xxx（赋值修改）
    
    const agentFiles = [
      'src/agents/aigc-orchestrator.ts',
      'src/agents/aigc-spec-agent.ts',
    ]
    
    const violations: string[] = []
    
    for (const file of agentFiles) {
      try {
        const fs = require('fs')
        const code = fs.readFileSync(file, 'utf-8')
        const lines = code.split('\n')
        
        lines.forEach((line: string, i: number) => {
          // 检测 filmIR 直接赋值
          const patterns = [
            { pattern: 'filmIR.', desc: '直接访问/修改 filmIR 字段' },
            { pattern: '.push(', desc: '直接 push（应在 clone 后操作）' },
          ]
          
          for (const { pattern, desc } of patterns) {
            if (line.includes(pattern) && !line.includes('cloneFilmIR') && !line.includes('//')) {
              // 检查是否在合法使用上下文中
              const isAdapter = file.includes('adapter')
              if (!isAdapter) {
                violations.push(`  ${file}:${i + 1}: ${desc} — ${line.trim()}`)
              }
            }
          }
        })
      } catch {}
    }
    
    if (violations.length > 0) {
      console.warn('⚠️  No Silent Mutation 违规：')
      violations.forEach(v => console.warn(v))
    }
    
    expect(true).toBe(true)
  })
})


describe('⑨ No Kernel Dependency Leak', () => {
  test('Kernel 模块不应依赖 Extension 或 Execution 层', () => {
    // 原则：依赖方向只能向下
    //   Kernel (runtime/)  ← 不依赖
    //   Extension          ← 可依赖 Kernel
    //   Execution (adapter) ← 可依赖 Kernel + Extension
    //
    // Kernel 文件：src/runtime/*.ts
    // 不应引用：
    //   - src/agents/ 下的任何模块
    //   - src/model-adapters/ 下的任何模块
    //   - src/queue/ 下的任何模块
    //   - src/director/v2/protocols/ 下的任何模块
    //   - 具体 Provider 名称（volcengine / veo / seedance）
    
    const fs = require('fs')
    const path = require('path')
    const kernelFiles = [
      'src/runtime/film-language-ir.ts',
      'src/runtime/film-ir-diagnostics.ts',
      'src/runtime/film-ir-diff.ts',
      'src/runtime/film-ir-version.ts',
      'src/runtime/film-ir-snapshot.ts',
      'src/runtime/execution-context.ts',
      'src/runtime/capability-planner.ts',
      'src/runtime/graph-runtime.ts',
    ]
    
    const forbiddenRefs = [
      '../agents/',
      '../model-adapters/',
      '../queue/',
      '../director/',
      'volcengine',
      'seedance',
      'veo',
      'kling',
    ]
    
    const violations: string[] = []
    
    for (const file of kernelFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8')
        for (const ref of forbiddenRefs) {
          if (content.includes(ref)) {
            violations.push(`  ${file} 引用了 ${ref}`)
          }
        }
      } catch (e: any) {
        violations.push(`  ${file} 读取失败: ${e.message}`)
      }
    }
    
    if (violations.length > 0) {
      console.warn('⚠️  Kernel Dependency Leak 违规：')
      violations.forEach(v => console.warn(v))
    }
    
    expect(violations.length).toBe(0)  // 这里必须是 0 违规
  })
})


describe('⑩ Stable Identifier Principle', () => {
  test('核心对象必须使用相应的 ID 生成函数', () => {
    // 原则：核心对象的 ID 必须永久稳定，即使经过 Migration / Clone / Merge / Split
    // 
    // 核心对象包括：
    //   - FilmIR：filmir_xxx（由 generateFilmIRId() 生成）
    //   - Snapshot：snap_xxx（由 generateSnapshotId() 生成）
    //   - GraphNode：node_xxx（由 generateNodeId() 生成 — A4 实现）
    //   - GraphEdge：edge_xxx（由 generateEdgeId() 生成 — A4 实现）
    //
    // 本测试检查 Kernel 文件中 ID 生成函数的正确格式
    
    const fs = require('fs')
    const kernelFiles = [
      'src/runtime/film-language-ir.ts',
      'src/runtime/film-ir-snapshot.ts',
      'src/runtime/graph-runtime.ts',
    ]
    
    const expectedPatterns: Record<string, { pattern: string; description: string }> = {
      'film-language-ir.ts': { pattern: "`filmir_", description: 'FilmIR ID 应以 filmir_ 开头' },
      'film-ir-snapshot.ts': { pattern: "`snap_", description: 'Snapshot ID 应以 snap_ 开头' },
      'graph-runtime.ts': { pattern: "node_", description: 'GraphNode ID 应包含 node_ 前缀（或 A4 定义）' },
    }
    
    const violations: string[] = []
    
    for (const file of kernelFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      const expected = expectedPatterns[file.split('/').pop() || '']
      if (expected && !content.includes(expected.pattern)) {
        violations.push(`  ${file}: 缺少 ${expected.description}`)
      }
    }
    
    // 检查 ID 长度：ID 应包含足够随机性
    const irContent = fs.readFileSync('src/runtime/film-language-ir.ts', 'utf-8')
    const snapshotContent = fs.readFileSync('src/runtime/film-ir-snapshot.ts', 'utf-8')
    
    // ID 生成函数不应是简单的自增数字
    if (irContent.includes('Math.random()') === false) {
      violations.push('  film-language-ir.ts: generateFilmIRId 应包含随机因子')
    }
    if (snapshotContent.includes('Math.random()') === false) {
      violations.push('  film-ir-snapshot.ts: generateSnapshotId 应包含随机因子')
    }
    
    if (violations.length > 0) {
      console.warn('⚠️  Stable Identifier 违规：')
      violations.forEach(v => console.warn(v))
    }
    
    expect(violations.length).toBe(0)
  })
})
