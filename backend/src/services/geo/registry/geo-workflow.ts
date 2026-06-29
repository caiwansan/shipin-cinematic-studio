// ============================================================
// GEO Workflow Runtime — Sprint 1B Knowledge Quality
// ============================================================
// P0: WorkflowContext — shared runtime context, AgentContext derives from it
// P0: EventBus — dispatches WorkflowStarted/NodeStarted/NodeCompleted/NodeFailed/WorkflowCompleted
// P0: FailurePolicy — retry/timeout/continueOnFailure per step
// P0: DAG Resolver — true topological sort for parallel execution
// ============================================================

import type { AgentContext, AgentOutput, AgentStatus, RuntimeTrace } from '../types'
import { createProvenanceRecord } from '../types'

// ─── Event Types ───

export type WorkflowEventType =
  | 'WorkflowStarted'
  | 'NodeStarted'
  | 'NodeCompleted'
  | 'NodeFailed'
  | 'NodeSkipped'
  | 'WorkflowCompleted'

export interface WorkflowEvent {
  type: WorkflowEventType
  executionId: string
  workflowId: string
  nodeName?: string
  data?: Record<string, unknown>
  error?: string
  timestamp: string
  duration?: number
}

// ─── Event Bus ───

export type EventHandler = (event: WorkflowEvent) => void

export class WorkflowEventBus {
  private handlers: Map<WorkflowEventType, EventHandler[]> = new Map()

  on(type: WorkflowEventType, handler: EventHandler): void {
    const existing = this.handlers.get(type) || []
    existing.push(handler)
    this.handlers.set(type, existing)
  }

  off(type: WorkflowEventType, handler: EventHandler): void {
    const existing = this.handlers.get(type) || []
    this.handlers.set(type, existing.filter((h) => h !== handler))
  }

  emit(event: WorkflowEvent): void {
    const typeHandlers = this.handlers.get(event.type) || []
    const allHandlers = this.handlers.get('*' as any) || []
    for (const handler of [...typeHandlers, ...allHandlers]) {
      try {
        handler(event)
      } catch {
        // Silently swallow handler errors — EventBus must never crash
      }
    }
  }

  clear(): void {
    this.handlers.clear()
  }
}

export const globalEventBus = new WorkflowEventBus()

// ─── Workflow Context ───

export interface WorkflowContext {
  executionId: string
  workflowId: string
  workflowVersion: string
  projectId: string
  tenantId: string
  inputs: Record<string, unknown>
  outputs: Map<string, AgentOutput<any>>
  capabilities: {
    llm: {
      generate: (prompt: string, opts?: any) => Promise<{ content: string; tokens: number; latency: number; cost: number }>
      embedding?: (text: string) => Promise<number[]>
    }
  }
  registry: {
    getPrompt: (template: string, variables: Record<string, unknown>) => string
    getConfig: (key: string) => string | undefined
  }
  metadata: Record<string, unknown>
}

/**
 * Derive AgentContext from WorkflowContext.
 * This is the ONLY way AgentContext should be created.
 */
export function deriveAgentContext(
  wfCtx: WorkflowContext,
  nodeName: string,
  parentNodeId?: string,
): AgentContext {
  return {
    projectId: wfCtx.projectId,
    userId: wfCtx.tenantId,
    executionId: wfCtx.executionId,
    workflowNodeId: nodeName,
    parentNodeId: parentNodeId || wfCtx.workflowId,
    config: {},
    capabilities: wfCtx.capabilities,
    registry: wfCtx.registry,
  }
}

// ─── Failure Policy ───

export interface FailurePolicy {
  retry: number          // max retries (0 = no retry)
  timeout: number        // ms, 0 = no timeout
  continueOnFailure: boolean  // if true, skip failed step and continue
}

export const DEFAULT_FAILURE_POLICY: FailurePolicy = {
  retry: 0,
  timeout: 60000,
  continueOnFailure: false,
}

