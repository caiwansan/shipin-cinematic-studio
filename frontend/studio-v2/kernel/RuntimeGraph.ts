// ============================================================
// Runtime Graph — Unified DAG connecting all workbench nodes
// SSOT enforcement: every node must have a parentId reference
// Downstream nodes may only Reference/Enhance, never Rewrite
// ============================================================

import type {
  PipelineRuntime, PipelineStageId, WorkspaceRuntime,
  CharacterRuntime, SceneRuntime, SegmentRuntime,
  NarrativeRuntime, StoryboardImage,
} from '~/studio-v2/types/runtime/index'

// ─── Runtime Node ────────────────────────────────────────────

export interface RuntimeNode {
  id: string
  type: 'script' | 'scene' | 'character' | 'storyboard' | 'video' | 'voice' | 'asset'
  parentId: string | null           // upstream node — null for root
  references: string[]              // referenced node IDs
  assets: string[]                  // generated asset IDs (images, videos, audio)
  outputs: string[]                 // child node IDs
  status: 'idle' | 'running' | 'completed' | 'error'
  sourceLabel: string               // human-readable source description
}

// ─── Prompt History ──────────────────────────────────────────

export interface PromptEntry {
  id: string
  original: string                  // initial prompt (from script breakdown)
  current: string                   // current active prompt
  optimized: string | null          // latest AI-optimized version
  negativeOriginal: string
  negativeCurrent: string
  references: {
    characterIds: string[]
    sceneIds: string[]
    assetUrls: string[]
  }
  updatedAt: number
}

// ─── Runtime Graph ───────────────────────────────────────────

export interface RuntimeGraphData {
  nodes: Record<string, RuntimeNode>
  prompts: Record<string, PromptEntry>  // segmentId → prompt
  updatedAt: number
}

const emptyGraph = (): RuntimeGraphData => ({
  nodes: {},
  prompts: {},
  updatedAt: Date.now(),
})

// ─── Graph Builder ───────────────────────────────────────────

export class RuntimeGraph {
  private data: RuntimeGraphData

  constructor(initial?: Partial<RuntimeGraphData>) {
    this.data = { ...emptyGraph(), ...initial }
  }

  // ── Node Management ──────────────────────────────────────

  addNode(node: RuntimeNode): void {
    this.data.nodes[node.id] = node
  }

  getNode(id: string): RuntimeNode | undefined {
    return this.data.nodes[id]
  }

  getChildren(parentId: string): RuntimeNode[] {
    return Object.values(this.data.nodes).filter(n => n.parentId === parentId)
  }

  getChain(startId: string): RuntimeNode[] {
    const chain: RuntimeNode[] = []
    let current: RuntimeNode | undefined = this.data.nodes[startId]
    while (current) {
      chain.push(current)
      current = current.parentId ? this.data.nodes[current.parentId] : undefined
    }
    return chain
  }

  // ── Prompt Management ────────────────────────────────────

  getPrompt(segmentId: string): PromptEntry | undefined {
    return this.data.prompts[segmentId]
  }

  setPrompt(segmentId: string, prompt: Partial<PromptEntry>): void {
    const existing = this.data.prompts[segmentId]
    if (existing) {
      this.data.prompts[segmentId] = { ...existing, ...prompt, updatedAt: Date.now() }
    } else {
      this.data.prompts[segmentId] = {
        id: segmentId,
        original: prompt.original || '',
        current: prompt.current || prompt.original || '',
        optimized: prompt.optimized || null,
        negativeOriginal: prompt.negativeOriginal || '',
        negativeCurrent: prompt.negativeCurrent || '',
        references: prompt.references || { characterIds: [], sceneIds: [], assetUrls: [] },
        updatedAt: Date.now(),
      }
    }
  }

  // ⭐ Enforce: Optimizer may only append, never replace
  applyOptimization(segmentId: string, optimized: string, negativeOptimized: string): void {
    const existing = this.data.prompts[segmentId]
    if (!existing) return
    // Save optimized version — current remains as reference
    this.data.prompts[segmentId] = {
      ...existing,
      optimized,
      negativeCurrent: negativeOptimized || existing.negativeCurrent,
      updatedAt: Date.now(),
    }
  }

