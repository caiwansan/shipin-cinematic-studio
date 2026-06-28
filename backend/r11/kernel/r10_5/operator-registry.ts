/**
 * r10_5/operator-registry.ts
 *
 * R10.5 — Operator Registry
 *
 * 所有 δ 实例的注册中心。
 * 短剧工作台的 8 个 agent 全部注册于此。
 */

import type { ExecutionOperator } from "./execution-operator";

export class OperatorRegistry {
  private operators = new Map<string, ExecutionOperator>();

  /**
   * 注册一个 δ 实例。
   * 同名覆盖（允许版本升级）。
   */
  register(op: ExecutionOperator): void {
    this.operators.set(op.id, op);
  }

  /**
   * 根据 id 获取 δ 实例。
   */
  get(id: string): ExecutionOperator | undefined {
    return this.operators.get(id);
  }

  /**
   * 列出所有注册的 δ 实例。
   */
  list(): ExecutionOperator[] {
    return Array.from(this.operators.values());
  }

  /**
   * 移除一个 δ 实例。
   */
  unregister(id: string): boolean {
    return this.operators.delete(id);
  }

  /**
   * 检查 δ 是否已注册。
   */
  has(id: string): boolean {
    return this.operators.has(id);
  }
}
