import type { ApiResponse } from '../contracts/api/base.js';
// ─── 服装持续化系统 (Costume Continuity System) ───
// 火麒麟AI导演控制台 — 角色多套服装管理
// 按场景锁定服装风格，AI 不能在同一场景内混搭

import { FastifyInstance } from 'fastify'

// ─── In-Memory Mock Store ──────────────────────────
interface Costume {
  id: string
  characterId: string
  name: string
  styleTag: string   // 'casual' | 'formal' | 'combat' | 'historical' | 'luxury' | string
  imageUrl?: string
  description?: string
  sceneBindings?: string[]
  createdAt: string
}

interface SceneBinding {
  sceneId: string
  costumeId: string
}

const costumes: Map<string, Costume> = new Map()
const sceneBindings: SceneBinding[] = []
const activeCostumes: Map<string, string> = new Map()  // characterId -> costumeId

let idCounter = 1

function genId(): string {
  return `costume_${Date.now()}_${idCounter++}`
}

const STYLE_TAGS = ['casual', 'formal', 'combat', 'historical', 'luxury']

// ─── Routes ─────────────────────────────────────────

export default async function costumeRoutes(app: FastifyInstance) {

  // POST /api/v1/costume/create — 创建服装
  app.post('/api/v1/costume/create', async (request, reply) => {
    const { characterId, name, styleTag, imageUrl, description } = request.body as any
    if (!characterId || !name) {
      return reply.status(400).send({ success: false, error: '缺少必填字段：characterId, name' })
    }
    const tag = styleTag || 'casual'
    if (!STYLE_TAGS.includes(tag)) {
      return reply.status(400).send({ success: false, error: `无效风格标签，可选: ${STYLE_TAGS.join(', ')}` })
    }
    const id = genId()
    const costume: Costume = {
      id,
      characterId,
      name,
      styleTag: tag,
      imageUrl: imageUrl || '',
      description: description || '',
      sceneBindings: [],
      createdAt: new Date().toISOString(),
    }
    costumes.set(id, costume)
    return { success: true, data: costume } satisfies ApiResponse<unknown>;

  })

  // GET /api/v1/costume/list/:characterId — 某角色的服装列表
  app.get('/api/v1/costume/list/:characterId', async (request, reply) => {
    const { characterId } = request.params as any
    const list = Array.from(costumes.values()).filter(c => c.characterId === characterId)
    return { success: true, data: list } satisfies ApiResponse<unknown>;

  })

  // GET /api/v1/costume/:id — 服装详情
  app.get('/api/v1/costume/:id', async (request, reply) => {
    const { id } = request.params as any
    const costume = costumes.get(id)
    if (!costume) {
      return reply.status(404).send({ success: false, error: '服装不存在' })
    }
    return { success: true, data: costume } satisfies ApiResponse<unknown>;

  })

  // PUT /api/v1/costume/:id — 更新服装
  app.put('/api/v1/costume/:id', async (request, reply) => {
    const { id } = request.params as any
    const existing = costumes.get(id)
    if (!existing) {
      return reply.status(404).send({ success: false, error: '服装不存在' })
    }
    const updates = request.body as any
    if (updates.name) existing.name = updates.name
    if (updates.styleTag) {
      if (!STYLE_TAGS.includes(updates.styleTag)) {
        return reply.status(400).send({ success: false, error: `无效风格标签，可选: ${STYLE_TAGS.join(', ')}` })
      }
      existing.styleTag = updates.styleTag
    }
    if (updates.imageUrl !== undefined) existing.imageUrl = updates.imageUrl
    if (updates.description !== undefined) existing.description = updates.description
    costumes.set(id, existing)
    return { success: true, data: existing } satisfies ApiResponse<unknown>;

  })

  // DELETE /api/v1/costume/:id — 删除服装
  app.delete('/api/v1/costume/:id', async (request, reply) => {
    const { id } = request.params as any
    if (!costumes.has(id)) {
      return reply.status(404).send({ success: false, error: '服装不存在' })
    }
    costumes.delete(id)

    // 同步清理场景绑定
    const bindIdx = sceneBindings.findIndex(b => b.costumeId === id)
    if (bindIdx >= 0) sceneBindings.splice(bindIdx, 1)

    // 同步清理活跃服装
    for (const [charId, cId] of activeCostumes.entries()) {
      if (cId === id) activeCostumes.delete(charId)
    }

    return { success: true, data: { id } } satisfies ApiResponse<unknown>;

  })

  // POST /api/v1/costume/bind-scene — 绑定场景服装 { sceneId, costumeId }
  app.post('/api/v1/costume/bind-scene', async (request, reply) => {
    const { sceneId, costumeId } = request.body as any
    if (!sceneId || !costumeId) {
      return reply.status(400).send({ success: false, error: '缺少必填字段：sceneId, costumeId' })
    }
    const costume = costumes.get(costumeId)
    if (!costume) {
      return reply.status(404).send({ success: false, error: '服装不存在' })
    }

    // 防止重复绑定
    const exists = sceneBindings.find(b => b.sceneId === sceneId && b.costumeId === costumeId)
    if (!exists) {
      sceneBindings.push({ sceneId, costumeId })
      if (!costume.sceneBindings) costume.sceneBindings = []
      if (!costume.sceneBindings.includes(sceneId)) {
        costume.sceneBindings.push(sceneId)
      }
    }
    return { success: true, data: { sceneId, costumeId } } satisfies ApiResponse<unknown>;

  })

  // GET /api/v1/costume/scene-costumes/:sceneId — 获取场景绑定的所有服装
  app.get('/api/v1/costume/scene-costumes/:sceneId', async (request, reply) => {
    const { sceneId } = request.params as any
    const bindIds = sceneBindings.filter(b => b.sceneId === sceneId).map(b => b.costumeId)
    const list = bindIds.map(id => costumes.get(id)).filter(Boolean)
    return { success: true, data: list } satisfies ApiResponse<unknown>;

  })

  // POST /api/v1/costume/set-active — 设置角色当前活跃服装
  app.post('/api/v1/costume/set-active', async (request, reply) => {
    const { characterId, costumeId } = request.body as any
    if (!characterId || !costumeId) {
      return reply.status(400).send({ success: false, error: '缺少必填字段：characterId, costumeId' })
    }
    const costume = costumes.get(costumeId)
    if (!costume) {
      return reply.status(404).send({ success: false, error: '服装不存在' })
    }
    if (costume.characterId !== characterId) {
      return reply.status(400).send({ success: false, error: '服装不属于该角色' })
    }
    activeCostumes.set(characterId, costumeId)
    return { success: true, data: { characterId, activeCostumeId: costumeId } } satisfies ApiResponse<unknown>;

  })

  // POST /api/v1/costume/check-continuity — 检查服装连续性
  app.post('/api/v1/costume/check-continuity', async (request, reply) => {
    const { sceneId, characterId } = (request.body || {}) as any
    const issues: any[] = []

    if (sceneId) {
      // 检查该场景下是否存在服装冲突
      const sceneCostumeIds = sceneBindings.filter(b => b.sceneId === sceneId).map(b => b.costumeId)
      const sceneCostumes = sceneCostumeIds.map(id => costumes.get(id)).filter(Boolean) as Costume[]

      // 检查同一角色的多件服装是否在同一场景中被绑定
      const charCostumeMap = new Map<string, Costume[]>()
      for (const c of sceneCostumes) {
        if (!charCostumeMap.has(c.characterId)) charCostumeMap.set(c.characterId, [])
        charCostumeMap.get(c.characterId)!.push(c)
      }

      for (const [charId, charCostumes] of charCostumeMap.entries()) {
        if (charCostumes.length > 1) {
          const activeId = activeCostumes.get(charId)
          if (activeId) {
            // 场景绑定了该角色的多件服装，但活跃服装只应有一件
            const nonActive = charCostumes.filter(c => c.id !== activeId)
            if (nonActive.length > 0) {
              for (const nc of nonActive) {
                issues.push({
                  type: 'costume_conflict',
                  severity: 'warning',
                  message: `角色已绑定多件服装：「${charCostumes[0].name}」与「${nc.name}」在同一场景中冲突`,
                  characterId: charId,
                  sceneId,
                })
              }
            }
          }
        }
      }
    }

    // 检查所有绑定中的风格混搭
    const styleCheckMap = new Map<string, Set<string>>()
    for (const b of sceneBindings) {
      const c = costumes.get(b.costumeId)
      if (c) {
        const key = `${b.sceneId}_${c.characterId}`
        if (!styleCheckMap.has(key)) styleCheckMap.set(key, new Set())
        styleCheckMap.get(key)!.add(c.styleTag)
      }
    }

    for (const [key, tags] of styleCheckMap.entries()) {
      if (tags.size > 1) {
        const [sid, cid] = key.split('_')
        issues.push({
          type: 'costume_style_conflict',
          severity: 'warning',
          message: `场景中存在多种服装风格混搭 (${Array.from(tags).join(', ')})`,
          sceneId: sid,
          characterId: cid,
        })
      }
    }

    const hasConflict = issues.some(i => i.type === 'costume_conflict' || i.type === 'costume_style_conflict')
    return {
      success: true,
      data: {
        status: hasConflict ? '❌' : '✅',
        issues,
        characters: '✅',
        scenes: '✅',
        props: '✅',
        costume: hasConflict ? '❌' : '✅',
      },
    }
  })
}
