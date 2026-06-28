// ============================================================
// Execution Runtime — lifecycle management
// ARCH-002: Init → Load Plan → Validate → Schedule → Execute → Finalize → Dispose
// Uses PlatformContext, IEventBus, PlatformError
// ============================================================

import type { RuntimeLifecycle } from '@platform/lifecycle/runtime-lifecycle'
import type { PlatformContext } from '@platform/context/platform-context'
import type { IEventBus } from '@platform/events/event-bus'
import { platformEventBus } from '@platform/events/event-bus'
import { RuntimeError } from '@platform/errors/platform-errors'
import type { ExecutionPlan, ExecutionResult } from '../types.js'
import { executionCompiler } from '../compiler/execution-compiler.js'
import type { CompilationOptions } from '../compiler/execution-compiler.js'
import { executionPlanner } from '../planner/execution-planner.js'
import { executionEngine } from '../engine/execution-engine.js'
import { executionValidator } from '../validators/execution-validator.js'
import { executionScheduler } from '../scheduler/execution-scheduler.js'
import { stepPluginRegistry, registerDefaultStepPlugins } from '../registry/step-plugin-registry.js'
import { executionEventService } from '../events/execution-events.js'
import { executionPlanRepository } from '../repositories/execution-plan.repository.js'
import { executionHistoryRepository } from '../repositories/execution-history.repository.js'

export interface RuntimeConfig {
  eventBus?: IEventBus
  autoRegisterPlugins?: boolean
}

class ExecutionRuntime implements RuntimeLifecycle<ExecutionPlan, ExecutionResult> {
  private initialized = false
  private config: RuntimeConfig = {}
  private eventBus: IEventBus = platformEventBus

  async init(ctx: PlatformContext, config?: Record<string, any>): Promise<void> {
    if (this.initialized) return

    this.config = {
      eventBus: config?.eventBus || platformEventBus,
      autoRegisterPlugins: config?.autoRegisterPlugins !== false,
    }

    this.eventBus = this.config.eventBus!

    // Register default step plugins if auto-registration is enabled
    if (this.config.autoRegisterPlugins) {
      registerDefaultStepPlugins()
    }

    this.initialized = true
    console.log(`[ExecutionRuntime] Initialized (plugins: ${stepPluginRegistry.count})`)
  }

  async load(ctx: PlatformContext, id: string): Promise<ExecutionPlan> {
    this._requireInit()

    // Try to load from repository first
    const plan = await executionPlanRepository.getById(id, ctx)
    if (plan) return plan

    throw new RuntimeError(`Execution plan not found: ${id}`, { planId: id })
  }

  async validate(ctx: PlatformContext, plan: ExecutionPlan): Promise<boolean> {
    this._requireInit()
    const result = await executionValidator.validate(plan, ctx)
    return result.valid
  }

  async execute(ctx: PlatformContext, plan: ExecutionPlan): Promise<ExecutionResult> {
    this._requireInit()

    // Full lifecycle within execute:
    // 1. Validate the plan
    const validationResult = await executionValidator.validate(plan, ctx)
    if (!validationResult.valid) {
      throw new RuntimeError(
        `Plan validation failed: ${validationResult.errors.join('; ')}`,
        { errors: validationResult.errors },
      )
    }

    // 2. Run the engine
    const result = await executionEngine.execute(plan, { eventBus: this.eventBus }, ctx)

    // 3. Record history
    await executionHistoryRepository.record(result, ctx)

    return result
  }

  async update(ctx: PlatformContext, id: string, data: Partial<ExecutionPlan>): Promise<ExecutionResult> {
    this._requireInit()
    const plan = await this.load(ctx, id)
    const updatedPlan = await executionPlanner.replan(plan, data, ctx)
    return this.execute(ctx, updatedPlan)
  }

  async dispose(ctx: PlatformContext): Promise<void> {
    if (!this.initialized) return

    stepPluginRegistry.clear()
    this.initialized = false

    console.log('[ExecutionRuntime] Disposed')
  }

  /**
   * Convenience: compile → plan → execute in one step.
   */
  async compileAndExecute(
    capabilityConfig: Parameters<typeof executionCompiler.compile>[0],
    options?: CompilationOptions,
    ctx?: PlatformContext,
  ): Promise<ExecutionResult> {
    this._requireInit()
    const context = ctx || {}

    // Compile
    const compiled = await executionCompiler.compile(capabilityConfig, options, context)

    // Save plan
    await executionPlanRepository.save(compiled.plan, context)

    // Execute
    return this.execute(context, compiled.plan)
  }

  private _requireInit(): void {
    if (!this.initialized) {
      throw new RuntimeError('ExecutionRuntime not initialized. Call init() first.')
    }
  }
}

export const executionRuntime = new ExecutionRuntime()
