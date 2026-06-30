import { StateMachineDefinition, Transition, StateTransitionResult } from './types';

// Registry of all state machines
const registry = new Map<string, StateMachineDefinition>();

export function registerStateMachine(def: StateMachineDefinition): void {
  if (registry.has(def.name)) {
    throw new Error(`State machine '${def.name}' already registered`);
  }
  // Validate states
  for (const t of def.transitions) {
    if (!def.states.includes(t.from)) {
      throw new Error(`Invalid from state '${t.from}' in '${def.name}'`);
    }
    if (!def.states.includes(t.to)) {
      throw new Error(`Invalid to state '${t.to}' in '${def.name}'`);
    }
  }
  registry.set(def.name, def);
}

export function getStateMachine(name: string): StateMachineDefinition | undefined {
  return registry.get(name);
}

export function validateTransition(name: string, from: string, to: string): StateTransitionResult {
  const def = registry.get(name);
  if (!def) {
    return { allowed: false, reason: `State machine '${name}' not found` };
  }
  if (!def.states.includes(from)) {
    return { allowed: false, reason: `Invalid state '${from}' for '${name}'` };
  }
  if (!def.states.includes(to)) {
    return { allowed: false, reason: `Invalid state '${to}' for '${name}'` };
  }
  const allowed = def.transitions.some(t => t.from === from && t.to === to);
  return allowed
    ? { allowed: true }
    : { allowed: false, reason: `Transition '${from} → ${to}' not allowed for '${name}'` };
}

export function listStateMachines(): string[] {
  return Array.from(registry.keys());
}

// --- 注册 Verification 状态机 ---
registerStateMachine({
  name: 'verification',
  states: ['pending', 'running', 'completed', 'failed', 'retrying', 'cancelled'],
  initialState: 'pending',
  transitions: [
    { from: 'pending', to: 'running' },
    { from: 'pending', to: 'cancelled' },
    { from: 'running', to: 'completed' },
    { from: 'running', to: 'failed' },
    { from: 'running', to: 'cancelled' },
    { from: 'failed', to: 'retrying' },
    { from: 'retrying', to: 'running' },
    { from: 'retrying', to: 'failed' },
  ],
  finalStates: ['completed', 'cancelled'],
});

// --- 注册 Publishing 状态机 ---
registerStateMachine({
  name: 'publishing',
  states: ['draft', 'approved', 'publishing', 'published', 'verified_online', 'indexed', 'failed', 'rolled_back'],
  initialState: 'draft',
  transitions: [
    { from: 'draft', to: 'approved' },
    { from: 'draft', to: 'failed' },
    { from: 'approved', to: 'publishing' },
    { from: 'publishing', to: 'published' },
    { from: 'publishing', to: 'failed' },
    { from: 'published', to: 'verified_online' },
    { from: 'published', to: 'rolled_back' },
    { from: 'verified_online', to: 'indexed' },
    { from: 'verified_online', to: 'rolled_back' },
    { from: 'rolled_back', to: 'draft' },
  ],
  finalStates: ['indexed', 'rolled_back'],
});

// --- 注册 Growth 状态机 ---
registerStateMachine({
  name: 'growth',
  states: ['idle', 'aggregating', 'completed', 'failed'],
  initialState: 'idle',
  transitions: [
    { from: 'idle', to: 'aggregating' },
    { from: 'aggregating', to: 'completed' },
    { from: 'aggregating', to: 'failed' },
  ],
  finalStates: ['completed'],
});
