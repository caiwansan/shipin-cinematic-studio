"use strict";
// ============================================================
// Platform SDK — single entry point for all Runtime operations
// ARCH-001-J: Workspace code must NOT access Runtime directly; use this SDK
// ARCH-002: All SDK methods accept and forward PlatformContext
// ============================================================
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.platformSDK = exports.PlatformSDK = void 0;
// ─── Platform SDK ───
class PlatformSDK {
    assetService;
    semanticService;
    goalService;
    capabilityService;
    executionRuntime;
    async initialize() {
        const { assetRuntime } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/asset/runtime/asset.runtime.js')));
        this.assetService = {
            async create(data, ctx) { throw new Error('use importFromHtml instead'); },
            async get(id, ctx) { return assetRuntime.getAsset(id); },
            async list(projectId, filter, ctx) { return assetRuntime.listByProject(projectId, filter); },
            async delete(id, ctx) { await assetRuntime.deleteAsset(id); },
            async importFromHtml(projectId, url, html, ctx) { return assetRuntime.importFromHtml(projectId, url, html); },
        };
        const { semanticRuntime } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/semantic/runtime/semantic.runtime.js')));
        this.semanticService = {
            async extract(projectId, content, ctx) {
                if (ctx) {
                    await semanticRuntime.init(ctx);
                    await semanticRuntime.execute(ctx, { projectId, content });
                }
                else {
                    await semanticRuntime.loadFromContent(projectId, { content });
                }
            },
            async listEntities(projectId, filter, ctx) { return semanticRuntime.listEntities({ projectId, ...filter }); },
            async deleteEntity(id, ctx) { await semanticRuntime.deleteEntity(id); },
        };
        const { goalRuntime } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/goal/runtime/goal.runtime.js')));
        this.goalService = {
            async create(data, ctx) { return goalRuntime.createGoal(data); },
            async get(id, ctx) { return goalRuntime.getGoal(id); },
            async executeTask(taskId, ctx) {
                const result = await goalRuntime.executeTask(taskId);
                return {
                    success: result.execution.status === 'completed',
                    provider: 'internal',
                    capability: result.execution.actionType,
                    result: { execution: result.execution, results: result.results },
                    error: result.execution.status === 'failed' ? 'execution failed' : null,
                    metrics: { resolveTimeMs: 0, strategyUsed: 'internal' },
                };
            },
            async generateStrategies(goalId, ctx) { return goalRuntime.generateStrategies(goalId); },
            async runFullPipeline(goalId, ctx) { return goalRuntime.runFullPipeline(goalId, ctx); },
        };
        const { capabilityRuntime } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/capability/runtime/capability.runtime.js')));
        this.capabilityService = {
            async get(name, ctx) { return capabilityRuntime.getCapability(name); },
            async validate(contractName, input, ctx) { return capabilityRuntime.validateContract(contractName, input); },
            async resolve(request, ctx) { return capabilityRuntime.resolve(request); },
            async register(input, ctx) { return capabilityRuntime.register(input); },
            list(ctx) { return capabilityRuntime.listCapabilities(); },
        };
        // Initialize Execution Runtime (KMKI-PLAT-007)
        try {
            const { executionRuntime } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/execution/runtime/execution.runtime.js')));
            this.executionRuntime = executionRuntime;
            await executionRuntime.init({});
            console.log('[PlatformSDK] Execution Runtime initialized');
        }
        catch (err) {
            console.warn('[PlatformSDK] Failed to init Execution Runtime:', err.message);
        }
        // Initialize Workflow Runtime (KMKI-PLAT-011)
        try {
            const { workflowRuntime } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/runtime/workflow.runtime.js')));
            await workflowRuntime.init({});
            console.log('[PlatformSDK] Workflow Runtime initialized');
        }
        catch (err) {
            console.warn('[PlatformSDK] Failed to init Workflow Runtime:', err.message);
        }
    }
    // ─── Public API ───
    async scan(url, ctx) {
        // NOTE: Scanner module removed per Architecture Freeze (ARCH-002).
        // AI modules must NOT self-maintain assets or re-scan websites.
        // This method is preserved for future Platform-level scanner integration.
        console.warn('[PlatformSDK] scan() is not available — scanner module removed');
        return { success: false, error: 'Scanner not available (Architecture Freeze)' };
    }
    asset() {
        if (!this.assetService)
            throw new Error('SDK not initialized. Call platformSDK.initialize() first.');
        return this.assetService;
    }
    semantic() {
        if (!this.semanticService)
            throw new Error('SDK not initialized. Call platformSDK.initialize() first.');
        return this.semanticService;
    }
    goal() {
        if (!this.goalService)
            throw new Error('SDK not initialized. Call platformSDK.initialize() first.');
        return this.goalService;
    }
    capability(name) {
        if (!this.capabilityService)
            throw new Error('SDK not initialized. Call platformSDK.initialize() first.');
        return this.capabilityService;
    }
    async execute(request, ctx) {
        if (!this.capabilityService)
            throw new Error('SDK not initialized. Call platformSDK.initialize() first.');
        return this.capabilityService.resolve(request, ctx);
    }
    // ─── Execution Runtime Methods (KMKI-PLAT-007) ───
    /**
     * Compile a capability into an execution plan.
     */
    async compile(capabilityId, ctx) {
        if (!this.executionRuntime)
            throw new Error('Execution Runtime not available');
        const { executionCompiler } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/execution/compiler/execution-compiler.js')));
        const compiled = await executionCompiler.compile({
            id: capabilityId,
            name: capabilityId,
            displayName: capabilityId,
            description: null,
            category: 'general',
            version: '1.0.0',
            status: 'active',
        }, undefined, ctx);
        return compiled.plan;
    }
    /**
     * Create an execution plan from a capability.
     */
    async plan(capabilityId, _input, ctx) {
        return this.compile(capabilityId, ctx);
    }
    /**
     * Execute an execution plan and return results.
     */
    async executePlan(plan, ctx) {
        if (!this.executionRuntime)
            throw new Error('Execution Runtime not available');
        return this.executionRuntime.execute(ctx || {}, plan);
    }
    // ─── Agent Runtime (KMKI-PLAT-010) ───
    agentService;
    /**
     * Get the Agent service for managing and dispatching agents.
     */
    agent() {
        if (!this.agentService) {
            this.agentService = this._createAgentService_lazy();
        }
        return this.agentService;
    }
    _createAgentService_lazy() {
        const that = this;
        return {
            async execute(code, input, ctx) {
                const { agentService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/agent/agent.service.js')));
                return agentService.execute(code, input, ctx);
            },
            async dispatch(code, input, ctx) {
                const { agentService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/agent/agent.service.js')));
                return agentService.dispatch({ agentCode: code, input }, ctx);
            },
            async schedule(plan, ctx) {
                const { agentService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/agent/agent.service.js')));
                return agentService.schedule(plan, ctx);
            },
            async register(definition, executor) {
                const { agentService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/agent/agent.service.js')));
                return agentService.register(definition, executor);
            },
            async unregister(code) {
                const { agentService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/agent/agent.service.js')));
                return agentService.unregister(code);
            },
            listAgents() {
                return [];
            },
            getAgent(code) {
                return null;
            },
            health() {
                return { status: 'ok' };
            },
        };
    }
    // ─── Workspace Runtime (KMKI-PLAT-009) ───
    workspaceService;
    /**
     * Get the Workspace service for managing AI creation workspaces.
     */
    workspace() {
        if (!this.workspaceService) {
            this.workspaceService = this._createWorkspaceService();
        }
        return this.workspaceService;
    }
    // ─── Workflow Runtime (KMKI-PLAT-011) ───
    workflowService;
    /**
     * Get the Workflow service for managing and executing workflows.
     */
    workflow() {
        if (!this.workflowService) {
            this.workflowService = this._createWorkflowService_lazy();
        }
        return this.workflowService;
    }
    _createWorkflowService_lazy() {
        const that = this;
        return {
            async execute(code, input, workspaceId, ctx) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                // Create instance then execute
                const instance = await workflowService.createInstance(code, workspaceId || 'default', input);
                if (instance.id) {
                    await workflowService.execute(instance.id, ctx);
                }
                return instance;
            },
            async pause(instanceId) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                return workflowService.pause(instanceId);
            },
            async resume(instanceId, ctx) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                return workflowService.resume(instanceId, ctx);
            },
            async replay(instanceId, options) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                return workflowService.replay(instanceId, options);
            },
            async cancel(instanceId) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                return workflowService.cancel(instanceId);
            },
            async listDefinitions(filter) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                return workflowService.listDefinitions(filter);
            },
            async getDefinition(code) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                return workflowService.getDefinition(code);
            },
            async createDefinition(data) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                return workflowService.createDefinition(data);
            },
            async getInstance(instanceId) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                return workflowService.getInstance(instanceId);
            },
            async describeInstance(instanceId) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                return workflowService.describeInstance(instanceId);
            },
            async submitHumanResponse(instanceId, nodeType, action, data) {
                const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
                return workflowService.submitHumanResponse(instanceId, nodeType, action, data);
            },
            health() {
                return that._workflowHealth();
            },
        };
    }
    async _workflowHealth() {
        try {
            const { workflowService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workflow/workflow.service.js')));
            return workflowService.health();
        }
        catch {
            return { status: 'unavailable' };
        }
    }
    _createWorkspaceService() {
        const that = this;
        return {
            async create(type, name, tenantId, description) {
                const { workspaceService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workspace/workspace.service.js')));
                return workspaceService.create({ type, name, tenantId, description });
            },
            async get(id) {
                const { workspaceService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workspace/workspace.service.js')));
                return workspaceService.get(id);
            },
            async list(tenantId) {
                const { workspaceService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workspace/workspace.service.js')));
                return workspaceService.list({ tenantId });
            },
            async snapshot(workspaceId, label) {
                const { workspaceService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workspace/workspace.service.js')));
                return workspaceService.snapshot(workspaceId, label);
            },
            async restore(snapshotId) {
                const { workspaceService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workspace/workspace.service.js')));
                return workspaceService.restore(snapshotId);
            },
            async undo(workspaceId) {
                const { workspaceService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workspace/workspace.service.js')));
                return workspaceService.undo(workspaceId);
            },
            async redo(workspaceId) {
                const { workspaceService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workspace/workspace.service.js')));
                return workspaceService.redo(workspaceId);
            },
            async getManifest(workspaceId) {
                const { workspaceService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workspace/workspace.service.js')));
                return workspaceService.getManifest(workspaceId);
            },
            async export(workspaceId) {
                const { workspaceService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workspace/workspace.service.js')));
                return workspaceService.exportWorkspace(workspaceId);
            },
            async delete(id) {
                const { workspaceService } = await Promise.resolve().then(() => __importStar(require('../../backend/src/services/platform/workspace/workspace.service.js')));
                return workspaceService.delete(id);
            },
        };
    }
}
exports.PlatformSDK = PlatformSDK;
// Singleton
exports.platformSDK = new PlatformSDK();
