/**
 * S3.4.1-BLOCKED Task 01 — 内部 Skill 工具路由（Hermes 工具后端）
 * POST /api/internal/skill-tools/resume-parse
 *   真实简历解析: filePath/text → pdf-text-extractor → ResumeParserAgent（确定性正则, 零 LLM）
 * 鉴权: x-internal-token（env KUNLUN_INTERNAL_TOKEN, .env 不入 git）
 * 禁止: 本模块零 LLM 引用（RP4）
 */
import type { FastifyInstance } from 'fastify'

function checkToken(request: any): boolean {
  const token = process.env.KUNLUN_INTERNAL_TOKEN
  if (!token) return false // fail closed
  return request.headers['x-internal-token'] === token
}

export async function registerSkillToolsInternalRoutes(app: FastifyInstance) {
  // 真实简历解析（确定性, 无 LLM）— Hermes resume.parse 工具后端
  app.post('/api/internal/skill-tools/resume-parse', async (request: any, reply: any) => {
    try {
      if (!checkToken(request)) {
        return reply.code(401).send({ error: 'UNAUTHORIZED' })
      }
      const body = request.body || {}
      const { text, filePath } = body
      if (!text && !filePath) {
        return reply.code(400).send({ error: 'TEXT_OR_FILE_REQUIRED' })
      }

      let sourceText: string
      if (text) {
        sourceText = text
      } else {
        const { extractTextFromPdfFile } = await import('../services/pdf-text-extractor.js')
        const extracted = await extractTextFromPdfFile(filePath)
        sourceText = extracted.text
        if (!sourceText) {
          return reply.code(422).send({ error: 'PDF_TEXT_EMPTY', message: 'PDF 未提取到文本' })
        }
      }

      const { ResumeParserAgent } = await import('../agents/job/resume-parser-agent.js')
      const agent = new ResumeParserAgent()
      const profile = agent.parseResume({ text: sourceText, fileName: filePath || undefined })
      const quality = agent.evaluateQuality(profile)

      return reply.send({ code: 0, data: { profile, quality, source: 'real', llmInvolved: false } })
    } catch (e: any) {
      request.log.error(e, 'internal resume-parse failed')
      return reply.code(500).send({ error: 'INTERNAL', message: e.message })
    }
  })

  // S3.4.2-B: 真实候选评分（Skill LLM Tool, 经 Unified AI Gateway — CS2）
  // 输入: { resumeProfile, jobRequirement } → DeepSeek 评分 → Schema 校验（CS3）
  app.post('/api/internal/skill-tools/candidate-score', async (request: any, reply: any) => {
    try {
      if (!checkToken(request)) {
        return reply.code(401).send({ error: 'UNAUTHORIZED' })
      }
      const body = request.body || {}
      if (!body.resumeProfile) {
        return reply.code(400).send({ error: 'RESUME_PROFILE_REQUIRED' })
      }
      const { buildScorePrompt, parseScoreResult } = await import('../ecosystem/score-parser.js')
      const { unifiedAIGateway } = await import('../services/unified-ai-gateway.js')
      let prompt = buildScorePrompt({ resumeProfile: body.resumeProfile, jobRequirement: body.jobRequirement })
      // S5.3: 插件增强注入（企业授权 EcologyLicense + manifest.enhancements; 无授权 → 基础执行, 不拒绝）
      if (body.tenantUserId) {
        const { getOrgEnhancementsForSkills, applyEnhancements } = await import('../ecosystem/plugin-enhancement.js')
        const { getOrganizationIdForUser } = await import('../services/enterprise/organization/identity-bootstrap.service.js')
        const orgId = await getOrganizationIdForUser(String(body.tenantUserId)).catch(() => null)
        if (orgId) {
          const enhs = await getOrgEnhancementsForSkills(String(orgId), ['candidate.score']).catch(() => [])
          if (enhs.length) prompt = applyEnhancements(prompt, enhs)
        }
      }
      // dev 模式工具调用身份（合成 UUID, 无用户配置 → dev provider）; S4 起解析调用方 BYOK
      const result = await unifiedAIGateway.invokeAI({
        // S4.1: 租户身份透传（body.tenantUserId）→ 组织 BYOK 凭证; 缺省 dev 身份
        userId: body.tenantUserId || '00000000-0000-4000-8000-0000000000ad',
        projectId: '00000000-0000-4000-8000-000000000001',
        agentType: 'orchestrator' as any,
        capability: 'llm',
        input: { messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ] },
      }).catch((e: any) => ({ status: 'error' as const, error: e.message, output: null }))
      if (result.status !== 'success' || !result.output?.text) {
        return reply.send({ code: 0, data: { error: 'SCORE_LLM_FAILED', message: result.error || 'NO_OUTPUT' } })
      }
      const parsed = parseScoreResult(result.output.text)
      if (!parsed) {
        // CS3: LLM 输出非法 → 拒绝, 不当最终结果
        return reply.send({ code: 0, data: { error: 'INVALID_TOOL_RESULT' } })
      }
      return reply.send({ code: 0, data: { ...parsed, source: 'real', llmInvolved: true } })
    } catch (e: any) {
      request.log.error(e, 'internal candidate-score failed')
      return reply.code(500).send({ error: 'INTERNAL', message: e.message })
    }
  })

  // S5.1: 短剧导演 3 Skill（Skill LLM Tool, 经 Unified AI Gateway; 禁 narrativeGateway 直连）
  // SD-01 script.analysis: { scriptText } → { summary, characters, structure }
  app.post('/api/internal/skill-tools/script-analysis', async (request: any, reply: any) => {
    try {
      if (!checkToken(request)) {
        return reply.code(401).send({ error: 'UNAUTHORIZED' })
      }
      const body = request.body || {}
      if (!body.scriptText) {
        return reply.code(400).send({ error: 'SCRIPT_TEXT_REQUIRED' })
      }
      const { buildScriptAnalysisPrompt, parseScriptAnalysisResult } = await import('../ecosystem/shortdrama-parser.js')
      const { unifiedAIGateway } = await import('../services/unified-ai-gateway.js')
      const prompt = buildScriptAnalysisPrompt({ scriptText: String(body.scriptText) })
      const result = await unifiedAIGateway.invokeAI({
        userId: body.tenantUserId || '00000000-0000-4000-8000-0000000000ad',
        projectId: '00000000-0000-4000-8000-000000000001',
        agentType: 'orchestrator' as any,
        capability: 'llm',
        input: { messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ] },
      }).catch((e: any) => ({ status: 'error' as const, error: e.message, output: null }))
      if (result.status !== 'success' || !result.output?.text) {
        return reply.send({ code: 0, data: { error: 'SCRIPT_ANALYSIS_LLM_FAILED', message: result.error || 'NO_OUTPUT' } })
      }
      const parsed = parseScriptAnalysisResult(result.output.text)
      if (!parsed) {
        return reply.send({ code: 0, data: { error: 'INVALID_TOOL_RESULT' } })
      }
      return reply.send({ code: 0, data: { ...parsed, source: 'real', llmInvolved: true } })
    } catch (e: any) {
      request.log.error(e, 'internal script-analysis failed')
      return reply.code(500).send({ error: 'INTERNAL', message: e.message })
    }
  })

  // SD-02 storyboard.plan: { sceneText, shots? } → { shots, summary }（shots 数量限制）
  app.post('/api/internal/skill-tools/storyboard-plan', async (request: any, reply: any) => {
    try {
      if (!checkToken(request)) {
        return reply.code(401).send({ error: 'UNAUTHORIZED' })
      }
      const body = request.body || {}
      if (!body.sceneText) {
        return reply.code(400).send({ error: 'SCENE_TEXT_REQUIRED' })
      }
      const { buildStoryboardPrompt, parseStoryboardResult } = await import('../ecosystem/shortdrama-parser.js')
      const { unifiedAIGateway } = await import('../services/unified-ai-gateway.js')
      const prompt = buildStoryboardPrompt({ sceneText: String(body.sceneText), shots: body.shots })
      const result = await unifiedAIGateway.invokeAI({
        userId: body.tenantUserId || '00000000-0000-4000-8000-0000000000ad',
        projectId: '00000000-0000-4000-8000-000000000001',
        agentType: 'orchestrator' as any,
        capability: 'llm',
        input: { messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ] },
      }).catch((e: any) => ({ status: 'error' as const, error: e.message, output: null }))
      if (result.status !== 'success' || !result.output?.text) {
        return reply.send({ code: 0, data: { error: 'STORYBOARD_LLM_FAILED', message: result.error || 'NO_OUTPUT' } })
      }
      const parsed = parseStoryboardResult(result.output.text)
      if (!parsed) {
        return reply.send({ code: 0, data: { error: 'INVALID_TOOL_RESULT' } })
      }
      return reply.send({ code: 0, data: { ...parsed, source: 'real', llmInvolved: true } })
    } catch (e: any) {
      request.log.error(e, 'internal storyboard-plan failed')
      return reply.code(500).send({ error: 'INTERNAL', message: e.message })
    }
  })

  // SD-03 prompt.optimize: { shotDescription, style? } → { prompt, keywords, negativePrompt }
  app.post('/api/internal/skill-tools/prompt-optimize', async (request: any, reply: any) => {
    try {
      if (!checkToken(request)) {
        return reply.code(401).send({ error: 'UNAUTHORIZED' })
      }
      const body = request.body || {}
      if (!body.shotDescription) {
        return reply.code(400).send({ error: 'SHOT_DESCRIPTION_REQUIRED' })
      }
      const { buildPromptOptimizePrompt, parsePromptOptimizeResult } = await import('../ecosystem/shortdrama-parser.js')
      const { unifiedAIGateway } = await import('../services/unified-ai-gateway.js')
      const prompt = buildPromptOptimizePrompt({ shotDescription: String(body.shotDescription), style: body.style, model: body.model })
      const result = await unifiedAIGateway.invokeAI({
        userId: body.tenantUserId || '00000000-0000-4000-8000-0000000000ad',
        projectId: '00000000-0000-4000-8000-000000000001',
        agentType: 'orchestrator' as any,
        capability: 'llm',
        input: { messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ] },
      }).catch((e: any) => ({ status: 'error' as const, error: e.message, output: null }))
      if (result.status !== 'success' || !result.output?.text) {
        return reply.send({ code: 0, data: { error: 'PROMPT_OPTIMIZE_LLM_FAILED', message: result.error || 'NO_OUTPUT' } })
      }
      const parsed = parsePromptOptimizeResult(result.output.text)
      if (!parsed) {
        return reply.send({ code: 0, data: { error: 'INVALID_TOOL_RESULT' } })
      }
      return reply.send({ code: 0, data: { ...parsed, source: 'real', llmInvolved: true } })
    } catch (e: any) {
      request.log.error(e, 'internal prompt-optimize failed')
      return reply.code(500).send({ error: 'INTERNAL', message: e.message })
    }
  })

  // S3.4.2-C: 真实面试评估（Skill LLM Tool, 经 Unified AI Gateway）
  // 输入: { resume, interviewTranscript, jobRequirement } → DeepSeek → Schema 校验（IE2/IE3）
  app.post('/api/internal/skill-tools/interview-evaluate', async (request: any, reply: any) => {
    try {
      if (!checkToken(request)) {
        return reply.code(401).send({ error: 'UNAUTHORIZED' })
      }
      const body = request.body || {}
      if (!body.interviewTranscript && !body.interviewRecord) {
        return reply.code(400).send({ error: 'INTERVIEW_TRANSCRIPT_REQUIRED' })
      }
      const { buildInterviewPrompt, parseInterviewResult, buildInterviewTranscript } = await import('../ecosystem/interview-parser.js')
      const { unifiedAIGateway } = await import('../services/unified-ai-gateway.js')
      // S4.2 D-F: 结构化面试记录 → 文本（人工录入/文件转换; 禁自动联系/三方/爬取）
      const transcript = body.interviewTranscript || buildInterviewTranscript(body.interviewRecord)
      const prompt = buildInterviewPrompt({
        resume: body.resume,
        interviewTranscript: transcript,
        jobRequirement: body.jobRequirement,
      })
      const result = await unifiedAIGateway.invokeAI({
        // S4.1: 租户身份透传（body.tenantUserId）→ 组织 BYOK 凭证; 缺省 dev 身份
        userId: body.tenantUserId || '00000000-0000-4000-8000-0000000000ad',
        projectId: '00000000-0000-4000-8000-000000000001',
        agentType: 'orchestrator' as any,
        capability: 'llm',
        input: { messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ] },
      }).catch((e: any) => ({ status: 'error' as const, error: e.message, output: null }))
      if (result.status !== 'success' || !result.output?.text) {
        return reply.send({ code: 0, data: { error: 'INTERVIEW_LLM_FAILED', message: result.error || 'NO_OUTPUT' } })
      }
      const parsed = parseInterviewResult(result.output.text)
      if (!parsed) {
        return reply.send({ code: 0, data: { error: 'INVALID_TOOL_RESULT' } })
      }
      return reply.send({ code: 0, data: { ...parsed, source: 'real', llmInvolved: true } })
    } catch (e: any) {
      request.log.error(e, 'internal interview-evaluate failed')
      return reply.code(500).send({ error: 'INTERNAL', message: e.message })
    }
  })

  // S5.2: 新媒体运营 3 Skill（Skill LLM Tool, 经 Unified AI Gateway; 禁浏览器自动化/平台 API/narrativeGateway）
  // NM-01 content.strategy: { brand, topic?, goal? } → { strategy, contentPillars, schedule(≤10) }
  app.post('/api/internal/skill-tools/content-strategy', async (request: any, reply: any) => {
    try {
      if (!checkToken(request)) {
        return reply.code(401).send({ error: 'UNAUTHORIZED' })
      }
      const body = request.body || {}
      if (!body.brand) {
        return reply.code(400).send({ error: 'BRAND_REQUIRED' })
      }
      const { buildContentStrategyPrompt, parseContentStrategyResult } = await import('../ecosystem/newmedia-parser.js')
      const { unifiedAIGateway } = await import('../services/unified-ai-gateway.js')
      const prompt = buildContentStrategyPrompt({ brand: String(body.brand), topic: body.topic, goal: body.goal })
      const result = await unifiedAIGateway.invokeAI({
        userId: body.tenantUserId || '00000000-0000-4000-8000-0000000000ad',
        projectId: '00000000-0000-4000-8000-000000000001',
        agentType: 'orchestrator' as any,
        capability: 'llm',
        input: { messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ] },
      }).catch((e: any) => ({ status: 'error' as const, error: e.message, output: null }))
      if (result.status !== 'success' || !result.output?.text) {
        return reply.send({ code: 0, data: { error: 'CONTENT_STRATEGY_LLM_FAILED', message: result.error || 'NO_OUTPUT' } })
      }
      const parsed = parseContentStrategyResult(result.output.text)
      if (!parsed) {
        return reply.send({ code: 0, data: { error: 'INVALID_TOOL_RESULT' } })
      }
      return reply.send({ code: 0, data: { ...parsed, source: 'real', llmInvolved: true } })
    } catch (e: any) {
      request.log.error(e, 'internal content-strategy failed')
      return reply.code(500).send({ error: 'INTERNAL', message: e.message })
    }
  })

  // NM-02 content.draft: { topic, tone?, format?, length? } → { title, body(≤1200), tags, cta }
  app.post('/api/internal/skill-tools/content-draft', async (request: any, reply: any) => {
    try {
      if (!checkToken(request)) {
        return reply.code(401).send({ error: 'UNAUTHORIZED' })
      }
      const body = request.body || {}
      if (!body.topic) {
        return reply.code(400).send({ error: 'TOPIC_REQUIRED' })
      }
      const { buildContentDraftPrompt, parseContentDraftResult } = await import('../ecosystem/newmedia-parser.js')
      const { unifiedAIGateway } = await import('../services/unified-ai-gateway.js')
      const prompt = buildContentDraftPrompt({ topic: String(body.topic), tone: body.tone, format: body.format, length: body.length })
      const result = await unifiedAIGateway.invokeAI({
        userId: body.tenantUserId || '00000000-0000-4000-8000-0000000000ad',
        projectId: '00000000-0000-4000-8000-000000000001',
        agentType: 'orchestrator' as any,
        capability: 'llm',
        input: { messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ] },
      }).catch((e: any) => ({ status: 'error' as const, error: e.message, output: null }))
      if (result.status !== 'success' || !result.output?.text) {
        return reply.send({ code: 0, data: { error: 'CONTENT_DRAFT_LLM_FAILED', message: result.error || 'NO_OUTPUT' } })
      }
      const parsed = parseContentDraftResult(result.output.text)
      if (!parsed) {
        return reply.send({ code: 0, data: { error: 'INVALID_TOOL_RESULT' } })
      }
      return reply.send({ code: 0, data: { ...parsed, source: 'real', llmInvolved: true } })
    } catch (e: any) {
      request.log.error(e, 'internal content-draft failed')
      return reply.code(500).send({ error: 'INTERNAL', message: e.message })
    }
  })

  // NM-03 ops.analysis: { operationDataText, question? } → { insights, recommendations, risks }（纯分析, 零平台触达）
  app.post('/api/internal/skill-tools/ops-analysis', async (request: any, reply: any) => {
    try {
      if (!checkToken(request)) {
        return reply.code(401).send({ error: 'UNAUTHORIZED' })
      }
      const body = request.body || {}
      if (!body.operationDataText) {
        return reply.code(400).send({ error: 'OPERATION_DATA_REQUIRED' })
      }
      const { buildOpsAnalysisPrompt, parseOpsAnalysisResult } = await import('../ecosystem/newmedia-parser.js')
      const { unifiedAIGateway } = await import('../services/unified-ai-gateway.js')
      const prompt = buildOpsAnalysisPrompt({ operationDataText: String(body.operationDataText), question: body.question })
      const result = await unifiedAIGateway.invokeAI({
        userId: body.tenantUserId || '00000000-0000-4000-8000-0000000000ad',
        projectId: '00000000-0000-4000-8000-000000000001',
        agentType: 'orchestrator' as any,
        capability: 'llm',
        input: { messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ] },
      }).catch((e: any) => ({ status: 'error' as const, error: e.message, output: null }))
      if (result.status !== 'success' || !result.output?.text) {
        return reply.send({ code: 0, data: { error: 'OPS_ANALYSIS_LLM_FAILED', message: result.error || 'NO_OUTPUT' } })
      }
      const parsed = parseOpsAnalysisResult(result.output.text)
      if (!parsed) {
        return reply.send({ code: 0, data: { error: 'INVALID_TOOL_RESULT' } })
      }
      return reply.send({ code: 0, data: { ...parsed, source: 'real', llmInvolved: true } })
    } catch (e: any) {
      request.log.error(e, 'internal ops-analysis failed')
      return reply.code(500).send({ error: 'INTERNAL', message: e.message })
    }
  })
}
