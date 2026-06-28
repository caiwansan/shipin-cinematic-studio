// ============================================================
// Human-in-the-Loop Nodes (KMKI-PLAT-011)
// HumanApproval, HumanEdit, HumanReview, HumanUpload, HumanDecision
// Event-based notification + polling mechanism
// ============================================================

import { BaseWorkflowNode, type WorkflowNodeContract } from '../contract/workflow-node-contract.js'
import { nodeTypeRegistry } from '../contract/workflow-node-contract.js'
import { workflowEventRepository } from '../repositories/event.repository.js'
import { workflowInstanceRepository } from '../repositories/instance.repository.js'
import type { WorkflowContext, NodeExecutionResult } from '../types.js'
import { platformEventBus } from '@platform/events/event-bus'
import { NodeStatus, InstanceStatus } from '../types.js'

// ─── Human Node Status ───

export enum HumanNodeStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  Edited = 'edited',
  Reviewed = 'reviewed',
  Uploaded = 'uploaded',
  Decided = 'decided',
  Expired = 'expired',
  Cancelled = 'cancelled',
}

// ─── Base Human Node ───

export abstract class BaseHumanNode extends BaseWorkflowNode {
  abstract humanType: string
  protected pollingIntervalMs = 5000
  protected maxWaitMs = 86400000 // 24 hours default
  protected startTime: number = 0

  async execute(input: Record<string, any>, ctx: WorkflowContext): Promise<NodeExecutionResult> {
    this.startTime = Date.now()

    const config = this.config
    this.maxWaitMs = config.timeout || config.maxWaitMs || 86400000
    this.pollingIntervalMs = (config.pollingInterval || 5) * 1000

    // Emit pending human action event
    await this.emitHumanEvent(ctx, 'humanPending', {
      humanType: this.humanType,
      input,
      message: config.message || 'Human action required',
      userId: config.userId || null,
      assignees: config.assignees || [],
    })

    ctx.logger.info(`Human node ${this.humanType} waiting for action`)

    // Poll for human action
    const result = await this.pollForHumanAction(ctx)

    if (result.success) {
      await this.emitHumanEvent(ctx, 'humanCompleted', {
        humanType: this.humanType,
        result: result.output,
      })
    } else {
      await this.emitHumanEvent(ctx, 'humanFailed', {
        humanType: this.humanType,
        error: result.error,
      })
    }

    return result
  }

  protected abstract pollForHumanAction(ctx: WorkflowContext): Promise<NodeExecutionResult>

  protected async checkHumanStatus(ctx: WorkflowContext): Promise<{ status: string; data?: any } | null> {
    // Check workflow events for human response
    const events = await workflowEventRepository.findByType(ctx.instanceId, `human:${this.humanType}`)
    if (events.length > 0) {
      const latestEvent = events[0]
      if (latestEvent.data) {
        try {
          const eventData = typeof latestEvent.data === 'object' ? latestEvent.data : JSON.parse(latestEvent.data)
          return { status: eventData.action || eventData.status, data: eventData }
        } catch {}
      }
    }

    // Also check the instance metadata for human response
    const instance = await workflowInstanceRepository.findById(ctx.instanceId)
    if (instance?.metadata) {
      try {
        const meta = typeof instance.metadata === 'object' ? instance.metadata : JSON.parse(instance.metadata)
        if (meta.humanResponses && meta.humanResponses[this.humanType]) {
          const response = meta.humanResponses[this.humanType]
          return { status: response.action, data: response }
        }
      } catch {}
    }

    return null
  }

  protected async emitHumanEvent(ctx: WorkflowContext, type: string, data: any): Promise<void> {
    await workflowEventRepository.create({
      instanceId: ctx.instanceId,
      type,
      nodeId: ctx.instanceId, // Placeholder — will be set properly in execution
      data,
    })

    platformEventBus.emit({
      type: `workflow:${type.charAt(0).toUpperCase() + type.slice(1)}` as any,
      source: 'workflow',
      timestamp: new Date().toISOString(),
      context: { workflowId: ctx.workflowId, workspaceId: ctx.workspaceId },
      entityId: ctx.instanceId,
      payload: { humanType: this.humanType, ...data },
    })
  }
}

// ─── Human Approval Node ───

export class HumanApprovalNode extends BaseHumanNode {
  type = 'humanApproval'
  humanType = 'approval'

  async validate(input: Record<string, any>): Promise<boolean> {
    return true
  }

  protected async pollForHumanAction(ctx: WorkflowContext): Promise<NodeExecutionResult> {
    const deadline = this.startTime + this.maxWaitMs

    while (Date.now() < deadline) {
      const response = await this.checkHumanStatus(ctx)
      if (response) {
        switch (response.status) {
          case 'approved':
            return { success: true, output: { action: 'approved', data: response.data } }
          case 'rejected':
            return { success: false, error: 'Human rejected the approval', output: { action: 'rejected', data: response.data } }
          case 'cancelled':
            return { success: false, error: 'Human cancelled the approval' }
          default:
            // Still waiting
            break
        }
      }
      await new Promise(resolve => setTimeout(resolve, this.pollingIntervalMs))
    }

    // Timeout
    return { success: false, error: 'Approval timeout: no human response received within the time limit' }
  }
}

