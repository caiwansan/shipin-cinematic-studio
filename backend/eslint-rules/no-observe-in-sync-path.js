/**
 * eslint-rules/no-observe-in-sync-path.js — Phase 4.3 Rule
 *
 * Forbids OBSERVE domain modules from importing SYNC/ASYNC execution APIs
 * (narrativeGateway.execute, pipelineExecutor.execute, provider.registry, etc.)
 *
 * Reason: OBSERVE modules must not participate in execution routing.
 */

'use strict'

const OBSERVE_DIRS = [
  'src/director-v2/',
]

const FORBIDDEN_IMPORTS = [
  'narrative-gateway',
  'pipeline-executor',
  'provider.registry',
  'runtime-gate',
]

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Forbid OBSERVE modules from importing execution APIs',
      category: 'Governance',
    },
    messages: {
      observeImport: 'OBSERVE module "{{module}}" must not import execution API "{{api}}". OBSERVE is non-execution domain.',
    },
    schema: [],
  },

  create(context) {
    const filename = context.getFilename()
    const isObserve = OBSERVE_DIRS.some(dir => filename.includes(dir))
    if (!isObserve) return {}

    return {
      ImportDeclaration(node) {
        const importPath = node.source.value
        const isForbidden = FORBIDDEN_IMPORTS.some(fi => importPath.includes(fi))
        if (isForbidden) {
          context.report({
            node,
            messageId: 'observeImport',
            data: {
              module: filename,
              api: importPath,
            },
          })
        }
      },
    },
  },
}
