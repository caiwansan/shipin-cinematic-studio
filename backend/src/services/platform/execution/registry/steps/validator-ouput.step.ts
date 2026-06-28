// ============================================================
// Validator Output Step Plugin — validates execution output
// ============================================================

import type { StepPlugin, StepPluginInput, StepPluginOutput } from '../step-plugin-registry.js'
import { StepType } from '../../types.js'

export function createValidatorOutputStep(): StepPlugin {
  return {
    name: 'validator-output',
    type: 'step',
    stepType: StepType.VALIDATE_OUTPUT,

    async execute(input: StepPluginInput, _ctx?: any): Promise<StepPluginOutput> {
      const startTime = Date.now()
      const { step, intermediateResults } = input

      try {
        // Resolve provider result from intermediate results
        const providerResult = intermediateResults.get('providerResult')

        if (!providerResult) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_NO_INPUT',
              message: 'No provider result found to validate',
            },
            durationMs: Date.now() - startTime,
          }
        }

        // Basic validation
        const errors: string[] = []
        if (!providerResult.content && !providerResult.output) {
          errors.push('Provider result has no content or output')
        }

        if (errors.length > 0) {
          return {
            success: false,
            error: {
              code: 'VALIDATION_FAILED',
              message: errors.join('; '),
              details: { errors },
            },
            durationMs: Date.now() - startTime,
          }
        }

        const validated = {
          ...providerResult,
          validated: true,
          validatedAt: new Date().toISOString(),
        }

        intermediateResults.set(`${step.id}.validated`, validated)
        intermediateResults.set(step.id, validated)

        return {
          success: true,
          output: validated,
          durationMs: Date.now() - startTime,
        }
      } catch (err) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: (err as Error).message,
          },
          durationMs: Date.now() - startTime,
        }
      }
    },
  }
}
