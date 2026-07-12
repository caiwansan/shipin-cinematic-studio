// ============================================================
// DeepSeek Discovery Provider
// RC2-T002: DeepSeek Discovery Provider
//
// Implements GeoAIProvider interface for DeepSeek API.
// - Discovery: calls DeepSeek chat completions with structured prompts
// - Verification: uses DeepSeek for claim verification
// - Health: lightweight ping check
// - Auto-retry on schema validation failure
// - Token usage, cost, latency tracking
// ============================================================

import { GeoAIProvider, ProviderName, GeoCapability, DiscoveryRequest, DiscoveryResult, VerificationRequest, VerificationResult } from './types'
import { DeepSeekConfig, loadDeepSeekConfig, calculateCost } from './deepseek-config'
import { buildDiscoveryMessages, buildRetryMessage, ScenarioContext } from './prompts/discovery/templates'
import { parseDiscoveryResponse, mapToDiscoveryResult } from './prompts/discovery/parser'
import { validateDiscoveryResult } from './prompts/discovery/validator'
import { scenarioStore } from '../../../benchmark/scenario/scenario-store'

export class DeepSeekProvider implements GeoAIProvider {
  readonly name: ProviderName = 'deepseek'
  readonly displayName = 'DeepSeek'
  readonly capabilities: GeoCapability[] = ['discovery', 'verification']

  private config: DeepSeekConfig
  private lastTokenUsage: { prompt: number; completion: number; total: number } = { prompt: 0, completion: 0, total: 0 }

  constructor(config?: Partial<DeepSeekConfig>) {
    this.config = loadDeepSeekConfig(config)
  }

  /**
   * Update the config at runtime.
   */
  updateConfig(config: Partial<DeepSeekConfig>): void {
    this.config = loadDeepSeekConfig(config)
  }

  /**
   * Get current config (sans API key for safety).
   */
  getConfig(): Record<string, any> & { apiKeyConfigured: boolean } {
    return {
      ...this.config,
      apiKey: '***' + this.config.apiKey.slice(-4),
      apiKeyConfigured: this.config.apiKey.length > 0,
    }
  }

  // ─── Discovery ───

