/**
 * Behavior Simulator — 行为风暴系统主入口
 * 
 * 聚合 User Models + Load Patterns + Chaos Injector + Event Generator
 * 对外暴露的控制接口。
 */

import { FastifyInstance } from 'fastify'
import { startSimulation, stopSimulation, getSimulationState } from './event-generator.js'
import { getActiveInjections, clearAllInjections, injectApiDelay } from './chaos-injector.js'
import { ALL_USER_MODELS, getUserModelById } from './user-models.js'
import { ALL_PATTERNS, getPatternByName } from './load-patterns.js'
import { startStabilityTest, stopStabilityTest, getStabilityStatus } from './stability-simulator.js'

export async function registerSimulationRoutes(fastify: FastifyInstance) {
  // ============================================================
  // 模拟控制
  // ============================================================

  // 启动模拟
  fastify.post('/api/simulation/start', async (request, reply) => {
    const body = request.body as any
    const result = startSimulation({
      durationSeconds: body.duration ?? 60,
      pattern: body.pattern ?? 'chaos',
      userCount: body.users ?? 10,
      chaosChance: body.chaos ?? 0.15,
    })
    return reply.send(result)
  })

  // 停止模拟
  fastify.post('/api/simulation/stop', async (_request, reply) => {
    const result = stopSimulation()
    return reply.send(result)
  })

  // 模拟状态
  fastify.get('/api/simulation/status', async (_request, reply) => {
    const state = getSimulationState()
    const injections = getActiveInjections()
    return reply.send({
      ...state,
      startTime: state.startTime?.toISOString(),
      activeInjections: injections.length,
    })
  })

  // ============================================================
  // 用户模型信息
  // ============================================================

  fastify.get('/api/simulation/models', async (_request, reply) => {
    return reply.send(
      ALL_USER_MODELS.map(m => ({
        id: m.id,
        name: m.name,
        label: m.label,
        emoji: m.emoji,
        weight: m.weight,
        retryProbability: m.retryProbability,
        burstSubmit: m.burstSubmit,
        multiTab: m.multiTab,
      }))
    )
  })

  // ============================================================
  // 流量模式信息
  // ============================================================

  fastify.get('/api/simulation/patterns', async (_request, reply) => {
    return reply.send(
      ALL_PATTERNS.map(p => ({
        name: p.name,
        label: p.label,
        description: p.description,
      }))
    )
  })

  // ============================================================
  // 故障注入控制
  // ============================================================

  // 手动注入故障
  fastify.post('/api/simulation/inject', async (request, reply) => {
    const body = request.query as any
    const type = body.type as string
    const severity = (body.severity as 'low' | 'medium' | 'high') ?? 'medium'

    switch (type) {
      case 'api_delay':
        return reply.send(injectApiDelay(severity))
      case 'worker_kill':
      case 'sse_disconnect':
      case 'redis_lag':
      case 'cost_spike':
        const { randomInjection } = await import('./chaos-injector.js')
        return reply.send(randomInjection())
      default:
        return reply.status(400).send({ error: `Unknown injection type: ${type}. Available: api_delay, worker_kill, sse_disconnect, redis_lag, cost_spike` })
    }
  })

  // 获取当前活动故障
  fastify.get('/api/simulation/injections', async (_request, reply) => {
    return reply.send(getActiveInjections())
  })

  // 清除所有故障
  fastify.post('/api/simulation/clear', async (_request, reply) => {
    clearAllInjections()
    return reply.send({ message: 'All injections cleared' })
  })

  // ============================================================
  // Bridge 控制
  // ============================================================

  // Bridge 配置 / 状态
  fastify.get('/api/simulation/bridge', async (_request, reply) => {
    const { getBridgeConfig, getBridgeState } = await import('./simulation-bridge.js')
    return reply.send({
      config: getBridgeConfig(),
      state: getBridgeState(),
    })
  })

  // 切换 Bridge
  fastify.post('/api/simulation/bridge/toggle', async (request, reply) => {
    const { setBridgeConfig, getBridgeConfig } = await import('./simulation-bridge.js')
    const body = request.body as any
    setBridgeConfig({ enabled: body.enabled ?? !getBridgeConfig().enabled })
    return reply.send({ enabled: getBridgeConfig().enabled })
  })

  // 设置 Bridge 配置
  fastify.post('/api/simulation/bridge/config', async (request, reply) => {
    const { setBridgeConfig, getBridgeConfig } = await import('./simulation-bridge.js')
    const body = request.body as any
    setBridgeConfig({
      maxConcurrency: body.maxConcurrency,
      injectionWeight: body.injectionWeight,
      skipCost: body.skipCost,
    })
    return reply.send(getBridgeConfig())
  })

  // 重置 Bridge 状态
  fastify.post('/api/simulation/bridge/reset', async (_request, reply) => {
    const { resetBridgeState } = await import('./simulation-bridge.js')
    resetBridgeState()
    return reply.send({ message: 'Bridge state reset' })
  })

  // ============================================================
  // Phase 6C-3 稳定性测试
  // ============================================================

  // 启动稳定性测试
  fastify.post('/api/simulation/stability/start', async (request, reply) => {
    const body = request.body as any
    return reply.send(await startStabilityTest({
      durationMs: body.durationMs,
      snapshotIntervalMs: body.snapshotIntervalMs,
      userCount: body.userCount,
      maxQueueGrowth: body.maxQueueGrowth,
      maxErrorRate: body.maxErrorRate,
      maxCostPerSnapshot: body.maxCostPerSnapshot,
      patternSequence: body.patternSequence,
      patternDurationSec: body.patternDurationSec,
    }))
  })

  // 停止稳定性测试
  fastify.post('/api/simulation/stability/stop', async (_request, reply) => {
    return reply.send(await stopStabilityTest())
  })

  // 稳定性状态
  fastify.get('/api/simulation/stability', async (_request, reply) => {
    return reply.send(getStabilityStatus())
  })
}
