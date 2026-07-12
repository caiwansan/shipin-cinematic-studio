/**
 * GEO Workspace State Types
 *
 * Defines four state machines:
 *   1. Page State — Idle → Loading → (Ready | Empty | Error)
 *   2. Task State — Idle → Queued → Running → (Paused | Failed | Cancelled | Completed)
 *   3. Card State — Collapsed → Expanded → Executing → Completed → (Undo | Dismissed)
 *   4. Semantic State — Workflow-level meaning layer (S1.2C-SM-001)
 *
 * Architecture constraint:
 *   - Semantic state is a pure description layer. UI components must NOT read semantic state.
 *   - Semantic state does NOT drive behavior, redirection, or orchestration.
 *   - Part of S1.1B-01 Workspace State Core.
 */

// ── Page State Machine ──

export const PAGE_STATES = [
  'idle',
  'loading',
  'ready',
  'empty',
  'error',
] as const

export type PageState = (typeof PAGE_STATES)[number]

export interface PageStateMachine {
  current: PageState
  last: PageState | null
  transition(target: PageState): boolean
  reset(): void
}

// ── Task State Machine ──

export const TASK_STATES = [
  'idle',
  'queued',
  'running',
  'paused',
  'failed',
  'cancelled',
  'completed',
] as const

export type TaskState = (typeof TASK_STATES)[number]

/** Terminal states cannot transition out of. */
export const TASK_TERMINAL_STATES: ReadonlySet<TaskState> = new Set([
  'failed',
  'cancelled',
  'completed',
])

export interface TaskProgress {
  percent: number    // 0-100
  message?: string
}

export interface TaskStateMachine {
  current: TaskState
  last: TaskState | null
  progress: TaskProgress
  transition(target: TaskState): boolean
  setProgress(p: TaskProgress): void
  reset(): void
}

// ── Card State Machine ──

export const CARD_STATES = [
  'collapsed',
  'expanded',
  'executing',
  'completed',
  'undo',
  'dismissed',
] as const

export type CardState = (typeof CARD_STATES)[number]

/** Terminal states cannot transition out of. */
export const CARD_TERMINAL_STATES: ReadonlySet<CardState> = new Set([
  'dismissed',
])

export interface CardStateMachine {
  current: CardState
  last: CardState | null
  /** Time window for undo in ms (default 30000) */
  undoWindow: number
  transition(target: CardState): boolean
  reset(): void
}

// ── Workflow Semantic State Machine (S1.2C-SM-001) ──
//
// Pure description layer. UI must NOT read these states.
// These states exist for interpretability / future orchestration only.

export const WORKFLOW_SEMANTIC_STATES = [
  'ENTRY_START',
  'FIRST_MISSION_CREATED',
  'WORKFLOW_ACTIVE',
  'WORKFLOW_COMPLETED',
  'WORKFLOW_EXIT',
] as const

export type WorkflowSemanticState = (typeof WORKFLOW_SEMANTIC_STATES)[number]

export interface WorkflowSemanticStateMachine {
  current: WorkflowSemanticState
  last: WorkflowSemanticState | null
  transition(target: WorkflowSemanticState): boolean
  reset(): void
}

/**
 * SprintScope describes the current sprint's entry/exit semantics.
 * Used by debug/trace tooling only.
 */
export interface SprintScope {
  entryStarted: boolean       // true when semantic === 'ENTRY_START'
  firstMissionCreated: boolean
  workflowActive: boolean
  workflowCompleted: boolean
  workflowExited: boolean
}

// ── Composite Workspace State ──

export interface WorkspaceState {
  page: PageStateMachine
  task: TaskStateMachine
  card: CardStateMachine
  /** Composed helper: true when page/task/card are all terminal/idle */
  get isIdle(): boolean
  /** Workflow semantic meaning layer (S1.2C-SM-001). UI must NOT read this. */
  semantic: WorkflowSemanticStateMachine
  reset(): void
}
