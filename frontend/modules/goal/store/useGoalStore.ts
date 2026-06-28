// ============================================================
// Goal Store — state management for Goal Runtime
// ============================================================

import { reactive, computed } from 'vue'
import { goalService } from '../services/goal.service'
import type {
  Goal, Strategy, Workflow, WorkflowStage, Task, Action,
  Execution, ExecutionResult, Review, GoalStats, GoalFilter,
} from '../types/index'

interface GoalStoreState {
  goals: Goal[]
  goalsTotal: number
  strategies: Strategy[]
  workflows: Workflow[]
  stages: WorkflowStage[]
  tasks: Task[]
  actions: Action[]
  executions: Execution[]
  executionResults: ExecutionResult[]
  reviews: Review[]
  stats: GoalStats
  selectedGoal: Goal | null
  selectedStrategy: Strategy | null
  selectedWorkflow: Workflow | null
  loading: boolean
  error: string | null
}

const initialState: GoalStoreState = {
  goals: [],
  goalsTotal: 0,
  strategies: [],
  workflows: [],
  stages: [],
  tasks: [],
  actions: [],
  executions: [],
  executionResults: [],
  reviews: [],
  stats: {
    totalGoals: 0, activeGoals: 0, completedGoals: 0,
    totalStrategies: 0, totalTasks: 0, pendingTasks: 0,
    runningTasks: 0, completedTasks: 0, failedTasks: 0,
    totalExecutions: 0, pendingReviews: 0,
  },
  selectedGoal: null,
  selectedStrategy: null,
  selectedWorkflow: null,
  loading: false,
  error: null,
}

const state = reactive<GoalStoreState>({ ...initialState })

export function useGoalStore() {
  function setLoading(loading: boolean) { state.loading = loading }
  function setError(error: string | null) { state.error = error }

  // ─── Goals ───

  async function fetchGoals(filter: GoalFilter): Promise<boolean> {
    state.loading = true
    state.error = null
    try {
      const result = await goalService.listGoals(filter)
      state.goals = result.items
      state.goalsTotal = result.total
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function createGoal(data: { projectId: string; title: string; description?: string; successCriteria?: string; targetMetric?: string }): Promise<Goal | null> {
    state.loading = true
    try {
      const goal = await goalService.createGoal(data)
      if (goal) {
        state.goals.unshift(goal)
        state.goalsTotal++
      }
      return goal
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  async function selectGoal(id: string): Promise<boolean> {
    state.loading = true
    try {
      const goal = await goalService.getGoal(id)
      if (goal) {
        state.selectedGoal = goal
        return true
      }
      return false
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  // ─── Strategies ───

  async function fetchStrategies(goalId: string): Promise<boolean> {
    state.loading = true
    try {
      const result = await goalService.listStrategies(goalId)
      state.strategies = result.items
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function generateStrategies(goalId: string): Promise<boolean> {
    state.loading = true
    try {
      const strategies = await goalService.generateStrategies(goalId)
      state.strategies = strategies
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  // ─── Workflows ───

  async function fetchWorkflows(strategyId: string): Promise<boolean> {
    state.loading = true
    try {
      const workflows = await goalService.listWorkflows(strategyId)
      state.workflows = workflows
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function generateWorkflows(strategyId: string): Promise<boolean> {
    state.loading = true
    try {
      const workflows = await goalService.generateWorkflows(strategyId)
      state.workflows = workflows
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  // ─── Tasks ───

  async function fetchTasks(filter?: { goalId?: string; strategyId?: string; status?: string }): Promise<boolean> {
    state.loading = true
    try {
      const result = await goalService.listTasks(filter)
      state.tasks = result.items
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function generateTasks(strategyId: string, workflowId?: string): Promise<boolean> {
    state.loading = true
    try {
      const tasks = await goalService.generateTasks(strategyId, workflowId)
      state.tasks = tasks
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  // ─── Executions ───

  async function fetchExecutions(taskId?: string): Promise<boolean> {
    state.loading = true
    try {
      const result = await goalService.listExecutions(taskId)
      state.executions = result.items
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  async function triggerExecution(taskId: string): Promise<boolean> {
    state.loading = true
    try {
      const result = await goalService.triggerExecution(taskId)
      if (result) {
        state.executions.unshift(result.execution)
        state.executionResults = result.results
      }
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  // ─── Reviews ───

  async function fetchReviews(executionId?: string): Promise<boolean> {
    state.loading = true
    try {
      const reviews = await goalService.listReviews(executionId)
      state.reviews = reviews
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    } finally {
      state.loading = false
    }
  }

  // ─── Pipeline ───

  async function runPipeline(projectId: string, title: string, options?: any): Promise<any> {
    state.loading = true
    try {
      const result = await goalService.runPipeline(projectId, title, options)
      return result
    } catch (err: any) {
      state.error = err.message
      return null
    } finally {
      state.loading = false
    }
  }

  // ─── Stats ───

  async function fetchStats(projectId: string): Promise<boolean> {
    try {
      const stats = await goalService.getGoalStats(projectId)
      if (stats) state.stats = stats
      return true
    } catch (err: any) {
      state.error = err.message
      return false
    }
  }

  // ─── Reset ───

  function reset() {
    Object.assign(state, initialState)
  }

  return {
    state: state as Readonly<GoalStoreState>,

    goals: computed(() => state.goals),
    goalsTotal: computed(() => state.goalsTotal),
    strategies: computed(() => state.strategies),
    workflows: computed(() => state.workflows),
    stages: computed(() => state.stages),
    tasks: computed(() => state.tasks),
    actions: computed(() => state.actions),
    executions: computed(() => state.executions),
    executionResults: computed(() => state.executionResults),
    reviews: computed(() => state.reviews),
    stats: computed(() => state.stats),
    selectedGoal: computed(() => state.selectedGoal),
    loading: computed(() => state.loading),
    error: computed(() => state.error),

    setLoading,
    setError,
    fetchGoals,
    createGoal,
    selectGoal,
    fetchStrategies,
    generateStrategies,
    fetchWorkflows,
    generateWorkflows,
    fetchTasks,
    generateTasks,
    fetchExecutions,
    triggerExecution,
    fetchReviews,
    runPipeline,
    fetchStats,
    reset,
  }
}
