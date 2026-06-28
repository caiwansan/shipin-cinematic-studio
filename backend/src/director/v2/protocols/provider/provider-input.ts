// ============================================================================
// ProviderInput — Provider Protocol (Chapter ⑨)
//
// Structured input from the runtime to Provider Adapters.
// Provider Adapters are pure format translators — no director logic.
// This is the structured Film Language that providers receive.
// ============================================================================

import type { DirectorDecision } from '../intent/director-decision';
import type { ExecutionPlan, CameraPlan } from '../execution/execution-plan';
import type { Constraint } from '../constraint/constraint';
import type { ReferenceAssignment } from '../reference/reference-assignment';

export interface ProviderInput {
  decision: DirectorDecision;
  executionPlan: ExecutionPlan;
  constraints: Constraint[];
  referenceAssignments: ReferenceAssignment[];
  shotIndex: number;
}

export interface ProviderPrompt {
  prompt: string;
  negativePrompt?: string;
  referenceImages: string[];
  providerParams: Record<string, unknown>;
  cameraControl?: CameraControl;
  characterControl?: CharacterControl;
  translationTrace: TranslationTraceEntry[];
}

export interface CameraControl {
  shotSize: string;
  angle: string;
  movement: string;
  lens?: string;
}

export interface CharacterControl {
  characterId: string;
  appearance: string;
  expression: string;
  pose: string;
}

export interface TranslationTraceEntry {
  step: string;
  inputField: string;
  outputField: string;
  loss: 'none' | 'partial' | 'significant';
  note: string;
}

export interface ProviderCompiler {
  compile(input: ProviderInput): ProviderPrompt;
  validate(prompt: ProviderPrompt): { valid: boolean; errors: string[] };
}
