// ============================================================
// Character System V1 — Backend API + Engine
// 角色 CRUD + Emotion/Memory/Relation/Behavior Engine
// ============================================================
import { FastifyInstance } from 'fastify'
import { PrismaClient } from '@prisma/client'

const NAME_POOL = [
  '林默', '叶燃', '苏晓', '顾夜', '陆川', '白露', '沈渊',
  '秦墨', '姜瑶', '周寒', '赵烬', '陈雪', '李沧', '王霁',
  '许念', '何途', '宋晚', '唐鹰', '韩影', '傅舟',
]

function randomPick(arr: string[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function clamp(v: number) { return Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000 }

export default async function characterRoutes(fastify: FastifyInstance) {
  const prisma = new PrismaClient()

  // ===================== 生成初始角色 =====================
  fastify.post('/api/characters/spawn', async (req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.status(400).send({ success: false, error: '无世界' })

    const body = req.body as any
    const count = body?.count || 5
    const created = []

    const factions = ['corporate', 'civilian', 'tech', 'underground']
    const locations = ['city_center', 'commercial_district', 'tech_park', 'slums', 'port_area']

    for (let i = 0; i < count; i++) {
      const personality = {
        logic: clamp(Math.random() * 0.7 + 0.3),
        emotion: clamp(Math.random() * 0.7 + 0.3),
        aggression: clamp(Math.random() * 0.6),
        empathy: clamp(Math.random() * 0.6 + 0.2),
      }
      const char = await prisma.character.create({
        data: {
          worldId: world.id,
          name: randomPick(NAME_POOL) + i,
          age: 20 + Math.floor(Math.random() * 30),
          faction: randomPick(factions),
          location: randomPick(locations),
          personality: JSON.stringify(personality),
          emotion: JSON.stringify({ joy: 0.5, anger: 0.1, fear: 0.2, sadness: 0.1, trust: 0.5 }),
          tickBorn: JSON.parse(world.state as string).tick || 0,
          activity: 'observing',
        },
      })
      created.push(char)
    }

    // Create random relations between them
    for (let i = 0; i < created.length; i++) {
      for (let j = i + 1; j < created.length; j++) {
        if (Math.random() > 0.4) {
          await prisma.characterRelation.create({
            data: {
              fromId: created[i].id,
              toId: created[j].id,
              type: randomPick(['trust', 'hate', 'fear', 'respect']),
              value: clamp((Math.random() - 0.5) * 2),
            },
          })
        }
      }
    }

    // Generate initial memories for each character
    for (const char of created) {
      await prisma.characterMemory.create({
        data: {
          characterId: char.id,
          type: 'event',
          content: `${char.name} 来到了${char.location === 'city_center' ? '市中心' : char.location === 'tech_park' ? '科技园区' : char.location === 'slums' ? '贫民区' : '商业区'}`,
          importance: 0.3,
          tick: 0,
          emotionalTag: 'neutral',
        },
      })
    }

    return reply.send({ success: true, characters: created.map(c => ({ id: c.id, name: c.name, faction: c.faction })) })
  })

  // ===================== 角色列表 =====================
  fastify.get('/api/characters', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: true, characters: [] })
    const chars = await prisma.character.findMany({
      where: { worldId: world.id, alive: true },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({
      success: true,
      characters: chars.map(c => ({
        id: c.id, name: c.name, age: c.age, faction: c.faction,
        location: c.location, activity: c.activity, alive: c.alive,
        personality: JSON.parse(c.personality),
        emotion: JSON.parse(c.emotion),
        tickBorn: c.tickBorn,
      })),
    })
  })

  // ===================== 角色详情 =====================
  fastify.get('/api/characters/:id', async (req, reply) => {
    const { id } = req.params as { id: string }
    const char = await prisma.character.findUnique({
      where: { id },
      include: {
        memories: { orderBy: { tick: 'desc' }, take: 20 },
        relations: { include: { to: true } },
        behaviors: { orderBy: { tick: 'desc' }, take: 10 },
      },
    })
    if (!char) return reply.status(404).send({ success: false, error: '角色不存在' })
    return reply.send({
      success: true,
      character: {
        id: char.id, name: char.name, age: char.age, faction: char.faction,
        location: char.location, activity: char.activity, alive: char.alive,
        personality: JSON.parse(char.personality),
        emotion: JSON.parse(char.emotion),
        memories: char.memories.map(m => ({ id: m.id, type: m.type, content: m.content, importance: m.importance, tick: m.tick, emotionalTag: m.emotionalTag })),
        relations: char.relations.map(r => ({ to: r.to.name, toId: r.toId, type: r.type, value: r.value })),
        behaviors: char.behaviors.map(b => ({ action: b.action, context: b.context, tick: b.tick, score: b.score })),
      },
    })
  })

  // ===================== Tick引擎 — 更新全部角色 =====================
  fastify.post('/api/characters/tick', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.status(400).send({ success: false, error: '无世界' })
    const state = JSON.parse(world.state as string)
    const tick = state.tick || 0

    const chars = await prisma.character.findMany({
      where: { worldId: world.id, alive: true },
      include: { memories: { orderBy: { tick: 'desc' }, take: 5 }, relations: true },
    })

    const updates = []

    for (const char of chars) {
      // 1. Update emotion based on world state
      const emotion = JSON.parse(char.emotion)
      emotion.fear = clamp(emotion.fear + (state.global.chaos - 0.3) * 0.3)
      emotion.joy = clamp(emotion.joy + (state.global.stability - 0.5) * 0.2)
      emotion.anger = clamp(emotion.anger + (state.global.narrative_pressure - 0.5) * 0.1)

      // 2. Decide behavior
      const personality = JSON.parse(char.personality)
      const actionScore: Record<string, number> = {
        observe: 0.3 + personality.emotion * 0.2,
        move: 0.2 + (state.global.chaos > 0.5 ? 0.3 : 0),
        talk: 0.2 + personality.empathy * 0.3,
        cooperate: 0.1 + personality.empathy * 0.3 - personality.aggression * 0.2,
        attack: personality.aggression * 0.4 + emotion.anger * 0.3,
        create_media: 0.1 + personality.logic * 0.3,
      }
      const actions = Object.entries(actionScore) as [string, number][]
      actions.sort((a, b) => b[1] - a[1])
      const chosenAction = actions[0][0]

      // 3. Determine target
      let targetId: string | null = null
      if (chosenAction === 'attack' || chosenAction === 'talk' || chosenAction === 'cooperate') {
        const potentialTargets = chars.filter(c => c.id !== char.id)
        if (potentialTargets.length > 0) {
          targetId = randomPick(potentialTargets.map(c => c.id))
        }
      }

      // 4. Record behavior
      await prisma.characterBehavior.create({
        data: {
          characterId: char.id,
          action: chosenAction,
          targetId,
          context: `${char.name} 选择 ${chosenAction}`,
          tick,
          score: actions[0][1],
        },
      })

      // 5. Random move
      const locations = ['city_center', 'commercial_district', 'tech_park', 'slums', 'port_area']
      const newLocation = Math.random() > 0.6 ? randomPick(locations) : char.location

      // 6. Generate memory if interesting action
      if (actions[0][1] > 0.5 || Math.random() > 0.8) {
        const memoryTypes = ['event', 'emotion', 'decision']
        await prisma.characterMemory.create({
          data: {
            characterId: char.id,
            type: randomPick(memoryTypes),
            content: `${char.name} 在 tick ${tick} 选择了 ${chosenAction}（${newLocation}）`,
            importance: clamp(actions[0][1]),
            tick,
            emotionalTag: emotion.anger > 0.5 ? 'negative' : emotion.joy > 0.6 ? 'positive' : 'neutral',
          },
        })
      }

      // 7. Update relations based on actions
      if (targetId && (chosenAction === 'attack' || chosenAction === 'cooperate')) {
        const existingRel = await prisma.characterRelation.findFirst({
          where: { fromId: char.id, toId: targetId },
        })
        if (existingRel) {
          const val = chosenAction === 'attack'
            ? clamp(existingRel.value - 0.3)
            : clamp(existingRel.value + 0.2)
          await prisma.characterRelation.update({
            where: { id: existingRel.id },
            data: { value: val, type: chosenAction === 'attack' ? 'hate' : 'trust' },
          })
        }
      }

      // 8. Update character
      await prisma.character.update({
        where: { id: char.id },
        data: {
          emotion: JSON.stringify(emotion),
          location: newLocation,
          activity: chosenAction,
        },
      })

      updates.push({ id: char.id, name: char.name, action: chosenAction, location: newLocation, emotion })
    }

    // Generate world events from character actions
    const attackChars = updates.filter(u => u.action === 'attack')
    if (attackChars.length > 0) {
      await prisma.event.create({
        data: {
          worldId: world.id,
          type: 'conflict',
          tick,
          data: JSON.stringify({
            actors: attackChars.map(c => c.name),
            description: `${attackChars.map(c => c.name).join('、')} 发起了冲突行为`,
          }),
        },
      })
      state.global.stability = clamp(state.global.stability - 0.02 * attackChars.length)
      state.global.chaos = clamp(state.global.chaos + 0.015 * attackChars.length)
      await prisma.world.update({ where: { id: world.id }, data: { state: JSON.stringify(state) } })
    }

    const cooperateChars = updates.filter(u => u.action === 'cooperate')
    if (cooperateChars.length > 1) {
      await prisma.event.create({
        data: {
          worldId: world.id,
          type: 'social',
          tick,
          data: JSON.stringify({
            actors: cooperateChars.map(c => c.name),
            description: `${cooperateChars.map(c => c.name).join('、')} 展开了合作`,
          }),
        },
      })
    }

    return reply.send({ success: true, tick, updated: updates.length, updates })
  })

  // ===================== 角色关系图数据 =====================
  fastify.get('/api/characters/graph', async (_req, reply) => {
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.send({ success: true, nodes: [], edges: [] })
    const chars = await prisma.character.findMany({
      where: { worldId: world.id, alive: true },
    })
    const relations = await prisma.characterRelation.findMany({
      where: { from: { worldId: world.id } },
    })
    const nodes = chars.map(c => ({
      id: c.id, label: c.name, type: 'character',
      faction: c.faction, location: c.location,
    }))
    const edges = relations.map(r => ({
      from: r.fromId, to: r.toId, type: r.type, value: r.value,
      label: r.type === 'trust' ? '信任' : r.type === 'hate' ? '敌视' : r.type === 'fear' ? '恐惧' : '尊重',
    }))
    return reply.send({ success: true, nodes, edges })
  })

  // ===================== 角色SSE流 =====================
  fastify.get('/api/characters/stream', async (req, reply) => {
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
        if (tick <= lastTick) return
        lastTick = tick

        const recentBehaviors = await prisma.characterBehavior.findMany({
          where: { tick },
          include: { character: true },
          take: 10,
        })

        if (recentBehaviors.length === 0) return

        reply.raw.write(`data: ${JSON.stringify({
          type: 'character_update',
          tick,
          actions: recentBehaviors.map(b => ({
            character_id: b.characterId,
            name: b.character.name,
            action: b.action,
            target_id: b.targetId,
            score: b.score,
          })),
        })}\n\n`)
      } catch (e) { /* ignore */ }
    }, 5000)

    req.raw.on('close', () => clearInterval(interval))
  })

  // ===================== 杀掉角色 =====================
  fastify.post('/api/characters/:id/kill', async (req, reply) => {
    const { id } = req.params as { id: string }
    const world = await prisma.world.findFirst({ orderBy: { createdAt: 'desc' } })
    if (!world) return reply.status(400).send({ success: false, error: '无世界' })
    const state = JSON.parse(world.state as string)
    await prisma.character.update({
      where: { id },
      data: { alive: false, tickDied: state.tick || 0 },
    })
    return reply.send({ success: true, message: '角色已死亡' })
  })
}