  async discover(request: DiscoveryRequest): Promise<DiscoveryResult> {
    const startTime = Date.now()
    let retryCount = 0
    let inputTokens = 0
    let outputTokens = 0

    // Load scenario context to guide the LLM
    const scenarioContexts = this.loadScenarioContexts()

    // Build messages
    const messages = buildDiscoveryMessages(
      request.entity,
      request.industry,
      request.description,
      request.website,
      scenarioContexts
    )

    // First attempt
    let responseText: string
    let usage: { promptTokens: number; completionTokens: number } | undefined

    try {
      const result = await this.callDeepSeek(messages)
      responseText = result.content
      usage = result.usage
      inputTokens = usage?.promptTokens || 0
      outputTokens = usage?.completionTokens || 0
    } catch (err: any) {
      const latencyMs = Date.now() - startTime
      // Return a minimal valid result on error
      return {
        scenarios: [],
        coverage: 0,
        share: 0,
        position: 100,
        meta: {
          provider: this.name,
          latencyMs,
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
          cost: 0,
          cached: false,
        },
      }
    }

    // Parse
    const parsed = parseDiscoveryResponse(responseText, request.entity)

    if (!parsed.success || !parsed.data) {
      // Auto-retry once on parse failure
      retryCount = 1
      const retryMessages = buildRetryMessage(
        messages[messages.length - 1].content,
        parsed.error ? [parsed.error] : ['Failed to parse JSON response']
      )

      try {
        const retryResult = await this.callDeepSeek(retryMessages)
        responseText = retryResult.content
        if (retryResult.usage) {
          inputTokens += retryResult.usage.promptTokens
          outputTokens += retryResult.usage.completionTokens
        }
      } catch (err: any) {
        const latencyMs = Date.now() - startTime
        return {
          scenarios: [],
          coverage: 0,
          share: 0,
          position: 100,
          meta: {
            provider: this.name,
            latencyMs,
            tokenUsage: { prompt: inputTokens, completion: outputTokens, total: inputTokens + outputTokens },
            cost: calculateCost(inputTokens, outputTokens, this.config),
            cached: false,
          },
        }
      }

      // Re-parse after retry
      const retryParsed = parseDiscoveryResponse(responseText, request.entity)
      if (!retryParsed.success || !retryParsed.data) {
        const latencyMs = Date.now() - startTime
        return {
          scenarios: [],
          coverage: 0,
          share: 0,
          position: 100,
          meta: {
            provider: this.name,
            latencyMs,
            tokenUsage: { prompt: inputTokens, completion: outputTokens, total: inputTokens + outputTokens },
            cost: calculateCost(inputTokens, outputTokens, this.config),
            cached: false,
          },
        }
      }

      // Validate schema on retry
      const validation = validateDiscoveryResult(retryParsed.data)
      if (!validation.valid) {
        const latencyMs = Date.now() - startTime
        // Return parsed data anyway (best effort), but mark in raw
        return mapToDiscoveryResult(
          retryParsed.data,
          request.entity,
          this.name,
          latencyMs,
          inputTokens,
          outputTokens,
          calculateCost(inputTokens, outputTokens, this.config),
          false,
          retryCount
        )
      }

      const latencyMs = Date.now() - startTime
      return mapToDiscoveryResult(
        retryParsed.data,
        request.entity,
        this.name,
        latencyMs,
        inputTokens,
        outputTokens,
        calculateCost(inputTokens, outputTokens, this.config),
        false,
        retryCount
      )
    }

    // Validate schema on first attempt
    const validation = validateDiscoveryResult(parsed.data)

    if (!validation.valid) {
      // Auto-retry once on validation failure
      retryCount = 1
      const retryMessages = buildRetryMessage(
        messages[messages.length - 1].content,
        validation.errors
      )

      try {
        const retryResult = await this.callDeepSeek(retryMessages)
        responseText = retryResult.content
        if (retryResult.usage) {
          inputTokens += retryResult.usage.promptTokens
          outputTokens += retryResult.usage.completionTokens
        }
      } catch (err: any) {
        const latencyMs = Date.now() - startTime
        return mapToDiscoveryResult(
          parsed.data,
          request.entity,
          this.name,
          latencyMs,
          inputTokens,
          outputTokens,
          calculateCost(inputTokens, outputTokens, this.config),
          false,
          retryCount
        )
      }

      // Re-parse and re-validate
      const retryParsed = parseDiscoveryResponse(responseText, request.entity)
      if (retryParsed.success && retryParsed.data) {
        const retryValidation = validateDiscoveryResult(retryParsed.data)
        const latencyMs = Date.now() - startTime
        return mapToDiscoveryResult(
          retryParsed.data,
          request.entity,
          this.name,
          latencyMs,
          inputTokens,
          outputTokens,
          calculateCost(inputTokens, outputTokens, this.config),
          false,
          retryCount
        )
      }

      // Retry also failed — return original parsed data
      const latencyMs = Date.now() - startTime
      return mapToDiscoveryResult(
        parsed.data,
        request.entity,
        this.name,
        latencyMs,
        inputTokens,
        outputTokens,
        calculateCost(inputTokens, outputTokens, this.config),
        false,
        retryCount
      )
    }

    // Success
    const latencyMs = Date.now() - startTime
    return mapToDiscoveryResult(
      parsed.data,
      request.entity,
      this.name,
      latencyMs,
      inputTokens,
      outputTokens,
      calculateCost(inputTokens, outputTokens, this.config),
      false,
      retryCount
    )
  }

  // ─── Verification ───

  async verify(request: VerificationRequest): Promise<VerificationResult> {
    const startTime = Date.now()

    if (!this.config.apiKey) {
      return {
        claims: request.claims.map((claim, index) => ({
          claimId: `ds-${index}-${Date.now().toString(36)}`,
          claim,
          verified: false,
          confidence: 0,
          evidence: ['DeepSeek API key not configured'],
        })),
        overallConfidence: 0,
        meta: {
          provider: this.name,
          latencyMs: Date.now() - startTime,
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
          cost: 0,
          cached: false,
        },
      }
    }

    // Build verification prompt
    const messages = [
      {
        role: 'system' as const,
        content: `You are a claim verification assistant. Your task is to verify the truthfulness of claims about "${request.entity}" for project "${request.projectId}".

For each claim, provide:
- verified: true/false
- confidence: 0-100
- evidence: list of supporting or contradicting evidence

Return ONLY valid JSON array:
[
  {
    "claimId": "string",
    "claim": "string",
    "verified": boolean,
    "confidence": number,
    "evidence": ["string"]
  }
]`,
      },
      {
        role: 'user' as const,
        content: `Verify these claims about "${request.entity}":

${request.claims.map((c, i) => `${i}: "${c}"`).join('\n')}

Return ONLY the JSON array, no other text.`,
      },
    ]

    try {
      const result = await this.callDeepSeek(messages)
      const usage = result.usage

      // Parse response
      let responseText = result.content.trim()
      const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (codeBlockMatch) {
        responseText = codeBlockMatch[1].trim()
      }

      let parsedClaims: Array<{ claimId: string; claim: string; verified: boolean; confidence: number; evidence: string[] }>
      try {
        parsedClaims = JSON.parse(responseText)
        if (!Array.isArray(parsedClaims)) {
          parsedClaims = []
        }
      } catch {
        // Fallback: map claims with low confidence
        parsedClaims = request.claims.map((claim, index) => ({
          claimId: `ds-${index}-${Date.now().toString(36)}`,
          claim,
          verified: false,
          confidence: 10,
          evidence: ['Failed to parse verification response'],
        }))
      }

      // Normalize to match input claims
      const claims = request.claims.map((claim, index) => {
        const parsed = parsedClaims[index] || parsedClaims.find((c: any) => c.claim === claim)
        if (!parsed) {
          return {
            claimId: `ds-${index}-${Date.now().toString(36)}`,
            claim,
            verified: false,
            confidence: 0,
            evidence: [] as string[],
          }
        }
        return {
          claimId: parsed.claimId || `ds-${index}-${Date.now().toString(36)}`,
          claim: parsed.claim || claim,
          verified: typeof parsed.verified === 'boolean' ? parsed.verified : false,
          confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 0,
          evidence: Array.isArray(parsed.evidence) ? parsed.evidence : [],
        }
      })

      const overallConfidence = claims.length > 0
        ? Math.round(claims.reduce((sum, c) => sum + c.confidence, 0) / claims.length)
        : 0

      const inputTokens = usage?.promptTokens || 0
      const outputTokens = usage?.completionTokens || 0

      return {
        claims,
        overallConfidence,
        meta: {
          provider: this.name,
          latencyMs: Date.now() - startTime,
          tokenUsage: { prompt: inputTokens, completion: outputTokens, total: inputTokens + outputTokens },
          cost: calculateCost(inputTokens, outputTokens, this.config),
          cached: false,
        },
      }
    } catch (err: any) {
      return {
        claims: request.claims.map((claim, index) => ({
          claimId: `ds-${index}-${Date.now().toString(36)}`,
          claim,
          verified: false,
          confidence: 0,
          evidence: [`Verification error: ${err.message}`],
        })),
        overallConfidence: 0,
        meta: {
          provider: this.name,
          latencyMs: Date.now() - startTime,
          tokenUsage: { prompt: 0, completion: 0, total: 0 },
          cost: 0,
          cached: false,
        },
      }
    }
  }

