/**
 * r10_5/execution-engine.ts
 *
 * R10.5 — Unified Execution Engine
 *
 * 统一执行引擎：所有状态变化都通过 δ(S, A, C) 完成。
 *
 * 职责：
 *   1. 接收 operator + state + agent + context
 *   2. 执行 δ
 *   3. 记录 trace
 *   4. 返回 transformed state + trace entry
 *
 * 铁律：
 * - 不修改 operator 行为
 * - 不添加副作用
 * - trace 只记录不分析
 */

import type { ExecutionOperator, SystemState, ExecutionTraceEntry, ExecutionResult } from "./execution-operator";

export class ExecutionEngine {
  private traceLog: Map<string, ExecutionTraceEntry[]> = new Map();

  /**
   * 执行一次 δ transformation。
   *
   * @param operator — δ instance
   * @param state — 当前系统状态 S
   * @param agent — agent 参数化 A
   * @param context — 执行上下文 C
   * @returns 转换后的状态 + trace entry
   */
  run<S, A, C>(
    operator: ExecutionOperator<S, A, C>,
    state: S,
    agent: A,
    context: C
  ): ExecutionResult<S> {
    const beforeState = this.hashState(state as any);

    const newState = operator.execute(state, agent, context);

    const afterState = this.hashState(newState as any);

    const entry: ExecutionTraceEntry = {
      operatorId: operator.id,
      agentName: (agent as any)?.name ?? "unknown",
      timestamp: Date.now(),
      inputStateHash: beforeState,
      outputStateHash: afterState,
      contextHash: this.hashContext(context as any),
      deltaDescription: `${operator.id} → ${
        beforeState === afterState ? "no_change" : "state_transformed"
      }`,
    };

    // 记录 trace
    const trace = this.traceLog.get(operator.id) ?? [];
    trace.push(entry);
    this.traceLog.set(operator.id, trace);

    return { state: newState, traceEntry: entry };
  }

  /**
   * 批量执行多个 δ transformations（composition）。
   * 每个后续 operator 的输入是前一个的输出。
   */
  runSequence<S, A, C>(
    operators: ExecutionOperator<S, A, C>[],
    initialState: S,
    agents: A[],
    contexts: C[]
  ): ExecutionResult<S>[] {
    const results: ExecutionResult<S>[] = [];
    let currentState = initialState;

    for (let i = 0; i < operators.length; i++) {
      const result = this.run(
        operators[i],
        currentState,
        agents[i] ?? ({} as A),
        contexts[i] ?? ({} as C)
      );
      results.push(result);
      currentState = result.state;
    }

    return results;
  }

  /**
   * 获取指定 operator 的 trace 历史。
   */
  getTrace(operatorId: string): ExecutionTraceEntry[] {
    return this.traceLog.get(operatorId) ?? [];
  }

  /**
   * 获取所有 trace。
   */
  getAllTraces(): Map<string, ExecutionTraceEntry[]> {
    return new Map(this.traceLog);
  }

  /**
   * 清除 trace 历史。
   */
  clearTraces(): void {
    this.traceLog.clear();
  }

  /**
   * 对状态结构字段 hash（排除 meta.timestamp）。
   */
  private hashState(state: SystemState): string {
    const { meta, ...rest } = state;
    const clean = { ...rest };
    return this.simpleHash(JSON.stringify(clean));
  }

  /**
   * 对 context 做 hash。
   */
  private hashContext(context: Record<string, unknown>): string {
    return this.simpleHash(JSON.stringify(context));
  }

  /**
   * 简单 string hash（足够用于确定性验证）。
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return hash.toString(16);
  }
}
