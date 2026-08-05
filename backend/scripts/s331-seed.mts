/**
 * S3.3.1 种子: 组合演示用 AgentDefinition（复用 agent_definition 表，零新表）
 * - def-candidate-scorer:   Skill candidate.score
 * - def-interview-evaluator: Skill interview.evaluate
 * - def-recruiter-alice:    组合员工（skillSet = 3 Skills, Q1 绑定视图素材）
 * 幂等: 已存在则跳过
 */
import { prisma } from '../src/utils/index.js'

const seeds = [
  {
    code: 'def-candidate-scorer',
    name: 'CandidateScorer',
    version: '1.0.0',
    description: '候选人评分 Skill（mock 演示）',
    capabilities: JSON.stringify(['candidate.score']),
    supportedResources: JSON.stringify(['candidate.profile']),
    permissions: JSON.stringify(['read-candidates']),
    category: 'official',
    status: 'active',
    executionMode: 'sync',
  },
  {
    code: 'def-interview-evaluator',
    name: 'InterviewEvaluator',
    version: '1.0.0',
    description: '面试评估 Skill（mock 演示）',
    capabilities: JSON.stringify(['interview.evaluate']),
    supportedResources: JSON.stringify(['interview.notes']),
    permissions: JSON.stringify(['read-interviews']),
    category: 'official',
    status: 'active',
    executionMode: 'sync',
  },
  {
    code: 'def-recruiter-alice',
    name: '招聘专员Alice',
    version: '1.0.0',
    description: 'S3.3.1 组合演示员工（3 Skills: resume-parser + candidate-scorer + interview-evaluator）',
    capabilities: JSON.stringify(['resume.parse', 'profile.extract', 'candidate.score', 'interview.evaluate']),
    supportedResources: JSON.stringify(['resume.pdf', 'candidate.profile', 'interview.notes']),
    permissions: JSON.stringify(['read-resumes', 'read-candidates', 'read-interviews']),
    category: 'official',
    status: 'active',
    executionMode: 'sync',
  },
]

let created = 0
let skipped = 0
for (const s of seeds) {
  const exist = await prisma.agentDefinition.findUnique({ where: { code: s.code } }).catch(() => null)
  if (exist) {
    skipped++
    console.log(`skip (exists): ${s.code}`)
    continue
  }
  await prisma.agentDefinition.create({ data: s })
  created++
  console.log(`created: ${s.code}`)
}
console.log(`DONE created=${created} skipped=${skipped}`)
await prisma.$disconnect()