  // ─── Health ───

  async health(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startTime = Date.now()

    if (!this.config.apiKey) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        error: 'DEEPSEEK_API_KEY is not configured',
      }
    }

    try {
      // Lightweight ping: call with minimal tokens
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: 'user', content: 'ping' },
          ],
          temperature: 0,
          max_tokens: 1,
          stream: false,
        }),
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        return {
          ok: false,
          latencyMs: Date.now() - startTime,
          error: `DeepSeek API error ${response.status}: ${text.slice(0, 200)}`,
        }
      }

      return {
        ok: true,
        latencyMs: Date.now() - startTime,
      }
    } catch (err: any) {
      return {
        ok: false,
        latencyMs: Date.now() - startTime,
        error: err.message || 'Unknown error',
      }
    }
  }

  // ─── Internal ───

  /**
   * Load scenario contexts from the scenario store.
   */
  private loadScenarioContexts(): ScenarioContext[] {
    try {
      const allScenarios = scenarioStore.listScenarios()
      const industries = scenarioStore.listIndustries()
      const industryMap = new Map(industries.map(i => [i.id, i.name]))

      return allScenarios.map(s => ({
        scenarioId: s.id,
        scenarioName: s.name,
        industryId: s.industryId,
        industryName: industryMap.get(s.industryId) || s.industryId,
      }))
    } catch {
      // If scenario store not available, return empty
      return []
    }
  }

  /**
   * Call the DeepSeek chat completions API.
   */
  private async callDeepSeek(
    messages: Array<{ role: string; content: string }>,
    overrideConfig?: Partial<DeepSeekConfig>
  ): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }> {
    const config = { ...this.config, ...overrideConfig }

    if (!config.apiKey) {
      throw new Error('DEEPSEEK_API_KEY is not configured')
    }

    const baseUrl = config.baseUrl || 'https://api.deepseek.com/v1'

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: false,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`DeepSeek API error ${response.status}: ${text.slice(0, 200)}`)
    }

    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
      model: string
      usage?: { prompt_tokens: number; completion_tokens: number }
    }

    const content = data.choices[0]?.message?.content ?? ''

    const usage = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
        }
      : undefined

    // Update last token usage
    if (usage) {
      this.lastTokenUsage = {
        prompt: this.lastTokenUsage.prompt + usage.promptTokens,
        completion: this.lastTokenUsage.completion + usage.completionTokens,
        total: this.lastTokenUsage.total + usage.promptTokens + usage.completionTokens,
      }
    }

    return { content, usage }
  }

  /**
   * Get cumulative token usage since provider creation or last reset.
   */
  getTokenUsage(): { prompt: number; completion: number; total: number } {
    return { ...this.lastTokenUsage }
  }

  /**
   * Reset cumulative token usage.
   */
  resetTokenUsage(): void {
    this.lastTokenUsage = { prompt: 0, completion: 0, total: 0 }
  }
}
