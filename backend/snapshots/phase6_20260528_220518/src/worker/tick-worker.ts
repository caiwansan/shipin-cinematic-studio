// ============================================================
// Tick Worker — 独立世界Tick执行器
// 每秒自动推进世界: tick → events → state → causality → SSE
// ============================================================
import { PrismaClient } from '@prisma/client'

/**
 * Character Tick Runner — updates all alive characters each tick
 */
async function tickCharacters(worldId: string, state: any) {
  const tick = state.tick || 0
  const chars = await prisma.character.findMany({
    where: { worldId, alive: true },
  })
  if (chars.length === 0) return []

  const updates: any[] = []
  const locations = ['city_center', 'commercial_district', 'tech_park', 'slums', 'port_area']

  for (const char of chars) {
    const emotion = JSON.parse(char.emotion)
    // Emotion drift by world state
    emotion.fear = Math.max(0, Math.min(1, emotion.fear + (state.global.chaos - 0.3) * 0.3))
    emotion.joy = Math.max(0, Math.min(1, emotion.joy + (state.global.stability - 0.5) * 0.2))

    // Simple behavior selection
    const personality = JSON.parse(char.personality)
    const scores: Record<string, number> = {
      observe: 0.3 + personality.emotion * 0.2,
      move: 0.2 + (state.global.chaos > 0.5 ? 0.3 : 0),
      talk: 0.2 + personality.empathy * 0.3,
      cooperate: 0.1 + personality.empathy * 0.3 - personality.aggression * 0.2,
      attack: personality.aggression * 0.4 + emotion.anger * 0.3,
      create_media: 0.1 + personality.logic * 0.3,
    }
    const bestAction = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0]

    // Determine target
    let targetId: string | null = null
    if (['attack', 'talk', 'cooperate'].includes(bestAction)) {
      const others = chars.filter(c => c.id !== char.id)
      if (others.length > 0) {
        targetId = others[Math.floor(Math.random() * others.length)].id
      }
    }

    const newLocation = Math.random() > 0.7 ? locations[Math.floor(Math.random() * locations.length)] : char.location

    // Update
    await prisma.character.update({
      where: { id: char.id },
      data: { emotion: JSON.stringify(emotion), location: newLocation, activity: bestAction },
    })

    // Record memory (25% chance)
    if (Math.random() > 0.75) {
      await prisma.characterMemory.create({
        data: {
          characterId: char.id,
          type: 'event',
          content: `${char.name} 在 T${tick} ${bestAction === 'attack' ? '攻击' : bestAction === 'move' ? '移动到' : '进行了'} ${bestAction}`,
          importance: Math.round((0.2 + Math.random() * 0.3) * 100) / 100,
          tick,
          emotionalTag: bestAction === 'attack' ? 'negative' : 'neutral',
        },
      })
    }

    // Record behavior
    await prisma.characterBehavior.create({
      data: {
        characterId: char.id,
        action: bestAction,
        targetId,
        context: `${char.name} → ${bestAction} @ ${newLocation}`,
        tick,
        score: scores[bestAction],
      },
    })

    updates.push({ id: char.id, name: char.name, action: bestAction, targetId })
  }

  // Generate world events from character actions
  const attackers = updates.filter(u => u.action === 'attack')
  if (attackers.length > 0) {
    await prisma.event.create({
      data: {
        worldId,
        type: 'conflict',
        tick,
        data: JSON.stringify({
          actors: attackers.map(a => a.name),
          description: `${attackers.map(a => a.name).join('、')} 发起冲突`,
        }),
      },
    })
    state.global.stability = Math.max(0, Math.min(1, state.global.stability - 0.02))
    state.global.chaos = Math.max(0, Math.min(1, state.global.chaos + 0.015))
  }

  const cooperators = updates.filter(u => u.action === 'cooperate')
  if (cooperators.length > 1) {
    await prisma.event.create({
      data: {
        worldId,
        type: 'social',
        tick,
        data: JSON.stringify({
          actors: cooperators.map(c => c.name),
          description: `${cooperators.map(c => c.name).join('、')} 展开合作`,
        }),
      },
    })
  }

  return updates
}

