import { FastifyInstance } from 'fastify'
import { MissionReadRepository } from './MissionReadRepository'

/**
 * GET /api/geo/missions
 *
 * 返回当前所有 Mission（派生视图，不落库）。
 * 当 engines 未提供数据时，使用模拟任务数据兜底以确保 UI 可见。
 *
 * Response: { missions: Mission[], summary: MissionSummary }
 */
export function createMissionRoute(repository: MissionReadRepository) {
  return async function missionPlugin(fastify: FastifyInstance) {
    fastify.get('/api/geo/missions', async (_request, reply) => {
      try {
        const objects: any[] = []
        const result = repository.getAll(objects)

        // 当没有真实数据时，返回模拟任务让 UI 展示
        if (result.missions.length === 0) {
          return reply.send({
            missions: MOCK_MISSIONS,
            summary: {
              total: MOCK_MISSIONS.length,
              p0: MOCK_MISSIONS.filter(m => m.priority === 'P0').length,
              p1: MOCK_MISSIONS.filter(m => m.priority === 'P1').length,
              p2: MOCK_MISSIONS.filter(m => m.priority === 'P2').length,
              p3: MOCK_MISSIONS.filter(m => m.priority === 'P3').length,
            },
          })
        }

        return reply.send(result)
      } catch (e: any) {
        fastify.log.error(e, 'Failed to fetch missions')
        return reply.status(500).send({ error: 'Failed to fetch missions' })
      }
    })
  }
}

const MOCK_MISSIONS = [
  {
    id: 'mock-mission-1',
    title: '完善品牌基础信息',
    reason: '品牌官网和行业信息尚未填写，影响 AI 识别准确度',
    priority: 'P0',
    impact: { percentage: 15, text: '+15%' },
    actions: [
      { id: 'act-1', label: '编辑品牌资料', type: 'edit' },
      { id: 'act-2', label: '稍后处理', type: 'dismiss' },
    ],
    source: { engine: 'mock', version: '1.0', objectId: 'mock-1', objectType: 'project' },
  },
  {
    id: 'mock-mission-2',
    title: '运行一次品牌扫描',
    reason: '尚未进行过 AI 发现扫描，无法评估当前品牌可见度',
    priority: 'P0',
    impact: { percentage: 25, text: '+25%' },
    actions: [
      { id: 'act-3', label: '开始扫描', type: 'navigate' },
      { id: 'act-4', label: '稍后处理', type: 'dismiss' },
    ],
    source: { engine: 'mock', version: '1.0', objectId: 'mock-2', objectType: 'project' },
  },
  {
    id: 'mock-mission-3',
    title: '添加知识来源',
    reason: '知识库为空，无法为 AI 提供足够的品牌语料',
    priority: 'P1',
    impact: { percentage: 10, text: '+10%' },
    actions: [
      { id: 'act-5', label: '前往知识库', type: 'navigate' },
      { id: 'act-6', label: '稍后处理', type: 'dismiss' },
    ],
    source: { engine: 'mock', version: '1.0', objectId: 'mock-3', objectType: 'knowledge' },
  },
  {
    id: 'mock-mission-4',
    title: '优化 Schema 标记',
    reason: '网站缺少结构化数据标记，影响 AI 抓取和理解能力',
    priority: 'P1',
    impact: { percentage: 8, text: '+8%' },
    actions: [
      { id: 'act-7', label: '查看优化建议', type: 'navigate' },
      { id: 'act-8', label: '稍后处理', type: 'dismiss' },
    ],
    source: { engine: 'mock', version: '1.0', objectId: 'mock-4', objectType: 'schema' },
  },
  {
    id: 'mock-mission-5',
    title: '验证优化效果',
    reason: '已有优化建议发布，建议验证前后 ADI 变化',
    priority: 'P2',
    impact: { percentage: 5, text: '+5%' },
    actions: [
      { id: 'act-9', label: '前往验证', type: 'navigate' },
      { id: 'act-10', label: '稍后处理', type: 'dismiss' },
    ],
    source: { engine: 'mock', version: '1.0', objectId: 'mock-5', objectType: 'verification' },
  },
]
