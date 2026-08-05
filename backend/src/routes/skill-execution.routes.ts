/**
 * S3.2.3 Skill Execution API — 首次真执行（受控）
 * - POST /api/skills/:id/execution/prepare  执行意图（只生成，不执行；SE1/SE2 拦截点）
 * - POST /api/skills/:id/execute            完整链路: 授权 → Hermes Policy → Sub-Agent → Result → Audit
 * 原则:
 *  - 拒绝路径（未授权/越权）在 Hermes 之前拦截（SE2）
 *  - Hermes 调用仅发生在本 routes 编排层；adapter 零执行
 *  - 仅 mock 工具可执行（resume.parse/profile.extract/mock-calc），无真实业务
 */
import type { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { prepareSkillExecution } from '../ecosystem/skill-execution-adapter.js'

const HERMES_SKILL_RUNTIME_URL = process.env.HERMES_SKILL_RUNTIME_URL || 'http://127.0.0.1:9457'

export async function registerSkillExecutionRoutes(app: FastifyInstance) {
  // 执行意图（只读生成，不执行）— SE1/SE2
  app.post('/api/skills/:id/execution/prepare', async (request: any, reply: any) => {
    try {
      const body = request.body || {}
      const intent = await prepareSkillExecution({
        skillId: request.params.id,
        agentDefinitionId: body.agentDefinitionId ?? null,
      })
      if (!intent) return reply.code(404).send({ error: 'SKILL_NOT_FOUND' })
      if (!intent.allowed) {
        return reply.code(403).send({ code: 403, error: 'SKILL_NOT_AUTHORIZED', reason: intent.reason, authorizationState: intent.authorizationState })
      }
      return reply.send({ code: 0, data: intent })
    } catch (e: any) {
      request.log.error(e, 'skill execution prepare failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })

  // 首次真执行（受控 mock 链路）
  app.post('/api/skills/:id/execute', async (request: any, reply: any) => {
    try {
      const body = request.body || {}
      const intent = await prepareSkillExecution({
        skillId: request.params.id,
        agentDefinitionId: body.agentDefinitionId ?? null,
      })
      if (!intent) return reply.code(404).send({ error: 'SKILL_NOT_FOUND' })
      // SE2: 未授权/越权 → Hermes 前拦截
      if (!intent.allowed || !intent.runtimePolicy) {
        return reply.code(403).send({ code: 403, error: 'SKILL_NOT_AUTHORIZED', reason: intent.reason, authorizationState: intent.authorizationState })
      }

      // 编排 Hermes（唯一 Hermes 调用点）: 授权 → Policy → Sub-Agent → Tool → Result → Audit
      const invocation = {
        invocationId: 'inv-' + randomUUID().slice(0, 8),
        skillId: request.params.id,
        agentDefinitionId: body.agentDefinitionId ?? null,
        tool: body.tool ?? null,
        input: body.input ?? {},
        policy: intent.runtimePolicy,
      }
      const hermesRes = await fetch(`${HERMES_SKILL_RUNTIME_URL}/invocations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invocation),
      }).catch((e: any) => {
        request.log.error(e, 'hermes invoke failed')
        return null
      })
      if (!hermesRes) {
        return reply.code(502).send({ code: 502, error: 'HERMES_UNREACHABLE' })
      }
      const hermes = await hermesRes.json().catch(() => ({}))
      if (hermes.status === 'POLICY_REJECTED') {
        return reply.send({ code: 0, data: { status: 'POLICY_REJECTED', executionId: hermes.executionId, tool: hermes.tool, reason: hermes.reason } })
      }
      return reply.send({
        code: 0,
        data: {
          status: hermes.status,
          executionId: hermes.executionId,
          runtimeId: hermes.runtimeId,
          skillId: request.params.id,
          subAgentStates: hermes.subAgentStates,
          toolCalls: hermes.toolCalls,
          result: hermes.result,
        },
      })
    } catch (e: any) {
      request.log.error(e, 'skill execute failed')
      return reply.code(500).send({ error: 'INTERNAL' })
    }
  })
}
