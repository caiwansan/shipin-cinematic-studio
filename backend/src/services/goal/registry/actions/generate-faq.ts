// ============================================================
// GenerateFAQ Action — placeholder (interface only, no business logic)
// Demonstrates how an Action is registered in the Registry
// ============================================================

import type { ActionHandler, ActionResult } from '../../types.js'
import { actionRegistry } from '../action-registry.js'

class GenerateFAQAction implements ActionHandler {
  name = 'GenerateFAQ'
  description = 'Generate FAQ content for a brand based on input parameters'
  provider = 'internal'

  async execute(input: Record<string, unknown>, _metadata?: Record<string, unknown>): Promise<ActionResult> {
    // Placeholder — no business logic implemented yet
    const brandName = input.brandName || 'unknown'
    const topic = input.topic || 'general'

    console.log(`[GenerateFAQ] Placeholder: generating FAQ for ${brandName} on topic "${topic}"`)

    return {
      success: true,
      output: {
        brandName,
        topic,
        faqGenerated: true,
        faqCount: 0,
        message: 'Placeholder: FAQ generation not yet implemented',
      },
    }
  }
}

// Self-registering
const instance = new GenerateFAQAction()
actionRegistry.register(instance)
console.log(`[Action] ✅ ${instance.name} registered (placeholder)`)

export default instance
