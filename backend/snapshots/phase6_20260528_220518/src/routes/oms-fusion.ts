// ============================================================
// Character-OMS Graph Fusion V1
// 角色 → 三层图谱融合：Causal / Structure / Influence
// ============================================================
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

export default async function omsFusionRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient()

  // ===================== 🧠 CAUSAL GRAPH (Fused) =====================
  fastify.get('/api/oms/fusion/causal-graph', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: true, nodes: [], edges: [] })

    const events = await prisma.event.findMany({
      where: { worldId: world.id },
      orderBy: { tick: 'desc' },
      take: 30,
    })

    const chars = await prisma.character.findMany({
      where: { worldId: world.id, alive: true },
      take: 10,
    })

    const recentBehaviors = await prisma.characterBehavior.findMany({
      where: { character: { worldId: world.id } },
      orderBy: { tick: 'desc' },
      take: 20,
      include: { character: true },
    })

    const nodes: any[] = []
    const edges: any[] = []
    const nodeMap = new Map<string, boolean>()

    // Event nodes (red for conflict, yellow for econ, green for social)
    events.forEach(evt => {
      const id = `event_${evt.id.slice(0, 8)}`
      if (nodeMap.has(id)) return
      nodeMap.set(id, true)
      const data = typeof evt.data === 'string' ? JSON.parse(evt.data) : evt.data || {}
      nodes.push({
        id,
        type: evt.type === 'conflict' ? 'shock' : 'event',
        label: evt.type,
        tick: evt.tick,
        characterId: null,
        source: 'event',
        actors: data.actors || [],
        impact: Math.round((0.3 + Math.random() * 0.4) * 100) / 100,
      })
    })

    // Character-action nodes (purple — added by fusion)
    recentBehaviors.forEach((b, i) => {
      const id = `charaction_${b.id.slice(0, 8)}`
      if (nodeMap.has(id)) return
      nodeMap.set(id, true)
      nodes.push({
        id,
        type: 'character_action',
        label: b.action,
        tick: b.tick,
        characterId: b.characterId,
        characterName: b.character.name,
        source: 'character',
        impact: b.score || 0.5,
      })

      // Link action to closest event (causal edge)
      const closestEvent = events.find(e => Math.abs(e.tick - b.tick) <= 3)
      if (closestEvent) {
        edges.push({
          from: id,
          to: `event_${closestEvent.id.slice(0, 8)}`,
          strength: Math.round(b.score),
          type: b.action === 'attack' ? 'direct' : 'indirect',
        })
      }

      // Chain character actions together
      if (i > 0) {
        edges.push({
          from: `charaction_${recentBehaviors[i - 1].id.slice(0, 8)}`,
          to: id,
          strength: 0.4,
          type: 'indirect',
        })
      }
    })

    return reply.send({ success: true, nodes: nodes.slice(-50), edges: edges.slice(-50) })
  })

  // ===================== 🌍 STRUCTURE MAP (Fused with Characters) =====================
  fastify.get('/api/oms/fusion/structure-map', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: true, nodes: [], edges: [] })

    const state = JSON.parse(world.state as string)
    const chars = await prisma.character.findMany({
      where: { worldId: world.id, alive: true },
    })
    const relations = await prisma.characterRelation.findMany()
    const recentBehaviors = await prisma.characterBehavior.findMany({
      where: { character: { worldId: world.id } },
      orderBy: { tick: 'desc' },
      take: 5,
      include: { character: true },
    })

    const nodes: any[] = []
    const edges: any[] = []

    // System nodes
    nodes.push(
      { id: 'world', type: 'system', name: '火麒麟世界', stability: state.global.stability, characterId: null },
      { id: 'economy', type: 'system', name: '经济系统', stability: 0.5, characterId: null },
      { id: 'society', type: 'system', name: '社会系统', stability: 0.5, characterId: null },
    )

    // Faction nodes (aggregated from characters)
    const factionMap: Record<string, { name: string; count: number; chars: string[] }> = {
      corporate: { name: '企业联盟', count: 0, chars: [] },
      civilian: { name: '平民组织', count: 0, chars: [] },
      tech: { name: '科技集团', count: 0, chars: [] },
      underground: { name: '地下势力', count: 0, chars: [] },
    }
    chars.forEach(c => {
      if (factionMap[c.faction]) {
        factionMap[c.faction].count++
        factionMap[c.faction].chars.push(c.name)
      }
    })
    Object.entries(factionMap).forEach(([key, val]) => {
      nodes.push({
        id: `faction_${key}`, type: 'faction', name: val.name,
        stability: 0.3 + Math.random() * 0.5,
        characterCount: val.count,
        characterNames: val.chars,
        characterId: null,
      })
    })

    // Character nodes (⭐ fusion — first-class graph citizens)
    chars.forEach(c => {
      const emotion = JSON.parse(c.emotion)
      nodes.push({
        id: `char_${c.id}`, type: 'character', name: c.name,
        faction: c.faction, location: c.location, activity: c.activity,
        characterId: c.id,
        emotion: { joy: emotion.joy, anger: emotion.anger, fear: emotion.fear },
      })
      // Link character to its faction
      edges.push({
        from: `char_${c.id}`, to: `faction_${c.faction}`,
        type: 'belongs_to', weight: 0.8,
      })
      // Link character to world
      edges.push({
        from: `char_${c.id}`, to: 'world',
        type: 'influence', weight: 0.3,
      })
    })

    // Character-character edges from relations
    relations.forEach(r => {
      edges.push({
        from: `char_${r.fromId}`, to: `char_${r.toId}`,
        type: r.type, weight: Math.abs(r.value),
      })
    })

    // System → faction edges
    edges.push(
      { from: 'economy', to: 'faction_corporate', type: 'influence', weight: 0.7 },
      { from: 'economy', to: 'faction_tech', type: 'influence', weight: 0.6 },
      { from: 'society', to: 'faction_civilian', type: 'influence', weight: 0.5 },
      { from: 'society', to: 'faction_underground', type: 'conflict', weight: 0.4 },
    )

    return reply.send({ success: true, nodes, edges })
  })

  // ===================== ⚡ INFLUENCE FLOW (Fused) =====================
  fastify.get('/api/oms/fusion/influence-flow', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    const observer = await prisma.observer.findFirst()
    if (!world) return reply.send({ success: true, nodes: [], edges: [], flows: [] })

    const state = JSON.parse(world.state as string)
    const chars = await prisma.character.findMany({
      where: { worldId: world.id, alive: true },
      take: 5,
    })

    const nodes: any[] = []
    const edges: any[] = []

    // Observer root
    const observerId = 'observer_user'
    nodes.push({ id: observerId, type: 'observer', label: '三郎(观察者)', influenceWeight: observer?.influenceWeight || 0.1 })

    // Variable nodes
    ;['stability', 'chaos', 'narrative_pressure'].forEach(v => {
      nodes.push({ id: `var_${v}`, type: 'variable', label: v, currentValue: state.global[v] })
      edges.push({ from: observerId, to: `var_${v}`, type: 'observer_control', strength: 0.3 })
    })

    // Character influence nodes (⭐ fusion)
    chars.forEach(c => {
      const emotion = JSON.parse(c.emotion)
      const angerWeight = emotion.anger || 0.1
      const joyWeight = emotion.joy || 0.5

      nodes.push({
        id: `char_infl_${c.id}`, type: 'character', label: c.name,
        characterId: c.id, anger: angerWeight, joy: joyWeight,
      })

      // Character anger → chaos
      if (angerWeight > 0.3) {
        edges.push({
          from: `char_infl_${c.id}`, to: 'var_chaos',
          type: 'character_influence', strength: Math.round(angerWeight * 100) / 100,
          propagation: ['anger', 'violence_probability', 'chaos'],
        })
      }

      // Character joy → stability
      if (joyWeight > 0.5) {
        edges.push({
          from: `char_infl_${c.id}`, to: 'var_stability',
          type: 'character_influence', strength: Math.round(joyWeight * 50) / 100,
          propagation: ['joy', 'social_cohesion', 'stability'],
        })
      }

      // Observer → character interaction
      edges.push({
        from: observerId, to: `char_infl_${c.id}`,
        type: 'observe', strength: 0.2,
      })
    })

    return reply.send({ success: true, nodes, edges })
  })

  // ===================== 🔁 FUSION SSE =====================
  fastify.get('/api/oms/fusion/stream', async (req, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    let lastTick = 0
    const interval = setInterval(async () => {
      try {
        const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
        if (!world) return
        const state = JSON.parse(world.state as string)
        const tick = state.tick || 0

        // Only push on new tick
        const recentBehaviors = await prisma.characterBehavior.findMany({
          where: { tick: { gt: lastTick } },
          include: { character: true },
          take: 5,
        })
        const recentEvents = await prisma.event.findMany({
          where: { worldId: world.id, tick: { gt: lastTick } },
          take: 3,
        })

        if (recentBehaviors.length === 0 && recentEvents.length === 0 && tick === lastTick) return
        lastTick = tick

        const fusionUpdates = recentBehaviors.map(b => ({
          type: 'fusion_update',
          characterId: b.characterId,
          characterName: b.character?.name || 'unknown',
          causal_updates: [{ nodeId: `charaction_${b.id.slice(0, 8)}`, action: b.action, tick: b.tick }],
          structure_updates: [{ nodeId: `char_${b.characterId}`, activity: b.action }],
          influence_updates: b.action === 'attack'
            ? [{ target: 'chaos', delta: 0.03 }]
            : b.action === 'cooperate'
            ? [{ target: 'stability', delta: 0.02 }]
            : [],
          generated_event: recentEvents[0]?.id || null,
        }))

        reply.raw.write(`data: ${JSON.stringify({ type: 'fusion_batch', tick, updates: fusionUpdates })}\n\n`)
      } catch (e) { /* ignore */ }
    }, 5000)

    req.raw.on('close', () => clearInterval(interval))
  })
}
