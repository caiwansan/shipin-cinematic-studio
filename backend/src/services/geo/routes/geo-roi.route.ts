// ============================================================
// GEO ROI Route — Sprint B-2 ROI Calculator API
// POST /api/geo/roi/calculate
// ============================================================

import { FastifyInstance } from 'fastify'
import { calculateROI, ROICalculationInput } from '../roi/roi-calculator.service.js'

export default async function geoROIRoutes(fastify: FastifyInstance) {
  // ── POST /api/geo/roi/calculate ──
  fastify.post('/api/geo/roi/calculate', { preHandler: [] }, async (request, reply) => {
    const input = request.body as ROICalculationInput

    // Basic validation
    if (!input.industry || !input.brandScale) {
      return reply.status(400).send({
        success: false,
        error: '缺少必要参数：industry（行业）和 brandScale（品牌规模）',
      })
    }

    if (typeof input.averageOrderValue !== 'number' || input.averageOrderValue <= 0) {
      return reply.status(400).send({
        success: false,
        error: '客单价必须为正数',
      })
    }

    if (typeof input.monthlyInquiries !== 'number' || input.monthlyInquiries < 0) {
      return reply.status(400).send({
        success: false,
        error: '月咨询量不能为负数',
      })
    }

    if (typeof input.conversionRate !== 'number' || input.conversionRate < 0 || input.conversionRate > 100) {
      return reply.status(400).send({
        success: false,
        error: '转化率必须在 0-100 之间',
      })
    }

    try {
      const result = calculateROI(input)
      return {
        success: true,
        data: result,
      }
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: `ROI 计算失败: ${err.message}`,
      })
    }
  })
}
