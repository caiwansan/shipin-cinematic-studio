import { FastifyInstance } from 'fastify'

// ─── Types ──────────────────────────────────────────────────────
interface CharacterStateProfile {
  characterId: string
  characterName: string
  emotion: 'happy' | 'sad' | 'angry' | 'calm' | 'anxious' | 'excited' | 'fearful' | 'neutral'
  physical: 'healthy' | 'injured' | 'exhausted' | 'sick' | 'peak_condition'
  narrative: 'beginning' | 'development' | 'conflict' | 'climax' | 'resolution'
  relationships: Record<string, 'trust' | 'hatred' | 'love' | 'rivalry' | 'neutral'>
  updatedAt: string
}

interface StateHistoryEntry {
  timestamp: string
  sceneId?: string
  changes: Partial<CharacterStateProfile>
}

// ─── In-memory store (mock) ─────────────────────────────────────
const states: Record<string, CharacterStateProfile> = {}
const histories: Record<string, StateHistoryEntry[]> = {}

// ─── Defaults ────────────────────────────────────────────────────
const DEFAULT_EMOTION = 'neutral'
const DEFAULT_PHYSICAL = 'healthy'
const DEFAULT_NARRATIVE = 'beginning'
const DEFAULT_RELATIONS: Record<string, 'trust' | 'hatred' | 'love' | 'rivalry' | 'neutral'> = {}

const VALID_EMOTIONS = ['happy', 'sad', 'angry', 'calm', 'anxious', 'excited', 'fearful', 'neutral']
const VALID_PHYSICALS = ['healthy', 'injured', 'exhausted', 'sick', 'peak_condition']
const VALID_NARRATIVES = ['beginning', 'development', 'conflict', 'climax', 'resolution']
const VALID_RELATIONSHIPS = ['trust', 'hatred', 'love', 'rivalry', 'neutral']

// Helper: generate timestamp
function now(): string {
  return new Date().toISOString()
}

// Helper: ensure character profile exists
function ensureCharacter(characterId: string, characterName?: string): CharacterStateProfile {
  if (!states[characterId]) {
    states[characterId] = {
      characterId,
      characterName: characterName || `角色 ${characterId}`,
      emotion: DEFAULT_EMOTION,
      physical: DEFAULT_PHYSICAL,
      narrative: DEFAULT_NARRATIVE,
      relationships: { ...DEFAULT_RELATIONS },
      updatedAt: now(),
    }
  }
  if (characterName) {
    states[characterId].characterName = characterName
  }
  return states[characterId]
}

// Helper: push history entry
function pushHistory(characterId: string, changes: Partial<CharacterStateProfile>, sceneId?: string) {
  if (!histories[characterId]) {
    histories[characterId] = []
  }
  histories[characterId].push({
    timestamp: now(),
    sceneId,
    changes,
  })
  // Keep max 100 entries
  if (histories[characterId].length > 100) {
    histories[characterId] = histories[characterId].slice(-100)
  }
}

