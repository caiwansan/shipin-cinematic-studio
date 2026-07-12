// ════════════════════════════════════════════════════════════
// Knowledge Component Registration Plugin
// Registers all Knowledge* components into the Component Registry
// ════════════════════════════════════════════════════════════

import { registerComponent } from './registry'
// Direct imports for SSR compatibility (no dynamic imports needed)
import KnowledgeHero from './KnowledgeHero.vue'
import KnowledgeSummary from './KnowledgeSummary.vue'
import KnowledgeBodyRenderer from './KnowledgeBodyRenderer.vue'
import KnowledgeJSONLD from './KnowledgeJSONLD.vue'
import KnowledgeMetadata from './KnowledgeMetadata.vue'
import KnowledgeFooter from './KnowledgeFooter.vue'
import KnowledgeRelated from './KnowledgeRelated.vue'
import KnowledgeFAQ from './KnowledgeFAQ.vue'

export function registerAllComponents(): void {
  registerComponent('knowledge-hero', KnowledgeHero, 'Brand/entity hero section with title and summary')
  registerComponent('knowledge-summary', KnowledgeSummary, 'Content summary block')
  registerComponent('knowledge-body-renderer', KnowledgeBodyRenderer, 'Multi-format body renderer (text/markdown/html/list)')
  registerComponent('knowledge-jsonld', KnowledgeJSONLD, 'JSON-LD structured data script tags')
  registerComponent('knowledge-metadata', KnowledgeMetadata, 'Version and compilation metadata')
  registerComponent('knowledge-footer', KnowledgeFooter, 'Copyright and attribution footer')
  registerComponent('knowledge-related', KnowledgeRelated, 'Related links block')
  registerComponent('knowledge-faq', KnowledgeFAQ, 'FAQ section parsed from body content')
}
