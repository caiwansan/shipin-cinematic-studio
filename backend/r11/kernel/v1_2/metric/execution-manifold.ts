/**
 * metric/execution-manifold.ts
 *
 * v1.2 Metric Core — Execution Manifold ℳ
 *
 * ℳ = execution state manifold
 * ℳ = (X, T, C)
 *   X = execution state space
 *   T = transition dynamics
 *   C = capability activation field
 *
 * 每个 point 不是 state，而是 state + transition rule + capability activation
 */

import type { SystemInstance } from "../../v1_1/system-instance";

/**
 * 执行流形 ℳ 的三维结构。
 */
export interface ExecutionManifold {
  /** state space X — 所有可能的系统状态 */
  readonly stateSpace: StateSpace;

  /** transition dynamics T — 状态转换规则 */
  readonly transitionDynamics: TransitionDynamics;

  /** capability activation field C — 能力激活场 */
  readonly capabilityField: CapabilityActivationField;
}

/**
 * Execution state space X.
 * 系统在某个时刻的快照，由 operator 集合 + state 结构定义。
 */
export interface StateSpace {
  /** operator 标识符集合 */
  operatorIds: string[];

  /** operator 版本集合（用于检测身份 vs 行为冲突） */
  operatorVersions: Map<string, string>;

  /** state 结构图谱（链式命名拓扑） */
  structureSignature: string;
}

/**
 * Transition dynamics T.
 * 定义 state 如何通过 δ 变换。
 * 捕获 execution graph 的拓扑。
 */
export interface TransitionDynamics {
  /** 所有 δ 的 id 序列（执行顺序） */
  operatorSequence: string[];

  /** δ 连接拓扑 — 谁的 output feed 谁的 input */
  adjacencyMatrix: number[][];

  /** 平均因果深度 */
  causalDepth: number;

  /** 分支度（并行执行的可能性） */
  branchingFactor: number;
}

/**
 * Capability activation field C.
 * 系统在 domain 空间中的能力边界。
 */
export interface CapabilityActivationField {
  /** 激活的 capability 集合 */
  activatedCapabilities: string[];

  /** 能力域拓扑结构 */
  domainStructure: string;

  /** 域间引用关系 */
  domainCrossReferences: number;
}

/**
 * ℳ 上的 trajectory — 系统作为执行轨迹生成函数。
 * S := (x₀, f_exec, π_capability)
 */
export interface SystemTrajectory {
  /** 系统标识 */
  systemId: string;

  /** 初始状态 x₀ */
  initialState: StateSpace;

  /** 执行函数 f_exec — 系统的 execution graph trace */
  executionTrace: string[];

  /** 能力投影 π_capability — 能力激活序列 */
  capabilityActivationSequence: string[];

  /** 完整轨迹签名（用于 distance 计算） */
  trajectorySignature: string;
}

/**
 * 从 SystemInstance 投影到 ℳ 的 observables。
 */
export function projectToManifold(system: SystemInstance): SystemTrajectory {
  const ops = Array.from(system.operators.values());

  const stateSpace: StateSpace = {
    operatorIds: ops.map((o) => o.id),
    operatorVersions: new Map(ops.map((o) => [o.id, o.version])),
    structureSignature: ops.map((o) => o.id).sort().join("::"),
  };

  const transitionDynamics: TransitionDynamics = {
    operatorSequence: ops.map((o) => o.id),
    adjacencyMatrix: [[]],
    causalDepth: ops.length,
    branchingFactor: 1,
  };

  const capabilityField: CapabilityActivationField = {
    activatedCapabilities: stateSpace.structureSignature.split("::").slice(0, 5),
    domainStructure: stateSpace.operatorIds.length > 6 ? "cinematic" : "presentation",
    domainCrossReferences: 0,
  };

  const executionTrace = ops.map((o) => `${o.id}@${o.version}`);

  return {
    systemId: system.id,
    initialState: stateSpace,
    executionTrace,
    capabilityActivationSequence: capabilityField.activatedCapabilities,
    trajectorySignature: `${system.id}::${executionTrace.join("->")}::${capabilityField.domainStructure}`,
  };
}

/**
 * 构建 ℳ 流形。
 */
export function buildManifold(
  systems: SystemInstance[]
): ExecutionManifold {
  const trajectories = systems.map(projectToManifold);

  const allOps = new Set<string>();
  const allVersions = new Map<string, string>();
  for (const t of trajectories) {
    for (const id of t.initialState.operatorIds) allOps.add(id);
    for (const [id, ver] of t.initialState.operatorVersions) {
      allVersions.set(id, ver);
    }
  }

  const stateSpace: StateSpace = {
    operatorIds: Array.from(allOps),
    operatorVersions: allVersions,
    structureSignature: Array.from(allOps).sort().join("::"),
  };

  const transitionDynamics: TransitionDynamics = {
    operatorSequence: trajectories[0]?.executionTrace ?? [],
    adjacencyMatrix: [[]],
    causalDepth: trajectories.reduce((max, t) => Math.max(max, t.executionTrace.length), 0),
    branchingFactor: 1,
  };

  const allCaps = new Set<string>();
  for (const t of trajectories) {
    for (const cap of t.capabilityActivationSequence) allCaps.add(cap);
  }

  const capabilityField: CapabilityActivationField = {
    activatedCapabilities: Array.from(allCaps),
    domainStructure: "mixed",
    domainCrossReferences: 0,
  };

  return { stateSpace, transitionDynamics, capabilityField };
}

/**
 * 计算 execution graph 的 graph edit distance。
 * 用于 d_exec 距离函数。
 */
export function graphEditDistance(
  opsA: string[],
  opsB: string[]
): number {
  // 最小编辑距离：insert/delete/rename operator
  const m = opsA.length;
  const n = opsB.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0)
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = opsA[i - 1] === opsB[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const maxLen = Math.max(m, n);
  return maxLen > 0 ? dp[m][n] / maxLen : 0;
}

/**
 * State dynamics divergence（metric 分量）。
 * 比较两个 trajectory 的 state 演化序列。
 */
export function stateDynamicsDivergence(
  traceA: string[],
  traceB: string[]
): number {
  if (traceA.length === 0 && traceB.length === 0) return 0;

  // Jaccard-like overlap on state transitions
  const setA = new Set(traceA);
  const setB = new Set(traceB);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  const jaccard = union.size > 0 ? intersection.size / union.size : 1;

  // 序列结构相似度（edit distance on sequences）
  const seqDist = graphEditDistance(traceA, traceB);

  return (1 - jaccard) * 0.5 + seqDist * 0.5;
}

/**
 * Capability activation sequence distance.
 * 比较两个系统的能力激活模式。
 */
export function capabilitySequenceDistance(
  capsA: string[],
  capsB: string[]
): number {
  if (capsA.length === 0 && capsB.length === 0) return 0;
  return graphEditDistance(capsA, capsB);
}
