/**
 * useWorkspaceState
 *
 * Single reactive entry point for GEO Workspace state management.
 * Composes Page / Task / Card state machines into one reactive object.
 *
 * Architecture constraints:
 *   - SSR safe: no timers, no DOM, no global state
 *   - Multi-instance safe: each call creates independent instances
 *   - No existing store/component/page modification
 *
 * Part of S1.1B-01 Workspace State Core.
 */

import type {
  PageState,
  TaskState,
  TaskProgress,
  CardState,
  PageStateMachine,
  TaskStateMachine,
  CardStateMachine,
  WorkspaceState,
  WorkflowSemanticState,
  WorkflowSemanticStateMachine,
} from '../types/state'

import {
  PAGE_STATES,
  TASK_STATES,
  TASK_TERMINAL_STATES,
  CARD_STATES,
  CARD_TERMINAL_STATES,
  WORKFLOW_SEMANTIC_STATES,
} from '../types/state'

import {
  transitionPage as checkPageTransition,
  transitionTask as checkTaskTransition,
  transitionCard as checkCardTransition,
  transitionSemantic as checkSemanticTransition,
} from '../lib/state-machines'

// ── Page State Machine ──

function createPageStateMachine(): PageStateMachine {
  let current: PageState = 'idle'
  let last: PageState | null = null

  function transition(target: PageState): boolean {
    if (!checkPageTransition(current, target)) return false
    last = current
    current = target
    return true
  }

  function reset(): void {
    last = current
    current = 'idle'
  }

  return {
    get current() { return current },
    get last() { return last },
    transition,
    reset,
  }
}

// ── Task State Machine ──

function createTaskStateMachine(): TaskStateMachine {
  let current: TaskState = 'idle'
  let last: TaskState | null = null
  let progress: TaskProgress = { percent: 0 }

  function transition(target: TaskState): boolean {
    if (!checkTaskTransition(current, target)) return false
    last = current
    current = target
    // Reset progress on reset transitions
    if (['queued', 'idle'].includes(target)) {
      progress = { percent: 0 }
    }
    return true
  }

  function setProgress(p: TaskProgress): void {
    // Constrain percent
    progress = { ...p, percent: Math.max(0, Math.min(100, p.percent)) }
  }

  function reset(): void {
    last = current
    current = 'idle'
    progress = { percent: 0 }
  }

  return {
    get current() { return current },
    get last() { return last },
    get progress() { return progress },
    transition,
    setProgress,
    reset,
  }
}

// ── Card State Machine ──

function createCardStateMachine(undoWindow = 30000): CardStateMachine {
  let current: CardState = 'collapsed'
  let last: CardState | null = null

  function transition(target: CardState): boolean {
    if (!checkCardTransition(current, target)) return false
    last = current
    current = target
    return true
  }

  function reset(): void {
    last = current
    current = 'collapsed'
  }

  return {
    get current() { return current },
    get last() { return last },
    undoWindow,
    transition,
    reset,
  }
}

// ── Workflow Semantic State Machine (S1.2C-SM-001) ──
//
// Pure description layer. UI must NOT read these states.
// Intentionally decoupled from Page/Task/Card state — semantic state is
// set externally by orchestration through transitionSemantic checks.

function createWorkflowSemanticMachine(): WorkflowSemanticStateMachine {
  let current: WorkflowSemanticState = 'ENTRY_START'
  let last: WorkflowSemanticState | null = null

  function transition(target: WorkflowSemanticState): boolean {
    if (!checkSemanticTransition(current, target)) return false
    last = current
    current = target
    return true
  }

  function reset(): void {
    last = current
    current = 'ENTRY_START'
  }

  return {
    get current() { return current },
    get last() { return last },
    transition,
    reset,
  }
}

// ── Composite Workspace State ──

/**
 * Create a new independent WorkspaceState instance.
 *
 * SSR safe: no global state, no timers, no side effects on construction.
 * Multi-instance safe: each call creates isolated state machines.
 *
 * Semantic state is a pure layer — UI must NOT read `semantic.current`.
 */
export function useWorkspaceState(undoWindow?: number): WorkspaceState {

// ── Module-level singleton for orchestration ──
// Only use getWorkspaceState() for core orchestration (semantic router).
// UI components should still use useWorkspaceState() for scoped instances.

let _sharedInstance: WorkspaceState | null = null

/**
 * getWorkspaceState — singleton accessor
 *
 * Returns a shared WorkspaceState instance.
 * Use ONLY for orchestration hooks (useSemanticRouter, event listeners).
 * UI components must NOT use this — they need scoped instances.
 */
export function getWorkspaceState(): WorkspaceState {
  if (!_sharedInstance) {
    _sharedInstance = (() => {
      const page = createPageStateMachine()
      const task = createTaskStateMachine()
      const card = createCardStateMachine()
      const semantic = createWorkflowSemanticMachine()
      return {
        page, task, card, semantic,
        get isIdle() {
          const terminalTask = ['completed', 'failed', 'cancelled']
          return (
            page.current === 'idle' ||
            (page.current === 'ready' && task.current === 'idle') ||
            (['ready', 'empty'].includes(page.current) && terminalTask.includes(task.current))
          )
        },
        reset() {
          page.reset(); task.reset(); card.reset(); semantic.reset()
        },
      }
    })()
  }
  return _sharedInstance
}
  const page = createPageStateMachine()
  const task = createTaskStateMachine()
  const card = createCardStateMachine(undoWindow)
  const semantic = createWorkflowSemanticMachine()

  return {
    page,
    task,
    card,
    semantic,
    get isIdle() {
      const terminalTask = ['completed', 'failed', 'cancelled']
      return (
        page.current === 'idle' ||
        (page.current === 'ready' && task.current === 'idle') ||
        (['ready', 'empty'].includes(page.current) && terminalTask.includes(task.current))
      )
    },
    reset() {
      page.reset()
      task.reset()
      card.reset()
      semantic.reset()
    },
  }
}
