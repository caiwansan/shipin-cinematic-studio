// ============================================================
// Sprint C0: Adoption Dashboard
// 查看所有下游引擎的 Discovery 消费状态
//
// GET /api/geo/discovery/adoption
// ============================================================

import { FastifyInstance } from 'fastify'
import { consumerRegistry, type DiscoveryConsumer } from '../services/consumer-registry'

interface ConsumerStatus {
  name: string
  registered: boolean
  active: boolean
}

interface AdoptionStatus {
  version: string
  consumers: ConsumerStatus[]
  registeredCount: number
  activeCount: number
  totalEngines: number
  adoptionPercent: string
  activePercent: string
}

const ALL_DOWNSTREAM_ENGINES: { name: string; requiredForActive: boolean }[] = [
  { name: 'KnowledgeConsumer', requiredForActive: true },
  { name: 'RecommendationsConsumer', requiredForActive: true },
  { name: 'MissionConsumer', requiredForActive: true },
  { name: 'VerificationConsumer', requiredForActive: false },
  { name: 'PublishingConsumer', requiredForActive: false },
  { name: 'LearningConsumer', requiredForActive: false },
]

export async function discoveryAdoptionRoutes(app: FastifyInstance) {
  app.get('/api/geo/discovery/adoption', async (_req, reply) => {
    const registered = consumerRegistry.getAll()
    const registeredNames = new Set(registered.map((c) => c.name))

    // Active = 已注册且是核心引擎链的一部分
    const activeNames = new Set(
      registered
        .filter((c) => {
          const def = ALL_DOWNSTREAM_ENGINES.find((d) => d.name === c.name)
          return def?.requiredForActive
        })
        .map((c) => c.name)
    )

    const consumers: ConsumerStatus[] = ALL_DOWNSTREAM_ENGINES.map(({ name }) => ({
      name,
      registered: registeredNames.has(name),
      active: activeNames.has(name),
    }))

    const registeredCount = consumers.filter((c) => c.registered).length
    const activeCount = consumers.filter((c) => c.active).length
    const totalEngines = ALL_DOWNSTREAM_ENGINES.length

    return {
      success: true,
      data: {
        version: 'c0',
        consumers,
        registeredCount,
        activeCount,
        totalEngines,
        adoptionPercent: `${Math.round((registeredCount / totalEngines) * 100)}%`,
        activePercent: `${Math.round((activeCount / totalEngines) * 100)}%`,
      } satisfies AdoptionStatus,
    }
  })
}
