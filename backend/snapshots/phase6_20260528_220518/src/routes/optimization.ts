import type { ApiResponse } from '../contracts/api/base.js';
/**
 * routes/optimization.ts — 自优化系统 API
 *
 * GET  /optimization/status          — 优化循环状态
 * GET  /optimization/report           — 最新报告
 * POST /optimization/start            — 启动优化循环
 * POST /optimization/stop             — 停止优化循环
 * POST /optimization/trigger-cycle    — 手动触发一次周期
 * GET  /optimization/providers         — Provider 学习评分排名
 * GET  /optimization/cost-suggestions  — 成本优化建议
 * GET  /optimization/user-analysis     — 用户行为分析
 * GET  /optimization/load-prediction   — 负载预测
 * GET  /optimization/healing           — 自愈状态
 * POST /optimization/heal              — 手动触发自愈
 * GET  /optimization/experiments       — 实验结果
 */

import { FastifyInstance } from 'fastify'
import { getOptimizationReport, startOptimizerLoop, stopOptimizerLoop } from '../optimization/optimizer-loop.js'
import { getAllProviderStates } from '../optimization/router-learning.js'
import { costOptimizer } from '../optimization/cost-optimizer.js'
import { analyzeAllActiveUsers } from '../optimization/user-behavior-analyzer.js'
import { predictLoad } from '../optimization/load-predictor.js'
import { getHealthChecks, getHealingHistory, triggerHealing } from '../optimization/self-healing.js'
import { getExperimentResults } from '../optimization/experiments.js'

export default async function optimizationRoutes(fastify: FastifyInstance) {
  // GET /optimization/status
  fastify.get('/optimization/status', async (request, reply) => {
    return {
      success: true,
      loopRunning: !!(fastify as any).optimizerLoopRunning,
      lastUpdate: getOptimizationReport()?.timestamp || null,
    }
  })

  // GET /optimization/report
  fastify.get('/optimization/report', async (request, reply) => {
    const report = getOptimizationReport()
    if (!report) {
      return { success: true, message: 'No report yet — loop may not have run' } satisfies ApiResponse<unknown>;

    }
    return { success: true, report } satisfies ApiResponse<unknown>;

  })

  // POST /optimization/start
  fastify.post('/optimization/start', async (request, reply) => {
    const query = request.body as any
    const interval = parseInt(query?.interval) || 60
    startOptimizerLoop(interval * 1000)
    ;(fastify as any).optimizerLoopRunning = true
    return { success: true, message: `Optimizer loop started (every ${interval}s)` } satisfies ApiResponse<unknown>;

  })

  // POST /optimization/stop
  fastify.post('/optimization/stop', async (request, reply) => {
    stopOptimizerLoop()
    ;(fastify as any).optimizerLoopRunning = false
    return { success: true, message: 'Optimizer loop stopped' } satisfies ApiResponse<unknown>;

  })

  // POST /optimization/trigger-cycle
  fastify.post('/optimization/trigger-cycle', async (request, reply) => {
    // 重启循环会触发立即执行
    stopOptimizerLoop()
    const query = request.body as any
    const interval = parseInt(query?.interval) || 60
    startOptimizerLoop(interval * 1000)
    ;(fastify as any).optimizerLoopRunning = true
    return { success: true, message: 'Cycle triggered — check /optimization/report' } satisfies ApiResponse<unknown>;

  })

  // GET /optimization/providers — Router Learning 评分
  fastify.get('/optimization/providers', async (request, reply) => {
    const states = getAllProviderStates()
    return { success: true, providers: states } satisfies ApiResponse<unknown>;

  })

  // GET /optimization/cost-suggestions — 成本优化建议
  fastify.get('/optimization/cost-suggestions', async (request, reply) => {
    const taskTypes = ['llm', 'image', 'tts', 'video']
    const suggestions = taskTypes.flatMap(t => costOptimizer.getOptimizationSuggestions(t))
    const savings = taskTypes.reduce((acc, t) => {
      acc[t] = costOptimizer.estimateSavings(t, 1000)
      return acc
    }, {} as Record<string, any>)

    return { success: true, suggestions, savings } satisfies ApiResponse<unknown>;

  })

  // GET /optimization/user-analysis
  fastify.get('/optimization/user-analysis', async (request, reply) => {
    const profiles = await analyzeAllActiveUsers()
    return { success: true, users: profiles } satisfies ApiResponse<unknown>;

  })

  // GET /optimization/load-prediction
  fastify.get('/optimization/load-prediction', async (request, reply) => {
    const prediction = await predictLoad()
    return { success: true, prediction } satisfies ApiResponse<unknown>;

  })

  // GET /optimization/healing
  fastify.get('/optimization/healing', async (request, reply) => {
    const checks = getHealthChecks()
    const history = getHealingHistory()
    return { success: true, checks, history } satisfies ApiResponse<unknown>;

  })

  // POST /optimization/heal
  fastify.post('/optimization/heal', async (request, reply) => {
    const { target } = request.body as any
    const action = triggerHealing(target || 'system')
    return { success: true, action } satisfies ApiResponse<unknown>;

  })

  // GET /optimization/experiments
  fastify.get('/optimization/experiments', async (request, reply) => {
    const results = getExperimentResults()
    return { success: true, experiments: results } satisfies ApiResponse<unknown>;

  })
}
