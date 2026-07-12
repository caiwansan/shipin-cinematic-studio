// ============================================================
// Discovery Result Parser
// RC2-T002: DeepSeek Discovery Provider
//
// Parses LLM response text into structured DiscoveryResult.
// Handles: raw JSON extraction, code block unwrapping, defaults.
// ============================================================

import { DiscoveryResult } from '../../types'

export interface ParsedResult {
  success: boolean
  data?: {
    scenarios: Array<{
      scenarioId: string
      scenarioName: string
      industryId?: string
      entityCoverage?: boolean
      coverageScore: number
      confidence: number
      trend: 'up' | 'stable' | 'down'
    }>
    coverage: number
    share: number
    position: number
    raw?: string
  }
  error?: string
}

/**
 * Parse LLM response text into a structured result.
 *
 * Steps:
 * 1. Extract JSON from code blocks if present
 * 2. Try direct JSON.parse
 * 3. Calculate derived metrics (coverage % from scenario average)
 * 4. Default missing fields
 */
export function parseDiscoveryResponse(responseText: string, entity: string): ParsedResult {
  try {
    // Step 1: Extract from code blocks if wrapped in ```json ... ```
    let jsonText = responseText.trim()

    // Try to find JSON within code blocks
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim()
    }

    // Step 2: Parse JSON
    let parsed: any
    try {
      parsed = JSON.parse(jsonText)
    } catch (parseErr: any) {
      // Try to find JSON object with braces
      const jsonStart = jsonText.indexOf('{')
      const jsonEnd = jsonText.lastIndexOf('}')
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        const extracted = jsonText.substring(jsonStart, jsonEnd + 1)
        try {
          parsed = JSON.parse(extracted)
        } catch {
          return {
            success: false,
            error: `Invalid JSON response: ${parseErr.message}. Raw: ${jsonText.substring(0, 200)}`,
          }
        }
      } else {
        return {
          success: false,
          error: `No JSON found in response: ${parseErr.message}. Raw: ${jsonText.substring(0, 200)}`,
        }
      }
    }

    // Step 3: Normalize scenarios
    const scenarios = Array.isArray(parsed.scenarios)
      ? parsed.scenarios.map((s: any, index: number) => ({
          scenarioId: String(s.scenarioId || `unknown-${index}`),
          scenarioName: String(s.scenarioName || `Scenario ${index}`),
          industryId: s.industryId !== undefined ? String(s.industryId) : 'unknown',
          entityCoverage: s.entityCoverage === true || (typeof s.coverageScore === 'number' && s.coverageScore > 20),
          coverageScore: typeof s.coverageScore === 'number' ? Math.max(0, Math.min(100, s.coverageScore)) : 0,
          confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(100, s.confidence)) : 0,
          trend: ['up', 'stable', 'down'].includes(s.trend) ? s.trend : 'stable',
        }))
      : []

    // Step 4: Calculate derived coverage from scenario averages if overall not provided
    const coverage = typeof parsed.coverage === 'number'
      ? Math.max(0, Math.min(100, parsed.coverage))
      : scenarios.length > 0
        ? Math.round(scenarios.reduce((sum: number, s: any) => sum + s.coverageScore, 0) / scenarios.length)
        : 0

    // Step 5: Handle share and position
    const share = typeof parsed.share === 'number'
      ? Math.max(0, Math.min(100, parsed.share))
      : scenarios.length > 0
        ? Math.round(scenarios.reduce((sum: number, s: any) => sum + s.confidence, 0) / scenarios.length)
        : 0

    const position = typeof parsed.position === 'number'
      ? Math.max(0, Math.floor(parsed.position))
      : scenarios.length > 0
        ? Math.round(100 - coverage)
        : 50

    return {
      success: true,
      data: {
        scenarios,
        coverage,
        share,
        position,
        raw: parsed.raw !== undefined ? String(parsed.raw) : undefined,
      },
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Unexpected parse error: ${err.message}`,
    }
  }
}

/**
 * Map parsed result to DiscoveryResult DTO with metadata.
 */
export function mapToDiscoveryResult(
  parsed: NonNullable<ParsedResult['data']>,
  entity: string,
  providerName: string,
  latencyMs: number,
  inputTokens: number,
  outputTokens: number,
  cost: number,
  cached: boolean,
  retryCount: number
): DiscoveryResult {
  return {
    scenarios: parsed.scenarios.map((s) => ({
      scenarioId: s.scenarioId,
      scenarioName: s.scenarioName,
      industryId: s.industryId || 'unknown',
      entityCoverage: s.entityCoverage ?? (s.coverageScore > 20),
      coverageScore: s.coverageScore,
      confidence: s.confidence,
      trend: s.trend,
    })),
    coverage: parsed.coverage,
    share: parsed.share,
    position: parsed.position,
    meta: {
      provider: providerName as any,
      latencyMs,
      tokenUsage: {
        prompt: inputTokens,
        completion: outputTokens,
        total: inputTokens + outputTokens,
      },
      cost,
      cached,
    },
  }
}
