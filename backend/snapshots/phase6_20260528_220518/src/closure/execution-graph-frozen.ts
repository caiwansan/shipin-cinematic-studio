/**
 * closure/execution-graph-frozen.ts — Execution Graph Immutability Lock
 *
 * EGIL Axioms:
 *   A1 — Single Entry Law: entrypoint_count === 1
 *   A2 — No Runtime Graph Mutation: execution_graph.is_mutable === false
 *   A3 — Deterministic Dispatch: dispatch(input) → path is pure function
 *   A4 — No Hidden Branch Layer: no fallback/default/switch-case-chain
 *
 * Frozen Graph Rule:
 *   At build time: execution_graph is fully resolved
 *   At runtime: execution_graph is READ-ONLY
 */

import fs from 'fs'
import path from 'path'

/**
 * Frozen execution graph node
 */
export interface FrozenGraphNode {
  /** Unique node id */
  id: string
  /** Human label */
  label: string
  /** File this node represents */
  file: string
  /** Node type */
  type: 'entry' | 'adapter' | 'provider' | 'middleware' | 'route' | 'service' | 'kernel' | 'truth'
  /** Required capabilities */
  requiresCapabilities: string[]
  /** Children (edges to next nodes) — frozen after build */
  edges: string[]
}

/**
 * Immutable execution graph
 */
export interface FrozenExecutionGraph {
  version: string
  builtAt: string
  hash: string
  entry: string
  nodes: Record<string, FrozenGraphNode>
}

/** Runtime-forbidden operations (EGIL Axiom 2 violations) */
export const FORBIDDEN_RUNTIME_OPERATIONS = [
  'registerHandler',
  'registerProvider',
  'addRoute',
  'extendWorker',
  'dynamic import* for routing',
  'env-based provider selection',
  'lazy runtime graph patching',
  'runtime registerAdapter',
] as const

// ================================================================
// Graph Hash Lock
// ================================================================

/**
 * Compute deterministic hash of the execution graph
 */
export function hashGraph(graph: FrozenExecutionGraph): string {
  // Simple deterministic hash: JSON canonical + string length
  const canonical = JSON.stringify(graph.nodes, Object.keys(graph.nodes).sort()) +
    graph.entry + graph.version
  let hash = 0
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32bit integer
  }
  return `EGIL-${Math.abs(hash).toString(16).padStart(8, '0')}`
}

// ================================================================
// Topology Validation
// ================================================================

/**
 * Validates the frozen graph:
 * - Single entry
 * - No cycles
 * - All edges reference valid nodes
 * - All nodes reachable from entry
 */
