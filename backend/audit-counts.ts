import { prisma } from './src/utils/index.js'
async function main() {
  const counts = {
    jobPosting: await prisma.jobPosting.count(),
    enterpriseProfile: await prisma.enterpriseProfile.count(),
    enterpriseJobWorkspace: await prisma.enterpriseJobWorkspace.count(),
    recruitmentPipeline: await prisma.recruitmentPipeline.count(),
    candidateMatch: await prisma.candidateMatch.count(),
    candidateResume: await prisma.candidateResume.count(),
    jobCandidate: await prisma.jobCandidate.count(),
    interviewSession: await prisma.interviewSession.count(),
    enterpriseMember: await prisma.enterpriseMember.count(),
    govUser: await prisma.govUser.count(),
    organization: await prisma.organization.count(),
    user: await prisma.user.count(),
  }
  console.table(counts)

  // 检查 JobPosting 样例
  const sampleJobs = await prisma.jobPosting.findMany({ take: 5, select: { id: true, title: true, status: true, enterpriseId: true, createdAt: true } })
  console.log('\nSample JobPostings:', JSON.stringify(sampleJobs, null, 2))

  // 检查企业身份链路
  const sampleEnterprise = await prisma.enterpriseProfile.findFirst({ take: 5, select: { id: true, organizationId: true } })
  console.log('\nSample EnterpriseProfile:', JSON.stringify(sampleEnterprise, null, 2))
}
main().catch(e => console.error(e))
