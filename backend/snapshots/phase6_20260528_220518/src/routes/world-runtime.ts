// ============================================================
// World Runtime Backend v2 — 带DB持久化
// OMS + Observer Economy MVP 全后端API
// ============================================================
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

export default async function worldRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient()
  // ===================== WORLD =====================

  fastify.post('/api/world/create', async (req, reply) => {
    const { name } = req.body as { name?: string }
    const world = await prisma.world.create({
      data: {
        name: name || '新世界',
        state: JSON.stringify({
          tick: 0,
          time: { day: 1, hour: 0 },
          global: { stability: 0.7, chaos: 0.3, narrative_pressure: 0.5 },
          regions: {},
          characters: {},
          factions: {},
        }),
      },
    })
    return reply.send({ success: true, world_id: world.id, world: JSON.parse(world.state as string) })
  })

  fastify.get('/api/world/state/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const world = await prisma.world.findUnique({ where: { id } })
    if (!world) return reply.status(404).send({ success: false, error: '世界不存在' })
    return reply.send({ success: true, world: { id: world.id, ...JSON.parse(world.state as string) } })
  })

  fastify.post('/api/world/tick', async (req, reply) => {
    const { id } = req.body as { id?: string }
    if (!id) {
      // fallback to first world
      const first = await prisma.world.findFirst()
      if (!first) return reply.status(400).send({ success: false, error: '没有世界，请先创建' })
      return tickWorld(first.id, reply)
    }
    return tickWorld(id, reply)
  })

  async function tickWorld(worldId: string, reply: any) {
    const world = await prisma.world.findUnique({ where: { id: worldId } })
    if (!world) return reply.status(404).send({ success: false, error: '世界不存在' })

    const state = JSON.parse(world.state as string)
    state.tick++

    // 时间推进
    state.time.hour += 2
    if (state.time.hour >= 24) { state.time.hour -= 24; state.time.day++ }

    // 状态漂移
    state.global.stability = Math.round(Math.max(0, Math.min(1,
      state.global.stability + (Math.random() - 0.5) * 0.1
    )) * 10000) / 10000
    state.global.chaos = Math.round(Math.max(0, Math.min(1,
      state.global.chaos + (Math.random() - 0.5) * 0.08
    )) * 10000) / 10000
    state.global.narrative_pressure = Math.round(Math.max(0, Math.min(1,
      state.global.narrative_pressure + (Math.random() - 0.5) * 0.12
    )) * 10000) / 10000

    // 事件生成
    const events: any[] = []
    if (Math.random() > 0.6) {
      const eventTypes = ['economic', 'conflict', 'social', 'random']
      const evt = await prisma.event.create({
        data: {
          worldId,
          type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
          tick: state.tick,
          data: JSON.stringify({
            actors: [],
            location: '主城',
            causality_score: Math.random(),
          }),
        },
      })
      events.push(evt)

      // 叙事压力高时自动编译剧情
      if (state.global.narrative_pressure > 0.6 && state.tick % 10 === 0) {
        const existing = await prisma.narrativeScene.count({ where: { worldId } })
        const sceneData = buildScene(state, events, existing + 1)
        await prisma.narrativeScene.create({
          data: {
            worldId,
            summary: sceneData.summary,
            importance: sceneData.importance,
            tickRange: `${state.tick - 5}-${state.tick}`,
            data: JSON.stringify(sceneData),
          },
        })
      }
    }

    // 保存状态
    await prisma.world.update({
      where: { id: worldId },
      data: { state: JSON.stringify(state) },
    })

    return reply.send({ success: true, tick: state.tick, state_delta: state, events })
  }

  function buildScene(state: any, events: any[], sceneNum: number) {
    const emotionalSignals = ['平静', '探索', '紧张', '希望']
    return {
      scene_id: `scene_${state.tick}`,
      scene_number: sceneNum,
      summary: `第${state.tick}tick · 第${state.time.day}日${state.time.hour}:00 · 稳定度${Math.round(state.global.stability * 100)}%·混沌度${Math.round(state.global.chaos * 100)}%`,
      emotional_arc: [emotionalSignals[Math.floor(Math.random() * emotionalSignals.length)]],
      key_events: events.map((e: any) => `[${e.type}] 事件发生`),
      cinematic_tags: state.global.stability > 0.6 ? ['日常', '平稳'] : ['动荡', '冲突'],
      importance: Math.round(state.global.narrative_pressure * 10) / 10,
    }
  }

  // ===================== NARRATIVE =====================

  fastify.get('/api/narrative/:world_id', async (req, reply) => {
    const { world_id } = req.params as { world_id: string }
    const scenes = await prisma.narrativeScene.findMany({
      where: { worldId: world_id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    return reply.send({
      success: true,
      scenes: scenes.map(s => ({ ...JSON.parse((s.data as string) || '{}'), id: s.id, summary: s.summary })),
    })
  })

  fastify.post('/api/narrative/compile', async (req, reply) => {
    const { world_id } = req.body as { world_id?: string }
    const world = await prisma.world.findFirst()
    if (!world) return reply.status(400).send({ success: false, error: '没有世界' })

    const events = await prisma.event.findMany({
      where: { worldId: world_id || world.id },
      orderBy: { tick: 'desc' },
      take: 100,
    })

    const state = JSON.parse(world.state as string)
    const scene = buildScene(state, events, 1)
    const saved = await prisma.narrativeScene.create({
      data: {
        worldId: world_id || world.id,
        summary: scene.summary,
        importance: scene.importance,
        tickRange: scene.scene_id,
        data: JSON.stringify(scene),
      },
    })

    return reply.send({
      success: true,
      episode: {
        id: `ep_${state.tick}`,
        scenes: [saved],
        overarchingTheme: state.global.stability > 0.6 ? '稳定发展' : '混乱与机遇',
        compiledAt: Date.now(),
      },
    })
  })

  // ===================== OBSERVER =====================

  fastify.post('/api/observer/create', async (req, reply) => {
    const { role, world_id } = req.body as { role?: string; world_id?: string }
    const world = world_id
      ? await prisma.world.findUnique({ where: { id: world_id } })
      : await prisma.world.findFirst()
    if (!world) return reply.status(400).send({ success: false, error: '没有世界' })

    const observer = await prisma.observer.create({
      data: {
        worldId: world.id,
        role: role || 'observer',
        influenceWeight: 0.1,
        stats: JSON.stringify({ totalImpact: 0, narrativePoints: 0 }),
      },
    })
    return reply.send({
      success: true,
      observer: {
        id: observer.id,
        world_id: observer.worldId,
        role: observer.role,
        influence_weight: observer.influenceWeight,
        stats: JSON.parse(observer.stats as string),
      },
    })
  })

  fastify.post('/api/observer/influence', async (req, reply) => {
    const { variable, delta } = req.body as { variable?: string; delta?: number }
    const world = await prisma.world.findFirst()
    if (!world) return reply.status(400).send({ success: false, error: '没有世界' })

    const state = JSON.parse(world.state as string)
    const actualDelta = Math.round((delta || 0) * 0.1 * (0.5 + Math.random() * 0.5) * 10000) / 10000

    if (variable && state.global[variable] !== undefined) {
      state.global[variable] = Math.round(Math.max(0, Math.min(1,
        state.global[variable] + actualDelta
      )) * 10000) / 10000
    }

    await prisma.world.update({
      where: { id: world.id },
      data: { state: JSON.stringify(state) },
    })

    // Update observer stats
    const firstObserver = await prisma.observer.findFirst({ where: { worldId: world.id } })
    if (firstObserver) {
      const stats = JSON.parse(firstObserver.stats as string)
      stats.totalImpact += Math.abs(actualDelta)
      stats.narrativePoints += Math.round(Math.abs(actualDelta) * 100)
      await prisma.observer.update({
        where: { id: firstObserver.id },
        data: { stats: JSON.stringify(stats) },
      })
    }

    return reply.send({
      success: true,
      actual_delta: actualDelta,
      narrative: `影响了${variable}，偏移${Math.round(Math.abs(actualDelta) * 100)}% (非确定性)`,
      current_value: variable ? state.global[variable] : null,
    })
  })

  fastify.post('/api/observer/bind', async (req, reply) => {
    const { observer_id, role } = req.body as { observer_id?: string; role?: string }
    const observer = observer_id
      ? await prisma.observer.findUnique({ where: { id: observer_id } })
      : await prisma.observer.findFirst()
    if (!observer) return reply.status(404).send({ success: false, error: '观测者不存在' })

    const weightMap: Record<string, number> = {
      civilian: 0.1, advisor: 0.25, agent: 0.4, 'observer-god': 0.05,
    }

    await prisma.observer.update({
      where: { id: observer.id },
      data: { role: role || 'observer', influenceWeight: weightMap[role || 'observer'] || 0.1 },
    })

    return reply.send({
      success: true,
      message: `绑定成功: ${observer.id} → ${role || 'observer'}`,
      influence_weight: weightMap[role || 'observer'] || 0.1,
    })
  })

  fastify.get('/api/observer/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const observer = await prisma.observer.findUnique({ where: { id } })
    if (!observer) return reply.status(404).send({ success: false, error: '观测者不存在' })
    return reply.send({
      success: true,
      observer: { ...observer, stats: JSON.parse(observer.stats as string) },
    })
  })

  // ===================== SSE STREAM =====================

  fastify.get('/api/world/stream/:id', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    const poll = async () => {
      try {
        const world = await prisma.world.findFirst()
        if (!world) return
        const state = JSON.parse(world.state as string)
        const recentEvents = await prisma.event.findMany({
          where: { worldId: world.id },
          orderBy: { tick: 'desc' },
          take: 3,
        })
        reply.raw.write(`data: ${JSON.stringify({
          tick: state.tick,
          events: recentEvents,
          state: state.global,
          narrative_hint: state.global.narrative_pressure > 0.7 ? 'conflict rising' : 'peaceful',
        })}\n\n`)
      } catch (e) { /* ignore */ }
    }

    const interval = setInterval(poll, 5000)
    req.raw.on('close', () => clearInterval(interval))
    poll() // immediate first push
  })
}
