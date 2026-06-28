// ============================================================
// Agent Contract — KMKI-PLAT-010
// AgentContract 接口定义 + BaseAgent 抽象类
// Agent 开发者只需继承覆盖需要的方法
// ============================================================

import type { AgentContext, AgentContract, AgentPlan, AgentResult, AgentStreamChunk } from '../types'

// ─── Abstract BaseAgent ───

export abstract class BaseAgent implements AgentContract {
  protected initialized = false

  /**
   * Initialize the agent with context.
   * Override to set up connections, load models, etc.
   */
  async initialize(ctx: AgentContext): Promise<void> {
    this.initialized = true
    ctx.logger.info(`[${ctx.agentDefinition.code}] Agent initialized`)
  }

  /**
   * Plan how to achieve the goal with given input.
   * Override to provide custom planning logic.
   * Default: create a single-step plan.
   */
  async plan(ctx: AgentContext, input: any): Promise<AgentPlan> {
    const capabilities = ctx.agentDefinition.capabilities
    const plan: AgentPlan = {
      steps: capabilities.map((cap, i) => ({
        name: `step-${i}-${cap}`,
        capability: cap,
        input: typeof input === 'object' && input !== null ? input : { data: input },
      })),
    }
    ctx.logger.info(`[${ctx.agentDefinition.code}] Generated plan with ${plan.steps.length} steps`)
    return plan
  }

  /**
   * Execute the plan.
   * Override to provide custom execution logic.
   * Default: resolve each capability step sequentially.
   */
  async execute(ctx: AgentContext, plan: AgentPlan): Promise<AgentResult> {
    const startTime = Date.now()
    const results: AgentResult['metrics'] = {
      totalSteps: plan.steps.length,
      completedSteps: 0,
      failedSteps: 0,
      totalDurationMs: 0,
      totalCost: 0,
      totalTokens: 0,
    }

    ctx.logger.info(`[${ctx.agentDefinition.code}] Executing plan with ${plan.steps.length} steps`)

    const output: Record<string, unknown> = {}

    for (const step of plan.steps) {
      try {
        ctx.logger.debug(`[${ctx.agentDefinition.code}] Executing step: ${step.name} (${step.capability})`)

        const stepStart = Date.now()
        const stepResult = await ctx.capabilityResolver.resolve(step.capability, step.input)
        const stepDuration = Date.now() - stepStart

        output[step.name] = stepResult
        results.completedSteps++
        results.totalDurationMs += stepDuration

        ctx.logger.info(`[${ctx.agentDefinition.code}] Step ${step.name} completed in ${stepDuration}ms`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        ctx.logger.error(`[${ctx.agentDefinition.code}] Step ${step.name} failed: ${errorMsg}`)
        results.failedSteps++

        return {
          success: false,
          output: null,
          error: `Step ${step.name} failed: ${errorMsg}`,
          metrics: {
            ...results,
            totalDurationMs: Date.now() - startTime,
          },
        }
      }
    }

    results.totalDurationMs = Date.now() - startTime

    return {
      success: results.failedSteps === 0,
      output,
      metrics: results,
    }
  }

  /**
   * Optional: stream execution chunks.
   * Override if agent supports streaming.
   */
  async *stream?(ctx: AgentContext, plan: AgentPlan): AsyncGenerator<AgentStreamChunk, AgentResult, void> {
    const result = await this.execute(ctx, plan)
    yield {
      type: 'complete',
      data: result,
      timestamp: new Date(),
    }
    return result
  }

  /**
   * Pause the current execution.
   * Override to save state and pause resources.
   */
  async pause(ctx: AgentContext): Promise<void> {
    ctx.logger.info(`[${ctx.agentDefinition.code}] Agent paused`)
  }

  /**
   * Resume a paused execution.
   * Override to restore state and resume resources.
   */
  async resume(ctx: AgentContext): Promise<void> {
    ctx.logger.info(`[${ctx.agentDefinition.code}] Agent resumed`)
  }

  /**
   * Cancel the current execution.
   * Override to clean up resources.
   */
  async cancel(ctx: AgentContext): Promise<void> {
    ctx.logger.info(`[${ctx.agentDefinition.code}] Agent cancelled`)
  }

  /**
   * Called when execution completes successfully.
   * Override for post-processing.
   */
  async complete(ctx: AgentContext, result: AgentResult): Promise<void> {
    ctx.logger.info(`[${ctx.agentDefinition.code}] Agent completed: success=${result.success}`)
  }

  /**
   * Dispose the agent. Called on shutdown.
   * Override to release connections.
   */
  async dispose(ctx: AgentContext): Promise<void> {
    this.initialized = false
    ctx.logger.info(`[${ctx.agentDefinition.code}] Agent disposed`)
  }
}