// ─── Human Edit Node ───

export class HumanEditNode extends BaseHumanNode {
  type = 'humanEdit'
  humanType = 'edit'

  async validate(input: Record<string, any>): Promise<boolean> {
    return true
  }

  protected async pollForHumanAction(ctx: WorkflowContext): Promise<NodeExecutionResult> {
    const deadline = this.startTime + this.maxWaitMs

    while (Date.now() < deadline) {
      const response = await this.checkHumanStatus(ctx)
      if (response) {
        switch (response.status) {
          case 'edited':
            return { success: true, output: { action: 'edited', content: response.data?.content, data: response.data } }
          case 'cancelled':
            return { success: false, error: 'Human cancelled the edit' }
          default:
            break
        }
      }
      await new Promise(resolve => setTimeout(resolve, this.pollingIntervalMs))
    }

    return { success: false, error: 'Edit timeout: no human response received within the time limit' }
  }
}

// ─── Human Review Node ───

export class HumanReviewNode extends BaseHumanNode {
  type = 'humanReview'
  humanType = 'review'

  async validate(input: Record<string, any>): Promise<boolean> {
    return true
  }

  protected async pollForHumanAction(ctx: WorkflowContext): Promise<NodeExecutionResult> {
    const deadline = this.startTime + this.maxWaitMs

    while (Date.now() < deadline) {
      const response = await this.checkHumanStatus(ctx)
      if (response) {
        switch (response.status) {
          case 'approved':
          case 'reviewed':
            return { success: true, output: { action: 'reviewed', feedback: response.data?.feedback, data: response.data } }
          case 'rejected':
            return { success: false, error: 'Human rejected in review', output: { action: 'rejected', feedback: response.data?.feedback, data: response.data } }
          case 'cancelled':
            return { success: false, error: 'Human cancelled the review' }
          default:
            break
        }
      }
      await new Promise(resolve => setTimeout(resolve, this.pollingIntervalMs))
    }

    return { success: false, error: 'Review timeout: no human response received within the time limit' }
  }
}

// ─── Human Upload Node ───

export class HumanUploadNode extends BaseHumanNode {
  type = 'humanUpload'
  humanType = 'upload'

  async validate(input: Record<string, any>): Promise<boolean> {
    return true
  }

  protected async pollForHumanAction(ctx: WorkflowContext): Promise<NodeExecutionResult> {
    const deadline = this.startTime + this.maxWaitMs

    while (Date.now() < deadline) {
      const response = await this.checkHumanStatus(ctx)
      if (response) {
        switch (response.status) {
          case 'uploaded':
            return { success: true, output: { action: 'uploaded', files: response.data?.files, urls: response.data?.urls, data: response.data } }
          case 'cancelled':
            return { success: false, error: 'Human cancelled the upload' }
          default:
            break
        }
      }
      await new Promise(resolve => setTimeout(resolve, this.pollingIntervalMs))
    }

    return { success: false, error: 'Upload timeout: no human response received within the time limit' }
  }
}

// ─── Human Decision Node ───

export class HumanDecisionNode extends BaseHumanNode {
  type = 'humanDecision'
  humanType = 'decision'

  async validate(input: Record<string, any>): Promise<boolean> {
    return true
  }

  protected async pollForHumanAction(ctx: WorkflowContext): Promise<NodeExecutionResult> {
    const deadline = this.startTime + this.maxWaitMs

    while (Date.now() < deadline) {
      const response = await this.checkHumanStatus(ctx)
      if (response) {
        switch (response.status) {
          case 'decided':
            return { success: true, output: { action: 'decided', decision: response.data?.decision, data: response.data } }
          case 'cancelled':
            return { success: false, error: 'Human cancelled the decision' }
          default:
            break
        }
      }
      await new Promise(resolve => setTimeout(resolve, this.pollingIntervalMs))
    }

    return { success: false, error: 'Decision timeout: no human response received within the time limit' }
  }
}

// ─── Register Human Node Types ───

export function registerHumanNodeTypes(): void {
  nodeTypeRegistry.register('humanApproval', HumanApprovalNode)
  nodeTypeRegistry.register('humanEdit', HumanEditNode)
  nodeTypeRegistry.register('humanReview', HumanReviewNode)
  nodeTypeRegistry.register('humanUpload', HumanUploadNode)
  nodeTypeRegistry.register('humanDecision', HumanDecisionNode)
}

// ─── Human Response Handler ───

export class HumanResponseHandler {
  async submitResponse(
    instanceId: string,
    nodeType: string,
    action: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const eventType = `human:${nodeType}`

    await workflowEventRepository.create({
      instanceId,
      type: eventType,
      nodeId: instanceId,
      data: { action, ...data, timestamp: new Date().toISOString() },
    })

    platformEventBus.emit({
      type: `workflow:Human${action.charAt(0).toUpperCase() + action.slice(1)}` as any,
      source: 'workflow',
      timestamp: new Date().toISOString(),
      entityId: instanceId,
      payload: { nodeType, action, data },
    })
  }
}

export const humanResponseHandler = new HumanResponseHandler()
