// ============================================================
// Cost Estimator — pre-execution cost estimation
// KMKI-PLAT-008
// ============================================================

import type { ResourceContract, ResourceCredential } from '../types'

export interface CostEstimate {
  estimatedCost: number
  currency: string
  estimatedTokens: number
  estimatedLatencyMs: number
  breakdown: {
    promptTokens: number
    completionTokens: number
    costPerPromptToken: number
    costPerCompletionToken: number
  }
}

// Default pricing per resource type (used when pricing info is not available)
const DEFAULT_PRICING: Record<string, { prompt: number; completion: number; currency: string }> = {
  LLM: { prompt: 0.000001, completion: 0.000002, currency: 'USD' },      // per token
  Embedding: { prompt: 0.0000001, completion: 0, currency: 'USD' },
  Image: { prompt: 0.01, completion: 0, currency: 'USD' },              // per image
  Video: { prompt: 0.05, completion: 0, currency: 'USD' },              // per second
  Speech: { prompt: 0.000015, completion: 0, currency: 'USD' },         // per character
}

// Estimated latency per resource type (ms)
const DEFAULT_LATENCY: Record<string, number> = {
  LLM: 2000,
  Embedding: 500,
  Image: 5000,
  Video: 30000,
  Speech: 3000,
  Tool: 1000,
  MCP: 1500,
  Browser: 3000,
  Human: 86400000,    // 24 hours
  Webhook: 500,
}

export const costEstimator = {
  /**
   * Estimate cost for a given resource and input.
   */
  async estimate(
    resource: ResourceContract,
    input: {
      promptLength?: number     // estimated prompt length in tokens/characters
      expectedOutputLength?: number  // estimated completion length
      resourceSpecific?: Record<string, number>
    }
  ): Promise<CostEstimate> {
    // Parse pricing from resource contract if available
    let pricing = DEFAULT_PRICING[resource.type]
    if (resource.pricing) {
      try {
        const customPricing = JSON.parse(resource.pricing)
        pricing = {
          prompt: customPricing.promptTokenCost || customPricing.prompt || pricing?.prompt || 0,
          completion: customPricing.completionTokenCost || customPricing.completion || pricing?.completion || 0,
          currency: customPricing.currency || pricing?.currency || 'USD',
        }
      } catch {
        // Use default pricing
      }
    }

    const promptTokens = input.promptLength || 1000
    const completionTokens = input.expectedOutputLength || 500
    const costPerPromptToken = pricing?.prompt || 0
    const costPerCompletionToken = pricing?.completion || 0

    const estimatedCost = (promptTokens * costPerPromptToken) + (completionTokens * costPerCompletionToken)
    const estimatedTokens = promptTokens + completionTokens
    const estimatedLatencyMs = DEFAULT_LATENCY[resource.type] || 2000

    return {
      estimatedCost,
      currency: pricing?.currency || 'USD',
      estimatedTokens,
      estimatedLatencyMs,
      breakdown: {
        promptTokens,
        completionTokens,
        costPerPromptToken,
        costPerCompletionToken,
      },
    }
  },

  /**
   * Quick cost comparison between multiple resources.
   */
  async compare(
    resources: ResourceContract[],
    input: { promptLength?: number; expectedOutputLength?: number }
  ): Promise<Array<{ resource: ResourceContract; estimate: CostEstimate }>> {
    const results = []
    for (const resource of resources) {
      const estimate = await this.estimate(resource, input)
      results.push({ resource, estimate })
    }
    results.sort((a, b) => a.estimate.estimatedCost - b.estimate.estimatedCost)
    return results
  },
}