const prisma = new PrismaClient()
let running = false
let intervalId: ReturnType<typeof setInterval> | null = null

async function tickWorld() {
  try {
    const worlds = await prisma.world.findMany()
    if (worlds.length === 0) return

    for (const world of worlds) {
      const state = JSON.parse(world.state as string)
      state.tick++

      // 时间推进（每tick=2小时）
      state.time.hour = (state.time.hour + 2) % 24
      if (state.time.hour === 0) state.time.day++

      // 状态漂移
      const drift = (key: string) => Math.max(0, Math.min(1,
        state.global[key] + (Math.random() - 0.5) * 0.08
      ))

      state.global.stability = Math.round(drift('stability') * 10000) / 10000
      state.global.chaos = Math.round(drift('chaos') * 10000) / 10000
      state.global.narrative_pressure = Math.round(drift('narrative_pressure') * 10000) / 10000

      // 事件生成（~40%概率）
      if (Math.random() > 0.6) {
        const types = ['economic', 'conflict', 'social', 'random']
        await prisma.event.create({
          data: {
            worldId: world.id,
            type: types[Math.floor(Math.random() * types.length)],
            tick: state.tick,
            data: JSON.stringify({
              actors: [],
              location: '主城',
              causality_score: Math.random(),
            }),
          },
        })
      }

      // 每10tick生成叙事场景
      if (state.tick % 10 === 0) {
        const recentEvents = await prisma.event.findMany({
          where: { worldId: world.id },
          orderBy: { tick: 'desc' },
          take: 10,
        })

        const scene = {
          scene_id: `scene_${state.tick}`,
          summary: `自动编译: 第${state.tick}tick·第${state.time.day}日 · ${recentEvents.length}个事件`,
          emotional_arc: state.global.stability > 0.6 ? ['平稳'] : ['动荡'],
          key_events: recentEvents.slice(0, 3).map(e => `[${e.type}]`),
          importance: Math.round(state.global.narrative_pressure * 10) / 10,
        }

        await prisma.narrativeScene.create({
          data: {
            worldId: world.id,
            summary: scene.summary,
            importance: scene.importance,
            tickRange: `${state.tick - 10}-${state.tick}`,
            data: JSON.stringify(scene),
          },
        })
      }

      // 保存世界状态
      await prisma.world.update({
        where: { id: world.id },
        data: { state: JSON.stringify(state) },
      })

      // 角色更新（每2tick一次以节约性能）
      if (state.tick % 2 === 0) {
        await tickCharacters(world.id, state)
      }
    }

    // 每60tick清理过期事件
    const worldCount = worlds.length
    if (worldCount > 0 && worlds[0].state && JSON.parse(worlds[0].state as string).tick % 60 === 0) {
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000)
      await prisma.event.deleteMany({ where: { createdAt: { lt: thirtyMinAgo } } })
      await prisma.narrativeScene.deleteMany({ where: { createdAt: { lt: thirtyMinAgo } } })
    }
  } catch (err) {
    console.error('[TickWorker] Error:', (err as Error).message)
  }
}

export function startTickWorker(intervalMs = 1000) {
  if (running) return
  running = true
  console.log(`[TickWorker] Started — every ${intervalMs}ms`)
  intervalId = setInterval(tickWorld, intervalMs)
}

export function stopTickWorker() {
  if (intervalId) clearInterval(intervalId)
  running = false
  console.log('[TickWorker] Stopped')
}

// 入口包装
if (require.main === module || process.env.WORKER_MODE === 'true') {
  console.log('[TickWorker] 通过主模块启动')
  startTickWorker()
  process.on('SIGINT', () => { stopTickWorker(); process.exit(0) })
  process.on('SIGTERM', () => { stopTickWorker(); process.exit(0) })
}
