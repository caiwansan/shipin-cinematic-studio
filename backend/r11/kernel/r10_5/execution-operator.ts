/**
 * r10_5/execution-operator.ts
 *
 * R10.5 — Execution Operator Contract
 *
 * 核心定义：所有 Agent 收敛为单一 δ : S × A × C → S'
 *
 * 铁律：
 * - 不改 agent 行为逻辑
 * - 不引入新 execution model
 * - 所有 transformation 必须通过 δ 接口
 */

/**
 * Execution Operator 的类型参数化契约。
 *
 * S = system state type
 * A = agent (execution actor) type
 * C = context (prompt / graph / runtime inputs) type
 */
export interface ExecutionOperator<S = unknown, A = unknown, C = unknown> {
  /** Operator 唯一标识 */
  id: string;

  /** Operator 版本号 */
  version: string;

  /**
   * 执行一次状态转换。
   * δ : S × A × C → S'
   *
   * 纯函数约束：
   * - 相同的 (state, agent, context) triple 必须产出相同的 S'
   * - 不得产生副作用（副作用必须在 S' 的 delta 中编码）
   */
  execute(state: S, agent: A, context: C): S;
}

/**
 * Agent = δ 的参数化实例。
 * 在 R10.5 定义中，Agent 不是独立组件，而是 ExecutionOperator 的具名载体。
 */
export interface AgentDescriptor {
  name: string;
  description: string;
  operatorRef: string;
}

/**
 * ExecutionTrace = δ 链的序列化记录。
 * 每个 trace entry 记录一次 δ execution。
 */
export interface ExecutionTraceEntry {
  operatorId: string;
  agentName: string;
  timestamp: number;
  inputStateHash: string;
  outputStateHash: string;
  contextHash: string;
  deltaDescription: string;
}

export interface ExecutionTrace {
  id: string;
  domain: string;
  entries: ExecutionTraceEntry[];
}

/**
 * SystemState 的哈希函数（用于 replay 确定性验证）。
 * 只对结构字段 hash，排除 meta.timestamp。
 */
export interface SystemState {
  id: string;
  data: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

/**
 * δ 的执行结果包装。
 * 包含转换后的状态 + trace。
 */
export interface ExecutionResult<S> {
  state: S;
  traceEntry: ExecutionTraceEntry;
}
