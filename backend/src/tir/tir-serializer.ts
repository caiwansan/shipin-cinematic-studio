/**
 * TIR — Serializer (DirectorIRGraph → TIR Text)
 * TIR 序列化器 — 将 DirectorIRGraph 编译回 TIR 源码
 *
 * 关键要求：
 *   - lossless round-trip（parse → serialize → parse 不丢信息）
 *   - 人类可读的输出
 *   - 约束声明优先于注释
 */

import {
  DirectorIRGraph,
  DirectorIRNode,
  DirectorIREdge,
} from '../director-ir/director-ir-types.js'

export function serializeTIR(graph: DirectorIRGraph): string {
  const lines: string[] = []
  let indent = 0

  const emit = (s: string) => lines.push('  '.repeat(indent) + s)
  const openBlock = () => { emit('{'); indent++ }
  const closeBlock = () => { indent--; emit('}') }

  // ─── Header ───
  emit(`// TIR v1 — Generated from DirectorIRGraph "${graph.metadata.title}"`)
  emit(`// Nodes: ${graph.metadata.shotCount}, Edges: ${graph.edges.length}, Version: ${graph.version}`)
  emit('')

  // ─── Group nodes by scene ───
  const sceneMap = new Map<string, DirectorIRNode[]>()
  for (const [, node] of graph.nodes) {
    const sceneName = graph.metadata.sceneNames?.[node.sceneIndex] ?? `scene_${node.sceneIndex}`
    if (!sceneMap.has(sceneName)) sceneMap.set(sceneName, [])
    sceneMap.get(sceneName)!.push(node)
  }

  // ─── Scene loop ───
  for (const [sceneName, nodes] of sceneMap) {
    // 收集 scene 级 annotations
    const sceneLocations = new Set<string>()
    const sceneTensions: number[] = []
    for (const node of nodes) {
      if (node.state.runtime?.location) sceneLocations.add(node.state.runtime.location as string)
      const t = node.state.causal?.tension
      if (t !== undefined) sceneTensions.push(t)
    }

    const avgTension = sceneTensions.length > 0
      ? sceneTensions.reduce((a, b) => a + b, 0) / sceneTensions.length
      : undefined

    emit(`scene "${sceneName}"`)
    openBlock()

    // Scene-level metadata
    if (sceneLocations.size === 1) {
      emit(`@location "${Array.from(sceneLocations)[0]}"`)
    }
    if (avgTension !== undefined) {
      emit(`@tension ${avgTension.toFixed(4)}`)
    }
    emit('')

    // Shots
    for (const node of nodes) {
      const annotations: string[] = []

      // tension
      const tension = node.state.causal?.tension ?? node.state.runtime?.tension
      if (tension !== undefined) annotations.push(`@tension ${typeof tension === 'number' ? tension.toFixed(4) : tension}`)

      // motion
      const motion = node.state.runtime?.motionStyle
      if (motion) annotations.push(`@motion ${motion}`)

      // grammar
      const grammar = node.state.runtime?.grammarType
      if (grammar) annotations.push(`@grammar ${grammar}`)

      // emotion
      const emotion = node.state.runtime?.emotionType
      if (emotion) annotations.push(`@emotion ${emotion}`)

      // characters
      const chars = node.state.runtime?.characters
      if (chars) {
        const charStr = Array.isArray(chars) ? chars.map((c: string) => `"${c}"`).join(', ') : `"${chars}"`
        annotations.push(`@character [${charStr}]`)
      }

      // duration
      const duration = node.state.runtime?.duration
      if (duration) annotations.push(`@duration ${duration}`)

      // location
      const loc = node.state.runtime?.location
      if (loc) annotations.push(`@location "${loc}"`)

      // timeline tags
      const tags = node.state.runtime?.tags
      if (Array.isArray(tags) && tags.length > 0) {
        annotations.push(`@tags [${tags.map((t: string) => `"${t}"`).join(', ')}]`)
      }

      // narrative annotations
      const arcRole = node.state.narrative?.arcRole
      if (arcRole) annotations.push(`@arcRole ${arcRole}`)

      // constraints
      const violations = node.state.narrative?.violations
      if (violations && violations.length > 0) {
        // 只取第一条作为标注
        annotations.push(`@constraint ${violations[0].replace(/[^a-zA-Z0-9_=]/g, '_')}`)
      }

      const text = (node.state.runtime?.text as string) ?? `shot ${node.shotIndex}`

      // 使用原始 shot id（从 node.id 中提取最后一个 . 后的部分）
      // 如果没找到，退回到 s{shotIndex}
      const originalShotId = node.id.split('.').pop() ?? `s${node.shotIndex}`

      emit(`shot ${originalShotId} "${escapeStr(text)}"`)
      openBlock()

      for (const ann of annotations) {
        emit(ann)
      }

      closeBlock()
      emit('')
    }

    // Same-scene edges (cross-scene edges are emitted separately)
    const sceneEdges = graph.edges.filter(e => {
      const fromNode = graph.nodes.get(e.from)
      const toNode = graph.nodes.get(e.to)
      return fromNode && toNode && fromNode.sceneIndex === nodes[0]?.sceneIndex
        && fromNode.sceneIndex === toNode.sceneIndex  // only same-scene
    })

    if (sceneEdges.length > 0) emit('')

    for (const edge of sceneEdges) {
      const fromName = edge.from.split('.').pop() ?? edge.from
      const toName = edge.to.split('.').pop() ?? edge.to

      let arrow = '->'
      if (edge.type === 'semantic' || edge.type === 'derivation' || edge.type === 'narrative_constraint') {
        arrow = '->>'
      }

      // 如果只有默认可省略 options
      const opts: string[] = []
      if (edge.weight !== undefined && edge.weight !== 1.0) opts.push(`weight ${edge.weight.toFixed(4)}`)
      if (edge.type !== 'temporal') opts.push(edge.type)
      if (edge.constraint?.hard) opts.push('hard')
      if (edge.constraint?.ruleId) opts.push(`rule_id="${edge.constraint.ruleId}"`)

      if (opts.length > 0) {
        emit(`${fromName} ${arrow} ${toName} { ${opts.join(' ')} }`)
      } else {
        emit(`${fromName} ${arrow} ${toName}`)
      }
    }

    // Cross-scene edges: emitted within source scene, using fully qualified target
    const crossEdges = graph.edges.filter(e => {
      const fromNode = graph.nodes.get(e.from)
      const toNode = graph.nodes.get(e.to)
      return fromNode && toNode && fromNode.sceneIndex === nodes[0]?.sceneIndex
        && fromNode.sceneIndex !== toNode.sceneIndex
    })

    if (crossEdges.length > 0 && graph.edges.length > sceneEdges.length) emit('') // double blank line before cross-scene

    for (const edge of crossEdges) {
      const fromName = edge.from  // already fully qualified (e.g. "first.s2")
      const toName = edge.to  // already fully qualified (e.g. "second.s3")

      let arrow = '->>'
      if (edge.type === 'causal' || edge.type === 'temporal') {
        arrow = '->'
      }

      const opts: string[] = []
      if (edge.weight !== undefined && edge.weight !== 1.0) opts.push(`weight ${edge.weight.toFixed(4)}`)
      if (edge.type !== 'temporal') opts.push(edge.type)
      if (edge.constraint?.hard) opts.push('hard')
      if (edge.constraint?.ruleId) opts.push(`rule_id="${edge.constraint.ruleId}"`)

      if (opts.length > 0) {
        emit(`${fromName} ${arrow} ${toName} { ${opts.join(' ')} }`)
      } else {
        emit(`${fromName} ${arrow} ${toName}`)
      }
    }

    // Constraints
    for (const node of nodes) {
      if (node.state.narrative?.violations && node.state.narrative.violations.length > 0) {
        emit('')
        const shotName = node.id.split('.').pop() ?? `s${node.shotIndex}`
        emit(`constrain ${shotName}`)
        openBlock()
        for (const v of node.state.narrative.violations) {
          if (v.startsWith('forbid ') || v.startsWith('must ')) {
            emit(v)
          }
        }
        closeBlock()
      }
    }

    closeBlock()
    emit('')
  }

  // ─── Cross-scene edges (outside scene blocks, using full qualified names) ───
  return lines.join('\n')
}

function escapeStr(s: string): string {
  return s.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
}
