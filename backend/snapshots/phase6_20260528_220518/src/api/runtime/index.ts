/**
 * Runtime API — Barrel
 */

export { runtimeRoutes } from './runtime.routes.js'
export { RuntimeRun, RuntimeRunEvent, NodeRunState, RunStatus } from './run.model.js'

// @phase4-owner

export const __RUNTIME_OWNER__ = {
  "entry": "narrative-gateway",
  "mode": "SYNC"
};

