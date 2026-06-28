// ============================================================
// Review Validator — Validate execution results against criteria
// ============================================================

import type { ExecutionData, ExecutionResultData } from '../types.js'

export interface ValidationResult {
  valid: boolean
  score: number
  issues: string[]
  summary: string
}

export class ReviewValidator {
  /**
   * Validate execution results
   */
  async validate(execution: ExecutionData, results: ExecutionResultData[]): Promise<ValidationResult> {
    const issues: string[] = []

    // Check if execution succeeded
    if (execution.status === 'failed') {
      return {
        valid: false,
        score: 0,
        issues: ['Execution failed: ' + (execution.error || 'Unknown error')],
        summary: 'Execution failed',
      }
    }

    // Check if results exist
    if (!results || results.length === 0) {
      return {
        valid: false,
        score: 0,
        issues: ['No results generated'],
        summary: 'No results to review',
      }
    }

    // Check for error results
    const errorResults = results.filter(r => r.type === 'error')
    if (errorResults.length > 0) {
      for (const err of errorResults) {
        issues.push(`Result error: ${err.summary}`)
      }
    }

    // Calculate score based on success ratio
    const successResults = results.filter(r => r.type !== 'error')
    const score = results.length > 0 ? Math.round((successResults.length / results.length) * 10) : 0

    const valid = errorResults.length === 0

    return {
      valid,
      score,
      issues,
      summary: valid
        ? `All ${results.length} results valid (score: ${score}/10)`
        : `${issues.length} issue(s) found (score: ${score}/10)`,
    }
  }

  /**
   * Quick validation: check if execution has output
   */
  async hasOutput(execution: ExecutionData): Promise<boolean> {
    return !!execution.output && execution.output.length > 0
  }

  /**
   * Compare execution output against expected criteria
   */
  async matchCriteria(execution: ExecutionData, criteria: string[]): Promise<{ matched: string[]; missing: string[] }> {
    if (!execution.output) {
      return { matched: [], missing: criteria }
    }

    const outputStr = execution.output.toLowerCase()
    const matched: string[] = []
    const missing: string[] = []

    for (const criterion of criteria) {
      if (outputStr.includes(criterion.toLowerCase())) {
        matched.push(criterion)
      } else {
        missing.push(criterion)
      }
    }

    return { matched, missing }
  }
}

export const reviewValidator = new ReviewValidator()
