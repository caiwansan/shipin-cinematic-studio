"use strict";
/**
 * services/runtime-context.ts — Trace-only Context (Phase 1-D)
 *
 * Phase 1-D 宪法降级：
 *   ALS 仅承载 trace/logging 信息
 *   禁止承载 secrets / provider / model
 *   RuntimePayload 已替代 ALS 作为正式 runtime 链路
 *
 * 设计原则：
 *   1. 每个请求/任务创建一个 TraceContext
 *   2. 仅包含 traceId, requestId, timing 信息
 *   3. 任何业务 runtime 数据必须通过 RuntimePayload 显式传递
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContext = createContext;
exports.cloneContext = cloneContext;
exports.withRuntimeContext = withRuntimeContext;
exports.getRuntimeContext = getRuntimeContext;
exports.getContextSnapshot = getContextSnapshot;
exports.restoreContextFromSnapshot = restoreContextFromSnapshot;
var async_hooks_1 = require("async_hooks");
var crypto_1 = require("crypto");
function createContext(init) {
    var now = Date.now();
    return {
        requestId: (init === null || init === void 0 ? void 0 : init.requestId) || crypto_1.default.randomUUID(),
        userId: init === null || init === void 0 ? void 0 : init.userId,
        taskId: init === null || init === void 0 ? void 0 : init.taskId,
        projectId: init === null || init === void 0 ? void 0 : init.projectId,
        createdAt: now,
    };
}
function cloneContext(ctx, overrides) {
    return __assign(__assign(__assign({}, ctx), overrides), { createdAt: Date.now() });
}
// ============ AsyncLocalStorage 实例 ============
var asyncLocalStorage = new async_hooks_1.AsyncLocalStorage();
// ============ API ============
/**
 * 在 context 中执行函数
 * 每个 HTTP handler / worker 入口调用一次
 */
function withRuntimeContext(ctx, fn) {
    return asyncLocalStorage.run(ctx, fn);
}
/**
 * 获取当前请求/任务的 TraceContext
 * Phase 1-D: 仅用于 trace/logging，禁止读取业务 secrets
 */
function getRuntimeContext() {
    return asyncLocalStorage.getStore();
}
/**
 * 获取当前 context 可序列化的快照（仅 trace 字段）
 * 用于 checkpoint 存储或 worker 传输
 */
function getContextSnapshot() {
    var ctx = getRuntimeContext();
    if (!ctx)
        return undefined;
    return {
        requestId: ctx.requestId,
        userId: ctx.userId,
        taskId: ctx.taskId,
        projectId: ctx.projectId,
    };
}
/**
 * 从 snapshot 重建 context（仅 trace 字段）
 * Phase 1-D: 业务 runtime 数据需通过 RuntimePayload 显式传递
 */
function restoreContextFromSnapshot(snapshot) {
    return {
        requestId: snapshot.requestId,
        userId: snapshot.userId,
        taskId: snapshot.taskId,
        projectId: snapshot.projectId,
        createdAt: Date.now(),
    };
}
