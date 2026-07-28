/**
 * RECRUITMENT-RELEASE-CANDIDATE-01 Task 01
 * Seed script: Create minimal E2E recruitment test data
 *
 * Uses Prisma ORM — no direct SQL, no fake JSON, no legacy models.
 * Chain: CareerProfile → CandidateMatch → InterviewSession → RecruitmentPipeline
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ENTERPRISE_ORG_ID = '52f4e88b-f396-445e-8abc-28b44ab25e41'
const WORKSPACE_ID = '3b5830ea-4a5d-4239-9bb0-e2360bef1e12'

async function main() {
  console.log('=== RECRUITMENT E2E REALITY SEED ===\n')

  // ── Step 1: Verify existing enterprise context ──
  const org = await prisma.organization.findUnique({ where: { id: ENTERPRISE_ORG_ID } })
  if (!org) throw new Error(`Org ${ENTERPRISE_ORG_ID} not found`)

  const workspace = await prisma.enterpriseJobWorkspace.findUnique({ where: { id: WORKSPACE_ID } })
  if (!workspace) throw new Error(`Workspace ${WORKSPACE_ID} not found`)

  // JobPosting.enterpriseId references JobCompanyProfile.id, not Organization.id
  // Fetch published postings across the workspace's JobCompanyProfile
  const jobPostings = await prisma.jobPosting.findMany({
    where: { status: { not: 'closed' } },
    orderBy: { createdAt: 'asc' },
  })
  if (jobPostings.length < 3) throw new Error(`Need at least 3 job postings, got ${jobPostings.length}`)

  console.log(`Org: ${org.id}`)
  console.log(`Workspace: ${workspace.id}`)
  console.log(`Jobs found: ${jobPostings.length}`)
  console.log(`  -> ${jobPostings.map(j => j.title).join(', ')}
  `)

  // ── Step 2: Find users for CareerProfile candidates ──
  // Two additional non-admin users for new CareerProfiles
  const users = await prisma.user.findMany({
    where: { email: { not: { contains: 'admin' } } },
    take: 3,
    orderBy: { createdAt: 'asc' },
  })
  if (users.length < 3) throw new Error(`Need at least 3 candidate users, got ${users.length}`)

  console.log(`Candidate users: ${users.map(u => `${u.username}(${u.id.slice(0, 8)})`).join(', ')}\n`)

  // ── Step 3: Create CareerProfiles (skip if already exists) ──
  const existingCp = await prisma.careerProfile.findMany()
  console.log(`Existing CareerProfiles: ${existingCp.length}\n`)

  const candidates = [
    {
      userId: users[0].id,
      fullName: users[0].username || '用户A',
      headline: '高级全栈工程师，5年Web开发经验',
      bio: '精通 React/Node.js/PostgreSQL，有大型电商平台架构经验',
      email: users[0].email,
      city: '北京',
      careerDirection: '全栈开发',
      industry: '互联网/IT',
      yearsExperience: 5,
      currentLevel: 'senior',
      jobSeekingStatus: 'actively_looking',
      openToOpportunity: true,
      visibility: 'public',
    },
    {
      userId: users[1].id,
      fullName: users[1].username || '用户B',
      headline: '资深AI算法工程师，专注NLP与推荐系统',
      bio: '3年NLP算法经验，发表过2篇顶会论文，有推荐系统实战经验',
      email: users[1].email,
      city: '上海',
      careerDirection: 'AI算法',
      industry: '互联网/IT',
      yearsExperience: 3,
      currentLevel: 'mid',
      jobSeekingStatus: 'open',
      openToOpportunity: true,
      visibility: 'public',
    },
    {
      userId: users[2].id,
      fullName: users[2].username || '用户C',
      headline: '产品经理，专注AI产品与B端SaaS',
      bio: '4年B端产品经理经验，主导过3款SaaS产品从0到1',
      email: users[2].email,
      city: '杭州',
      careerDirection: '产品经理',
      industry: '互联网/IT',
      yearsExperience: 4,
      currentLevel: 'mid',
      jobSeekingStatus: 'actively_looking',
      openToOpportunity: true,
      visibility: 'public',
    },
  ]

  // Filter out users that already have a CareerProfile
  const existingUserIds = new Set(existingCp.map(cp => cp.userId))
  const profilesToCreate = candidates.filter(c => !existingUserIds.has(c.userId))

  let createdProfiles: any[] = [...existingCp]
  for (const cp of profilesToCreate) {
    const created = await prisma.careerProfile.upsert({
      where: { userId: cp.userId },
      create: {
        candidateId: cp.userId, // candidateId = userId for single-tenant mode
        ...cp
      },
      update: {},
    })
    createdProfiles.push(created)
    console.log(`  ✅ Created CareerProfile: ${cp.fullName} (${cp.careerDirection})`)
  }
  console.log(`\nTotal CareerProfiles: ${createdProfiles.length}\n`)

  // ── Step 4: Match CareerProfiles to JobPostings → CandidateMatch ──
  const existingMatches = await prisma.candidateMatch.findMany()
  if (existingMatches.length > 0) {
    console.log(`Existing CandidateMatches: ${existingMatches.length} — purging for clean seed`)
    await prisma.candidateMatch.deleteMany()
  }

  const matchBreakdown = {
    skill: 40,
    experience: 30,
    education: 15,
    career: 15,
  }

  const matchScoreMap: Record<number, [number, string]> = {
    0: [85, '技能匹配度高，工作经验丰富，强烈推荐'],
    1: [72, '算法方向匹配，需要补充产品相关经验'],
    2: [68, '产品思维匹配，技术背景略弱，可培养'],
  }

  // Map each candidate profile to a job posting
  const jobAssignments = [
    { jobIdx: 0, cpIdx: 0, matchIdx: 0 }, // 全栈 → 数据分析师
    { jobIdx: 1, cpIdx: 1, matchIdx: 1 }, // AI算法 → AI应用工程师
    { jobIdx: 2, cpIdx: 2, matchIdx: 2 }, // 产品经理 → 机器学习工程师
  ]

  const matches = []
  for (const assign of jobAssignments) {
    const profile = createdProfiles[assign.cpIdx]
    const job = jobPostings[assign.jobIdx]
    const [score, reason] = matchScoreMap[assign.matchIdx]

    // Check if match already exists to avoid duplicates
    const existingMatch = await prisma.candidateMatch.findFirst({
      where: { jobId: job.id, candidateId: profile.id },
    })
    if (existingMatch) {
      console.log(`  ⏭️  Match exists: ${profile.fullName} → ${job.title} (${existingMatch.matchScore})`)
      matches.push(existingMatch)
      continue
    }

    const match = await prisma.candidateMatch.create({
      data: {
        workspaceId: WORKSPACE_ID,
        jobId: job.id,
        candidateId: profile.id,
        matchScore: score,
        matchBreakdown: matchBreakdown as any,
        status: 'new',
        aiAnalysis: reason,
      },
    })
    matches.push(match)
    console.log(`  ✅ Match: ${profile.fullName} → ${job.title} (score: ${score})`)
  }
  console.log(`\nTotal CandidateMatches: ${matches.length}\n`)

  // ── Step 5: Create RecruitmentPipeline entries ──
  const existingPipelines = await prisma.recruitmentPipeline.findMany()
  if (existingPipelines.length > 0) {
    console.log(`Existing Pipelines: ${existingPipelines.length} — purging`)
    await prisma.recruitmentPipeline.deleteMany()
  }

  const pipelineStages = ['new', 'screening', 'interview', 'decision']
  const pipelines = []
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const profile = createdProfiles[i]
    const job = jobPostings[i]

    const pipeline = await prisma.recruitmentPipeline.create({
      data: {
        workspaceId: WORKSPACE_ID,
        jobId: job.id,
        candidateName: profile.fullName,
        stage: pipelineStages[i],
        screeningScore: match.matchScore,
        interviewCount: i > 0 ? 1 : 0,
        lastActivityAt: new Date(),
        autoCreated: true,
        tags: ['seed', 'e2e-test'],
      },
    })
    pipelines.push(pipeline)
    console.log(`  ✅ Pipeline: ${profile.fullName} @ ${pipelineStages[i]}`)
  }
  console.log(`\nTotal Pipelines: ${pipelines.length}\n`)

  // ── Step 6: Create InterviewSession for the "interview" stage pipeline ──
  const existingSessions = await prisma.interviewSession.findMany()
  if (existingSessions.length > 0) {
    console.log(`Existing InterviewSessions: ${existingSessions.length} — purging`)
    await prisma.interviewSession.deleteMany()
  }

  // Only pipeline[1] is at "interview" stage
  const interviewPipeline = pipelines[1]
  const interviewJob = jobPostings[1]
  const interviewProfile = createdProfiles[1]

  const session = await prisma.interviewSession.create({
    data: {
      workspaceId: WORKSPACE_ID,
      pipelineId: interviewPipeline.id,
      jobId: interviewJob.id,
      candidateName: interviewProfile.fullName,
      title: `初面 - ${interviewProfile.fullName} 应聘 ${interviewJob.title}`,
      status: 'scheduled',
      startedAt: new Date(Date.now() + 86400000), // tomorrow
    },
  })
  console.log(`  ✅ InterviewSession: ${interviewProfile.fullName} → ${interviewJob.title} (${session.id.slice(0, 8)})\n`)

  // ── Summary ──
  console.log('═══════════════════════════════════════')
  console.log('  E2E Seed Complete')
  console.log('═══════════════════════════════════════')
  console.log(`  CareerProfiles:   ${createdProfiles.length}`)
  console.log(`  CandidateMatches: ${matches.length}`)
  console.log(`  Pipelines:        ${pipelines.length}`)
  console.log(`  InterviewSession: ${session ? 1 : 0}`)
  console.log('')
  console.log('  Chain: CareerProfile → CandidateMatch → Pipeline → InterviewSession')
  console.log('  Status: ✅ RECRUITMENT E2E ready for testing')
  console.log('═══════════════════════════════════════\n')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
