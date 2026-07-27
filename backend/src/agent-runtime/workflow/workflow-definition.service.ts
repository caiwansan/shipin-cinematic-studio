/**
 * agent-runtime/workflow/workflow-definition.service.ts
 * Workflow Definition Service — DAG 模板管理
 *
 * 职责：
 *   1. 创建/更新/删除 Workflow 定义
 *   2. 验证 DAG 结构合法性
 *   3. 版本管理
 */

import type { PrismaClient } from '@prisma/client';

export interface WorkflowNode {
  id: string;
  type: 'brain' | 'tool' | 'approval' | 'generate';
  name: string;
  config?: Record<string, any>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  version: number;
  status: 'draft' | 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export class WorkflowDefinitionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * 创建 Workflow 定义
   */
  async createDefinition(
    organizationId: string,
    name: string,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    description?: string
  ): Promise<WorkflowDefinition> {
    // 验证 DAG
    this.validateDAG(nodes, edges);

    const def = await (this.prisma as any).enterpriseAgentWorkflowDefinition.create({
      data: {
        organizationId,
        name,
        description: description || null,
        nodes: JSON.stringify(nodes),
        edges: JSON.stringify(edges),
        version: 1,
        status: 'draft',
      },
    });

    return this.mapToDefinition(def);
  }

  /**
   * 激活 Workflow 定义
   */
  async activateDefinition(id: string): Promise<void> {
    await (this.prisma as any).enterpriseAgentWorkflowDefinition.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  /**
   * 获取 Workflow 定义
   */
  async getDefinition(id: string): Promise<WorkflowDefinition | null> {
    const def = await (this.prisma as any).enterpriseAgentWorkflowDefinition.findUnique({
      where: { id },
    });
    return def ? this.mapToDefinition(def) : null;
  }

  /**
   * 列出组织的 Workflow 定义
   */
  async listDefinitions(organizationId: string): Promise<WorkflowDefinition[]> {
    const defs = await (this.prisma as any).enterpriseAgentWorkflowDefinition.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return defs.map(this.mapToDefinition);
  }

  /**
   * 验证 DAG 结构
   */
  private validateDAG(nodes: WorkflowNode[], edges: WorkflowEdge[]): void {
    if (!nodes || nodes.length === 0) {
      throw new Error('Workflow must have at least one node');
    }

    const nodeIds = new Set(nodes.map(n => n.id));

    // 检查边引用的节点是否存在
    for (const edge of edges) {
      if (!nodeIds.has(edge.from)) {
        throw new Error(`Edge references unknown node: ${edge.from}`);
      }
      if (!nodeIds.has(edge.to)) {
        throw new Error(`Edge references unknown node: ${edge.to}`);
      }
    }

    // 检查是否有环
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of edges) {
      adjacency.get(edge.from)!.push(edge.to);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      for (const neighbor of adjacency.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          throw new Error('Workflow DAG contains a cycle');
        }
      }
    }
  }

  private mapToDefinition(def: any): WorkflowDefinition {
    return {
      id: def.id,
      organizationId: def.organizationId,
      name: def.name,
      description: def.description,
      nodes: JSON.parse(def.nodes),
      edges: JSON.parse(def.edges),
      version: def.version,
      status: def.status,
      createdAt: def.createdAt,
      updatedAt: def.updatedAt,
    };
  }
}
