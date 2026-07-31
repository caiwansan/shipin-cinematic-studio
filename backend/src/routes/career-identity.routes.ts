// ─── Sprint-10C: Career Identity Profile — Chat Route (Fastify) ───
import { FastifyInstance } from 'fastify'
import { processUserInput } from '../services/career-identity/identity-service.js'
import { generateResumeCard, formatResumeCard } from '../services/career-identity/resume-card-generator.js'
import { getOrCreateProfile } from '../services/career-identity/profile-repo.js'

const chatHistory = new Map<string, Array<{ role: string; content: string }>>()

export default async function careerIdentityRoutes(app: FastifyInstance) {
  /**
   * POST /api/career-identity/chat
   * 用户对话 → Extract → Merge → Save → Context → LLM → Reply
   */
  app.post('/api/career-identity/chat', async (req, reply) => {
    try {
      const body = req.body as any
      const userId = body?.userId
      const message = body?.message
      const reset = body?.reset

      if (!userId || !message) {
        return reply.status(400).send({ error: 'userId and message required' })
      }

      if (reset) {
        chatHistory.delete(userId)
      }

      const history = chatHistory.get(userId) || []
      const result = await processUserInput(userId, message, history)

      history.push({ role: 'user', content: message })
      history.push({ role: 'assistant', content: result.reply })
      chatHistory.set(userId, history.length > 40 ? history.slice(-40) : history)

      let resumeCard = null
      if (result.questionPlan.action === 'resume' && result.profile.completionScore >= 80) {
        const card = generateResumeCard(result.profile)
        resumeCard = formatResumeCard(card)
      }

      return reply.send({
        reply: result.reply,
        profile: {
          status: result.profile.status,
          completionScore: result.profile.completionScore,
          missingFields: result.profile.missingFields,
          confirmedFacts: result.profile.confirmedFacts.length,
        },
        resumeCard,
        identity: {
          name: result.profile.identity.name,
          career: result.profile.career.careerDirection,
          experience: result.profile.career.yearsExperience,
          skills: result.profile.skills.map(s => s.name),
          city: result.profile.location.currentCity,
        },
      })
    } catch (err: any) {
      console.error('[CareerIdentity] Error:', err.message)
      return reply.status(500).send({ error: err.message })
    }
  })

  /**
   * GET /api/career-identity/profile/:userId
   * 获取用户的职业画像
   */
  app.get('/api/career-identity/profile/:userId', async (req, reply) => {
    try {
      const params = req.params as any
      const profile = await getOrCreateProfile(params.userId)
      return reply.send({
        status: profile.status,
        completionScore: profile.completionScore,
        missingFields: profile.missingFields,
        confirmedFacts: profile.confirmedFacts,
        identity: profile.identity,
        location: profile.location,
        education: profile.education,
        career: profile.career,
        skills: profile.skills,
        workExperience: profile.workExperience,
      })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  /**
   * GET /api/career-identity/resume/:userId
   * 获取简历卡
   */
  app.get('/api/career-identity/resume/:userId', async (req, reply) => {
    try {
      const params = req.params as any
      const profile = await getOrCreateProfile(params.userId)

      if (profile.completionScore < 80) {
        return reply.send({ ready: false, completionScore: profile.completionScore })
      }

      const card = generateResumeCard(profile)
      return reply.send({ ready: true, card, formatted: formatResumeCard(card) })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })
}
