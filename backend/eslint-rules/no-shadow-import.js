/**
 * eslint-rules/no-shadow-import.js — Phase 4.3 Rule
 *
 * Forbids new imports from SYNC/TOOL/WORKER modules into SHADOW modules.
 * Reason: SHADOW modules are frozen — adding imports means adding coupling.
 */

'use strict'

const SHADOW_DIRS = [
  'src/queue/',
  'src/graph-runtime/',
  'src/production-loop/',
]

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Forbid new imports into SHADOW modules',
      category: 'Governance',
    },
    messages: {
      shadowImport: 'Import into SHADOW module "{{importer}}" forbidden. SHADOW modules are frozen.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename()
    const isShadowModule = SHADOW_DIRS.some(dir => filename.includes(dir))

    if (!isShadowModule) return {}

    return {
      ImportDeclaration(node) {
        context.report({
          node,
          messageId: 'shadowImport',
          data: { importer: filename },
        })
      },
    }
  },
}
