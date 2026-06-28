// ============================================================
// OMS Dashboard Backend API — 可视化仪表盘专用
// 配套 OMS World Visualization System V1
// ============================================================
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

export default async function omsRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient()

  // ===================== 世界总览 =====================
  fastify.get('/api/oms/world/state', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: true, world: null, message: '无世界存在' })
    const state = JSON.parse(world.state as string)
    const eventCount = await prisma.event.count({ where: { worldId: world.id } })
    const sceneCount = await prisma.narrativeScene.count({ where: { worldId: world.id } })
    return reply.send({
      success: true,
      world: {
        id: world.id,
        name: world.name,
        tick: state.tick,
        time: { day: state.time.day, hour: state.time.hour },
        global: state.global,
        eventCount,
        sceneCount,
      },
    })
  })

  // ===================== Tick控制 =====================
  fastify.post('/api/oms/world/tick', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.status(400).send({ success: false, error: '无世界存在' })
    const state = JSON.parse(world.state as string)
    state.tick++
    state.time.hour = (state.time.hour + 2) % 24
    if (state.time.hour === 0) state.time.day++
    ;['stability', 'chaos', 'narrative_pressure'].forEach(k => {
      state.global[k] = Math.round(Math.max(0, Math.min(1,
        state.global[k] + (Math.random() - 0.5) * 0.1
      )) * 10000) / 10000
    })
    await prisma.world.update({ where: { id: world.id }, data: { state: JSON.stringify(state) } })
    return reply.send({ success: true, tick: state.tick, global: state.global })
  })

  fastify.post('/api/oms/world/reset', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.status(400).send({ success: false, error: '无世界存在' })
    const state = JSON.parse(world.state as string)
    state.tick = 0
    state.time = { day: 1, hour: 0 }
    state.global = { stability: 0.7, chaos: 0.3, narrative_pressure: 0.5 }
    await prisma.world.update({ where: { id: world.id }, data: { state: JSON.stringify(state) } })
    await prisma.event.deleteMany({ where: { worldId: world.id } })
    await prisma.narrativeScene.deleteMany({ where: { worldId: world.id } })
    return reply.send({ success: true, message: '世界已重置', state })
  })

  // ===================== 事件流 =====================
  fastify.get('/api/oms/events/history', async (req, reply) => {
    const { limit } = req.query as { limit?: string }
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: true, events: [] })
    const events = await prisma.event.findMany({
      where: { worldId: world.id },
      orderBy: { tick: 'desc' },
      take: parseInt(limit || '50'),
    })
    return reply.send({
      success: true,
      events: events.map(e => ({
        id: e.id,
        tick: e.tick,
        type: e.type,
        data: JSON.parse(e.data as string || '{}'),
        created_at: e.createdAt,
      })),
    })
  })

  fastify.get('/api/oms/events/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })
    let lastMaxTick = 0
    const interval = setInterval(async () => {
      try {
        const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
        if (!world) return
        const state = JSON.parse(world.state as string)
        const newEvents = await prisma.event.findMany({
          where: { worldId: world.id, tick: { gt: lastMaxTick } },
          orderBy: { tick: 'desc' },
          take: 5,
        })
        if (newEvents.length > 0) lastMaxTick = Math.max(...newEvents.map(e => e.tick))
        const recentScenes = await prisma.narrativeScene.findMany({
          where: { worldId: world.id },
          orderBy: { tickRange: 'desc' },
          take: 1,
        })
        reply.raw.write(`data: ${JSON.stringify({
          tick: state.tick,
          time: state.time,
          global: state.global,
          newEvents: newEvents.map(e => ({ id: e.id, tick: e.tick, type: e.type, data: JSON.parse(e.data as string || '{}') })),
          recentScene: recentScenes[0] ? { summary: recentScenes[0].summary, importance: recentScenes[0].importance } : null,
        })}\n\n`)
      } catch (e) { /* ignore */ }
    }, 3000)
    req.raw.on('close', () => clearInterval(interval))
  })

  // ===================== 观测者 =====================
  fastify.post('/api/oms/observer/influence', async (req, reply) => {
    const { variable, delta } = req.body as { variable?: string; delta?: number }
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.status(400).send({ success: false, error: '无世界存在' })
    const state = JSON.parse(world.state as string)
    const actualDelta = Math.round((delta || 0) * 0.1 * (0.5 + Math.random() * 0.5) * 10000) / 10000
    if (variable && state.global[variable] !== undefined) {
      state.global[variable] = Math.round(Math.max(0, Math.min(1, state.global[variable] + actualDelta)) * 10000) / 10000
    }
    await prisma.world.update({ where: { id: world.id }, data: { state: JSON.stringify(state) } })
    return reply.send({
      success: true, actual_delta: actualDelta,
      narrative: `${variable} ${delta && delta > 0 ? '↑' : '↓'} ${Math.round(Math.abs(actualDelta) * 100)}%`,
      current_value: variable ? state.global[variable] : null,
    })
  })

  fastify.get('/api/oms/observer/state', async (_req, reply) => {
    const observer = await prisma.observer.findFirst()
    if (!observer) return reply.send({ success: true, observer: null })
    return reply.send({
      success: true,
      observer: { id: observer.id, role: observer.role, influenceWeight: observer.influenceWeight, stats: JSON.parse(observer.stats as string) },
    })
  })

  fastify.post('/api/oms/observer/bind', async (req, reply) => {
    const { role } = req.body as { role?: string }
    const weightMap: Record<string, number> = { civilian: 0.1, advisor: 0.25, agent: 0.4, 'observer-god': 0.05 }
    let observer = await prisma.observer.findFirst()
    if (!observer) {
      const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
      if (!world) return reply.status(400).send({ success: false, error: '无世界' })
      observer = await prisma.observer.create({
        data: { worldId: world.id, role: role || 'observer', influenceWeight: weightMap[role || 'observer'] || 0.1, stats: '{}' },
      })
    } else {
      observer = await prisma.observer.update({
        where: { id: observer.id },
        data: { role: role || 'observer', influenceWeight: weightMap[role || 'observer'] || 0.1 },
      })
    }
    return reply.send({ success: true, observer: { id: observer.id, role: observer.role, influenceWeight: observer.influenceWeight } })
  })

  // ===================== 世界关系图 =====================
  fastify.get('/api/oms/world/graph', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: true, nodes: [], edges: [] })
    const state = JSON.parse(world.state as string)
    const events = await prisma.event.findMany({
      where: { worldId: world.id },
      orderBy: { tick: 'desc' },
      take: 20,
    })
    // Build graph from events
    const nodes: any[] = []
    const edges: any[] = []
    const addedTypes = new Set<string>()
    events.forEach(e => {
      if (!addedTypes.has(e.type)) {
        addedTypes.add(e.type)
        nodes.push({ id: e.type, label: e.type === 'economic' ? '💰 经济' : e.type === 'conflict' ? '⚔️ 冲突' : e.type === 'social' ? '👥 社会' : '🎲 随机', type: e.type, size: 10 })
      }
    })
    // Connect event types in order
    for (let i = 0; i < events.length - 1; i++) {
      edges.push({
        source: events[i].type,
        target: events[i + 1].type,
        label: `T${events[i].tick}→T${events[i+1].tick}`,
        value: 1,
      })
    }
    nodes.push({ id: 'world', label: state.name || '火麒麟世界', type: 'world', size: 20 })
    edges.push({ source: 'world', target: events[0]?.type || 'economic', label: '当前', value: 2 })
    return reply.send({ success: true, nodes, edges })
  })

  fastify.get('/api/oms/world/relations', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: true, relations: [] })
    const state = JSON.parse(world.state as string)
    return reply.send({
      success: true,
      relations: [
        { from: '稳定度', to: '叙事压力', type: '反比', strength: 0.7 },
        { from: '混沌度', to: '事件频率', type: '正比', strength: 0.8 },
        { from: '叙事压力', to: '剧情编译', type: '触发', strength: 0.9 },
      ],
    })
  })

  // ===================== 快照 =====================
  fastify.get('/api/oms/world/snapshot', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: false, error: '无世界' })
    const state = JSON.parse(world.state as string)
    const eventCount = await prisma.event.count({ where: { worldId: world.id } })
    const sceneCount = await prisma.narrativeScene.count({ where: { worldId: world.id } })
    return reply.send({
      success: true,
      snapshot: {
        at: new Date().toISOString(),
        worldId: world.id,
        name: world.name,
        tick: state.tick,
        time: state.time,
        global: state.global,
        events: eventCount,
        scenes: sceneCount,
      },
    })
  })
}
