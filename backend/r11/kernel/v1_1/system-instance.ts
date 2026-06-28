/**
 * v1_1/system-instance.ts
 *
 * v1.1 — System Instance
 *
 * 一个"执行系统"是 δ 实例的集合。
 * 这是比较理论的基本单位。
 */
import type { ExecutionOperator } from "../r10_5/execution-operator";

/**
 * 系统实例：一个独立执行系统。
 *
 * 每个系统是一个 δ 实例集合，定义在统一的 Kernel 坐标系中。
 */
export interface SystemInstance {
  id: string;
  name: string;
  description: string;
  version: string;

  /** 该系统的所有 δ 实例 */
  operators: Map<string, ExecutionOperator>;

  /** 注册 operator */
  register(op: ExecutionOperator): void;

  /** 获取 operator */
  get(operatorId: string): ExecutionOperator | undefined;
}

/**
 * SystemInstance 默认实现。
 */
export class DefaultSystemInstance implements SystemInstance {
  id: string;
  name: string;
  description: string;
  version: string;
  operators = new Map<string, ExecutionOperator>();

  constructor(spec: {
    id: string;
    name: string;
    description: string;
    version: string;
  }) {
    this.id = spec.id;
    this.name = spec.name;
    this.description = spec.description;
    this.version = spec.version;
  }

  register(op: ExecutionOperator): void {
    this.operators.set(op.id, op);
  }

  get(operatorId: string): ExecutionOperator | undefined {
    return this.operators.get(operatorId);
  }
}
