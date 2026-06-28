/**
 * eslint-rules/require-runtime-owner.js — Phase 4.3 Rule
 *
 * Requires every runtime module to export a __RUNTIME_OWNER__ declaration.
 * Covers: src/runtime/, src/services/, src/routes/, src/agents/,
 *         src/jobs/, src/scheduler/, src/api/, src/plugins/, src/utils/
 */

'use strict'

const COVERED_DIRS = [
  'src/runtime/',
  'src/services/',
  'src/routes/',
  'src/agents/',
  'src/jobs/',
  'src/scheduler/',
  'src/api/',
  'src/plugins/',
  'src/utils/',
  'src/director-v2/',
]

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Require __RUNTIME_OWNER__ export in runtime modules',
      category: 'Governance',
    },
    messages: {
      missingOwner: 'Module "{{module}}" is missing __RUNTIME_OWNER__ export. All runtime modules must declare ownership.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename()
    const isCovered = COVERED_DIRS.some(dir => filename.includes(dir))
    if (!isCovered) return {}

    // Exclude test files, fixtures, chaos
    if (filename.includes('__tests__') || filename.includes('__fixtures__') || filename.includes('__chaos__')) {
      return {}
    }

    return {
      Program(node) {
        const sourceCode = context.getSourceCode()
        if (!sourceCode.text.includes('__RUNTIME_OWNER__')) {
          context.report({
            node,
            messageId: 'missingOwner',
            data: { module: filename },
          })
        }
      },
    }
  },
}
