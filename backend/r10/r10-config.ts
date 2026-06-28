/**
 * r10/r10-config.ts
 *
 * R10 — Feature Flag
 *
 * 默认关闭。
 * 所有 R10 模块禁止访问主 runtime。
 */

export interface R10Config {
  /** Master switch — when false, all R10 modules are no-ops */
  enabled: boolean;

  /** Diff kernel settings */
  diff: {
    /** Max depth for recursive comparison */
    maxDepth: number;
    /** Skip EQUAL nodes in output (reduce noise) */
    skipEqual: boolean;
  };

  /** Replay engine settings */
  replay: {
    /** Enable determinism check on replay */
    determinismCheck: boolean;
  };
}

export const DEFAULT_R10_CONFIG: R10Config = {
  enabled: false,
  diff: {
    maxDepth: 10,
    skipEqual: false,
  },
  replay: {
    determinismCheck: true,
  },
};

let _config: R10Config = { ...DEFAULT_R10_CONFIG };

export function getR10Config(): R10Config {
  return { ..._config };
}

export function setR10Config(partial: Partial<R10Config>): void {
  _config = { ..._config, ...partial };
}

/** Convenience check used by all R10 entry points */
export function isR10Enabled(): boolean {
  return _config.enabled;
}
