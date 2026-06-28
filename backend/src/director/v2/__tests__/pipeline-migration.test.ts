import { describe, it, expect } from 'vitest';
import { generateShotPlan } from '../../../runtime/director/shot-planner-rules';
import type { ShotGraph } from '../../../runtime/director/shot-graph-schema';
import { shotGraphToDirectorDecision } from '@director-v2/director-adapter';
import { buildExecutionPlan } from '@director-v2/execution-plan-builder';

// ── Golden Test Samples ──────────────────────────────────────────────────────

const GOLDEN_SCRIPTS = [
  {
    name: 'short confrontation scene',
    storyboard: 'A tense confrontation between Li Ming and Zhao Xue at a rainy night office. Li Ming slams the table, Zhao Xue turns away in anger.',
  },
  {
    name: 'action climax',
    storyboard: 'Chen Hao runs through the burning building, dodging falling debris. He reaches the rooftop just as the helicopter arrives. Explosions behind him.',
  },
  {
    name: 'romantic reveal',
    storyboard: 'Xiao Mei walks into the garden at sunset. She sees Wang Lei waiting with flowers. They embrace. Slow motion as cherry blossoms fall.',
  },
  {
    name: 'horror tension',
    storyboard: 'Zhang Wei enters the dark basement. Strange noises come from the corner. He shines a flashlight — a figure appears behind him. Heart-pounding moment.',
  },
  {
    name: 'epic battle',
    storyboard: 'The armies clash on the open field. General Liu charges forward on horseback. Swords clash, arrows fly. The battle rages as the sun sets.',
  },
  {
    name: 'emotional farewell',
    storyboard: 'At the train station, Mother holds back tears. Young Lin looks back one last time. The train whistle blows. They wave goodbye through the foggy window.',
  },
  {
    name: 'mystery reveal',
    storyboard: 'Detective Wang examines the evidence board. Red strings connect photos. He suddenly realizes the truth. The murderer is the butler. Shocking climax.',
  },
  {
    name: 'comedy misunderstanding',
    storyboard: 'Li Hua hides behind the couch as his wife enters. She sees the broken vase. He tries to blame the cat. The cat looks at him with contempt.',
  },
  {
    name: 'training montage',
    storyboard: 'Young warrior practices sword forms at dawn. Sweat drips as the sun rises. He repeats the same strike over and over. Finally, a perfect cut through the bamboo.',
  },
  {
    name: 'dream sequence',
    storyboard: 'Mei Ling floats through a surreal landscape. Time moves in reverse. She sees her younger self. A voice whispers. She wakes up with tears on her face.',
  },
];

// ── Helper ──────────────────────────────────────────────────────────────────

function runPipeline(storyboard: string): { shotGraph: ShotGraph; decision: ReturnType<typeof shotGraphToDirectorDecision>; plan: ReturnType<typeof buildExecutionPlan> } {
  const shotGraph = generateShotPlan(storyboard);
  const decision = shotGraphToDirectorDecision(shotGraph);
  const plan = buildExecutionPlan(decision);
  return { shotGraph, decision, plan };
}

// ── DirectorDecision Golden Tests ────────────────────────────────────────────

describe('A2.1 — DirectorAdapter (ShotGraph → DirectorDecision)', () => {
  GOLDEN_SCRIPTS.forEach(({ name, storyboard }) => {
    it(`produces deterministic output for: "${name}"`, () => {
      const result1 = runPipeline(storyboard);
      const result2 = runPipeline(storyboard);

      // Same storyboard → same number of shots
      expect(result1.shotGraph.shots.length).toBe(result2.shotGraph.shots.length);
      // DirectorDecision camera count matches ShotGraph
      expect(result1.decision.camera.length).toBe(result1.shotGraph.shots.length);
    });

    it(`produces valid DirectorDecision shape for: "${name}"`, () => {
      const { shotGraph, decision } = runPipeline(storyboard);

      // Required fields
      expect(decision.id).toBeTruthy();
      expect(decision.semanticRevision).toBe(1);
      expect(decision.segment.narrativePurpose).toBeTruthy();
      expect(decision.camera.length).toBeGreaterThanOrEqual(1);

      // Each camera decision has required fields
      decision.camera.forEach((cam) => {
        expect(cam.cameraIntent).toBeTruthy();
        expect(cam.mood).toBeTruthy();
        expect(cam.focus).toBeTruthy();
      });

      // Character presence should match shot subjects
      const allSubjects = new Set<string>();
      shotGraph.shots.forEach((s) => s.subject?.forEach((sub) => allSubjects.add(sub)));
      if (allSubjects.size > 0) {
        expect(decision.characterPresence.length).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

// ── ExecutionPlanBuilder Tests ───────────────────────────────────────────────

describe('A2.2 — ExecutionPlanBuilder (DirectorDecision → ExecutionPlan)', () => {
  GOLDEN_SCRIPTS.slice(0, 3).forEach(({ name, storyboard }) => {
    it(`builds valid ExecutionPlan for: "${name}"`, () => {
      const { shotGraph, decision, plan } = runPipeline(storyboard);

      // Basic structure
      expect(plan.id).toBeTruthy();
      expect(plan.directorDecisionId).toBe(decision.id);
      expect(plan.cameraPlans.length).toBe(decision.camera.length);

      // Each CameraPlan has required fields
      plan.cameraPlans.forEach((cp) => {
        expect(cp.directorIntent).toBeTruthy();
        expect(cp.motivation).toBeTruthy();
        expect(cp.composition.shotSize).toBeTruthy();
        expect(cp.composition.angle).toBeTruthy();
        expect(cp.composition.movement).toBeTruthy();
        expect(cp.deterministicHash).toBeTruthy();
        expect(cp.deterministicHash.length).toBe(16);
      });
    });

    it(`produces deterministic ExecutionPlan: "${name}"`, () => {
      const { decision } = runPipeline(storyboard);

      const plan1 = buildExecutionPlan(decision);
      const plan2 = buildExecutionPlan(decision);

      // Same input → same deterministicHash
      expect(plan1.deterministicHash).toBe(plan2.deterministicHash);
      plan1.cameraPlans.forEach((cp, i) => {
        expect(cp.deterministicHash).toBe(plan2.cameraPlans[i].deterministicHash);
      });
    });
  });
});
