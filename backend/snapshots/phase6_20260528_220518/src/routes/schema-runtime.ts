import type { ApiResponse } from '../contracts/api/base.js';
// ⭐ Phase A 观测 API：不碰任何现有逻辑，只做 shadow observe

import { FastifyInstance } from 'fastify'
import { normalizeFields, collectNormalizeStats, validateAgentOutput, batchShadowValidate, getDriftSummary } from '../schema-runtime/index.js'
import { AGENT_SCHEMAS, FIELD_MAP } from '../schema-runtime/registry.js'

export default async function schemaRuntimeRoutes(fastify: FastifyInstance) {
  // GET /api/schema-runtime/schemas — 获取当前所有 schema 定义
  fastify.get('/api/schema-runtime/schemas', async (_request, _reply) => {
    const summary = Object.entries(AGENT_SCHEMAS).map(([name, schema]) => ({
      name,
      type: schema.type,
      fields: schema.fields ? Object.keys(schema.fields) : undefined,
      itemSchema: schema.itemSchema ? Object.keys(schema.itemSchema) : undefined,
    }))

    return {
      schemaVersion: '1.0',
      fieldMapKeys: Object.keys(FIELD_MAP),
      fieldMap: Object.fromEntries(
        Object.entries(FIELD_MAP).map(([k, v]) => [k, { canonical: v.canonical, aliases: v.alias }])
      ),
      agentSchemas: summary,
    }
  })

  // POST /api/schema-runtime/validate — 验证任意 JSON 数据
  fastify.post('/api/schema-runtime/validate', async (request, _reply) => {
    const { schemaName, data } = request.body as any

    if (!schemaName || !data) {
      return { success: false, error: 'need schemaName and data' } satisfies ApiResponse<unknown>;

    }

    if (!AGENT_SCHEMAS[schemaName]) {
      return { success: false, error: `unknown schema: ${schemaName}` } satisfies ApiResponse<unknown>;

    }

    // normalizer 先
    const normalized = normalizeFields(data)
    const stats = collectNormalizeStats(data, normalized)

    // validator 后
    const validation = validateAgentOutput(schemaName, normalized)

    return {
      success: validation.valid,
      schemaName,
      normalizeStats: stats,
      validation: {
        valid: validation.valid,
        errors: validation.errors,
      },
      normalizedPreview: JSON.stringify(normalized).slice(0, 500),
      originalPreview: JSON.stringify(data).slice(0, 500),
    }
  })

  // POST /api/schema-runtime/batch-validate — 批量验证
  fastify.post('/api/schema-runtime/batch-validate', async (request, _reply) => {
    const { items } = request.body as any
    // items: [{ schemaName, data, label? }]

    if (!Array.isArray(items)) {
      return { success: false, error: 'items must be array' } satisfies ApiResponse<unknown>;

    }

    const results = items.map((item: any) => {
      const normalized = normalizeFields(item.data)
      const stats = collectNormalizeStats(item.data, normalized)
      const validation = validateAgentOutput(item.schemaName, normalized)

      return {
        label: item.label || item.schemaName,
        schemaName: item.schemaName,
        valid: validation.valid,
        normalizeStats: stats,
        errors: validation.errors,
        hasDrift: stats.mappedFields > 0 || validation.errors.length > 0,
      }
    })

    const totalDrift = results.filter(r => r.hasDrift).length
    const totalErrors = results.filter(r => !r.valid).length

    return {
      success: true,
      summary: {
        total: results.length,
        withDrift: totalDrift,
        withErrors: totalErrors,
      },
      results,
    }
  })

  // POST /api/schema-runtime/shadow — Shadow Injection Test
  fastify.post('/api/schema-runtime/shadow', async (request, _reply) => {
    const { results } = request.body as any
    // results: [{ agentName, rawOutput }]

    if (!Array.isArray(results) || results.length === 0) {
      return { success: false, error: 'need results array with { agentName, rawOutput }' } satisfies ApiResponse<unknown>;

    }

    const shadowResult = batchShadowValidate(results)

    return {
      success: true,
      summary: shadowResult.summary,
      driftMetrics: shadowResult.driftMetrics.map(m => ({
        agentName: m.agentName,
        hitRate: m.hitRate,
        hasSchemaErrors: m.hasSchemaErrors,
        hasEnumMismatch: m.hasEnumMismatch,
        unknownFieldsCount: m.unknownFields.length,
        duplicateSemanticsCount: m.duplicateSemantics.length,
        errors: m.validationErrors.slice(0, 5),
        unknownFieldsSample: m.unknownFields.slice(0, 10),
      })),
    }
  })

  // GET /api/schema-runtime/drift-summary — drift 系统状态
  fastify.get('/api/schema-runtime/drift-summary', async (_request, _reply) => {
    const summary = getDriftSummary()
    return {
      success: true,
      schemaRuntime: summary,
    }
  })
}
