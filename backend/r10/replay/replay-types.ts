/**
 * r10/replay/replay-types.ts
 *
 * R10 — Replay Layer 类型系统
 *
 * 回放系统：以 R9 snapshot 为 deterministic seed，执行纯复制 + 验证。
 * 不依赖外部状态，不做 AI 判断。
 */

export interface ReplayInput {
  /** R9 baseline snapshot or any saved state */
  snapshot: any;
  /** Optional execution parameters */
  params?: any;
}

export interface ReplayOutput {
  runId: string;
  output: any;
  trace: {
    steps: string[];
  };
}

export interface ReplayComparison {
  baselineId: string;
  replayId: string;
  originalOutput: any;
  replayedOutput: any;
  isDeterministic: boolean;
}

export interface ReplayResult {
  runId: string;
  status: "SUCCESS" | "DRIFT_DETECTED" | "ERROR";
  output: any;
  error?: string;
  trace: {
    steps: string[];
  };
}
