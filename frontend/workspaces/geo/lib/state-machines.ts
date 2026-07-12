/**
 * GEO Workspace State Machines
 *
 * Transition matrices for Page / Task / Card state machines.
 * All illegal transitions are silently rejected (return false).
 *
 * Architecture constraint:
 *   Transition rules are defined once here. No ad-hoc transitions elsewhere.
 *
 * Part of S1.1B-01 Workspace State Core.
 */

import {
  PAGE_STATES,
  TASK_STATES,
  TASK_TERMINAL_STATES,
  CARD_STATES,
  CARD_TERMINAL_STATES,
  WORKFLOW_SEMANTIC_STATES,
  type PageState,
  type TaskState,
  type CardState,
  type WorkflowSemanticState,
} from '../types/state'

// ── Transition Matrix: Page ──

const PAGE_TRANSITIONS: Record<PageState, ReadonlySet<PageState>> = {
  idle:     new Set(['loading']),
  loading:  new Set(['ready', 'empty', 'error']),
  ready:    new Set(['loading']),
  empty:    new Set(['loading']),
  error:    new Set(['loading']),
}

// ── Transition Matrix: Task ──

const TASK_TRANSITIONS: Record<TaskState, ReadonlySet<TaskState>> = {
  idle:      new Set(['queued']),
  queued:    new Set(['running', 'cancelled']),
  running:   new Set(['paused', 'failed', 'completed']),
  paused:    new Set(['running', 'cancelled']),
  failed:    new Set(),
  cancelled: new Set(),
  completed: new Set(),
}

// ── Transition Matrix: Card ──

const CARD_TRANSITIONS: Record<CardState, ReadonlySet<CardState>> = {
  collapsed:  new Set(['expanded']),
  expanded:   new Set(['collapsed', 'executing']),
  executing:  new Set(['completed', 'collapsed']),
  completed:  new Set(['undo', 'dismissed']),
  undo:       new Set(['collapsed', 'dismissed']),
  dismissed:  new Set(),
}

// ── Guard: Terminal State ──

function isTerminal<T extends TaskState | CardState>(
  state: T,
  terminalSet: ReadonlySet<T>,
): boolean {
  return terminalSet.has(state)
}

// ── Public API ──

/**
 * Attempt a page state transition.
 * Returns true if allowed, false if rejected.
 */
export function transitionPage(current: PageState, target: PageState): boolean {
  const allowed = PAGE_TRANSITIONS[current]
  return allowed ? allowed.has(target) : false
}

/**
 * Attempt a task state transition.
 * Terminal states reject all transitions.
 */
export function transitionTask(current: TaskState, target: TaskState): boolean {
  if (isTerminal(current, TASK_TERMINAL_STATES)) return false
  const allowed = TASK_TRANSITIONS[current]
  return allowed ? allowed.has(target) : false
}

/**
 * Attempt a card state transition.
 * Terminal states reject all transitions.
 */
export function transitionCard(current: CardState, target: CardState): boolean {
  if (isTerminal(current, CARD_TERMINAL_STATES)) return false
  const allowed = CARD_TRANSITIONS[current]
  return allowed ? allowed.has(target) : false
}

/**
 * Return the full page transition matrix.
 * Useful for debugging, lock hashing, and docs generation.
 */
export function getPageTransitionMatrix(): Record<PageState, PageState[]> {
  const result = {} as Record<PageState, PageState[]>
  for (const state of PAGE_STATES) {
    result[state] = Array.from(PAGE_TRANSITIONS[state] || [])
  }
  return result
}

/**
 * Return the full task transition matrix.
 */
export function getTaskTransitionMatrix(): Record<TaskState, TaskState[]> {
  const result = {} as Record<TaskState, TaskState[]>
  for (const state of TASK_STATES) {
    result[state] = Array.from(TASK_TRANSITIONS[state] || [])
  }
  return result
}

/**
 * Return the full card transition matrix.
 */
export function getCardTransitionMatrix(): Record<CardState, CardState[]> {
  const result = {} as Record<CardState, CardState[]>
  for (const state of CARD_STATES) {
    result[state] = Array.from(CARD_TRANSITIONS[state] || [])
  }
  return result
}

// ── Workflow Semantic Transition Matrix (S1.2C-SM-001) ──
//
// Pure description layer. Only traces workflow-level meaning.
// UI must NOT reference these states.

export const SEMANTIC_TRANSITIONS: Record<WorkflowSemanticState, ReadonlySet<WorkflowSemanticState>> = {
  ENTRY_START:            new Set(['FIRST_MISSION_CREATED']),
  FIRST_MISSION_CREATED:  new Set(['WORKFLOW_ACTIVE', 'WORKFLOW_COMPLETED']),
  WORKFLOW_ACTIVE:        new Set(['WORKFLOW_COMPLETED']),
  WORKFLOW_COMPLETED:     new Set(['WORKFLOW_EXIT']),
  WORKFLOW_EXIT:          new Set(),  // terminal
}

/**
 * Attempt a semantic state transition.
 * Returns false for illegal jumps (e.g. ENTRY_START → WORKFLOW_COMPLETED).
 * Terminals reject all transitions.
 */
export function transitionSemantic(
  current: WorkflowSemanticState,
  target: WorkflowSemanticState,
): boolean {
  const allowed = SEMANTIC_TRANSITIONS[current]
  return allowed ? allowed.has(target) : false
}

/**
 * Return the full semantic transition matrix.
 */
export function getSemanticTransitionMatrix(): Record<WorkflowSemanticState, WorkflowSemanticState[]> {
  const result = {} as Record<WorkflowSemanticState, WorkflowSemanticState[]>
  for (const state of WORKFLOW_SEMANTIC_STATES) {
    result[state] = Array.from(SEMANTIC_TRANSITIONS[state] || [])
  }
  return result
}

export { PAGE_TRANSITIONS, TASK_TRANSITIONS, CARD_TRANSITIONS }
