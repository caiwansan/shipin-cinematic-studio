/**
 * S5.3 Task 01 — JD 模板增强插件 Seed（幂等）
 * plugin-recruitment-jd-template → 增强 Alice 的 candidate.score
 * 插件不创建 Skill/Agent/Runtime; 只提供模板数据（manifest 只存不执行）
 */
import { prisma } from '../src/utils/index.js'

const PLUGIN_ID = 'plugin-recruitment-jd-template'
const ORG_A = '11111111-2222-4333-8444-555555555555'

// 1. 插件本体（manifest 含 enhancements, 零新表）
let plugin = await prisma.ecologyPlugin.findUnique({ where: { pluginId: PLUGIN_ID } })
if (!plugin) {
  plugin = await prisma.ecologyPlugin.create({
    data: {
      pluginId: PLUGIN_ID,
      name: 'JD 模板增强插件（招聘）',
      type: 'tool',
      author: 'kunlun-platform',
      description: 'S5.3 Employee Enhancement: 向 Alice candidate.score 注入岗位 JD 模板',
      status: 'PUBLISHED',
      manifest: {
        id: PLUGIN_ID,
        name: 'JD 模板增强插件（招聘）',
        type: 'tool',
        author: 'kunlun-platform',
        version: '1.0.0',
        enhancements: [
          {
            skillId: 'candidate.score',
            type: 'jd-template',
            templates: [
              '互联网研发岗 JD：要求 3 年以上后端/前端经验，熟悉分布式系统，有高并发项目经历优先。',
              'AI 产品经理 JD：要求 AI 产品设计经验，熟悉 LLM 应用场景，能定义模型评测指标。',
              '运营岗位 JD：要求内容运营或用户运营经验，擅长数据分析与增长策略。',
            ],
          },
        ],
      },
    },
  })
  console.log(`CREATED plugin: ${PLUGIN_ID}`)
} else {
  console.log(`EXISTS plugin: ${PLUGIN_ID} (status=${plugin.status})`)
}

// 2. 企业授权（EcologyLicense, org+plugin, @@unique）
const existingLicense = await prisma.ecologyLicense.findUnique({
  where: { organizationId_pluginId: { organizationId: ORG_A, pluginId: plugin.id } },
}).catch(() => null)
if (!existingLicense) {
  await prisma.ecologyLicense.create({
    data: {
      organizationId: ORG_A,
      pluginId: plugin.id,
      pluginVersion: '1.0.0',
      status: 'ACTIVE',
      licenseType: 'subscription',
      startAt: new Date(),
      expireAt: new Date(Date.now() + 365 * 24 * 3600 * 1000),
    },
  })
  console.log(`CREATED license: org=${ORG_A} plugin=${PLUGIN_ID}`)
} else {
  console.log(`EXISTS license: status=${existingLicense.status}`)
}

const p = await prisma.ecologyPlugin.findUnique({ where: { pluginId: PLUGIN_ID }, select: { pluginId: true, status: true, manifest: true } })
console.log('plugin:', p?.pluginId, p?.status, '| enhancements:', JSON.stringify((p?.manifest as any)?.enhancements?.length || 0))
process.exit(0)
