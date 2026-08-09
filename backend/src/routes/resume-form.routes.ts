/**
 * resume-form.routes.ts — 在线简历表单 API
 *
 * POST /api/job/resumes/from-form — 从结构化表单创建简历
 *   1. 创建/更新 CareerProfile
 *   2. 创建 WorkExperience / Education / CandidateSkill
 *   3. 创建 CandidateResume（contentJson）
 *   4. 设置 visibility = public（提交到人才市场）
 */

import type { FastifyInstance } from 'fastify'
import { prisma } from '../utils/index.js'

// ─── 类型 ───

interface ResumeFormBody {
  // 基本信息
  fullName: string
  email?: string
  phone?: string
  city?: string
  headline?: string
  bio?: string
  careerDirection?: string
  industry?: string
  yearsExperience?: number
  currentLevel?: string
  // 期望
  careerGoal?: string
  expectedSalaryMin?: number
  expectedSalaryMax?: number
  // 结构化数据
  educations?: Array<{
    school: string
    degree?: string
    major?: string
    startDate?: string
    endDate?: string
    gpa?: string
    description?: string
  }>
  experiences?: Array<{
    company: string
    title: string
    department?: string
    startDate: string
    endDate?: string
    isCurrent?: boolean
    location?: string
    description?: string
    achievements?: string[]
  }>
  skills?: string[]
  // 简历名称
  resumeName?: string
}

// ─── 安全日期解析 ───
const parseDate = (d: string | undefined | null): Date | null => {
  if (!d || typeof d !== 'string') return null
  const trimmed = d.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  return isNaN(parsed.getTime()) ? null : parsed
}

// ─── 路由 ───

