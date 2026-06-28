// ============================================================================
// DirectorDecision — Intent Protocol (Chapter ①)
//
// The single source of truth for director intent. Immutable once emitted.
// All downstream modules refine, constrain, or translate — never modify.
// ============================================================================

import { v4 as uuidv4 } from 'uuid';

// ── Core Identifier ──────────────────────────────────────────────────────────

export type DirectorDecisionId = string & { readonly __brand: 'DirectorDecisionId' };

export function createDirectorDecisionId(): DirectorDecisionId {
  return uuidv4() as DirectorDecisionId;
}

// ── Segment Decision ─────────────────────────────────────────────────────────

export interface SegmentDecision {
  /** How this segment advances the story arc */
  narrativePurpose: string;
  /** Emotional tone for this segment */
  emotionalTone: string;
  /** Pacing indicator */
  pacing: 'slow' | 'medium' | 'fast' | 'climax';
  /** Key story beats within this segment */
  keyBeats: string[];
}

// ── Camera Decision ──────────────────────────────────────────────────────────

export interface CameraDecision {
  /** High-level camera intent — what the camera should express */
  cameraIntent: string;
  /** Suggested mood/atmosphere */
  mood: string;
  /** Key visual focus */
  focus: string;
}

// ── Emotion Decision ─────────────────────────────────────────────────────────

export interface EmotionDecision {
  characterId: string;
  targetEmotion: string;
  intensity: number; // 0.0 – 1.0
  transitionFromPrevious?: string;
}

// ── Character Presence Decision ──────────────────────────────────────────────

export interface CharacterPresenceDecision {
  characterId: string;
  presence: 'on_screen' | 'off_screen' | 'voice_only';
  roleInShot: 'primary' | 'secondary' | 'background';
}

// ── Environment Decision ─────────────────────────────────────────────────────

export interface EnvironmentDecision {
  location: string;
  timeOfDay: 'dawn' | 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night';
  weather?: string;
  atmosphere?: string;
}

// ── Action Decision ──────────────────────────────────────────────────────────

export interface ActionDecision {
  characterId: string;
  action: string;
  timing: string;
  motivation: string;
}

// ── Scene Decision ──────────────────────────────────────────────────────────

export interface SceneDecision {
  sceneTransition: 'cut' | 'fade_in' | 'fade_out' | 'dissolve' | 'wipe';
  pacing: string;
  duration: number; // seconds
}

// ── Story Arc Decision ──────────────────────────────────────────────────────

export interface StoryArcDecision {
  arcPosition: number; // 0.0 = beginning, 1.0 = end
  tensionLevel: number; // 0.0 – 1.0
  cliffhanger: boolean;
  audienceEmotion?: string;
}

// ── Root DirectorDecision ────────────────────────────────────────────────────

export interface DirectorDecision {
  /** Unique identifier (immutable) */
  id: DirectorDecisionId;
  /** Semantic version (monotonic revision counter for intent refinements) */
  semanticRevision: number;

  /** Story-level decision */
  segment: SegmentDecision;

  /** Camera-level decisions (one per shot) */
  camera: CameraDecision[];

  /** Character emotion decisions */
  emotions: EmotionDecision[];

  /** Character presence decisions */
  characterPresence: CharacterPresenceDecision[];

  /** Environment decisions */
  environment: EnvironmentDecision[];

  /** Action decisions */
  actions: ActionDecision[];

  /** Scene-level decisions */
  scene: SceneDecision[];

  /** Arc-level decisions */
  storyArc: StoryArcDecision;

  /** Optional: hash from V3 for traceability */
  v3Hash?: string;

  /** Timestamp when this decision was created */
  createdAt: string; // ISO 8601
}

// ── Immutable Intent Enforcer ────────────────────────────────────────────────

/**
 * Wrap a DirectorDecision to enforce immutability at runtime.
 * In release builds, this is a no-op (trust compile-time).
 * In dev/test, it uses Object.freeze recursively.
 */
export function freezeDecision(decision: DirectorDecision): DirectorDecision {
  return Object.freeze({
    ...decision,
    camera: Object.freeze(decision.camera.map(Object.freeze)),
    emotions: Object.freeze(decision.emotions.map(Object.freeze)),
    characterPresence: Object.freeze(decision.characterPresence.map(Object.freeze)),
    environment: Object.freeze(decision.environment.map(Object.freeze)),
    actions: Object.freeze(decision.actions.map(Object.freeze)),
    scene: Object.freeze(decision.scene.map(Object.freeze)),
    storyArc: Object.freeze(decision.storyArc),
  }) as DirectorDecision;
}