// ─── Workflow Step ───

export type AgentFn<TInput, TOutput> = (
  input: TInput,
  ctx: AgentContext
) => Promise<AgentOutput<TOutput>>

export interface WorkflowStep {
  name: string
  agent: AgentFn<any, any>
  input: (wfCtx: WorkflowContext) => any
  dependsOn: string[]
  failurePolicy: FailurePolicy
  config?: Record<string, unknown>
}

// ─── DAG Resolver ───

export interface ResolvedDAG {
  layers: WorkflowStep[][]     // parallel execution layers
  stageCount: number
}

/**
 * Topological sort of workflow steps into parallel execution layers.
 * Each layer can run entirely in parallel; layers execute sequentially.
 */
export function resolveDAG(steps: WorkflowStep[]): ResolvedDAG {
  const stepNames = new Map<string, WorkflowStep>()
  for (const step of steps) stepNames.set(step.name, step)

  // Compute in-degree (number of uncompleted dependencies)
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()   // step → dependents

  for (const step of steps) {
    inDegree.set(step.name, 0)
    adjacency.set(step.name, [])
  }

  for (const step of steps) {
    for (const dep of step.dependsOn) {
      inDegree.set(step.name, (inDegree.get(step.name) || 0) + 1)
      if (!adjacency.has(dep)) adjacency.set(dep, [])
      adjacency.get(dep)!.push(step.name)
    }
  }

  const layers: WorkflowStep[][] = []
  const remaining = new Set(steps.map((s) => s.name))
  const stepMap = new Map(steps.map((s) => [s.name, s]))

  while (remaining.size > 0) {
    // Find all steps with zero in-degree
    const currentLayer: string[] = []
    for (const name of remaining) {
      if ((inDegree.get(name) || 0) === 0) {
        currentLayer.push(name)
      }
    }

    if (currentLayer.length === 0) {
      // Deadlock: remaining steps all have non-zero in-degree
      throw new Error(`DAG deadlock detected: remaining steps ${[...remaining].join(', ')}`)
    }

    const layerSteps: WorkflowStep[] = []
    for (const name of currentLayer) {
      const step = stepMap.get(name)
      if (step) layerSteps.push(step)
      remaining.delete(name)

      // Decrement in-degree of all dependents
      for (const dependent of adjacency.get(name) || []) {
        inDegree.set(dependent, (inDegree.get(dependent) || 1) - 1)
      }
    }

    layers.push(layerSteps)
  }

  return { layers, stageCount: layers.length }
}

// ─── Workflow Definition ───

export interface WorkflowDefinition {
  id: string
  name: string
  version: string
  steps: WorkflowStep[]
  timeout?: number
}

export interface WorkflowExecutionResult {
  workflowId: string
  workflowVersion: string
  executionId: string
  status: AgentStatus
  outputs: Map<string, AgentOutput<any>>
  errors: Map<string, string>   // nodeName → error message
  startedAt: string
  finishedAt: string
  duration: number
}

// ─── Workflow Builder ───

export class WorkflowBuilder {
  private steps: WorkflowStep[] = []
  private version: string = '1.0.0'

  setVersion(v: string): WorkflowBuilder {
    this.version = v
    return this
  }

  add(
    name: string,
    agent: AgentFn<any, any>,
    input: (wfCtx: WorkflowContext) => any,
    dependsOn?: string[],
    failurePolicy?: Partial<FailurePolicy>,
  ): WorkflowBuilder {
    this.steps.push({
      name,
      agent,
      input,
      dependsOn: dependsOn || [],
      failurePolicy: {
        retry: failurePolicy?.retry ?? DEFAULT_FAILURE_POLICY.retry,
        timeout: failurePolicy?.timeout ?? DEFAULT_FAILURE_POLICY.timeout,
        continueOnFailure: failurePolicy?.continueOnFailure ?? DEFAULT_FAILURE_POLICY.continueOnFailure,
      },
    })
    return this
  }

