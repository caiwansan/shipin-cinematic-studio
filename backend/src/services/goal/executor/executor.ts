// ============================================================
// Executor — Unified execution entry point
// Task → Action → Execution → Result
// Does NOT generate Tasks or Goals (single responsibility)
// ============================================================

import { actionRegistry } from '../registry/action-registry.js'
import { executionRepository } from '../repositories/execution.repository.js'
import { taskRepository } from '../repositories/task.repository.js'
import type { TaskData, ExecutionData, ExecutionResultData, ActionResult } from '../types.js'

export class Executor {
  /**
   * Execute a single task
   * Task → Create Execution → Run Action → Save Result → Update Task Status
   */
  async executeTask(task: TaskData): Promise<{ execution: ExecutionData; results: ExecutionResultData[] }> {
    // Create execution record
    const execution = await executionRepository.create({
      taskId: task.id!,
      actionType: task.actionType,
      status: 'running',
      input: JSON.stringify({ taskTitle: task.title, taskDescription: task.description }),
      retryAttempt: task.retryCount || 0,
      schemaVersion: 1,
    })

    // Execute via action registry
    const actionResult = await actionRegistry.execute(task.actionType, {
      taskId: task.id,
      title: task.title,
      description: task.description,
      metadata: task.metadata ? JSON.parse(task.metadata) : {},
    }, {
      executionId: execution.id,
      taskId: task.id,
    })

    // Save results
    const results: ExecutionResultData[] = []

    if (actionResult.success && actionResult.output) {
      // Create result entry
      const result = await executionRepository.createResult({
        executionId: execution.id!,
        assetId: actionResult.assetId,
        type: 'created',
        summary: `${task.actionType} executed successfully`,
        details: JSON.stringify(actionResult.output),
        schemaVersion: 1,
      })
      results.push(result)
    } else if (!actionResult.success) {
      const result = await executionRepository.createResult({
        executionId: execution.id!,
        type: 'error',
        summary: actionResult.error || 'Unknown error',
        details: JSON.stringify({ error: actionResult.error }),
        schemaVersion: 1,
      })
      results.push(result)
    }

    // Update execution record
    const updatedExecution = await executionRepository.update(execution.id!, {
      status: actionResult.success ? 'completed' : 'failed',
      output: actionResult.output ? JSON.stringify(actionResult.output) : undefined,
      error: actionResult.error,
      durationMs: actionResult.durationMs,
    })

    // Update task status
    await taskRepository.update(task.id!, {
      status: actionResult.success ? 'completed' : 'failed',
    })

    return { execution: updatedExecution, results }
  }

  /**
   * Execute a batch of tasks
   */
  async executeBatch(tasks: TaskData[]): Promise<Array<{ task: TaskData; execution: ExecutionData; results: ExecutionResultData[] }>> {
    const batchResults: Array<{ task: TaskData; execution: ExecutionData; results: ExecutionResultData[] }> = []

    for (const task of tasks) {
      // Skip if task is not ready
      if (task.status !== 'ready') continue

      // Mark as running
      await taskRepository.update(task.id!, { status: 'running' })

      try {
        const result = await this.executeTask(task)
        batchResults.push({ task, ...result })
      } catch (err: any) {
        // Mark execution as failed
        const execution = await executionRepository.create({
          taskId: task.id!,
          actionType: task.actionType,
          status: 'failed',
          error: err.message,
          schemaVersion: 1,
        })

        await taskRepository.update(task.id!, { status: 'failed' })

        batchResults.push({
          task,
          execution,
          results: [{
            executionId: execution.id!,
            type: 'error',
            summary: err.message,
            details: JSON.stringify({ error: err.message, stack: err.stack }),
            schemaVersion: 1,
          }],
        })
      }
    }

    return batchResults
  }
}

export const executor = new Executor()
