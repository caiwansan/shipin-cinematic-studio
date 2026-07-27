/**
 * agent-runtime/execution/workflow-engine.service.ts
 * Workflow Engine — 工作流引擎
 *
 * 职责：
 *   1. 创建 Workflow Instance
 *   2. 驱动 DAG 执行
 *   3. 状态流转
 *   4. 审计
 */

import type { PrismaClient } from '@prisma/client';
import type { RuntimeContext } from '../types/agent-runtime.types.js';
import { WorkflowStateService, WorkflowInstanceStatus } from './workflow-state.service.js';
import { StepExecutorService } from './step-executor.service.js';
import { WorkflowDefinitionService } from '../workflow/workflow-definition.service.js';

export class WorkflowEngineService {
  private stateService: WorkflowStateService;
  private stepExecutor: StepExecutorService;
  private definitionService: WorkflowDefinitionService;

  constructor(
    private prisma: PrismaClient,
    brain: any,
  ) {
    this.stateService = new WorkflowStateService(prisma);
    this.stepExecutor = new StepExecutorService(prisma, brain);
    this.definitionService = new WorkflowDefinitionService(prisma);
  }

  /**
   * 启动 Workflow Instance
   */
  async startWorkflow(
    definitionId: string,
    input: string,
    context: RuntimeContext
  ): Promise<{ instanceId: string; status: WorkflowInstanceStatus }> {
    // 1. 加载定义
    const definition = await this.definitionService.getDefinition(definitionId);
    if (!definition) {
      throw new Error(`Workflow definition not found: ${definitionId}`);
    }

    if (definition.status !== 'active') {
      throw new Error(`Workflow definition is not active: ${definition.status}`);
    }

    // 2. 创建 Instance
    const instance = await this.stateService.createInstance(
      context.organizationId,
      context.agentId,
      definitionId,
      input,
      definition.nodes,
      definition.edges
    );

    // 3. 更新状态为 running
    await this.stateService.updateInstanceStatus(instance.id, 'running');

    // 4. 写入审计
    await this.recordAudit(instance.id, 'WORKFLOW_STARTED', {
      definitionId,
      input,
      organizationId: context.organizationId,
    });

    return { instanceId: instance.id, status: 'running' };
  }

  /**
   * 执行 Workflow（处理下一个 Step）
   */
  async executeNextStep(
    instanceId: string,
    context: RuntimeContext
  ): Promise<{
    instanceId: string;
    status: WorkflowInstanceStatus;
    stepResult?: any;
    completed: boolean;
  }> {
    // 0. 从 Workflow Instance 获取 agentId（如果 context 中没有）
    if (!context.agentId) {
      const instance = await (this.prisma as any).enterpriseAgentWorkflow.findUnique({
        where: { id: instanceId },
        select: { agentId: true },
      });
      if (instance?.agentId) {
        context.agentId = instance.agentId;
      }
    }

    // 1. 获取下一个待执行 Step
    const step = await this.stateService.getNextPendingStep(instanceId);
    if (!step) {
      // 没有更多 Step，完成 Workflow
      await this.completeWorkflow(instanceId);
      const instance = await this.stateService.getInstance(instanceId);
      return {
        instanceId,
        status: 'completed',
        completed: true,
        stepResult: { result: instance?.result },
      };
    }

    // 2. 更新 Step 为 running
    await this.stateService.updateStepStatus(step.id, 'running');
    const stepStartTime = Date.now();

    // 3. 获取节点配置
    const instance = await this.stateService.getInstance(instanceId);
    const definition = await this.definitionService.getDefinition(instance!.definitionId);
    const node = definition?.nodes.find(n => n.id === step.nodeId);

    // 4. 获取上一步的输出作为本步输入
    const steps = await this.stateService.getInstanceSteps(instanceId);
    const prevStep = steps.filter(s => s.status === 'completed').pop();
    const stepInput = prevStep?.output || instance?.input || '';

    // 5. 执行 Step
    const result = await this.stepExecutor.executeStep(
      step.id,
      step.nodeType,
      node?.config || {},
      stepInput,
      context
    );

    const stepDurationMs = Date.now() - stepStartTime;

    // 6. 更新 Step 结果
    await this.stateService.updateStepStatus(step.id, result.status, {
      output: result.output,
      error: result.error,
    });

    // 6.5 记录 Workflow Execution Trace (Patch-B)
    await this.recordTrace(instanceId, 'STEP_EXECUTED', {
      stepId: step.id,
      nodeType: step.nodeType,
      status: result.status,
      durationMs: stepDurationMs,
      inputSummary: stepInput.slice(0, 500),
      outputSummary: result.output?.slice(0, 500) || null,
      errorMessage: result.error || null,
    });

    if (result.status === 'waiting_approval') {
      await this.stateService.updateInstanceStatus(instanceId, 'paused', {
        currentStepId: step.nodeId,
      });
      return {
        instanceId,
        status: 'paused',
        completed: false,
        stepResult: { stepId: step.id, status: 'waiting_approval' },
      };
    }

    if (result.status === 'failed') {
      await this.stateService.updateInstanceStatus(instanceId, 'failed');
      await this.recordAudit(instanceId, 'WORKFLOW_FAILED', {
        stepId: step.id,
        error: result.error,
      });
      return {
        instanceId,
        status: 'failed',
        completed: true,
        stepResult: { error: result.error },
      };
    }

    // 7. 检查是否还有更多 Step
    const nextStep = await this.stateService.getNextPendingStep(instanceId);
    if (!nextStep) {
      // 收集所有输出作为结果
      const allSteps = await this.stateService.getInstanceSteps(instanceId);
      const finalOutput = allSteps
        .filter(s => s.output)
        .map(s => s.output)
        .join('\n\n---\n\n');
      await this.completeWorkflow(instanceId, finalOutput);
      return {
        instanceId,
        status: 'completed',
        completed: true,
        stepResult: { result: finalOutput },
      };
    }

    return {
      instanceId,
      status: 'running',
      completed: false,
      stepResult: { stepId: step.id, status: 'completed', output: result.output },
    };
  }

