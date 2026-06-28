import type { ID, ApiResponse, ProjectNarrative } from './base.js';

export interface DirectorScene {
  id: ID;
  projectId: ID;
  type: 'scene' | 'transition' | 'cut';
  content: string;
  description?: string;
  confidence?: number;
  metadata?: Record<string, unknown>;
  characters?: string[];
  location?: string;
}

export interface DirectorExecutionPlan {
  id: ID;
  projectId: ID;
  scenes: DirectorScene[];
  narrative?: ProjectNarrative;
  status: 'draft' | 'ready' | 'running' | 'done' | 'failed';
  createdAt: number;
  updatedAt?: number;
}

export interface DirectorProjection {
  id: ID;
  projectId: ID;
  energy: number;
  drift: number;
  state: Record<string, unknown>;
  timestamp: number;
}

export interface CinematicIntent {
  projectId: ID;
  genre: string;
  tone: string;
  constraints?: string[];
}

export type DirectorStatusResponse = ApiResponse<{
  projection: DirectorProjection;
  plan?: DirectorExecutionPlan;
}>

export type DirectorGenerateResponse = ApiResponse<{
  plan: DirectorExecutionPlan;
  scenes: DirectorScene[];
}>
