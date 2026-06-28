import { describe, it, expect } from 'vitest';
import {
  ProviderInput,
  ProviderPrompt,
  ProviderCompiler,
  CameraControl,
  CharacterControl,
  TranslationTraceEntry,
} from '../provider/provider-input';
import { DirectorDecision, createDirectorDecisionId } from '../intent/director-decision';
import { createExecutionPlanId } from '../execution/execution-plan';
import { createConstraintId, Constraint, ConstraintPriority, ConstraintState, ConstraintCategory, ConstraintScope, ConstraintSource } from '../constraint/constraint';

describe('ProviderInput — Provider Protocol', () => {
  it('defines ProviderInput with all protocol types', () => {
    const decision = {
      id: createDirectorDecisionId(),
      semanticRevision: 1,
      segment: { narrativePurpose: 'test', emotionalTone: 'neutral', pacing: 'medium', keyBeats: [] },
      camera: [{ cameraIntent: 'test', mood: 'test', focus: 'test' }],
      emotions: [],
      characterPresence: [],
      environment: [],
      actions: [],
      scene: [],
      storyArc: { arcPosition: 0, tensionLevel: 0, cliffhanger: false },
      createdAt: new Date().toISOString(),
    } as DirectorDecision;

    const input: ProviderInput = {
      decision,
      executionPlan: {
        id: createExecutionPlanId(),
        directorDecisionId: decision.id,
        cameraPlans: [],
        deterministicHash: 'hash',
        createdAt: new Date().toISOString(),
      },
      constraints: [],
      referenceAssignments: [],
      shotIndex: 0,
    };

    expect(input.decision.id).toBeTruthy();
    expect(input.shotIndex).toBe(0);
  });

  it('defines ProviderCompiler interface shape', () => {
    const compiler: ProviderCompiler = {
      compile: (input: ProviderInput) => ({
        prompt: `A ${input.shotIndex}-shot of the scene`,
        referenceImages: [],
        providerParams: {},
        translationTrace: [],
      }),
      validate: (prompt: ProviderPrompt) => {
        const errors: string[] = [];
        if (!prompt.prompt) errors.push('Empty prompt');
        return { valid: errors.length === 0, errors };
      },
    };

    const decision = {
      id: createDirectorDecisionId(),
      semanticRevision: 1,
      segment: { narrativePurpose: 'test', emotionalTone: 'test', pacing: 'slow', keyBeats: [] },
      camera: [], emotions: [], characterPresence: [],
      environment: [], actions: [], scene: [],
      storyArc: { arcPosition: 0, tensionLevel: 0, cliffhanger: false },
      createdAt: new Date().toISOString(),
    } as DirectorDecision;

    const input: ProviderInput = {
      decision,
      executionPlan: {
        id: createExecutionPlanId(),
        directorDecisionId: decision.id,
        cameraPlans: [],
        deterministicHash: 'hash',
        createdAt: new Date().toISOString(),
      },
      constraints: [],
      referenceAssignments: [],
      shotIndex: 0,
    };

    const prompt = compiler.compile(input);
    expect(prompt.prompt).toContain('0-shot');

    const result = compiler.validate(prompt);
    expect(result.valid).toBe(true);
  });
});
