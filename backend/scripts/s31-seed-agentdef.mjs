import { prisma } from '../src/utils/index.js'
// 幂等 seed
const existing = await prisma.agentDefinition.findUnique({ where: { code: 'def-resume-parser' } })
if (!existing) {
  await prisma.agentDefinition.create({
    data: {
      code: 'def-resume-parser',
      name: 'ResumeParser',
      version: '1.0.0',
      description: 'Parse resume documents into structured profiles',
      capabilities: JSON.stringify(['resume.parse', 'profile.extract']),
      supportedResources: JSON.stringify(['resume.pdf', 'resume.docx']),
      permissions: JSON.stringify(['read-resumes']),
      executionMode: 'sync',
      category: 'official',
      status: 'active',
    },
  })
  console.log('seeded def-resume-parser')
} else {
  console.log('already exists')
}
process.exit(0)
