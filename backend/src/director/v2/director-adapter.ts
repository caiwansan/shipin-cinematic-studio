// ============================================================================
// DirectorAdapter — A2.1: Legacy ShotGraph → DirectorDecision
//
// This adapter wraps the existing V1 rule engine (DirectorRuntime) and
// translates its output (ShotGraph) into V2 DirectorDecision.
//
// It does NOT replace the V1 engine. It sits on TOP of it.
// This enables A/B comparison between V1 ShotGraph and V2 DirectorDecision
// from the same input.
//
// Phase A2.1 scope: Adapter only. No behavioral changes.
// Phase A2.2 scope: ExecutionPlanBuilder (separate file).
// ============================================================================

import type { DirectorDecision, SegmentDecision, CameraDecision } from '@director-v2/protocols/intent/director-decision';
import { createDirectorDecisionId, freezeDecision } from '@director-v2/protocols/intent/director-decision';
import type { ShotGraph, ShotNode } from '../../../runtime/director/shot-graph-schema';

// ── ShotType → V2 CameraDecision heuristics ──────────────────────────────────

const SHOT_TYPE_TO_CAMERA_INTENT: Record<string, string> = {
  establishing: 'Establish environment and spatial context',
  reveal: 'Reveal character presence with dramatic emphasis',
  dialogue: 'Capture character interaction and reaction',
  confrontation: 'Frame tension and opposition between characters',
  action: 'Follow dynamic action with energy',
  impact: 'Capture critical moment of collision or resolution',
  climax: 'Emphasize turning point with maximum dramatic weight',
  ending: 'Provide closure and emotional resolution',
};

const SHOT_TYPE_TO_MOOD: Record<string, string> = {
  establishing: 'atmospheric',
  reveal: 'mysterious',
  dialogue: 'intimate',
  confrontation: 'tense',
  action: 'energetic',
  impact: 'intense',
  climax: 'dramatic',
  ending: 'peaceful',
};

// ── ShotGraph → DirectorDecision ─────────────────────────────────────────────

export function shotGraphToDirectorDecision(shotGraph: ShotGraph): DirectorDecision {
  const id = createDirectorDecisionId();
  const now = new Date().toISOString();

  // Build SegmentDecision from ShotGraph meta
  const segment: SegmentDecision = {
    narrativePurpose: shotGraph.meta?.narrativeSummary || 'Unknown narrative',
    emotionalTone: inferOverallMood(shotGraph),
    pacing: inferPacing(shotGraph),
    keyBeats: extractKeyBeats(shotGraph),
  };

  // Build CameraDecision for each shot
  const camera: CameraDecision[] = shotGraph.shots.map((shot) => ({
    cameraIntent: SHOT_TYPE_TO_CAMERA_INTENT[shot.shotType] || 'Standard shot',
    mood: SHOT_TYPE_TO_MOOD[shot.shotType] || 'neutral',
    focus: shot.subject?.join(', ') || shot.action || 'scene',
  }));

  // Extract unique characters for CharacterPresenceDecision
  const allSubjects = new Set<string>();
  shotGraph.shots.forEach((s) => s.subject?.forEach((sub) => allSubjects.add(sub)));
  const characterPresence = Array.from(allSubjects).map((char) => ({
    characterId: char,
    presence: 'on_screen' as const,
    roleInShot: 'primary' as const,
  }));

  const decision: DirectorDecision = {
    id,
    semanticRevision: 1,
    segment,
    camera,
    emotions: [],
    characterPresence,
    environment: [],
    actions: [],
    scene: [],
    storyArc: {
      arcPosition: 0.5,  // default — will be refined in A2.2
      tensionLevel: 0.5,
      cliffhanger: false,
    },
    v3Hash: shotGraph.meta?.narrativeSummary ? simpleHash(shotGraph.meta.narrativeSummary) : undefined,
    createdAt: now,
  };

  return freezeDecision(decision);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function inferOverallMood(graph: ShotGraph): string {
  const moods = graph.shots.map((s) => SHOT_TYPE_TO_MOOD[s.shotType] || 'neutral');
  const counts = new Map<string, number>();
  moods.forEach((m) => counts.set(m, (counts.get(m) || 0) + 1));

  let best = 'neutral';
  let bestCount = 0;
  counts.forEach((count, mood) => {
    if (count > bestCount) {
      best = mood;
      bestCount = count;
    }
  });
  return best;
}

function inferPacing(graph: ShotGraph): 'slow' | 'medium' | 'fast' | 'climax' {
  const actionCount = graph.shots.filter(
    (s) => s.shotType === 'action' || s.shotType === 'impact' || s.shotType === 'climax'
  ).length;
  const ratio = actionCount / Math.max(graph.shots.length, 1);

  if (ratio > 0.5) return 'fast';
  if (ratio > 0.3) return 'medium';
  return 'slow';
}

function extractKeyBeats(graph: ShotGraph): string[] {
  return graph.shots.map((s) => `${s.shotType}: ${s.action || s.subject?.join(', ') || 'scene'}`);
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `v3:${Math.abs(hash).toString(16)}`;
}
