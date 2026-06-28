/**
 * Optimization Decision Layer — Routes
 */

import type { FastifyInstance } from 'fastify'
import { handleOptimizationAnalyze } from './optimization.controller.js'

export function registerOptimizationRoutes(app: FastifyInstance) {
  app.post('/api/graph-optimization/analyze', handleOptimizationAnalyze)
}
