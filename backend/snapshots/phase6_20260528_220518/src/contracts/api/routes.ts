import type { ApiResponse, ID, ProjectNarrative } from './base.js';

/* ── Project ── */
export interface CreateProjectDTO {
  name: string;
  description?: string;
  narrative?: ProjectNarrative;
}

export interface ProjectDTO {
  id: ID;
  name: string;
  description?: string;
  status: string;
  createdAt: Date;
  updatedAt?: Date;
}

export type CreateProjectResponse = ApiResponse<ProjectDTO>;
export type GetProjectResponse = ApiResponse<ProjectDTO>;
export type ListProjectsResponse = ApiResponse<ProjectDTO[]>;

/* ── Member ── */
export interface MemberDTO {
  id: ID;
  userId: string;
  memberTier: string;
  expiresAt?: Date;
  status: string;
}

export interface CreateMemberDTO {
  userId: string;
  memberTier: string;
}

export type MemberResponse = ApiResponse<MemberDTO>;

/* ── Video Task ── */
export interface VideoTaskDTO {
  id: ID;
  projectId: ID;
  status: string;
  taskType: string;
  progress: number;
  error?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
}

export type VideoTaskResponse = ApiResponse<VideoTaskDTO>;

/* ── Workbench ── */
export interface WorkbenchSnapshotDTO {
  id: ID;
  projectId: ID;
  data: Record<string, unknown>;
  version: number;
  updatedAt: Date;
}

export type WorkbenchSnapshotResponse = ApiResponse<WorkbenchSnapshotDTO>;

/* ── Global Config ── */
export interface GlobalConfigDTO {
  key: string;
  value: unknown;
  updatedAt: Date;
}

export interface SetGlobalConfigDTO {
  value: unknown;
}

export type GlobalConfigResponse = ApiResponse<GlobalConfigDTO>;
