/**
 * Patch Preview Engine — Generates visual diff data for frontend
 *
 * Transforms GraphDiff into a format the frontend canvas can render
 * as overlay: dashed nodes, animated edges, color-coded changes.
 */

import type { GraphDiff, PatchPlan } from './patch.types.js'

export interface PreviewOverlayNode {
  id: string
  changeType: 'add' | 'remove' | 'modify'
  label: string
  /** Vue Flow node style overrides */
  style: Record<string, string>
  originalPosition?: { x: number; y: number }
}

export interface PreviewOverlayEdge {
  id: string
  source: string
  target: string
  changeType: 'add' | 'remove' | 'modify'
  animated: boolean
  style: Record<string, string>
}

export interface PatchPreview {
  patchId: string
  overlayNodes: PreviewOverlayNode[]
  overlayEdges: PreviewOverlayEdge[]
  summary: string
}

export function generatePreview(plan: PatchPlan): PatchPreview {
  const overlayNodes: PreviewOverlayNode[] = []
  const overlayEdges: PreviewOverlayEdge[] = []

  // Diff nodes
  for (const nd of plan.diff.nodes) {
    if (nd.type === 'add') {
      overlayNodes.push({
        id: nd.id,
        changeType: 'add',
        label: nd.proposed?.label ?? nd.id,
        style: {
          border: '2px dashed #22d3ee',
          background: '#0a3a4a',
          opacity: '0.9',
        },
      })
    } else if (nd.type === 'remove') {
      overlayNodes.push({
        id: nd.id,
        changeType: 'remove',
        label: nd.original?.label ?? nd.id,
        style: {
          border: '2px dashed #ef4444',
          opacity: '0.3',
          textDecoration: 'line-through',
        },
      })
    } else if (nd.type === 'modify') {
      overlayNodes.push({
        id: nd.id,
        changeType: 'modify',
        label: (nd.proposed?.label ?? nd.original?.label ?? nd.id) + ' ✏️',
        style: {
          border: '2px solid #fbbf24',
          boxShadow: '0 0 8px #fbbf24',
        },
      })
    }
  }

  // Diff edges
  for (const ed of plan.diff.edges) {
    if (ed.type === 'add') {
      overlayEdges.push({
        id: ed.id,
        source: ed.proposed?.source ?? '',
        target: ed.proposed?.target ?? '',
        changeType: 'add',
        animated: true,
        style: { stroke: '#22d3ee', strokeDasharray: '5,5' },
      })
    } else if (ed.type === 'remove') {
      overlayEdges.push({
        id: ed.id,
        source: ed.original?.source ?? '',
        target: ed.original?.target ?? '',
        changeType: 'remove',
        animated: false,
        style: { stroke: '#ef4444', opacity: '0.3' },
      })
    } else if (ed.type === 'modify') {
      overlayEdges.push({
        id: ed.id,
        source: ed.proposed?.source ?? '',
        target: ed.proposed?.target ?? '',
        changeType: 'modify',
        animated: true,
        style: { stroke: '#fbbf24' },
      })
    }
  }

  // Summary
  const adds = overlayNodes.filter(n => n.changeType === 'add').length
  const removes = overlayNodes.filter(n => n.changeType === 'remove').length
  const modifies = overlayNodes.filter(n => n.changeType === 'modify').length
  const summary = [
    adds ? `+${adds} 节点` : '',
    removes ? `-${removes} 节点` : '',
    modifies ? `~${modifies} 节点变更` : '',
  ].filter(Boolean).join('，') || '无变更'

  return {
    patchId: plan.patchId,
    overlayNodes,
    overlayEdges,
    summary,
  }
}
