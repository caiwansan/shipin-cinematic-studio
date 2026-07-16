/**
 * inspector.route.ts — Snapshot Inspector HTTP API
 * 
 * POST /api/narrative/snapshot/inspect    完整 Snapshot 查看
 * POST /api/narrative/snapshot/explain    角色事实溯源
 * POST /api/narrative/snapshot/budget     预算检查  
 * POST /api/narrative/snapshot/deterministic 确定性检查
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { narrativeRuntime } from '../index.js'

export async function registerInspectorRoutes(app: FastifyInstance) {
  app.post('/api/narrative/snapshot/inspect', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId, chapterNo = 1 } = req.body as any
    if (!projectId) return reply.status(400).send({ error: 'projectId required' })

    const snapshot = await narrativeRuntime.snapshot.buildWriterSnapshot(projectId, { chapterNo })

    // 给每个 fact 加上 explainable 元数据
    return reply.send({
      ...snapshot,
      _meta: {
        generatedAt: new Date().toISOString(),
        chapterNo,
        resourceCounts: {
          characters: snapshot.characters.length,
          events: snapshot.events.length,
          timeline: snapshot.timeline.length,
          relationships: snapshot.relationships.length,
          knowledge: snapshot.knowledge.length,
          foreshadows: snapshot.foreshadows.length,
          inventory: snapshot.inventory.length,
          organizations: (snapshot as any).organizations?.length || 0,
        },
      },
    })
  })

  app.post('/api/narrative/snapshot/explain', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId, characterName } = req.body as any
    if (!projectId || !characterName) {
      return reply.status(400).send({ error: 'projectId and characterName required' })
    }

    const snapshot = await narrativeRuntime.snapshot.buildWriterSnapshot(projectId)
    const character = snapshot.characters.find(c => c.name === characterName)
    if (!character) {
      return reply.status(404).send({ error: `Character "${characterName}" not found in Snapshot` })
    }

    const events = snapshot.events.filter(e =>
      e.participants.some(p => p.characterName === characterName)
    )
    const relationships = snapshot.relationships.filter(r =>
      r.characterA === characterName || r.characterB === characterName
    )
    const knowledge = snapshot.knowledge.filter(k => k.knownBy.includes(characterName))
    const inventory = snapshot.inventory.filter(i => i.ownerCharacterName === characterName)

    return reply.send({
      character,
      events,
      relationships,
      knowledge,
      inventory,
      _meta: {
        generatedAt: new Date().toISOString(),
        eventCount: events.length,
        relationshipCount: relationships.length,
        knowledgeCount: knowledge.length,
        inventoryCount: inventory.length,
      },
    })
  })

  app.post('/api/narrative/snapshot/budget', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId, chapterNo = 1 } = req.body as any
    if (!projectId) return reply.status(400).send({ error: 'projectId required' })

    const snapshot = await narrativeRuntime.snapshot.buildWriterSnapshot(projectId, { chapterNo })
    const limits: Record<string, { max: number; actual: number; pass: boolean }> = {
      characters: { max: 30, actual: snapshot.characters.length, pass: true },
      events: { max: 20, actual: snapshot.events.length, pass: true },
      timeline: { max: 20, actual: snapshot.timeline.length, pass: true },
      relationships: { max: 50, actual: snapshot.relationships.length, pass: true },
      knowledge: { max: 20, actual: snapshot.knowledge.length, pass: true },
      foreshadows: { max: 20, actual: snapshot.foreshadows.length, pass: true },
      inventory: { max: 20, actual: snapshot.inventory.length, pass: true },
      organizations: { max: 10, actual: (snapshot as any).organizations?.length || 0, pass: true },
    }

    for (const [key, val] of Object.entries(limits)) {
      val.pass = val.actual <= val.max
    }

    const jsonLen = JSON.stringify(snapshot).length
    const allPass = Object.values(limits).every(l => l.pass)

    return reply.send({
      pass: allPass,
      limits,
      estimatedTokens: Math.ceil(jsonLen / 4),
      jsonSizeKB: (jsonLen / 1024).toFixed(1),
    })
  })

  app.post('/api/narrative/snapshot/deterministic', async (req: FastifyRequest, reply: FastifyReply) => {
    const { projectId, chapterNo = 1 } = req.body as any
    if (!projectId) return reply.status(400).send({ error: 'projectId required' })

    const fingerprints: string[] = []
    for (let i = 0; i < 3; i++) {
      const snapshot = await narrativeRuntime.snapshot.buildWriterSnapshot(projectId, { chapterNo })
      const fp = JSON.stringify({
        chars: snapshot.characters.map(c => `${c.name}:${c.lifecycle}`).sort(),
        events: snapshot.events.map(e => `${e.chapterNo}:${e.title}`).sort(),
        foreshadows: snapshot.foreshadows.map(f => `${f.id}:${f.status}`).sort(),
        rels: snapshot.relationships.map(r => `${r.characterA}:${r.characterB}:${r.bondType}`).sort(),
      })
      fingerprints.push(fp)
    }

    const allSame = fingerprints.every(f => f === fingerprints[0])

    return reply.send({
      pass: allSame,
      runs: fingerprints.map((_, i) => ({ run: i + 1 })),
      stable: allSame,
      message: allSame ? '3 次运行完全一致' : '❌ 不一致（可能因未排序的 Runtime 输出）',
    })
  })
}
