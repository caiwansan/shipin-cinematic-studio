import type { PlatformContext } from '../context/platform-context.js';
export interface ScanResult {
    title?: string;
    description?: string;
    language?: string;
    robots?: Record<string, unknown>;
    sitemap?: {
        urls: string[];
        count: number;
    };
    meta?: Record<string, unknown>;
    pages?: Array<{
        url: string;
        title: string;
        depth: number;
        type: string;
    }>;
    error?: string;
}
export interface AssetData {
    id?: string;
    projectId: string;
    type: string;
    title: string;
    content?: string;
    summary?: string;
    metadata?: Record<string, unknown>;
    status?: string;
}
export interface SemanticEntityData {
    id?: string;
    projectId: string;
    type: string;
    name: string;
    description?: string;
    confidence?: number;
}
export interface GoalData {
    id?: string;
    projectId: string;
    title: string;
    description?: string;
    status?: string;
    priority?: number;
}
export interface CapabilityContract {
    id: string;
    name: string;
    displayName: string;
    description: string | null;
    category: string;
    version: string;
    status: string;
}
export interface ExecuteRequest {
    capabilityName: string;
    input: Record<string, unknown>;
    context?: {
        userId?: string;
        projectId?: string;
        priority?: number;
    };
}
export interface ExecuteResult {
    success: boolean;
    provider: string;
    capability: string;
    result: Record<string, unknown> | null;
    error: string | null;
    metrics: {
        resolveTimeMs: number;
        strategyUsed: string;
    };
}
export interface ExecutionStepDTO {
    id: string;
    type: string;
    name: string;
    inputs?: Record<string, any>;
    outputs?: Record<string, string>;
    dependencies?: string[];
    timeout?: number;
    retry?: {
        maxAttempts: number;
        backoffMs: number;
    };
    metadata?: Record<string, any>;
}
export interface ExecutionPlanDTO {
    id: string;
    capabilityId: string;
    version: string;
    steps: ExecutionStepDTO[];
    dependencies?: Record<string, string[]>;
    parallelGroups?: string[][];
    metadata?: Record<string, any>;
    schemaVersion: string;
}
export interface ExecutionResultDTO {
    planId: string;
    capabilityId: string;
    status: 'completed' | 'failed' | 'cancelled';
    startedAt: string;
    completedAt?: string;
    durationMs?: number;
    stepResults: Array<{
        stepId: string;
        stepType: string;
        status: string;
        durationMs?: number;
        error?: {
            code: string;
            message: string;
        };
    }>;
    error?: {
        code: string;
        message: string;
    };
    metrics: {
        totalSteps: number;
        completedSteps: number;
        failedSteps: number;
        totalDurationMs: number;
    };
    schemaVersion: string;
}
export interface AssetService {
    create(data: AssetData, ctx?: PlatformContext): Promise<AssetData>;
    get(id: string, ctx?: PlatformContext): Promise<AssetData | null>;
    list(projectId: string, filter?: Record<string, unknown>, ctx?: PlatformContext): Promise<{
        items: AssetData[];
        total: number;
    }>;
    delete(id: string, ctx?: PlatformContext): Promise<void>;
    importFromHtml(projectId: string, url: string, html: string, ctx?: PlatformContext): Promise<unknown>;
}
export interface SemanticService {
    extract(projectId: string, content: string, ctx?: PlatformContext): Promise<void>;
    listEntities(projectId: string, filter?: Record<string, unknown>, ctx?: PlatformContext): Promise<{
        items: SemanticEntityData[];
        total: number;
    }>;
    deleteEntity(id: string, ctx?: PlatformContext): Promise<void>;
}
export interface GoalService {
    create(data: GoalData, ctx?: PlatformContext): Promise<GoalData>;
    get(id: string, ctx?: PlatformContext): Promise<GoalData | null>;
    executeTask(taskId: string, ctx?: PlatformContext): Promise<ExecuteResult>;
    generateStrategies(goalId: string, ctx?: PlatformContext): Promise<any[]>;
    runFullPipeline(goalId: string, ctx?: PlatformContext): Promise<any>;
}
export interface CapabilityService {
    get(name: string, ctx?: PlatformContext): Promise<CapabilityContract | null>;
    validate(contractName: string, input: Record<string, unknown>, ctx?: PlatformContext): Promise<any>;
    resolve(request: ExecuteRequest, ctx?: PlatformContext): Promise<ExecuteResult>;
    register(input: Record<string, unknown>, ctx?: PlatformContext): Promise<CapabilityContract>;
    list(ctx?: PlatformContext): CapabilityContract[];
}
export type WorkspaceType = 'short_drama' | 'novel' | 'ppt' | 'geo' | 'asset';
export interface WorkspaceDTO {
    id: string;
    type: WorkspaceType;
    tenantId: string;
    name: string;
    description?: string;
    status: string;
    runtimeState?: Record<string, unknown>;
    manifest?: string;
    settings?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    schemaVersion: number;
    createdAt: Date;
    updatedAt: Date;
}
export interface WorkspaceSnapshotDTO {
    id: string;
    workspaceId: string;
    version: number;
    label?: string;
    runtimeState?: Record<string, unknown>;
    createdAt: Date;
    autoSave: boolean;
}
export interface WorkspaceManifest {
    workspaceId: string;
    name: string;
    type: WorkspaceType;
    capabilities: Array<{
        id: string;
        name: string;
        version: string;
        category: string;
    }>;
    assets: Array<{
        id: string;
        type: string;
        path: string;
        size: number;
    }>;
    outputVersions: Array<{
        version: string;
        label: string;
        published: boolean;
        createdAt: string;
    }>;
    costSummary: {
        totalEstimatedCost: number;
        currency: string;
    };
    auditTrail: Array<{
        operation: string;
        userId?: string;
        timestamp: string;
    }>;
    generatedAt: string;
    schemaVersion: number;
}
export interface WorkspaceService {
    create(type: WorkspaceType, name: string, tenantId: string, description?: string): Promise<WorkspaceDTO>;
    get(id: string): Promise<WorkspaceDTO | null>;
    list(tenantId: string): Promise<WorkspaceDTO[]>;
    snapshot(workspaceId: string, label?: string): Promise<WorkspaceSnapshotDTO>;
    restore(snapshotId: string): Promise<any>;
    undo(workspaceId: string): Promise<boolean>;
    redo(workspaceId: string): Promise<boolean>;
    getManifest(workspaceId: string): Promise<WorkspaceManifest | null>;
    export(workspaceId: string): Promise<any>;
    delete(id: string): Promise<void>;
}
export declare class PlatformSDK {
    private assetService?;
    private semanticService?;
    private goalService?;
    private capabilityService?;
    private executionRuntime?;
    initialize(): Promise<void>;
    scan(url: string, ctx?: PlatformContext): Promise<ScanResult>;
    asset(): AssetService;
    semantic(): SemanticService;
    goal(): GoalService;
    capability(name: string): CapabilityService;
    execute(request: ExecuteRequest, ctx?: PlatformContext): Promise<ExecuteResult>;
    /**
     * Compile a capability into an execution plan.
     */
    compile(capabilityId: string, ctx?: PlatformContext): Promise<ExecutionPlanDTO>;
    /**
     * Create an execution plan from a capability.
     */
    plan(capabilityId: string, _input: any, ctx?: PlatformContext): Promise<ExecutionPlanDTO>;
    /**
     * Execute an execution plan and return results.
     */
    executePlan(plan: ExecutionPlanDTO, ctx?: PlatformContext): Promise<ExecutionResultDTO>;
    private agentService?;
    /**
     * Get the Agent service for managing and dispatching agents.
     */
    agent(): any;
    private _createAgentService_lazy;
    private workspaceService?;
    /**
     * Get the Workspace service for managing AI creation workspaces.
     */
    workspace(): WorkspaceService;
    private workflowService?;
    /**
     * Get the Workflow service for managing and executing workflows.
     */
    workflow(): any;
    private _createWorkflowService_lazy;
    private _workflowHealth;
    private _createWorkspaceService;
}
export declare const platformSDK: PlatformSDK;
