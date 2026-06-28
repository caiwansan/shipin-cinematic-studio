// ============================================================
// PublishCMS Action — placeholder (interface only, no business logic)
// ============================================================

import type { ActionHandler, ActionResult } from '../../types.js'
import { actionRegistry } from '../action-registry.js'

class PublishCMSAction implements ActionHandler {
  name = 'PublishCMS'
  description = 'Publish content to CMS platform'
  provider = 'api'

  async execute(input: Record<string, unknown>, _metadata?: Record<string, unknown>): Promise<ActionResult> {
    const platform = input.platform || 'unknown'
    const title = input.title || 'untitled'

    console.log(`[PublishCMS] Placeholder: publishing "${title}" to ${platform}`)

    return {
      success: true,
      output: {
        platform,
        title,
        published: true,
        url: null,
        message: 'Placeholder: CMS publishing not yet implemented',
      },
    }
  }
}

// Self-registering
const instance = new PublishCMSAction()
actionRegistry.register(instance)
console.log(`[Action] ✅ ${instance.name} registered (placeholder)`)

export default instance
