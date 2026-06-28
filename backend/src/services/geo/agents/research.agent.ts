// ============================================================
// Research Agent — Topic Research (KMKI-GEO-AGENT-001)
// Registers via AgentRegistry with capabilities: geo.research, knowledge.discovery
// Input:  { topic, config }
// Output: { primaryTopic, secondaryTopics, intent, audience, questions, competitors, keywords }
// ============================================================

import { agentService } from '../../platform/agent/agent.service'
import { type AgentDefinition } from '../../platform/agent/types'
import { createProvenanceRecord } from '../types'
import type { ResearchInput, ResearchOutput } from '../types'

export const RESEARCH_AGENT_CODE = 'geo.research'
export const RESEARCH_AGENT_CAPABILITIES = ['geo.research', 'knowledge.discovery']

/**
 * Default executor for Research Agent.
 * When no AI resource is available, returns a structured stub result.
 */
async function researchExecutor(input: ResearchInput, _ctx?: any): Promise<ResearchOutput> {
  const topic = input.topic || ''
  const config = input.config || {}

  // Create provenance for this research
  const provenance = createProvenanceRecord({
    source: 'geo.research',
    action: 'created',
    actor: 'agent:geo.research',
    reason: `Topic research for: ${topic}`,
  })

  // Default stub — in production, this dispatches through Capability → Execution Runtime → AI Resource Runtime
  const output: ResearchOutput = {
    primaryTopic: topic,
    secondaryTopics: generateSecondaryTopics(topic, config.language),
    intent: determineIntent(topic),
    audience: determineAudience(topic),
    questions: generateQuestions(topic),
    competitors: [],
    keywords: generateKeywords(topic),
  }

  console.log(`[ResearchAgent] Completed research for topic="${topic}" at ${provenance.timestamp}`)
  return output
}

function generateSecondaryTopics(topic: string, _language?: string): string[] {
  // Stub: would normally invoke AI via Capability Runtime
  return [
    `${topic} industry overview`,
    `${topic} key players`,
    `${topic} trends and innovations`,
  ]
}

function determineIntent(_topic: string): string {
  return 'informational'
}

function determineAudience(_topic: string): string {
  return 'general public, industry professionals'
}

function generateQuestions(topic: string): string[] {
  return [
    `What is ${topic}?`,
    `Who are the key players in ${topic}?`,
    `What are the latest trends in ${topic}?`,
    `How does ${topic} impact the industry?`,
    `What are common challenges in ${topic}?`,
  ]
}

function generateKeywords(topic: string): string[] {
  return [topic, `${topic} guide`, `${topic} trends`, `${topic} examples`, `${topic} best practices`]
}

let registered = false

/**
 * Register the Research Agent with the Agent Registry.
 * Must be called once during application startup.
 */
export async function registerResearchAgent(): Promise<void> {
  if (registered) return
  const def: Omit<AgentDefinition, 'id' | 'createdAt' | 'updatedAt'> = {
    code: RESEARCH_AGENT_CODE,
    name: 'Topic Research Agent',
    version: '1.0.0',
    description: 'Discovers primary and secondary topics, intent, audience, and keywords for a given topic.',
    capabilities: RESEARCH_AGENT_CAPABILITIES,
    supportedResources: ['llm'],
    executionMode: 'sync',
    category: 'official',
    status: 'active',
    schemaVersion: 1,
  }
  try {
    await agentService.register(def, researchExecutor)
    console.log('[ResearchAgent] Registered successfully')
    registered = true
  } catch (err) {
    console.error('[ResearchAgent] Registration failed:', err)
    throw err
  }
}

/**
 * Execute research via the Agent Dispatcher.
 */
export async function executeResearch(input: ResearchInput): Promise<ResearchOutput> {
  const result = await agentService.dispatch({
    agentCode: RESEARCH_AGENT_CODE,
    input: input as unknown as Record<string, unknown>,
  })
  const output = result.result?.output as Record<string, unknown> | undefined
  return {
    primaryTopic: (output?.primaryTopic as string) || input.topic,
    secondaryTopics: (output?.secondaryTopics as string[]) || [],
    intent: output?.intent as string | undefined,
    audience: output?.audience as string | undefined,
    questions: (output?.questions as string[]) || [],
    competitors: (output?.competitors as string[]) || [],
    keywords: (output?.keywords as string[]) || [],
  }
}

export { researchExecutor }