export async function resumeFormRoutes(fastify: FastifyInstance) {

  // ─── POST /api/job/resumes/from-form — 从表单创建简历 ───
  fastify.post('/api/job/resumes/from-form', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      if (!userId) {
        return reply.status(401).send({ error: 'UNAUTHORIZED', message: '请先登录' })
      }

      const body = request.body as ResumeFormBody
      if (!body.fullName) {
        return reply.status(400).send({ error: 'MISSING_NAME', message: '请填写姓名' })
      }

      // ── 事务：创建/更新档案 + 子记录 + 简历 ──
      const result = await prisma.$transaction(async (tx) => {
        // 1. 查找或创建 CareerProfile
        let profile = await tx.careerProfile.findUnique({ where: { userId } })

        if (!profile) {
          const { randomUUID } = await import('crypto')
          profile = await tx.careerProfile.create({
            data: {
              id: randomUUID(),
              candidateId: randomUUID(),
              userId,
              fullName: body.fullName,
              email: body.email || null,
              phone: body.phone || null,
              city: body.city || null,
              headline: body.headline || null,
              bio: body.bio || null,
              careerDirection: body.careerDirection || null,
              industry: body.industry || null,
              yearsExperience: body.yearsExperience || 0,
              currentLevel: body.currentLevel || null,
              visibility: 'public',
              jobSeekingStatus: 'actively_looking',
              openToOpportunity: true,
            },
          })
        } else {
          // 更新已有档案
          profile = await tx.careerProfile.update({
            where: { id: profile.id },
            data: {
              fullName: body.fullName,
              ...(body.email !== undefined ? { email: body.email } : {}),
              ...(body.phone !== undefined ? { phone: body.phone } : {}),
              ...(body.city !== undefined ? { city: body.city } : {}),
              ...(body.headline !== undefined ? { headline: body.headline } : {}),
              ...(body.bio !== undefined ? { bio: body.bio } : {}),
              ...(body.careerDirection !== undefined ? { careerDirection: body.careerDirection } : {}),
              ...(body.industry !== undefined ? { industry: body.industry } : {}),
              ...(body.yearsExperience !== undefined ? { yearsExperience: body.yearsExperience } : {}),
              ...(body.currentLevel !== undefined ? { currentLevel: body.currentLevel } : {}),
              visibility: 'public',
              jobSeekingStatus: 'actively_looking',
              openToOpportunity: true,
            },
          })
        }

        const profileId = profile.id

        // 2. 创建教育经历
        if (body.educations && body.educations.length > 0) {
          // 先删除旧的（表单全量提交）
          await tx.education.deleteMany({ where: { profileId } })
          for (const edu of body.educations) {
            if (!edu.school) continue
            await tx.education.create({
              data: {
                profileId,
                school: edu.school,
                degree: edu.degree || null,
                major: edu.major || null,
                startDate: parseDate(edu.startDate),
                endDate: parseDate(edu.endDate),
                gpa: edu.gpa ? parseFloat(edu.gpa) : null,
                description: edu.description || null,
              },
            })
          }
        }

        // 3. 创建工作经历
        if (body.experiences && body.experiences.length > 0) {
          await tx.workExperience.deleteMany({ where: { profileId } })
          for (const exp of body.experiences) {
            if (!exp.company || !exp.title || !exp.startDate) continue
            const parsedStartDate = parseDate(exp.startDate)
            if (!parsedStartDate) continue
            await tx.workExperience.create({
              data: {
                profileId,
                company: exp.company,
                title: exp.title,
                department: exp.department || null,
                startDate: parsedStartDate,
                endDate: parseDate(exp.endDate),
                isCurrent: exp.isCurrent || false,
                location: exp.location || null,
                description: exp.description || null,
                achievements: exp.achievements || [],
              },
            })
          }
        }

        // 4. 创建技能
        if (body.skills && body.skills.length > 0) {
          // 删除旧的 candidate_skill 关联
          await tx.candidateSkill.deleteMany({ where: { profileId } })
          for (const skillName of body.skills) {
            if (!skillName.trim()) continue
            // 查找或创建 skill 词表
            let skill = await tx.skill.findFirst({
              where: { name: { equals: skillName.trim(), mode: 'insensitive' } },
            })
            if (!skill) {
              skill = await tx.skill.create({
                data: { name: skillName.trim(), category: 'technical' },
              })
            }
            await tx.candidateSkill.create({
              data: {
                profileId,
                skillId: skill.id,
                level: 'intermediate',
                confidence: 0.9,
                source: 'user',
              },
            })
          }
        }

        // 5. 创建 CandidateResume
        const contentJson = {
          fullName: body.fullName,
          email: body.email || null,
          phone: body.phone || null,
          city: body.city || null,
          headline: body.headline || null,
          bio: body.bio || null,
          careerDirection: body.careerDirection || null,
          industry: body.industry || null,
          yearsExperience: body.yearsExperience || 0,
          currentLevel: body.currentLevel || null,
          careerGoal: body.careerGoal || null,
          expectedSalaryMin: body.expectedSalaryMin || null,
          expectedSalaryMax: body.expectedSalaryMax || null,
          educations: body.educations || [],
          experiences: body.experiences || [],
          skills: body.skills || [],
        }

        const resume = await tx.candidateResume.create({
          data: {
            profileId,
            name: body.resumeName || `${body.fullName}的简历`,
            language: 'zh',
            targetRole: body.careerDirection || body.careerGoal || null,
            contentJson,
            generatedBy: 'user',
            isDefault: true,
          },
        })

        // 6. 计算完成度
        let completionScore = 0
        if (body.fullName) completionScore += 15
        if (body.email || body.phone) completionScore += 10
        if (body.city) completionScore += 10
        if (body.educations && body.educations.length > 0) completionScore += 20
        if (body.experiences && body.experiences.length > 0) completionScore += 25
        if (body.skills && body.skills.length > 0) completionScore += 10
        if (body.careerGoal) completionScore += 10

        await tx.careerProfile.update({
          where: { id: profileId },
          data: { completionScore: Math.min(completionScore, 100) },
        })

        return { profile, resume, completionScore: Math.min(completionScore, 100) }
      })

      return reply.status(201).send({
        success: true,
        message: '简历已创建并提交到人才市场',
        profileId: result.profile.id,
        resumeId: result.resume.id,
        completionScore: result.completionScore,
      })
    } catch (error: any) {
      request.log.error(`[resume-form] error: ${error.message}`)
      return reply.status(500).send({ error: '创建简历失败', message: error.message })
    }
  })

  // ─── GET /api/job/resumes/from-form — 获取当前用户简历表单数据（用于编辑）───
  fastify.get('/api/job/resumes/from-form', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    try {
      const userId = (request as any).user?.id || (request as any).userId
      if (!userId) {
        return reply.status(401).send({ error: 'UNAUTHORIZED' })
      }

      const profile = await prisma.careerProfile.findUnique({
        where: { userId },
        include: {
          educations: true,
          workExperiences: true,
          skills: { include: { skill: true } },
          resumes: {
            where: { status: 'active' },
            orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
            take: 1,
          },
        },
      })

      if (!profile) {
        return { hasProfile: false, data: null }
      }

      return {
        hasProfile: true,
        data: {
          fullName: profile.fullName,
          email: profile.email || '',
          phone: profile.phone || '',
          city: profile.city || '',
          headline: profile.headline || '',
          bio: profile.bio || '',
          careerDirection: profile.careerDirection || '',
          industry: profile.industry || '',
          yearsExperience: profile.yearsExperience || 0,
          currentLevel: profile.currentLevel || '',
          careerGoal: profile.bio || '',
          expectedSalaryMin: 0,
          expectedSalaryMax: 0,
          educations: profile.educations.map(e => ({
            school: e.school,
            degree: e.degree || '',
            major: e.major || '',
            startDate: e.startDate?.toISOString().slice(0, 10) || '',
            endDate: e.endDate?.toISOString().slice(0, 10) || '',
            gpa: e.gpa || '',
            description: e.description || '',
          })),
          experiences: profile.workExperiences.map(w => ({
            company: w.company,
            title: w.title,
            department: w.department || '',
            startDate: w.startDate?.toISOString().slice(0, 10) || '',
            endDate: w.endDate?.toISOString().slice(0, 10) || '',
            isCurrent: w.isCurrent || false,
            location: w.location || '',
            description: w.description || '',
            achievements: w.achievements || [],
          })),
          skills: profile.skills.map(s => s.skill?.name).filter(Boolean),
        },
      }
    } catch (error: any) {
      request.log.error(`[resume-form] get error: ${error.message}`)
      return reply.status(500).send({ error: '获取简历数据失败', message: error.message })
    }
  })
}
