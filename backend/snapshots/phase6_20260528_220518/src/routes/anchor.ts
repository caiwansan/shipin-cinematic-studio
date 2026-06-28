import type { ApiResponse } from '../contracts/api/base.js';
import { FastifyInstance } from 'fastify'

// Simple ID generator (avoids uuid dependency)
function simpleId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36)
}

// ─── In-memory anchor store (mock) ──────────────────────────────
const characterAnchors: Record<string, any> = {}
const sceneAnchors: Record<string, any> = {}
const propAnchors: Record<string, any> = {}
const bindMappings: Record<string, any> = {}

let charCounter = 0
let sceneCounter = 0
let propCounter = 0

export default async function anchorRoutes(fastify: FastifyInstance) {
  // ── POST /api/v1/anchor/character ──────────────────────────────
  fastify.post('/api/v1/anchor/character', async (request, reply) => {
    const { name, type, base64, url } = request.body as any
    if (!name) {
      return reply.status(400).send({ success: false, message: '缺少角色名' })
    }
    charCounter++
    const id = `anchor-char-${simpleId()}`
    const thumbnail = url || `https://picsum.photos/seed/char${charCounter}/200/200`
    const anchor = {
      id,
      name,
      type: type || 'character',
      thumbnail,
      description: `角色「${name}」特征嵌入完成 — 人脸特征向量已提取，运动风格分析完成`,
      locked: true,
      createdAt: new Date().toISOString(),
      extra: {
        faceEmbedding: `v2/embed/face/${id}`,
        motionStyle: 'natural',
        gender: Math.random() > 0.5 ? '男' : '女',
        ageGroup: '20-35岁',
      },
    }
    characterAnchors[id] = anchor
    return {
      success: true,
      data: {
        characterId: id,
        description: anchor.description,
        anchor,
      },
    }
  })

  // ── POST /api/v1/anchor/scene ─────────────────────────────────
  fastify.post('/api/v1/anchor/scene', async (request, reply) => {
    const { name, type, base64, url } = request.body as any
    if (!name) {
      return reply.status(400).send({ success: false, message: '缺少场景名' })
    }
    sceneCounter++
    const id = `anchor-scene-${simpleId()}`
    const thumbnail = url || `https://picsum.photos/seed/scene${sceneCounter}/200/200`
    const anchor = {
      id,
      name,
      type: type || 'scene',
      thumbnail,
      description: `场景「${name}」空间分析完成 — 空间布局拓扑结构已提取，光照HDR映射已存储`,
      locked: true,
      createdAt: new Date().toISOString(),
      extra: {
        spatialLayout: 'open_plan',
        lighting: 'natural_daylight',
        colorPalette: ['#8B7355', '#2F4F4F', '#F5DEB3'],
        environment: '室外/自然光',
      },
    }
    sceneAnchors[id] = anchor
    return {
      success: true,
      data: {
        sceneId: id,
        description: anchor.description,
        anchor,
      },
    }
  })

  // ── POST /api/v1/anchor/prop ──────────────────────────────────
  fastify.post('/api/v1/anchor/prop', async (request, reply) => {
    const { name, type, base64, url } = request.body as any
    if (!name) {
      return reply.status(400).send({ success: false, message: '缺少道具名' })
    }
    propCounter++
    const id = `anchor-prop-${simpleId()}`
    const thumbnail = url || `https://picsum.photos/seed/prop${propCounter}/200/200`
    const anchor = {
      id,
      name,
      type: type || 'prop',
      thumbnail,
      description: `道具「${name}」材质分析完成 — PBR材质参数已提取，物理碰撞体积已计算`,
      locked: true,
      createdAt: new Date().toISOString(),
      extra: {
        material: 'wood_metal_composite',
        usage: '手持道具/场景装饰',
        weight: '1.2kg',
        dimensions: '30x15x8cm',
      },
    }
    propAnchors[id] = anchor
    return {
      success: true,
      data: {
        propId: id,
        description: anchor.description,
        anchor,
      },
    }
  })

  // ── GET /api/v1/anchor/characters ─────────────────────────────
  fastify.get('/api/v1/anchor/characters', async () => {
    return {
      success: true,
      data: Object.values(characterAnchors),
    }
  })

  // ── GET /api/v1/anchor/scenes ─────────────────────────────────
  fastify.get('/api/v1/anchor/scenes', async () => {
    return {
      success: true,
      data: Object.values(sceneAnchors),
    }
  })

  // ── GET /api/v1/anchor/props ──────────────────────────────────
  fastify.get('/api/v1/anchor/props', async () => {
    return {
      success: true,
      data: Object.values(propAnchors),
    }
  })

  // ── DELETE /api/v1/anchor/character/:id ───────────────────────
  fastify.delete('/api/v1/anchor/character/:id', async (request, reply) => {
    const { id } = request.params as any
    if (!characterAnchors[id]) {
      return reply.status(404).send({ success: false, message: '角色锚定不存在' })
    }
    delete characterAnchors[id]
    return { success: true, message: '角色已解锁' } satisfies ApiResponse<unknown>;

  })

  // ── DELETE /api/v1/anchor/scene/:id ───────────────────────────
  fastify.delete('/api/v1/anchor/scene/:id', async (request, reply) => {
    const { id } = request.params as any
    if (!sceneAnchors[id]) {
      return reply.status(404).send({ success: false, message: '场景锚定不存在' })
    }
    delete sceneAnchors[id]
    return { success: true, message: '场景已解锁' } satisfies ApiResponse<unknown>;

  })

  // ── DELETE /api/v1/anchor/prop/:id ────────────────────────────
  fastify.delete('/api/v1/anchor/prop/:id', async (request, reply) => {
    const { id } = request.params as any
    if (!propAnchors[id]) {
      return reply.status(404).send({ success: false, message: '道具锚定不存在' })
    }
    delete propAnchors[id]
    return { success: true, message: '道具已解锁' } satisfies ApiResponse<unknown>;

  })

  // ── POST /api/v1/anchor/bind ──────────────────────────────────
  fastify.post('/api/v1/anchor/bind', async (request, reply) => {
    const { scriptCharacter, characterId, scriptScene, sceneId, scriptProp, propId } = request.body as any
    const bindId = `bind-${simpleId()}`
    const mapping: Record<string, any> = {
      id: bindId,
      createdAt: new Date().toISOString(),
    }
    if (scriptCharacter && characterId) {
      mapping.scriptCharacter = scriptCharacter
      mapping.characterId = characterId
      mapping.type = 'character'
    } else if (scriptScene && sceneId) {
      mapping.scriptScene = scriptScene
      mapping.sceneId = sceneId
      mapping.type = 'scene'
    } else if (scriptProp && propId) {
      mapping.scriptProp = scriptProp
      mapping.propId = propId
      mapping.type = 'prop'
    }
    bindMappings[bindId] = mapping
    return {
      success: true,
      data: {
        bindId,
        mapping,
        message: `锚定绑定完成 — @anchor-rule: ${mapping.type}_identity_locked=true — 优先使用锚定素材`,
      },
    }
  })

  // ── POST /api/v1/anchor/consistency-scan ──────────────────────
  fastify.post('/api/v1/anchor/consistency-scan', async () => {
    const charCount = Object.keys(characterAnchors).length
    const sceneCount = Object.keys(sceneAnchors).length
    const propCount = Object.keys(propAnchors).length
    const issues: any[] = []

    if (charCount === 0) {
      issues.push({ type: 'character', severity: 'warning', message: '未绑定任何角色锚定，AI可能自由生成角色形象' })
    }
    if (sceneCount === 0) {
      issues.push({ type: 'scene', severity: 'warning', message: '未绑定任何场景锚定，AI可能自由生成场景' })
    }
    if (propCount === 0) {
      issues.push({ type: 'prop', severity: 'info', message: '未绑定任何道具锚定（可选）' })
    }

    // Check bind mappings
    const bindCount = Object.keys(bindMappings).length
    if (charCount > 0 && bindCount < charCount) {
      issues.push({ type: 'character', severity: 'warning', message: `${charCount}个角色已绑定但只有${bindCount}个映射，部分角色可能未被锁定` })
    }

    return {
      success: true,
      data: {
        status: {
          characters: issues.some(i => i.type === 'character' && i.severity === 'critical') ? '[PASS]' : charCount > 0 ? '[PASS]' : '[PENDING]',
          scenes: issues.some(i => i.type === 'scene' && i.severity === 'critical') ? '[PASS]' : sceneCount > 0 ? '[PASS]' : '[PENDING]',
          props: issues.some(i => i.type === 'prop' && i.severity === 'critical') ? '[PASS]' : propCount > 0 ? '[PASS]' : '[PENDING]',
        },
        issues,
        timestamp: new Date().toISOString(),
      },
    }
  })
}