// ─── Route Registration ─────────────────────────────────────────
export default async function characterStateRoutes(fastify: FastifyInstance) {
  // ── POST /api/v1/character-state/update ──────────────────────────
  fastify.post('/api/v1/character-state/update', async (request, reply) => {
    const { characterId, characterName, emotion, physical, narrative, relationship, sceneId } = request.body as any
    if (!characterId) {
      return reply.status(400).send({ success: false, message: '缺少 characterId' })
    }

    const profile = ensureCharacter(characterId, characterName)
    const changes: Partial<CharacterStateProfile> = {}

    if (emotion !== undefined) {
      if (!VALID_EMOTIONS.includes(emotion)) {
        return reply.status(400).send({ success: false, message: `无效情绪: ${emotion}` })
      }
      profile.emotion = emotion
      changes.emotion = emotion
    }

    if (physical !== undefined) {
      if (!VALID_PHYSICALS.includes(physical)) {
        return reply.status(400).send({ success: false, message: `无效身体状态: ${physical}` })
      }
      profile.physical = physical
      changes.physical = physical
    }

    if (narrative !== undefined) {
      if (!VALID_NARRATIVES.includes(narrative)) {
        return reply.status(400).send({ success: false, message: `无效剧情阶段: ${narrative}` })
      }
      profile.narrative = narrative
      changes.narrative = narrative
    }

    if (relationship !== undefined) {
      const { targetId, value } = relationship
      if (!targetId || !VALID_RELATIONSHIPS.includes(value)) {
        return reply.status(400).send({ success: false, message: '无效关系参数，需要 targetId 和有效 value' })
      }
      profile.relationships[targetId] = value
      if (!changes.relationships) changes.relationships = {}
      changes.relationships = { ...profile.relationships }
    }

    profile.updatedAt = now()

    if (Object.keys(changes).length > 0) {
      pushHistory(characterId, changes, sceneId)
    }

    return reply.send({ success: true, data: profile })
  })

  // ── GET /api/v1/character-state/:characterId ────────────────────
  fastify.get('/api/v1/character-state/:characterId', async (request, reply) => {
    const { characterId } = request.params as any
    const profile = states[characterId]
    if (!profile) {
      return reply.status(404).send({ success: false, message: `角色 ${characterId} 不存在` })
    }
    return reply.send({ success: true, data: profile })
  })

  // ── GET /api/v1/character-state/:characterId/history ────────────
  fastify.get('/api/v1/character-state/:characterId/history', async (request, reply) => {
    const { characterId } = request.params as any
    const history = histories[characterId] || []
    return reply.send({ success: true, data: history })
  })

  // ── POST /api/v1/character-state/batch-update ───────────────────
  fastify.post('/api/v1/character-state/batch-update', async (request, reply) => {
    const { updates } = request.body as any
    if (!Array.isArray(updates)) {
      return reply.status(400).send({ success: false, message: '需要 updates 数组' })
    }

    const results: CharacterStateProfile[] = []
    for (const update of updates) {
      const { characterId, characterName, emotion, physical, narrative, relationship, sceneId } = update
      if (!characterId) continue

      const profile = ensureCharacter(characterId, characterName)
      const changes: Partial<CharacterStateProfile> = {}

      if (emotion && VALID_EMOTIONS.includes(emotion)) {
        profile.emotion = emotion
        changes.emotion = emotion
      }
      if (physical && VALID_PHYSICALS.includes(physical)) {
        profile.physical = physical
        changes.physical = physical
      }
      if (narrative && VALID_NARRATIVES.includes(narrative)) {
        profile.narrative = narrative
        changes.narrative = narrative
      }
      if (relationship) {
        const { targetId, value } = relationship
        if (targetId && VALID_RELATIONSHIPS.includes(value)) {
          profile.relationships[targetId] = value
        }
      }

      profile.updatedAt = now()

      if (Object.keys(changes).length > 0) {
        pushHistory(characterId, changes, sceneId || update.sceneId)
      }

      results.push(profile)
    }

    return reply.send({ success: true, data: results })
  })

  // ── GET /api/v1/character-state/all ─────────────────────────────
  fastify.get('/api/v1/character-state/all', async (request, reply) => {
    return reply.send({ success: true, data: Object.values(states) })
  })

  // ── POST /api/v1/character-state/validate ───────────────────────
  fastify.post('/api/v1/character-state/validate', async (request, reply) => {
    const results: Array<{
      characterId: string
      characterName: string
      status: 'ok' | 'conflict'
      issues: string[]
    }> = []

    for (const [characterId, profile] of Object.entries(states)) {
      const issues: string[] = []

      // Emotion vs narrative consistency rules
      if (profile.narrative === 'conflict' && ['happy', 'calm'].includes(profile.emotion)) {
        issues.push('剧情处于「冲突」阶段但角色情绪为「开心/平静」，可能存在情绪-剧情不匹配')
      }
      if (profile.narrative === 'climax' && ['calm', 'neutral'].includes(profile.emotion)) {
        issues.push('剧情处于「高潮」阶段但角色情绪为「平静/中立」，可能存在情绪-剧情不匹配')
      }
      if (profile.narrative === 'resolution' && ['angry', 'fearful', 'anxious'].includes(profile.emotion)) {
        issues.push('剧情处于「结局」阶段但角色情绪为「愤怒/恐惧/焦虑」，可能存在情绪-剧情不匹配')
      }

      // Physical vs narrative rules
      if (profile.narrative === 'conflict' && profile.physical === 'healthy') {
        issues.push('剧情处于「冲突」阶段但角色身体状态为「健康」，可能需要标记轻微受伤')
      }
      if (profile.narrative === 'climax' && profile.physical === 'peak_condition') {
        issues.push('剧情处于「高潮」阶段但角色状态为「巅峰」，高强度的战斗可能应有消耗')
      }

      results.push({
        characterId,
        characterName: profile.characterName,
        status: issues.length > 0 ? 'conflict' : 'ok',
        issues,
      })
    }

    return reply.send({
      success: true,
      data: {
        total: Object.keys(states).length,
        ok: results.filter(r => r.status === 'ok').length,
        conflict: results.filter(r => r.status === 'conflict').length,
        details: results,
      },
    })
  })
}
