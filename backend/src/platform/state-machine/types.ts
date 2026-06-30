export interface Transition {
  from: string;
  to: string;
}

export interface StateMachineDefinition {
  name: string;
  states: string[];
  initialState: string;
  transitions: Transition[];
  finalStates: string[];
}

export interface StateTransitionResult {
  allowed: boolean;
  reason?: string;
}