  // ── Build from WorkspaceRuntime ───────────────────────────

  static fromWorkspace(ws: WorkspaceRuntime): RuntimeGraph {
    const graph = new RuntimeGraph()

    // Root: Script node
    graph.addNode({
      id: 'script-root',
      type: 'script',
      parentId: null,
      references: [],
      assets: [],
      outputs: [],
      status: 'completed',
      sourceLabel: '剧本拆解（Script Analysis）',
    })

    // Scene nodes
    for (const sc of (ws.scenes || [])) {
      graph.addNode({
        id: sc.id,
        type: 'scene',
        parentId: 'script-root',
        references: ['script-root'],
        assets: sc.imageUrl ? [sc.imageUrl] : [],
        outputs: [],
        status: sc.imageUrl ? 'completed' : 'idle',
        sourceLabel: `场景：${sc.name || sc.id}`,
      })
    }

    // Character nodes
    for (const ch of (ws.characters || [])) {
      graph.addNode({
        id: ch.id,
        type: 'character',
        parentId: 'script-root',
        references: ['script-root'],
        assets: ch.imageUrl ? [ch.imageUrl] : [],
        outputs: [],
        status: ch.imageUrl ? 'completed' : 'idle',
        sourceLabel: `角色：${ch.name || ch.id}`,
      })
    }

    // Storyboard nodes (from segments)
    for (const sg of (ws.segments || [])) {
      const sgId = sg.id || sg.segmentId || `segment-${ws.segments.indexOf(sg)}`
      graph.addNode({
        id: sgId,
        type: 'storyboard',
        parentId: 'script-root',
        references: [
          ...(sg.characters || []).map((c: string) => `char-${c}`),
          ...(sg.scenes || []).map((s: string) => `scene-${s}`),
        ],
        assets: [],
        outputs: [],
        status: 'idle',
        sourceLabel: `分镜：${sg.title || sgId}`,
      })
    }

    // Storyboard images → assets
    for (const img of (ws.storyboardImages || [])) {
      const segNode = graph.getNode(img.segmentId)
      if (segNode) {
        segNode.assets.push(img.imageUrl)
        segNode.status = 'completed'
      }
    }

    // Prompts from segments
    for (const sg of (ws.segments || [])) {
      const sgId = sg.id || sg.segmentId || `segment-${ws.segments.indexOf(sg)}`
      graph.setPrompt(sgId, {
        original: sg.imagePrompt || sg.fullText || sg.narrativePurpose || '',
        current: sg.imagePrompt || sg.fullText || '',
        references: {
          characterIds: sg.characters || [],
          sceneIds: sg.scenes || [],
          assetUrls: [],
        },
      })
    }

    return graph
  }

  // ── Serialization ─────────────────────────────────────────

  toJSON(): RuntimeGraphData {
    return this.data
  }

  toAuditReport(): string {
    const nodes = Object.values(this.data.nodes)
    const prompts = Object.values(this.data.prompts)
    const brokenRefs: string[] = []

    for (const node of nodes) {
      for (const refId of node.references) {
        if (!this.data.nodes[refId] && !refId.startsWith('char-') && !refId.startsWith('scene-')) {
          brokenRefs.push(`${node.id} → ${refId} (missing)`)
        }
      }
    }

    return [
      '=== Runtime Graph Audit ===',
      `Nodes: ${nodes.length}`,
      `Prompts: ${prompts.length}`,
      `Broken References: ${brokenRefs.length}`,
      ...brokenRefs.map(r => `  ⚠️ ${r}`),
      '',
      '=== Per-Type Count ===',
      ...Object.entries(
        nodes.reduce((acc: Record<string, number>, n) => {
          acc[n.type] = (acc[n.type] || 0) + 1
          return acc
        }, {})
      ).map(([type, count]) => `  ${type}: ${count}`),
      '',
      '=== Prompt Status ===',
      `  Original only: ${prompts.filter(p => !p.optimized).length}`,
      `  Has optimized: ${prompts.filter(p => p.optimized).length}`,
      `  Original preserved: ${prompts.filter(p => p.original === p.current).length}`,
    ].join('\n')
  }
}
