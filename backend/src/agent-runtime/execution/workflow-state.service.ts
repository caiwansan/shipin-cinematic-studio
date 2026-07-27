/**
 * agent-runtime/execution/workflow-state.service.ts
 * Workflow State Service — 工作流实例状态管理
 *
 * 职责：
 *   1. 管理 Workflow Instance 和 Step 的持久化
 *   2. 状态流转控制
 *   3. 查询执行进度
 */

import type { PrismaClient } from '@prisma/client';

export type WorkflowInstanceStatus = 'pending' | 'running' | 'completed' | 'failed' | 'paused';
export type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'waiting_approval' | 'skipped';

export interface WorkflowStep {
  id: string;
  workflowInstanceId: string;
  nodeId: string;
  nodeType: string;
  status: WorkflowStepStatus;
  input?: string;
  output?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
  approvalRequired: boolean;
  approvalStatus?: 'pending' | 'approved' | 'rejected';
}

export interface WorkflowInstance {
  id: string;
  organizationId: string;
  agentId: string;
  definitionId: string;
  status: WorkflowInstanceStatus;
  input?: string;
  result?: string;
  currentStepId?: string;
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
}

export class WorkflowStateService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 创建 Workflow Instance 和 Steps
   */
  async createInstance(
    organizationId: string,
    agentId: string,
    definitionId: string,
    input: string,
    nodes: any[],
    edges: any[]
  ): Promise<WorkflowInstance> {
    // 拓扑排序确定执行顺序
    const sortedNodes = this.topologicalSort(nodes, edges);

    const instance = await (this.prisma as any).enterpriseAgentWorkflow.create({
      data: {
        organizationId,
        tenantId: organizationId,
        agentId,
        definitionId,
        status: 'pending',
        input,
        currentStepId: sortedNodes[0]?.id || null,
        startedAt: new Date(),
      },
    });

    // 创建 Steps
    for (let i = 0; i < sortedNodes.length; i++) {
      const node = sortedNodes[i];
      await (this.prisma as any).enterpriseAgentWorkflowStep.create({
        data: {
          workflowInstanceId: instance.id,
          nodeId: node.id,
          nodeType: node.type,
          status: 'pending',
          approvalRequired: node.type === 'approval',
          stepOrder: i,
          input: i === 0 ? JSON.stringify({ task: input }) : null,
        },
      });
    }

    return this.mapToInstance(instance);
  }

  /**
   * 获取下一个待执行的 Step
   */
  async getNextPendingStep(instanceId: string): Promise<WorkflowStep | null> {
    const steps = await (this.prisma as any).enterpriseAgentWorkflowStep.findMany({
      where: { workflowInstanceId: instanceId, status: 'pending' },
      orderBy: { stepOrder: 'asc' },
      take: 1,
    });

    if (steps.length === 0) return null;

    return this.mapToStep(steps[0]);
  }

  /**
   * 更新 Step 状态
   */
  async updateStepStatus(
    stepId: string,
    status: WorkflowStepStatus,
    updates?: { output?: string; error?: string }
  ): Promise<void> {
    await (this.prisma as any).enterpriseAgentWorkflowStep.update({
      where: { id: stepId },
      data: {
        status,
        output: updates?.output || null,
        error: updates?.error || null,
        startedAt: status === 'running' ? new Date() : undefined,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
      },
    });
  }

  /**
   * 更新 Instance 状态
   */
  async updateInstanceStatus(
    instanceId: string,
    status: WorkflowInstanceStatus,
    updates?: { result?: string; currentStepId?: string }
  ): Promise<void> {
    await (this.prisma as any).enterpriseAgentWorkflow.update({
      where: { id: instanceId },
      data: {
        status,
        result: updates?.result || null,
        currentStepId: updates?.currentStepId || undefined,
        completedAt: status === 'completed' || status === 'failed' ? new Date() : undefined,
      },
    });
  }

  /**
   * 获取 Instance 状态
   */
  async getInstance(instanceId: string): Promise<WorkflowInstance | null> {
    const instance = await (this.prisma as any).enterpriseAgentWorkflow.findUnique({
      where: { id: instanceId },
    });
    return instance ? this.mapToInstance(instance) : null;
  }

  /**
   * 获取 Instance 的所有 Steps
   */
  async getInstanceSteps(instanceId: string): Promise<WorkflowStep[]> {
    const steps = await (this.prisma as any).enterpriseAgentWorkflowStep.findMany({
      where: { workflowInstanceId: instanceId },
      orderBy: { stepOrder: 'asc' },
    });
    return steps.map(this.mapToStep);
  }

  /**
   * 拓扑排序
   */
  private topologicalSort(nodes: any[], edges: any[]): any[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const node of nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    for (const edge of edges) {
      adjacency.get(edge.from)!.push(edge.to);
      inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const sorted: any[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = nodes.find(n => n.id === nodeId);
      if (node) sorted.push(node);

      for (const neighbor of adjacency.get(nodeId) || []) {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return sorted;
  }

  private mapToInstance(instance: any): WorkflowInstance {
    return {
      id: instance.id,
      organizationId: instance.organizationId,
      agentId: instance.agentId,
      definitionId: instance.definitionId,
      status: instance.status,
      input: instance.input,
      result: instance.result,
      currentStepId: instance.currentStepId,
      startedAt: instance.startedAt,
      completedAt: instance.completedAt,
      createdAt: instance.createdAt,
    };
  }

  private mapToStep(step: any): WorkflowStep {
    return {
      id: step.id,
      workflowInstanceId: step.workflowInstanceId,
      nodeId: step.nodeId,
      nodeType: step.nodeType,
      status: step.status,
      input: step.input,
      output: step.output,
      error: step.error,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      approvalRequired: step.approvalRequired,
      approvalStatus: step.approvalStatus,
    };
  }
}
