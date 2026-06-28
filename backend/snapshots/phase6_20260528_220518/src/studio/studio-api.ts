/**
 * AI Studio API — 三屏后端入口
 *
 * 提供：
 *   ① Pipeline CRUD（Node Graph 持久化）
 *   ② Flow 执行（提交/Cancel/状态查询）
 *   ③ Timeline 数据查询
 *   ④ Node Type 注册表
 */

import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { submitFlow, cancelFlow } from './flow-engine.js'
import type { Pipeline, PipelineNode, PipelineEdge, TimelineEvent } from './graph.model.js'
import { NodeType, topologicalSort } from './graph.model.js'

// ============================================================
// 内存 Pipeline 存储（后续迁移到 PG）
// ============================================================

const pipelineStore = new Map<string, Pipeline>()
const executionStore = new Map<string, any>()

// ============================================================
// Node Type 注册表（前端菜单用）
// ============================================================

const NODE_TYPE_REGISTRY = [
  { type: NodeType.SCRIPT_INPUT,     label: '📜 脚本输入',     icon: '📜',  color: '#6b7280', taskType: null },
  { type: NodeType.STORYBOARD,       label: '🎬 故事板',      icon: '🎬',  color: '#8b5cf6', taskType: 'text_to_image' },
  { type: NodeType.CHARACTER_DEF,    label: '🧑 角色定义',    icon: '🧑',  color: '#3b82f6', taskType: 'text_to_image' },
  { type: NodeType.SCENE_GEN,        label: '🎨 场景生成',    icon: '🎨',  color: '#10b981', taskType: 'text_to_image' },
  { type: NodeType.VOICE_GEN,        label: '🎙️ 语音生成',    icon: '🎙️',  color: '#f59e0b', taskType: 'text_to_audio' },
  { type: NodeType.VIDEO_GEN,        label: '🎥 视频生成',    icon: '🎥',  color: '#ef4444', taskType: 'text_to_video' },
  { type: NodeType.EFFECT,           label: '✨ 特效',         icon: '✨',  color: '#ec4899', taskType: 'video_effect' },
  { type: NodeType.RENDER,           label: '⬇️ 导出渲染',    icon: '⬇️',  color: '#14b8a6', taskType: 'render' },
  { type: NodeType.OUTPUT,           label: '📦 输出',         icon: '📦',  color: '#6366f1', taskType: null },
  { type: NodeType.PROMPT_BUILDER,   label: '💡 Prompt生成',   icon: '💡',  color: '#a78bfa', taskType: null },
  { type: NodeType.SCRIPT_WRITER,    label: '📝 剧本编写',    icon: '📝',  color: '#60a5fa', taskType: null },
  { type: NodeType.SHOT_SPLIT,        label: '✂️ 镜头拆解',    icon: '✂️',  color: '#34d399', taskType: null },
  { type: NodeType.IMAGE_PROMPT,      label: '🖼 图片提示词',  icon: '🖼',  color: '#f472b6', taskType: null },
  { type: NodeType.IMAGE_GEN,         label: '🎭 图片生成',    icon: '🎭',  color: '#2dd4bf', taskType: null },
  { type: NodeType.CONDITIONAL,      label: '🔀 条件分支',     icon: '🔀',  color: '#f97316', taskType: null },
  { type: NodeType.PARALLEL,         label: '⚡ 并行',         icon: '⚡',  color: '#a855f7', taskType: null },
  { type: NodeType.MERGE,            label: '🔗 合并',         icon: '🔗',  color: '#78716c', taskType: null },
]