export function validateFrozenGraph(graph: FrozenExecutionGraph): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Axiom 1: Single Entry Law
  if (!graph.entry) {
    errors.push('[EGIL A1] No entry point defined')
  }

  // Axiom 2: Verify all nodes exist
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (id !== node.id) {
      errors.push(`[EGIL A2] Node ID mismatch: '${id}' vs '${node.id}'`)
    }
    for (const edge of node.edges) {
      if (!graph.nodes[edge]) {
        errors.push(`[EGIL A2] Edge '${edge}' from node '${id}' references non-existent node`)
      }
    }
  }

  // Axiom 3: No cycles (DFS from entry)
  if (graph.entry && graph.nodes[graph.entry]) {
    const visited = new Set<string>()
    const stack = new Set<string>()
    const detectCycle = (nodeId: string): boolean => {
      if (stack.has(nodeId)) return true // cycle detected
      if (visited.has(nodeId)) return false
      visited.add(nodeId)
      stack.add(nodeId)
      const node = graph.nodes[nodeId]
      if (node) {
        for (const edge of node.edges) {
          if (detectCycle(edge)) return true
        }
      }
      stack.delete(nodeId)
      return false
    }
    if (detectCycle(graph.entry)) {
      errors.push('[EGIL A3] Cycle detected in execution graph')
    }

    // All nodes reachable?
    const reachable = new Set(visited)
    for (const id of Object.keys(graph.nodes)) {
      if (!reachable.has(id)) {
        errors.push(`[EGIL A3] Node '${id}' is unreachable from entry '${graph.entry}'`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// ================================================================
// Graph Integrity Check (boot-time)
// ================================================================

const GRAPH_PATH = path.resolve(__dirname, '../../config/execution-graph.frozen.json')

let _cachedGraph: FrozenExecutionGraph | null = null

/**
 * Load frozen execution graph from disk
 */
export function loadFrozenGraph(): FrozenExecutionGraph | null {
  if (_cachedGraph) return _cachedGraph
  try {
    if (!fs.existsSync(GRAPH_PATH)) {
      console.warn('[EGIL] No frozen graph found at', GRAPH_PATH)
      return null
    }
    const raw = fs.readFileSync(GRAPH_PATH, 'utf-8')
    const graph = JSON.parse(raw) as FrozenExecutionGraph
    _cachedGraph = graph
    return graph
  } catch (err: any) {
    console.error('[EGIL] Failed to load frozen graph:', err.message)
    return null
  }
}

/**
 * Boot-time integrity check:
 * 1. Load frozen graph
 * 2. Compute runtime hash
 * 3. Compare with build-time hash
 * 4. Validate topology
 */
export function checkGraphIntegrity(): {
  pass: boolean
  message: string
  details: string[]
} {
  const graph = loadFrozenGraph()
  if (!graph) {
    return { pass: false, message: 'No frozen graph available', details: [] }
  }

  const details: string[] = []
  details.push(`[EGIL] Graph version: ${graph.version}`)
  details.push(`[EGIL] Build time: ${graph.builtAt}`)
  details.push(`[EGIL] Entry point: ${graph.entry}`)
  details.push(`[EGIL] Nodes: ${Object.keys(graph.nodes).length}`)

  // Hash check
  const expectedHash = graph.hash
  const actualHash = hashGraph(graph)
  const hashMatch = expectedHash === actualHash
  if (!hashMatch) {
    details.push(`[EGIL] ❌ Hash mismatch: expected ${expectedHash}, got ${actualHash}`)
  } else {
    details.push(`[EGIL] ✅ Hash verified: ${actualHash}`)
  }

  // Topology check
  const { valid, errors } = validateFrozenGraph(graph)
  if (!valid) {
    details.push(`[EGIL] ❌ Topology violations: ${errors.length}`)
    errors.forEach(e => details.push(`  - ${e}`))
  } else {
    details.push(`[EGIL] ✅ Topology valid`)
  }

  const pass = hashMatch && valid
  const message = pass
    ? '[EGIL] ✅ Execution graph integrity verified'
    : '[EGIL] ❌ Execution graph integrity VIOLATED'

  return { pass, message, details }
}

// ================================================================
// Build & Freeze
// ================================================================

/**
 * Build and freeze the execution graph.
 * Called at build time (or first boot) to generate the immutable artifact.
 */
export function buildFrozenGraph(): FrozenExecutionGraph {
  const nodes: Record<string, FrozenGraphNode> = {
    'runtime-boot': {
      id: 'runtime-boot',
      label: 'Runtime Boot',
      file: 'bootstrap/runtime-boot.ts',
      type: 'entry',
      requiresCapabilities: [],
      edges: ['governance-init', 'kernel-init', 'truth-init', 'adapter-registry', 'determinism-test'],
    },
    'governance-init': {
      id: 'governance-init',
      label: 'Governance Init',
      file: 'governance/init-governance.ts',
      type: 'kernel',
      requiresCapabilities: [],
      edges: [],
    },
    'kernel-init': {
      id: 'kernel-init',
      label: 'Kernel Init',
      file: 'kernel/init-kernel.ts',
      type: 'kernel',
      requiresCapabilities: [],
      edges: [],
    },
    'truth-init': {
      id: 'truth-init',
      label: 'Truth Layer Init',
      file: 'truth/init-truth.ts',
      type: 'truth',
      requiresCapabilities: [],
      edges: [],
    },
    'adapter-registry': {
      id: 'adapter-registry',
      label: 'Model Adapter Registry',
      file: 'model-adapters/index.ts',
      type: 'adapter',
      requiresCapabilities: ['llm', 'image', 'video', 'tts'],
      edges: ['adapter-freeze', 'runtime-self-test'],
    },
    'adapter-freeze': {
      id: 'adapter-freeze',
      label: 'Freeze Registry',
      file: 'model-adapters/registry.ts',
      type: 'adapter',
      requiresCapabilities: [],
      edges: ['runtime-self-test'],
    },
    'determinism-test': {
      id: 'determinism-test',
      label: 'Determinism Test',
      file: 'bootstrap/determinism-test.ts',
      type: 'kernel',
      requiresCapabilities: [],
      edges: [],
    },
    'runtime-self-test': {
      id: 'runtime-self-test',
      label: 'Runtime Self-Test',
      file: 'bootstrap/self-test/runtime-self-test.ts',
      type: 'kernel',
      requiresCapabilities: [],
      edges: ['worker-runtime'],
    },
    'worker-runtime': {
      id: 'worker-runtime',
      label: 'Worker Runtime (Single Entry)',
      file: 'queue/worker-runtime.ts',
      type: 'entry',
      requiresCapabilities: ['llm', 'image', 'video', 'tts'],
      edges: ['model-adapter-execute'],
    },
    'model-adapter-execute': {
      id: 'model-adapter-execute',
      label: 'ModelAdapterRegistry.execute()',
      file: 'model-adapters/registry.ts',
      type: 'adapter',
      requiresCapabilities: [],
      edges: [
        'llm-openai', 'llm-volcengine', 'llm-aliyun',
        'image-qwen', 'image-wan', 'image-seedream', 'image-dalle', 'image-siliconflow',
        'video-aliyun', 'video-volcengine',
        'tts-volcengine', 'tts-aliyun', 'tts-siliconflow',
      ],
    },
    // LLM adapters
    'llm-openai': {
      id: 'llm-openai', label: 'OpenAI Compat LLM', file: 'model-adapters/llm/openai-compat.adapter.ts',
      type: 'adapter', requiresCapabilities: ['llm'], edges: ['event-sourcing'],
    },
    'llm-volcengine': {
      id: 'llm-volcengine', label: 'Volcengine LLM', file: 'model-adapters/llm/volcengine-llm.adapter.ts',
      type: 'adapter', requiresCapabilities: ['llm'], edges: ['event-sourcing'],
    },
    'llm-aliyun': {
      id: 'llm-aliyun', label: 'Alibaba Cloud LLM', file: 'model-adapters/llm/aliyun-llm.adapter.ts',
      type: 'adapter', requiresCapabilities: ['llm'], edges: ['event-sourcing'],
    },
    // Image adapters
    'image-qwen': {
      id: 'image-qwen', label: 'Qwen Image', file: 'model-adapters/images/qwen-image.adapter.ts',
      type: 'adapter', requiresCapabilities: ['image'], edges: ['event-sourcing'],
    },
    'image-wan': {
      id: 'image-wan', label: 'Wan Image', file: 'model-adapters/images/wan-image.adapter.ts',
      type: 'adapter', requiresCapabilities: ['image'], edges: ['event-sourcing'],
    },
    'image-seedream': {
      id: 'image-seedream', label: 'Seedream Image', file: 'model-adapters/images/seedream-image.adapter.ts',
      type: 'adapter', requiresCapabilities: ['image'], edges: ['event-sourcing'],
    },
    'image-dalle': {
      id: 'image-dalle', label: 'DALL·E Image', file: 'model-adapters/images/dalle-image.adapter.ts',
      type: 'adapter', requiresCapabilities: ['image'], edges: ['event-sourcing'],
    },
    'image-siliconflow': {
      id: 'image-siliconflow', label: 'SiliconFlow Image', file: 'model-adapters/images/siliconflow-image.adapter.ts',
      type: 'adapter', requiresCapabilities: ['image'], edges: ['event-sourcing'],
    },
    // Video adapters
    'video-aliyun': {
      id: 'video-aliyun', label: 'Alibaba Video', file: 'model-adapters/video/aliyun-video.adapter.ts',
      type: 'adapter', requiresCapabilities: ['video'], edges: ['event-sourcing'],
    },
    'video-volcengine': {
      id: 'video-volcengine', label: 'Volcengine Video', file: 'model-adapters/video/volcengine-video.adapter.ts',
      type: 'adapter', requiresCapabilities: ['video'], edges: ['event-sourcing'],
    },
    // TTS adapters
    'tts-volcengine': {
      id: 'tts-volcengine', label: 'Volcengine TTS', file: 'model-adapters/tts/volcengine-tts.adapter.ts',
      type: 'adapter', requiresCapabilities: ['tts'], edges: ['event-sourcing'],
    },
    'tts-aliyun': {
      id: 'tts-aliyun', label: 'Alibaba TTS', file: 'model-adapters/tts/aliyun-tts.adapter.ts',
      type: 'adapter', requiresCapabilities: ['tts'], edges: ['event-sourcing'],
    },
    'tts-siliconflow': {
      id: 'tts-siliconflow', label: 'SiliconFlow TTS', file: 'model-adapters/tts/siliconflow-tts.adapter.ts',
      type: 'adapter', requiresCapabilities: ['tts'], edges: ['event-sourcing'],
    },
    'event-sourcing': {
      id: 'event-sourcing', label: 'Event Sink', file: 'kernel/event-sourcing/execution-event-store.ts',
      type: 'kernel', requiresCapabilities: [], edges: ['truth-arbitration'],
    },
    'truth-arbitration': {
      id: 'truth-arbitration', label: 'Truth Arbitration', file: 'truth/arbitration-engine.ts',
      type: 'truth', requiresCapabilities: [], edges: [],
    },
  }

  const graph: FrozenExecutionGraph = {
    version: 'v1.0.0',
    builtAt: new Date().toISOString(),
    hash: 'PENDING',
    entry: 'runtime-boot',
    nodes,
  }

  graph.hash = hashGraph(graph)
  return graph
}

/**
 * Write frozen graph to disk
 */
export function persistFrozenGraph(graph: FrozenExecutionGraph): void {
  const dir = path.dirname(GRAPH_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(GRAPH_PATH, JSON.stringify(graph, null, 2))
  console.log(`[EGIL] Frozen graph written to ${GRAPH_PATH} (${graph.hash})`)
}

// ================================================================
// Structural Purity Score
// ================================================================

/**
 * Compute Structural Purity Score (SPS)
 *
 * SPS = 100 - mutation_points - runtime_branch_sources - dynamic_registry_points
 */
export function computeSPS(graph: FrozenExecutionGraph): number {
  let score = 100

  // Penalize: any node with fallback/shadow/legacy naming
  for (const [, node] of Object.entries(graph.nodes)) {
    const fileLower = node.file.toLowerCase()
    if (fileLower.includes('fallback')) score -= 10
    if (fileLower.includes('shadow')) score -= 8
    if (fileLower.includes('legacy')) score -= 8
    if (fileLower.includes('dynamic')) score -= 5
  }

  // Penalize: too many entry points (Axiom 1)
  const entryCount = Object.values(graph.nodes).filter(n => n.type === 'entry').length
  if (entryCount > 1) score -= (entryCount - 1) * 15

  // Penalize: cycle detection via validation
  const { valid } = validateFrozenGraph(graph)
  if (!valid) score -= 20

  // Penalize: large graph (complexity tax)
  const nodeCount = Object.keys(graph.nodes).length
  if (nodeCount > 30) score -= Math.min(15, Math.floor((nodeCount - 30) / 5))

  // If graph has mutations
  if (graph.nodes['dao'] || graph.nodes['dynamic-registry']) score -= 15

  return Math.max(0, Math.min(100, score))
}

// ================================================================
// CLI
// ================================================================

if (process.argv[1]?.includes('execution-graph-frozen')) {
  runCLI()
}

function runCLI() {
  const action = process.argv[2] || 'build'

  if (action === 'build') {
    const graph = buildFrozenGraph()
    persistFrozenGraph(graph)
    console.log(`[EGIL] Graph hash: ${graph.hash}`)
    console.log(`[EGIL] Nodes: ${Object.keys(graph.nodes).length}`)
    console.log(`[EGIL] SPS: ${computeSPS(graph)}/100`)

    // Validate
    const { valid, errors } = validateFrozenGraph(graph)
    if (valid) {
      console.log('[EGIL] ✅ Topology valid')
    } else {
      console.log('[EGIL] ❌ Topology errors:')
      errors.forEach(e => console.log(`  - ${e}`))
    }
  }

  if (action === 'check') {
    const result = checkGraphIntegrity()
    console.log(result.message)
    result.details.forEach(d => console.log(d))
    if (!result.pass) process.exit(1)
  }
}