  build(id: string, name: string): WorkflowDefinition {
    // Validate: no duplicate names
    const names = new Set<string>()
    for (const step of this.steps) {
      if (names.has(step.name)) throw new Error(`Duplicate step name: ${step.name}`)
      names.add(step.name)
    }

    // Validate: all dependency names exist
    const allNames = new Set(this.steps.map((s) => s.name))
    for (const step of this.steps) {
      for (const dep of step.dependsOn) {
        if (!allNames.has(dep)) throw new Error(`Step "${step.name}" depends on unknown step "${dep}"`)
      }
    }

    return {
      id,
      name,
      version: this.version,
      steps: this.steps,
    }
  }
}

// ─── Workflow Dispatcher (with DAG, EventBus, FailurePolicy) ───

export class WorkflowDispatcher {
  private workflows: Map<string, WorkflowDefinition> = new Map()
  private eventBus: WorkflowEventBus

  constructor(eventBus?: WorkflowEventBus) {
    this.eventBus = eventBus || globalEventBus
  }

  register(workflow: WorkflowDefinition): void {
    this.workflows.set(workflow.id, workflow)
    // Validate DAG at register time
    resolveDAG(workflow.steps)
  }

  get(id: string): WorkflowDefinition | undefined {
    return this.workflows.get(id)
  }

  getEventBus(): WorkflowEventBus {
    return this.eventBus
  }

