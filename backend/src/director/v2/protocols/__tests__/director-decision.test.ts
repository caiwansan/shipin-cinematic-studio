import { describe, it, expect } from 'vitest';
import {
  DirectorDecision,
  createDirectorDecisionId,
  freezeDecision,
  SegmentDecision,
  CameraDecision,
} from '../intent/director-decision';

function makeSampleDecision(overrides?: Partial<DirectorDecision>): DirectorDecision {
  const decision: DirectorDecision = {
    id: createDirectorDecisionId(),
    semanticRevision: 1,
    segment: {
      narrativePurpose: 'Establish conflict between characters',
      emotionalTone: 'tense',
      pacing: 'medium',
      keyBeats: ['Enter', 'Confrontation'],
    },
    camera: [
      {
        cameraIntent: 'Establish power dynamic',
        mood: 'tense',
        focus: 'Character A',
      },
    ],
    emotions: [
      { characterId: 'char_a', targetEmotion: 'anger', intensity: 0.8 },
    ],
    characterPresence: [
      { characterId: 'char_a', presence: 'on_screen', roleInShot: 'primary' },
    ],
    environment: [
      {
        location: 'office',
        timeOfDay: 'noon',
        weather: 'clear',
        atmosphere: 'corporate',
      },
    ],
    actions: [
      { characterId: 'char_a', action: 'slam the table', timing: 'immediately', motivation: 'frustration' },
    ],
    scene: [
      { sceneTransition: 'cut', pacing: 'medium', duration: 30 },
    ],
    storyArc: {
      arcPosition: 0.3,
      tensionLevel: 0.6,
      cliffhanger: false,
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  return decision;
}

describe('DirectorDecision — Intent Protocol', () => {
  it('creates a unique ID each time', () => {
    const a = createDirectorDecisionId();
    const b = createDirectorDecisionId();
    expect(a).not.toBe(b);
  });

  it('builds a complete DirectorDecision', () => {
    const d = makeSampleDecision();
    expect(d.id).toBeTruthy();
    expect(d.segment.narrativePurpose).toBe('Establish conflict between characters');
    expect(d.camera).toHaveLength(1);
    expect(d.camera[0].cameraIntent).toBe('Establish power dynamic');
    expect(d.emotions).toHaveLength(1);
    expect(d.characterPresence).toHaveLength(1);
    expect(d.environment).toHaveLength(1);
    expect(d.actions).toHaveLength(1);
    expect(d.scene).toHaveLength(1);
    expect(d.storyArc.arcPosition).toBe(0.3);
  });

  it('freezeDecision makes all fields readonly', () => {
    const d = freezeDecision(makeSampleDecision());
    // In strict mode, this should fail at compile time
    // At runtime, Object.freeze makes writes silent failures
    expect(() => {
      (d as any).segment = { narrativePurpose: 'changed', emotionalTone: 'happy', pacing: 'fast', keyBeats: [] };
    }).toThrow();
  });
});
