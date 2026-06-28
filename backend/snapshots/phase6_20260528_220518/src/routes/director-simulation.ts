/**
 * Director Simulation Layer — API Routes
 *
 * - POST /api/v1/simulation/scene — 单场景预演
 * - POST /api/v1/simulation/episode — 整集预演
 * - POST /api/v1/simulation/gatekeep — 强制执行检查
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { simulateScene } from '../director-simulation/scene-pre-simulator.js'
import { predictShotOutcome } from '../director-simulation/shot-outcome-predictor.js'
import { simulateEmotionTrajectory } from '../director-simulation/emotion-trajectory-simulator.js'
import { predictContinuityRisks } from '../director-simulation/continuity-risk-engine.js'
import { aggregateSimulation, gatekeepSimulation } from '../director-simulation/simulation-aggregator.js'

export default async function directorSimulationRoutes(fastify: FastifyInstance) {
  // ============================================================
  // POST /api/v1/simulation/scene — 单场景预演
  // ============================================================
  fastify.post('/api/v1/simulation/scene', async (request: FastifyRequest, reply: FastifyReply) => {
    const { intentState, sceneBlueprint, shotPlan } = request.body as any
    if (!intentState || !sceneBlueprint || !shotPlan) {
      return reply.status(400).send({ success: false, error: '缺少必要参数' })
    }

    const sceneSim = simulateScene(intentState, sceneBlueprint, shotPlan)
    const shotPredictions = (shotPlan as any[]).map(s => predictShotOutcome(intentState, s))
    const trajectory = simulateEmotionTrajectory(intentState, [sceneBlueprint])
    const continuity = predictContinuityRisks(intentState, [sceneBlueprint], 1)
    const aggregated = aggregateSimulation(sceneBlueprint.sceneId || 'scene_1', sceneSim, shotPredictions, trajectory, continuity)

    return {
      success: true,
      data: aggregated,
    }
  })

  // ============================================================
  // POST /api/v1/simulation/episode — 整集预演
  // ============================================================
  fastify.post('/api/v1/simulation/episode', async (request: FastifyRequest, reply: FastifyReply) => {
    const { intentState, scenes } = request.body as any
    if (!intentState || !scenes || !Array.isArray(scenes)) {
      return reply.status(400).send({ success: false, error: '缺少必要参数' })
    }

    const simulations = scenes.map((scene: any) => {
      const sceneSim = simulateScene(intentState, scene, scene.shots || [])
      const shotPredictions = (scene.shots || []).map((s: any) => predictShotOutcome(intentState, s))
      return { sceneId: scene.sceneId, sceneSim, shotPredictions }
    })

    const trajectory = simulateEmotionTrajectory(intentState, scenes)
    const allSceneIntents = scenes.map((s: any) => ({
      sceneId: s.sceneId,
      sceneName: s.sceneName || '',
      primaryMood: s.primaryMood || intentState.globalEmotion,
      timeOfDay: s.timeOfDay || 'day',
      weather: s.weather || 'clear',
      colorScript: s.colorScript || [],
      cameraApproach: s.cameraApproach || 'standard',
    }))
    const continuity = predictContinuityRisks(intentState, allSceneIntents, scenes.length)

    const aggregatedResults = simulations.map((s: any, i: number) =>
      aggregateSimulation(s.sceneId, s.sceneSim, s.shotPredictions, trajectory, continuity)
    )

    const gatekeep = gatekeepSimulation(aggregatedResults)

    return {
      success: true,
      data: {
        totalScenes: scenes.length,
        decision: gatekeep.blocked.length > 0 ? 'BLOCKED' : gatekeep.fixRequired.length > 0 ? 'NEEDS_FIX' : 'GO',
        summary: `${gatekeep.passed.length}个通过, ${gatekeep.fixRequired.length}个需修复, ${gatekeep.blocked.length}个阻止`,
        emptionTrajectory: trajectory,
        continuityRisk: continuity,
        passed: gatekeep.passed,
        fixRequired: gatekeep.fixRequired,
        blocked: gatekeep.blocked,
      },
    }
  })

  // ============================================================
  // POST /api/v1/simulation/gatekeep — 强制执行检查
  // ============================================================
  fastify.post('/api/v1/simulation/gatekeep', async (request: FastifyRequest, reply: FastifyReply) => {
    const { simulations } = request.body as any
    if (!simulations || !Array.isArray(simulations)) {
      return reply.status(400).send({ success: false, error: '缺少 simulations 数组' })
    }

    const result = gatekeepSimulation(simulations)

    return {
      success: true,
      data: {
        total: simulations.length,
        canExecute: result.blocked.length === 0,
        passed: result.passed.length,
        fixRequired: result.fixRequired.length,
        blocked: result.blocked.length,
        blockedScenes: result.blocked.map(s => ({ sceneId: s.sceneId, score: s.overallSuccessScore })),
      },
    }
  })
}

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "director-simulation",
  "mode": "LEGACY"
};

