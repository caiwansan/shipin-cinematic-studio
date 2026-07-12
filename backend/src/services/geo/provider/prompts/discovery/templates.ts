// ============================================================
// Discovery Prompt Templates
// RC2-T002: DeepSeek Discovery Provider
//
// Builds the full message array for LLM calls.
// Reads system.md content and builds user message with entity context.
// ============================================================

import * as path from 'path'
import { resolveFilePath, getPromptSearchPaths } from './path-resolver'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ScenarioContext {
  scenarioId: string
  scenarioName: string
  industryId: string
  industryName: string
}

// ─── System Prompt Loading ───

let systemPromptCache: string | null = null

function loadSystemPrompt(): string {
  if (systemPromptCache) return systemPromptCache

  const searchDirs = getPromptSearchPaths('services/geo/provider/prompts/discovery')
  const content = resolveFilePath(
    ['system.md'],
    searchDirs
  )

  if (content) {
    systemPromptCache = content
    return systemPromptCache
  }

  // Fallback: use inline prompt
  systemPromptCache = `You are a Brand Intelligence Discovery Agent. Your mission is to analyze how a given brand or entity appears across AI ecosystems and demand scenarios. Output ONLY valid JSON following the schema.`
  return systemPromptCache
}

/**
 * Clear the system prompt cache (useful for testing).
 */
export function clearSystemPromptCache(): void {
  systemPromptCache = null
}

/**
 * Build the full message array for a discovery LLM call.
 *
 * @param entity - The brand/entity name to analyze
 * @param industry - Optional industry context
 * @param description - Optional entity description
 * @param website - Optional entity website URL
 * @param scenarios - Optional list of scenarios to provide context
 */
export function buildDiscoveryMessages(
  entity: string,
  industry?: string,
  description?: string,
  website?: string,
  scenarios?: ScenarioContext[]
): ChatMessage[] {
  const messages: ChatMessage[] = []

  // System prompt
  messages.push({
    role: 'system',
    content: loadSystemPrompt(),
  })

  // Build user message
  const userParts: string[] = []

  userParts.push(`Analyze the following entity:\n\nEntity: "${entity}"`)

  if (industry) {
    userParts.push(`Industry: "${industry}"`)
  }

  if (description) {
    userParts.push(`Description: "${description}"`)
  }

  if (website) {
    userParts.push(`Website: "${website}"`)
  }

  // Provide scenario context if available
  if (scenarios && scenarios.length > 0) {
    userParts.push(`\nEvaluate across these scenarios:`)
    for (const sc of scenarios) {
      userParts.push(`- ${sc.scenarioId}: "${sc.scenarioName}" (Industry: ${sc.industryName || sc.industryId})`)
    }
  } else {
    userParts.push(`\nEvaluate across all relevant demand scenarios you know of for this entity type and industry.`)
  }

  userParts.push(`\nReturn ONLY valid JSON following the schema. Be conservative and honest.`)

  messages.push({
    role: 'user',
    content: userParts.join('\n'),
  })

  return messages
}

/**
 * Build a retry message when schema validation fails.
 */
export function buildRetryMessage(originalUserContent: string, validationErrors: string[]): ChatMessage[] {
  const messages: ChatMessage[] = []

  messages.push({
    role: 'system',
    content: loadSystemPrompt(),
  })

  messages.push({
    role: 'user',
    content: originalUserContent,
  })

  messages.push({
    role: 'assistant',
    content: '[Previous response failed schema validation]',
  })

  messages.push({
    role: 'user',
    content: `Your previous response failed schema validation. Please fix these errors and try again:\n\n${validationErrors.join('\n')}\n\nReturn ONLY valid JSON following the schema.`,
  })

  return messages
}
