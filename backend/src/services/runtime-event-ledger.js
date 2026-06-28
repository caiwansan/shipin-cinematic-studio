"use strict";
/**
 * runtime-event-ledger.ts
 *
 * Event Ledger — 系统运行时事件统一写入点。
 * 所有 provider 调用、fallback、超时、错误都通过此 service 记录。
 *
 * 这是 Runtime Observability Civilization 的第一步：
 *   不再是各模块各写各的日志表，
 *   而是所有事件统一 schema、统一写入、统一查询。
 *
 * Constitutional:
 *   - 所有 P0/P1 runtime 模块必须使用此 service 记录事件
 *   - 禁止直接写 InvocationLog / AiExecutionLog 等表
 *   - 未来 trace layer 依赖此数据
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeLedger = writeLedger;
exports.queryLedger = queryLedger;
exports.ledgerSummary = ledgerSummary;
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
/**
 * 写入 runtime event ledger
 * 单次写入，不重试 — 失败不影响主流程
 */
function writeLedger(event) {
    return __awaiter(this, void 0, void 0, function () {
        var err_1;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        return __generator(this, function (_m) {
            switch (_m.label) {
                case 0:
                    _m.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, prisma.invocationLog.create({
                            data: {
                                userId: event.userId,
                                projectId: (_a = event.projectId) !== null && _a !== void 0 ? _a : null,
                                traceId: (_b = event.traceId) !== null && _b !== void 0 ? _b : null,
                                executionId: (_c = event.executionId) !== null && _c !== void 0 ? _c : null,
                                stageId: (_d = event.stageId) !== null && _d !== void 0 ? _d : null,
                                capability: event.capability,
                                provider: event.provider,
                                model: event.model,
                                status: event.status,
                                latencyMs: (_e = event.latencyMs) !== null && _e !== void 0 ? _e : null,
                                tokenUsage: (_f = event.tokenUsage) !== null && _f !== void 0 ? _f : null,
                                errorMsg: (_g = event.errorMsg) !== null && _g !== void 0 ? _g : null,
                                fallbackChain: event.fallbackChain ? JSON.parse(JSON.stringify(event.fallbackChain)) : null,
                                sourcePath: (_h = event.sourcePath) !== null && _h !== void 0 ? _h : null,
                                runtimeVersion: process.env.RUNTIME_VERSION || '20260531_baseline',
                                agentType: (_j = event.agentType) !== null && _j !== void 0 ? _j : null,
                                operationType: (_k = event.operationType) !== null && _k !== void 0 ? _k : null,
                                assetRegistryId: (_l = event.assetRegistryId) !== null && _l !== void 0 ? _l : null,
                            },
                        })];
                case 1:
                    _m.sent();
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _m.sent();
                    // ledger write 失败不应影响主流程
                    console.warn('[RuntimeEventLedger] write failed (non-fatal):', err_1 instanceof Error ? err_1.message : err_1);
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * 查询最近的 runtime events，按时间倒序
 */
function queryLedger() {
    return __awaiter(this, arguments, void 0, function (opts) {
        var where, _a, items, total;
        if (opts === void 0) { opts = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    where = {};
                    if (opts.userId)
                        where.userId = opts.userId;
                    if (opts.projectId)
                        where.projectId = opts.projectId;
                    if (opts.traceId)
                        where.traceId = opts.traceId;
                    if (opts.executionId)
                        where.executionId = opts.executionId;
                    if (opts.capability)
                        where.capability = opts.capability;
                    if (opts.status)
                        where.status = opts.status;
                    return [4 /*yield*/, Promise.all([
                            prisma.invocationLog.findMany({
                                where: where,
                                orderBy: { createdAt: 'desc' },
                                take: opts.limit || 50,
                                skip: opts.offset || 0,
                            }),
                            prisma.invocationLog.count({ where: where }),
                        ])];
                case 1:
                    _a = _b.sent(), items = _a[0], total = _a[1];
                    return [2 /*return*/, { items: items, total: total }];
            }
        });
    });
}
/**
 * 获取 event ledger 的统计快照
 */
function ledgerSummary() {
    return __awaiter(this, arguments, void 0, function (opts) {
        var since, where, all, summary, latencies, _i, all_1, e, p95Idx;
        if (opts === void 0) { opts = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    since = opts.since || new Date(Date.now() - 24 * 60 * 60 * 1000) // 默认过去24小时
                    ;
                    where = { createdAt: { gte: since } };
                    if (opts.userId)
                        where.userId = opts.userId;
                    return [4 /*yield*/, prisma.invocationLog.findMany({
                            where: where,
                            select: { status: true, capability: true, latencyMs: true, provider: true },
                        })];
                case 1:
                    all = _a.sent();
                    summary = {
                        total: all.length,
                        byStatus: {},
                        byCapability: {},
                        byProvider: {},
                        avgLatencyMs: 0,
                        p95LatencyMs: 0,
                    };
                    latencies = [];
                    for (_i = 0, all_1 = all; _i < all_1.length; _i++) {
                        e = all_1[_i];
                        summary.byStatus[e.status] = (summary.byStatus[e.status] || 0) + 1;
                        summary.byCapability[e.capability] = (summary.byCapability[e.capability] || 0) + 1;
                        summary.byProvider[e.provider] = (summary.byProvider[e.provider] || 0) + 1;
                        if (e.latencyMs != null)
                            latencies.push(e.latencyMs);
                    }
                    if (latencies.length > 0) {
                        latencies.sort(function (a, b) { return a - b; });
                        summary.avgLatencyMs = Math.round(latencies.reduce(function (a, b) { return a + b; }, 0) / latencies.length);
                        p95Idx = Math.ceil(latencies.length * 0.95) - 1;
                        summary.p95LatencyMs = latencies[Math.max(0, p95Idx)];
                    }
                    return [2 /*return*/, summary];
            }
        });
    });
}
