/**
 * WorkspaceAdapter — The core extension point for ALL workspaces.
 *
 * Platform recognizes only WorkspaceAdapter, not individual workspace types.
 * GEO, Video, Novel, PPT, Music, Image — all implement this interface.
 *
 * @package @studio/platform/workspace
 * @see ADR-002 (Workspace Adapter Pattern)
 * @see WORKSPACE-SPEC.md
 */

export type WorkspaceType = 'geo' | 'video' | 'novel' | 'ppt' | 'music' | 'image';

export interface WorkspaceContext {
  projectId: string;
  userId: string;
  tenantId: string;
  capabilities: Map<string, unknown>;
  stateRuntime: unknown;
  eventBus: unknown;
}

export interface WorkspaceRoute {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  handler: string;
}

export interface WorkspaceMenu {
  id: string;
  label: string;
  icon: string;
  route: string;
  group?: string;
  order?: number;
}

export interface CapabilityRequirement {
  capabilityId: string;
  modelId?: string;
  minVersion?: string;
}

export interface AssetType {
  type: string;
  schema: Record<string, unknown>;
}

export interface CommandDefinition {
  id: string;
  label: string;
  handler: string;
}

export interface WorkspaceAdapter {
  readonly type: WorkspaceType;

  initialize(context: WorkspaceContext): Promise<void>;
  activate(projectId: string): Promise<void>;
  deactivate(): Promise<void>;
  dispose(): Promise<void>;

  getRoutes(): WorkspaceRoute[];
  getMenus(): WorkspaceMenu[];
  getCapabilities(): CapabilityRequirement[];
  getAssetTypes(): AssetType[];
  getCommands(): CommandDefinition[];
}
