import { FastifyInstance, FastifyPluginAsync } from 'fastify'

/**
 * World Model Routes — 世界感知占位 API
 *
 * 世界感知是前端运行时行为，后端仅提供 mock 占位。
 * 未来可扩展为持久化缓存或跨用户共享世界状态。
 */
const worldModelRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 获取世界状态
  fastify.get('/api/world-model/state', async (_request, _reply) => {
    return {
      status: 'active',
      worldId: 'world-default-001',
      timestamp: new Date().toISOString(),
      dimensions: {
        environment: 'connected',
        physics: 'active',
        knowledge: 'ready',
        reality: 'validated',
        sensory: 'awake',
      },
      activeScenes: [],
      continuityToken: 'ct-abc123def456',
    }
  })

  // 环境连续性
  fastify.get('/api/world-model/environment', async (_request, _reply) => {
    return {
      environmentId: 'env-default-001',
      location: '未指定',
      time: new Date().toISOString(),
      lighting: '自动',
      weather: '晴朗',
      temperature: 25,
      humidity: 60,
      continuityScore: 1.0,
      constraints: [
        '场景内物品位置不可突变',
        '天气变化需符合时间线逻辑',
        '光照需与时间/地点一致',
      ],
    }
  })

  // 物理约束
  fastify.get('/api/world-model/physics', async (_request, _reply) => {
    return {
      physicsId: 'phys-default-001',
      gravity: 9.8,
      collisionEnabled: true,
      rigidBodyCount: 0,
      activeConstraints: [
        {
          name: '重力',
          value: '9.8 m/s²',
          modifiable: false,
        },
        {
          name: '碰撞检测',
          value: '启用',
          modifiable: true,
        },
        {
          name: '摩擦力默认系数',
          value: 0.6,
          modifiable: true,
        },
        {
          name: '空气阻力',
          value: 0.02,
          modifiable: true,
        },
      ],
      violations: [],
      note: '物理约束目前为默认值，前端可在运行时覆盖',
    }
  })

  // 真实性验证
  fastify.get('/api/world-model/reality-check', async (_request, _reply) => {
    return {
      checkId: `rc-${Date.now()}`,
      timestamp: new Date().toISOString(),
      overallScore: 0.85,
      valid: true,
      dimensions: {
        motion: 0.9,
        physiology: 0.8,
        physics: 0.85,
        environment: 0.9,
        cinematic: 0.8,
      },
      recommendations: [
        '增加角色细微表情变化以提升生理真实性',
        '检查镜头转场是否遵守180度法则',
      ],
      governance: {
        passed: true,
        blockedBy: null,
      },
    }
  })

  // 知识查询
  fastify.get('/api/world-model/knowledge', async (_request, _reply) => {
    return {
      knowledgeId: 'know-default-001',
      graphVersion: '1.0.0',
      entityCount: 0,
      relationCount: 0,
      lastIndexed: new Date().toISOString(),
      sampleFacts: [
        '事实(香港, 位于, 中国)',
        '事实(暴雨, 带来, 低可见度)',
        '事实(角色移动速度, 受限于, 地形)',
        '规则(镜头切换, 不应, 违反180度线)',
        '规则(对话场景, 建议使用, 正反打镜头)',
      ],
      queryCapabilities: [
        '实体查询 (entity → 属性列表)',
        '关系查询 (entity1, relation → entity2)',
        '规则查询 (context → 适用规则列表)',
        '语义搜索 (text → 相关事实)',
      ],
    }
  })
}

export default worldModelRoutes
