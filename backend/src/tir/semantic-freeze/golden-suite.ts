/**
 * TIR Semantic Freeze — Golden Test Suite
 * 金标准测试套件 — TIR 语义冻结的回归防线
 *
 * 每个 golden sample 定义了"TIR 必须永远能正确解析"的语义。
 * 如果某个 sample 失效 → freeze violation → 必须改的是下游代码，不是 TIR 语义。
 *
 * 规则：
 *   - 每个 golden sample 必须通过 parse + roundtrip
 *   - 不允许跳过或标记为"未来修复"
 *   - 新增样本必须经过审核
 */

import { TIRParser } from '../tir-parser.js'
import { assertEquivalence } from './roundtrip-checker.js'

export interface GoldenSample {
  name: string
  source: string
  requirements: {
    minNodes: number
    minEdges: number
    scenes: number
  }
}

// ── Golden Samples ────────────────────────

const GOLDEN_SAMPLES: GoldenSample[] = [
  // G001: 最小电影 — 单场景单镜头
  {
    name: 'G001 — Minimal single shot',
    source: `# G001: minimal film
scene "minimal" {
  shot s1 "a single shot" {
    @tension 0.5
  }
}`,
    requirements: { minNodes: 1, minEdges: 0, scenes: 1 },
  },

  // G002: 双镜 + causal edge
  {
    name: 'G002 — Two shots with causal edge',
    source: `# G002: two-shot causal
scene "duo" {
  shot s1 "shot one" {
    @tension 0.3
    @motion static
  }
  shot s2 "shot two" {
    @tension 0.7
    @motion slow_push
  }
  s1 -> s2 { weight 0.8 causal }
}`,
    requirements: { minNodes: 2, minEdges: 1, scenes: 1 },
  },

  // G003: 多场 + 语义边 + 约束
  {
    name: 'G003 — Multi-scene with semantic edge and constraint',
    source: `# G003: cross-scene semantic
@arc build_peak_release

scene "first" {
  shot s1 "opening" {
    @tension 0.2
  }
  shot s2 "build up" {
    @tension 0.5
    @emotion tension
  }
  s1 -> s2 { weight 0.6 causal }
}

scene "second" {
  shot s3 "climax" {
    @tension 0.9
    @motion quick_zoom
  }
  s2 ->> s3 { weight 0.4 semantic }
  constrain s3 {
    forbid abrupt_peak
    must arc_role=peak
  }
}`,
    requirements: { minNodes: 3, minEdges: 2, scenes: 2 },
  },

  // G004: 全标注镜头
  {
    name: 'G004 — Fully annotated shot',
    source: `# G004: full annotations
scene "full" {
  shot s1 "the annotated shot" {
    @tension 0.618
    @motion handheld_shake
    @grammar cu
    @emotion anxiety
    @character ["hero", "villain"]
    @duration "12s"
    @location "rooftop"
    @tags ["action", "climax"]
  }
}`,
    requirements: { minNodes: 1, minEdges: 0, scenes: 1 },
  },

  // G005: 5 个镜头的弧线测试
  {
    name: 'G005 — Five-shot arc',
    source: `# G005: five-shot arc build
@arc build_peak_release
@max_tension_curve [0.2, 0.4, 0.7, 0.9, 0.5]

scene "arc" {
  shot s1 "intro" {
    @tension 0.2
  }
  shot s2 "rising" {
    @tension 0.4
  }
  shot s3 "conflict" {
    @tension 0.7
  }
  shot s4 "peak" {
    @tension 0.9
  }
  shot s5 "release" {
    @tension 0.5
  }
  s1 -> s2 { weight 0.5 causal }
  s2 -> s3 { weight 0.7 causal }
  s3 -> s4 { weight 0.9 temporal }
  s4 -> s5 { weight 0.6 causal }
}`,
    requirements: { minNodes: 5, minEdges: 4, scenes: 1 },
  },

  // G006: 黎明追击（完整示例）
  {
    name: 'G006 — Full feature: Dawn Chase',
    source: `# G006: dawn chase
@arc build_peak_release

scene "opening" {
  @location "warehouse"
  shot s1 "wake up" {
    @tension 0.2
    @motion static
    @grammar ws
  }
  shot s2 "look around" {
    @tension 0.3
    @motion slow_pan
  }
  s1 -> s2 { weight 0.7 causal }
}

scene "showdown" {
  @location "rooftop"
  shot s3 "villain appears" {
    @tension 0.8
    @motion quick_zoom
    @grammar cu
    @emotion shock
  }
  shot s4 "confrontation" {
    @tension 0.85
    @motion static
    @grammar ots
    @emotion tension
  }
  s3 -> s4 { weight 0.9 temporal }
}`,
    requirements: { minNodes: 4, minEdges: 2, scenes: 2 },
  },

  // G007: 仅 temporal edges（无 causal）
  {
    name: 'G007 — Temporal-only edges',
    source: `# G007: temporal sequence
scene "sequence" {
  shot s1 "first" { @tension 0.3 }
  shot s2 "second" { @tension 0.5 }
  shot s3 "third" { @tension 0.7 }
  s1 -> s2 { weight 1.0 temporal }
  s2 -> s3
}`,
    requirements: { minNodes: 3, minEdges: 2, scenes: 1 },
  },

  // G008: 空约束验证
  {
    name: 'G008 — Constraint-only scene',
    source: `# G008: constraints
scene "constrained" {
  shot s1 "the shot" { @tension 0.5 }
  constrain s1 {
    forbid abrupt_peak
    must arc_role=build
  }
}`,
    requirements: { minNodes: 1, minEdges: 0, scenes: 1 },
  },
]

export { GOLDEN_SAMPLES }

export interface SuiteResult {
  total: number
  passed: number
  failed: number
  results: Array<{
    name: string
    pass: boolean
    error?: string
    nodeCount: number
    edgeCount: number
  }>
}

/**
 * 运行金标准测试套件
 */
export function runGoldenSuite(): SuiteResult {
  const results: SuiteResult['results'] = []

  for (const sample of GOLDEN_SAMPLES) {
    try {
      // Parse
      const parser = new TIRParser()
      const { graph, warnings } = parser.parse(sample.source)

      // Basic requirements
      const meetsNodes = graph.nodes.size >= sample.requirements.minNodes
      const meetsEdges = graph.edges.length >= sample.requirements.minEdges
      const meetsScenes = graph.metadata.sceneCount >= sample.requirements.scenes

      if (!meetsNodes) {
        results.push({
          name: sample.name,
          pass: false,
          error: `Expected ≥${sample.requirements.minNodes} nodes, got ${graph.nodes.size}`,
          nodeCount: graph.nodes.size,
          edgeCount: graph.edges.length,
        })
        continue
      }

      // Roundtrip equivalence
      assertEquivalence(sample.source)

      results.push({
        name: sample.name,
        pass: true,
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.length,
      })
    } catch (e) {
      results.push({
        name: sample.name,
        pass: false,
        error: String(e),
        nodeCount: 0,
        edgeCount: 0,
      })
    }
  }

  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length

  return {
    total: results.length,
    passed,
    failed,
    results,
  }
}
