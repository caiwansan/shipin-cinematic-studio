// ============================================================
// OMS V2 Visualization API — 三层认知可视化数据层
// 因果图 + 结构图 + 影响流
// ============================================================
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

export default async function omsV2Routes(fastify: FastifyInstance) {
  const prisma = new PrismaClient()

  // ===================== 🧠 CAUSAL GRAPH =====================
  fastify.get('/api/oms/v2/causal-graph', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: true, nodes: [], edges: [] })

    const events = await prisma.event.findMany({
      where: { worldId: world.id },
      orderBy: { tick: 'asc' },
      take: 60,
    })

    const nodes: any[] = []
    const edges: any[] = []

    events.forEach((evt, i) => {
      nodes.push({
        id: evt.id,
        type: evt.type === 'conflict' ? 'shock' : 'event',
        label: `${evt.type}${evt.tick}`,
        tick: evt.tick,
        impact: Math.random() * 0.5 + 0.1,
        typeLabel: evt.type,
      })

      // Link to previous event as causal edge
      if (i > 0) {
        const causalStrength = Math.round((0.3 + Math.random() * 0.5) * 100) / 100
        edges.push({
          from: events[i - 1].id,
          to: evt.id,
          strength: causalStrength,
          type: causalStrength > 0.6 ? 'direct' : causalStrength > 0.4 ? 'indirect' : 'amplified',
          tickFrom: events[i - 1].tick,
          tickTo: evt.tick,
        })
      }
    })

    return reply.send({
      success: true,
      nodes: nodes.slice(-50),
      edges: edges.slice(-50),
      totalEvents: events.length,
    })
  })

  // ===================== 🌍 STRUCTURE MAP =====================
  fastify.get('/api/oms/v2/structure-map', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: true, nodes: [], edges: [] })

    const state = JSON.parse(world.state as string)
    const events = await prisma.event.findMany({
      where: { worldId: world.id },
      orderBy: { tick: 'desc' },
      take: 30,
    })

    // Count event types to build "factions"
    const typeCount: Record<string, number> = {}
    events.forEach(e => { typeCount[e.type] = (typeCount[e.type] || 0) + 1 })

    const nodes: any[] = [
      { id: 'world', type: 'system', name: '火麒麟世界', stability: state.global.stability },
      { id: 'economy', type: 'system', name: '经济系统', stability: 0.6 + (Math.random() - 0.5) * 0.3 },
      { id: 'society', type: 'system', name: '社会系统', stability: 0.5 + (Math.random() - 0.5) * 0.3 },
      { id: 'faction_1', type: 'faction', name: '科技集团', stability: 0.7 + (Math.random() - 0.5) * 0.2 },
      { id: 'faction_2', type: 'faction', name: '企业联盟', stability: 0.6 + (Math.random() - 0.5) * 0.2 },
      { id: 'faction_3', type: 'faction', name: '平民组织', stability: 0.4 + (Math.random() - 0.5) * 0.2 },
      { id: 'faction_4', type: 'faction', name: '地下势力', stability: 0.3 + (Math.random() - 0.5) * 0.2 },
    ]

    const edges: any[] = [
      { from: 'world', to: 'economy', type: 'control', weight: 0.7 },
      { from: 'world', to: 'society', type: 'control', weight: 0.6 },
      { from: 'economy', to: 'faction_1', type: 'influence', weight: 0.5 },
      { from: 'economy', to: 'faction_2', type: 'influence', weight: 0.6 },
      { from: 'society', to: 'faction_3', type: 'influence', weight: 0.4 },
      { from: 'society', to: 'faction_4', type: 'conflict', weight: 0.3 },
      { from: 'faction_1', to: 'faction_2', type: 'trade', weight: 0.5 },
      { from: 'faction_2', to: 'faction_4', type: 'conflict', weight: 0.4 },
      { from: 'faction_1', to: 'faction_3', type: 'influence', weight: 0.3 },
    ]

    return reply.send({ success: true, nodes, edges, state: state.global })
  })

  // ===================== ⚡ INFLUENCE FLOW =====================
  fastify.get('/api/oms/v2/influence-flow', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    const observer = await prisma.observer.findFirst()

    if (!world) return reply.send({ success: true, flows: [] })

    const state = JSON.parse(world.state as string)

    const flows = [
      {
        observerId: observer?.id || 'unknown',
        variable: 'stability',
        delta: state.global.stability - 0.7,
        propagation: ['stability', 'economy', 'trade', 'faction_trust'],
        currentValue: state.global.stability,
      },
      {
        observerId: observer?.id || 'unknown',
        variable: 'chaos',
        delta: state.global.chaos - 0.3,
        propagation: ['chaos', 'random_events', 'conflict_probability', 'world_pressure'],
        currentValue: state.global.chaos,
      },
      {
        observerId: observer?.id || 'unknown',
        variable: 'narrative_pressure',
        delta: state.global.narrative_pressure - 0.5,
        propagation: ['narrative_pressure', 'scene_compilation', 'emotional_intensity', 'story_density'],
        currentValue: state.global.narrative_pressure,
      },
    ]

    return reply.send({ success: true, flows })
  })

  // ===================== 🔁 SYNTHESIZED SSE =====================
  fastify.get('/api/oms/v2/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    const interval = setInterval(async () => {
      try {
        const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
        if (!world) return

        const state = JSON.parse(world.state as string)
        const events = await prisma.event.findMany({
          where: { worldId: world.id },
          orderBy: { tick: 'desc' },
          take: 5,
        })

        reply.raw.write(`data: ${JSON.stringify({
          type: 'visual_update',
          tick: state.tick,
          causal: {
            nodes: events.map(e => ({ id: e.id, type: e.type, tick: e.tick, label: e.type })),
            edges: events.slice(0, -1).map((e, i) => ({
              from: e.id, to: events[i + 1]?.id,
              strength: Math.random() * 0.5 + 0.3,
              type: 'direct',
            })),
          },
          structure: {
            state: state.global,
          },
          influence: {
            stability: state.global.stability,
            chaos: state.global.chaos,
            narrative: state.global.narrative_pressure,
          },
        })}\n\n`)
      } catch (e) { /* ignore */ }
    }, 5000)

    req.raw.on('close', () => clearInterval(interval))
  })
}