export async function registerStudioRoutes(app: FastifyInstance) {
  // ============================================================
  // Node Type 注册表
  // ============================================================

  app.get('/api/studio/node-types', async () => {
    return { types: NODE_TYPE_REGISTRY }
  })

  // ============================================================
  // Pipeline CRUD
  // ============================================================

  // 列表
  app.get('/api/studio/pipelines', async () => {
    const list = Array.from(pipelineStore.values()).map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      version: p.version,
      nodeCount: p.nodes.length,
      edgeCount: p.edges.length,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      tags: p.tags,
    }))
    return { pipelines: list }
  })

  // 详情
  app.get('/api/studio/pipelines/:id', async (request) => {
    const params = request.params as any
    const pipeline = pipelineStore.get(params.id)
    if (!pipeline) return { error: 'Pipeline not found', statusCode: 404 }
    return { pipeline }
  })

  // 创建
  app.post('/api/studio/pipelines', async (request) => {
    const body = request.body as any
    const id = randomUUID()

    const pipeline: Pipeline = {
      id,
      name: body.name ?? 'New Pipeline',
      description: body.description ?? '',
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: body.nodes ?? [],
      edges: body.edges ?? [],
      entryNodeIds: body.entryNodeIds ?? [],
      exitNodeIds: body.exitNodeIds ?? [],
      status: 'draft',
      tags: body.tags ?? [],
      projectId: body.projectId,
      userId: body.userId,
    }

    pipelineStore.set(id, pipeline)
    return { pipeline, id }
  })

  // 更新
  app.put('/api/studio/pipelines/:id', async (request) => {
    const params = request.params as any
    const body = request.body as any
    const existing = pipelineStore.get(params.id)
    if (!existing) return { error: 'Pipeline not found', statusCode: 404 }

    const updated: Pipeline = {
      ...existing,
      ...body,
      id: params.id,
      version: existing.version + 1,
      updatedAt: new Date().toISOString(),
    }

    pipelineStore.set(params.id, updated)
    return { pipeline: updated }
  })

  // 删除
  app.delete('/api/studio/pipelines/:id', async (request) => {
    const params = request.params as any
    pipelineStore.delete(params.id)
    return { success: true }
  })

  // ============================================================
  // Node 操作（在 Pipeline 内增删改节点）
  // ============================================================

  // 在 Pipeline 中添加节点
  app.post('/api/studio/pipelines/:id/nodes', async (request) => {
    const params = request.params as any
    const body = request.body as any
    const pipeline = pipelineStore.get(params.id)
    if (!pipeline) return { error: 'Pipeline not found', statusCode: 404 }

    const node: PipelineNode = {
      id: body.id ?? `node_${Date.now()}`,
      type: body.type ?? NodeType.SCRIPT_INPUT,
      label: body.label ?? 'New Node',
      position: body.position ?? { x: 100, y: 100 },
      inputs: body.inputs ?? [],
      outputs: body.outputs ?? [],
      slotBinding: body.slotBinding,
      prompt: body.prompt,
      status: 'idle',
    }

    pipeline.nodes.push(node)
    pipeline.updatedAt = new Date().toISOString()
    return { node }
  })

  // 更新 Pipeline 中的节点
  app.put('/api/studio/pipelines/:id/nodes/:nodeId', async (request) => {
    const params = request.params as any
    const body = request.body as any
    const pipeline = pipelineStore.get(params.id)
    if (!pipeline) return { error: 'Pipeline not found', statusCode: 404 }

    const idx = pipeline.nodes.findIndex(n => n.id === params.nodeId)
    if (idx === -1) return { error: 'Node not found', statusCode: 404 }

    pipeline.nodes[idx] = { ...pipeline.nodes[idx], ...body }
    pipeline.updatedAt = new Date().toISOString()
    return { node: pipeline.nodes[idx] }
  })

  // 删除节点
  app.delete('/api/studio/pipelines/:id/nodes/:nodeId', async (request) => {
    const params = request.params as any
    const pipeline = pipelineStore.get(params.id)
    if (!pipeline) return { error: 'Pipeline not found', statusCode: 404 }

    pipeline.nodes = pipeline.nodes.filter(n => n.id !== params.nodeId)
    pipeline.edges = pipeline.edges.filter(e => e.source !== params.nodeId && e.target !== params.nodeId)
    pipeline.updatedAt = new Date().toISOString()
    return { success: true }
  })

  // ============================================================
  // Edge 操作
  // ============================================================

  // 添加连线
  app.post('/api/studio/pipelines/:id/edges', async (request) => {
    const params = request.params as any
    const body = request.body as any
    const pipeline = pipelineStore.get(params.id)
    if (!pipeline) return { error: 'Pipeline not found', statusCode: 404 }

    const edge: PipelineEdge = {
      id: body.id ?? `edge_${Date.now()}`,
      source: body.source,
      sourceHandle: body.sourceHandle,
      target: body.target,
      targetHandle: body.targetHandle,
      label: body.label,
      type: body.type ?? 'smoothstep',
      animated: body.animated ?? true,
    }

    pipeline.edges.push(edge)
    pipeline.updatedAt = new Date().toISOString()
    return { edge }
  })

  // 删除连线
  app.delete('/api/studio/pipelines/:id/edges/:edgeId', async (request) => {
    const params = request.params as any
    const pipeline = pipelineStore.get(params.id)
    if (!pipeline) return { error: 'Pipeline not found', statusCode: 404 }

    pipeline.edges = pipeline.edges.filter(e => e.id !== params.edgeId)
    pipeline.updatedAt = new Date().toISOString()
    return { success: true }
  })

  // ============================================================
  // Flow 执行
  // ============================================================

  // 提交执行
  app.post('/api/studio/pipelines/:id/execute', async (request) => {
    const params = request.params as any
    const body = request.body as any
    const pipeline = pipelineStore.get(params.id)
    if (!pipeline) return { error: 'Pipeline not found', statusCode: 404 }

    // 更新状态
    pipeline.status = 'running'
    pipeline.updatedAt = new Date().toISOString()

    const executionId = `flow_${Date.now()}_${params.id}`

    // 自动执行（不阻塞 HTTP 响应 — 异步执行）
    submitFlow(pipeline, body.userId).then(result => {
      executionStore.set(result.executionId, result)
    })

    return {
      executionId,
      status: 'submitted',
      nodeCount: pipeline.nodes.length,
    }
  })

  // 执行详情
  app.get('/api/studio/executions/:executionId', async (request) => {
    const params = request.params as any
    const exec = executionStore.get(params.executionId)
    if (!exec) return { error: 'Execution not found', statusCode: 404 }
    return { execution: exec }
  })

  // 取消执行
  app.post('/api/studio/executions/:executionId/cancel', async (request) => {
    const params = request.params as any
    const ok = cancelFlow(params.executionId)
    return { cancelled: ok }
  })

  // ============================================================
  // 拓扑排序与校验
  // ============================================================

  app.get('/api/studio/pipelines/:id/topology', async (request) => {
    const params = request.params as any
    const pipeline = pipelineStore.get(params.id)
    if (!pipeline) return { error: 'Pipeline not found', statusCode: 404 }

    const topo = topologicalSort(pipeline)
    return {
      ...topo,
      hasCycle: topo.hasCycle,
      levelCount: topo.levels.length,
      nodeCount: topo.ordered.length,
      levels: topo.levels.map((lv, i) => ({
        level: i,
        nodes: lv.map(n => ({ id: n.id, label: n.label, type: n.type })),
      })),
    }
  })

  // ============================================================
  // Timeline 数据
  // ============================================================

  app.get('/api/studio/executions/:executionId/timeline', async (request) => {
    const params = request.params as any
    const exec = executionStore.get(params.executionId)
    if (!exec) return { error: 'Execution not found', statusCode: 404 }
    return { timeline: exec.timeline ?? [] }
  })
}