  async execute(
    workflowId: string,
    wfCtx: WorkflowContext,
  ): Promise<WorkflowExecutionResult> {
    const workflow = this.workflows.get(workflowId)
    if (!workflow) throw new Error(`Workflow not found: ${workflowId}`)

    const executionId = wfCtx.executionId
    const startedAt = new Date()
    const isoStarted = startedAt.toISOString()

    const outputs = new Map<string, AgentOutput<any>>()
    const errors = new Map<string, string>()

    // Emit WorkflowStarted
    this.eventBus.emit({
      type: 'WorkflowStarted',
      executionId,
      workflowId,
      timestamp: isoStarted,
      data: { workflowName: workflow.name, stepCount: workflow.steps.length },
    })

    // Resolve DAG into parallel layers
    const dag = resolveDAG(workflow.steps)
    const stepMap = new Map(workflow.steps.map((s) => [s.name, s]))

    for (let layerIndex = 0; layerIndex < dag.layers.length; layerIndex++) {
      const layer = dag.layers[layerIndex]
      const promises = layer.map(async (step) => {
        const stepStartedAt = Date.now()
        const nodeStartedAt = new Date().toISOString()

        // Emit NodeStarted
        this.eventBus.emit({
          type: 'NodeStarted',
          executionId,
          workflowId,
          nodeName: step.name,
          timestamp: nodeStartedAt,
        })

        const agentCtx = deriveAgentContext(wfCtx, step.name, wfCtx.workflowId)

        let lastError: string | undefined
        let result: AgentOutput<any> | undefined

        for (let attempt = 0; attempt <= step.failurePolicy.retry; attempt++) {
          const attemptStart = Date.now()

          // timeout guard via Promise.race
          const execPromise = step.agent(step.input(wfCtx), agentCtx)
          let timeoutId: NodeJS.Timeout | undefined

          const timeoutPromise = new Promise<never>((_, reject) => {
            if (step.failurePolicy.timeout > 0) {
              timeoutId = setTimeout(() => reject(new Error(`Timeout after ${step.failurePolicy.timeout}ms`)), step.failurePolicy.timeout)
            }
          })

          try {
            const agentResult = await Promise.race([execPromise, timeoutPromise]) as AgentOutput<any>
            result = agentResult
            lastError = undefined
            break  // success, exit retry loop
          } catch (err: any) {
            if (timeoutId) clearTimeout(timeoutId)
            lastError = err.message
            // Only wait on retries, not the last attempt
            if (attempt < step.failurePolicy.retry) {
              const backoff = Math.min(1000 * Math.pow(2, attempt), 30000)
              await new Promise((r) => setTimeout(r, backoff))
            }
          }
        }

        if (result && !lastError) {
          // Ensure trace is filled
          result.trace = {
            executionId,
            workflowNodeId: step.name,
            parentNodeId: wfCtx.workflowId,
            agent: step.name,
            startedAt: nodeStartedAt,
            finishedAt: new Date().toISOString(),
            duration: Date.now() - stepStartedAt,
          }

          outputs.set(step.name, result)

          this.eventBus.emit({
            type: 'NodeCompleted',
            executionId,
            workflowId,
            nodeName: step.name,
            timestamp: new Date().toISOString(),
            duration: result.executionMetrics?.latency || Date.now() - stepStartedAt,
            data: { status: result.status, outputCount: result.data.length, confidence: result.confidence },
          })
        } else {
          errors.set(step.name, lastError || 'Unknown error')

          this.eventBus.emit({
            type: 'NodeFailed',
            executionId,
            workflowId,
            nodeName: step.name,
            timestamp: new Date().toISOString(),
            error: lastError,
            duration: Date.now() - stepStartedAt,
          })

          if (!step.failurePolicy.continueOnFailure) {
            throw new WorkflowAbortError(`Step "${step.name}" failed: ${lastError}`, step.name)
          }
        }
      })

      // Wait for all steps in this layer to complete (parallel execution)
      try {
        await Promise.all(promises)
      } catch (abortErr: any) {
        if (abortErr instanceof WorkflowAbortError) {
          // Mark remaining steps as skipped
          for (let oi = layerIndex; oi < dag.layers.length; oi++) {
            for (const s of dag.layers[oi]) {
              if (!errors.has(s.name) && !outputs.has(s.name)) {
                errors.set(s.name, 'Skipped due to upstream failure')
                this.eventBus.emit({
                  type: 'NodeSkipped',
                  executionId,
                  workflowId,
                  nodeName: s.name,
                  timestamp: new Date().toISOString(),
                  data: { reason: 'Upstream failure' },
                })
              }
            }
          }

          const finishedAt = new Date()
          const duration = finishedAt.getTime() - startedAt.getTime()

          this.eventBus.emit({
            type: 'WorkflowCompleted',
            executionId,
            workflowId,
            timestamp: finishedAt.toISOString(),
            data: { status: 'FAILED', failedNode: abortErr.nodeName },
            duration,
          })

          return {
            workflowId,
            workflowVersion: workflow.version,
            executionId,
            status: 'FAILED',
            outputs,
            errors,
            startedAt: isoStarted,
            finishedAt: finishedAt.toISOString(),
            duration,
          }
        }
        throw abortErr
      }
    }

    const finishedAt = new Date()
    const duration = finishedAt.getTime() - startedAt.getTime()

    const hasErrors = errors.size > 0
    let status: AgentStatus = 'SUCCESS'
    if (hasErrors && outputs.size > 0) status = 'PARTIAL_SUCCESS'
    else if (hasErrors) status = 'FAILED'

    this.eventBus.emit({
      type: 'WorkflowCompleted',
      executionId,
      workflowId,
      timestamp: finishedAt.toISOString(),
      data: { status, stepsOutput: outputs.size, stepsErrors: errors.size },
      duration,
    })

    return {
      workflowId,
      workflowVersion: workflow.version,
      executionId,
      status,
      outputs,
      errors,
      startedAt: isoStarted,
      finishedAt: finishedAt.toISOString(),
      duration,
    }
  }
}

class WorkflowAbortError extends Error {
  nodeName: string
  constructor(message: string, nodeName: string) {
    super(message)
    this.name = 'WorkflowAbortError'
    this.nodeName = nodeName
  }
}

// ─── Singleton ───

export const workflowDispatcher = new WorkflowDispatcher(globalEventBus)