  /**
   * 审批通过
   */
  async approveStep(
    stepId: string,
    instanceId: string,
    context: RuntimeContext
  ): Promise<void> {
    await (this.prisma as any).enterpriseAgentWorkflowStep.update({
      where: { id: stepId },
      data: {
        approvalStatus: 'approved',
        status: 'completed',
        completedAt: new Date(),
      },
    });

    await this.stateService.updateInstanceStatus(instanceId, 'running');

    await this.recordAudit(instanceId, 'STEP_APPROVED', { stepId });
  }

  /**
   * 审批拒绝
   */
  async rejectStep(
    stepId: string,
    instanceId: string,
    context: RuntimeContext
  ): Promise<void> {
    await (this.prisma as any).enterpriseAgentWorkflowStep.update({
      where: { id: stepId },
      data: {
        approvalStatus: 'rejected',
        status: 'failed',
        completedAt: new Date(),
      },
    });

    await this.stateService.updateInstanceStatus(instanceId, 'failed');

    await this.recordAudit(instanceId, 'STEP_REJECTED', { stepId });
  }

  /**
   * 获取 Workflow 状态
   */
  async getWorkflowStatus(instanceId: string): Promise<{
    instance: any;
    steps: any[];
  } | null> {
    const instance = await this.stateService.getInstance(instanceId);
    if (!instance) return null;

    const steps = await this.stateService.getInstanceSteps(instanceId);
    return { instance, steps };
  }

  /**
   * 完成 Workflow
   */
  private async completeWorkflow(instanceId: string, result?: string): Promise<void> {
    await this.stateService.updateInstanceStatus(instanceId, 'completed', { result });
    await this.recordAudit(instanceId, 'WORKFLOW_COMPLETED', { result });
  }

  /**
   * 审计日志
   */
  private async recordAudit(instanceId: string, action: string, payload: Record<string, any>): Promise<void> {
    // 获取 workflow 的 tenantId 和 organizationId
    const workflow = await (this.prisma as any).enterpriseAgentWorkflow.findUnique({
      where: { id: instanceId },
      select: { tenantId: true, organizationId: true, agentId: true },
    });

    await (this.prisma as any).agentAuditTrail.create({
      data: {
        agentId: workflow?.agentId || undefined,
        tenantId: workflow?.tenantId || '',
        action,
        metadata: JSON.stringify(payload),
        createdAt: new Date(),
      },
    });
  }

  /**
   * Workflow Execution Trace — Patch-B
   * 记录每个 Step 的执行详情
   */
  private async recordTrace(
    instanceId: string,
    action: string,
    payload: {
      stepId?: string;
      nodeType?: string;
      status: string;
      durationMs?: number;
      tokenUsage?: number;
      cost?: number;
      inputSummary?: string;
      outputSummary?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    const workflow = await (this.prisma as any).enterpriseAgentWorkflow.findUnique({
      where: { id: instanceId },
      select: { tenantId: true, organizationId: true, agentId: true },
    });

    await (this.prisma as any).workflowExecutionTrace.create({
      data: {
        tenantId: workflow?.tenantId || '',
        organizationId: workflow?.organizationId || '',
        workflowInstanceId: instanceId,
        stepId: payload.stepId || null,
        agentId: workflow?.agentId || null,
        action,
        nodeType: payload.nodeType || null,
        status: payload.status,
        durationMs: payload.durationMs || 0,
        tokenUsage: payload.tokenUsage || 0,
        cost: payload.cost || 0,
        inputSummary: payload.inputSummary || null,
        outputSummary: payload.outputSummary || null,
        errorMessage: payload.errorMessage || null,
      },
    });
  }
}
