"use strict";
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
exports.__RUNTIME_OWNER__ = exports.projectService = void 0;
var index_js_1 = require("../utils/index.js");
exports.projectService = {
    findAll: function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var where;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        where = {};
                        if (userId)
                            where.userId = userId;
                        return [4 /*yield*/, index_js_1.prisma.project.findMany({
                                where: where,
                                select: {
                                    id: true,
                                    name: true,
                                    status: true,
                                    createdAt: true,
                                    updatedAt: true,
                                    description: true,
                                    userId: true,
                                },
                                orderBy: { updatedAt: 'desc' },
                            })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    findById: function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, index_js_1.prisma.project.findUnique({ where: { id: id }, include: { storyboards: true, videoTasks: true } })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    create: function (data) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // 映射 title → name（前端可能传 title 而非 name）
                        if (data.title && !data.name) {
                            data.name = data.title;
                        }
                        delete data.title;
                        return [4 /*yield*/, index_js_1.prisma.project.create({ data: data })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    update: function (id, data) {
        return __awaiter(this, void 0, void 0, function () {
            var existing, knownFields, cleanData, _i, _a, _b, key, value;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!(data.version !== undefined)) return [3 /*break*/, 2];
                        return [4 /*yield*/, index_js_1.prisma.project.findUnique({
                                where: { id: id },
                                select: { version: true }
                            })];
                    case 1:
                        existing = _c.sent();
                        if (!existing) {
                            throw Object.assign(new Error('项目不存在'), { statusCode: 404 });
                        }
                        if (data.version < existing.version) {
                            throw Object.assign(new Error("\u7248\u672C\u51B2\u7A81\uFF1A\u5F53\u524D\u7248\u672C ".concat(existing.version, "\uFF0C\u5BA2\u6237\u7AEF\u7248\u672C ").concat(data.version, "\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5")), { statusCode: 409 });
                        }
                        // 校验通过后递增版本，并从 data 中移除旧版本值
                        data.version = existing.version + 1;
                        _c.label = 2;
                    case 2:
                        knownFields = new Set([
                            'id', 'name', 'description', 'script', 'status', 'version',
                            'budgetLimit', 'budgetSpent', 'budgetAlertAt', 'budgetNotified',
                            'executionResults', 'runtimeCheckpoint', 'failureEvents', 'executionJournal',
                            'plotBlueprint', 'continuationFrom', 'createdAt', 'updatedAt',
                        ]);
                        cleanData = {};
                        for (_i = 0, _a = Object.entries(data); _i < _a.length; _i++) {
                            _b = _a[_i], key = _b[0], value = _b[1];
                            if (knownFields.has(key)) {
                                cleanData[key] = value;
                            }
                        }
                        return [4 /*yield*/, index_js_1.prisma.project.update({ where: { id: id }, data: cleanData })];
                    case 3: return [2 /*return*/, _c.sent()];
                }
            });
        });
    },
    delete: function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, index_js_1.prisma.project.delete({ where: { id: id } })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    saveExecutionResults: function (projectId, executionResults) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, index_js_1.prisma.project.update({
                            where: { id: projectId },
                            data: { executionResults: executionResults },
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    },
    getExecutionResults: function (projectId) {
        return __awaiter(this, void 0, void 0, function () {
            var project;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, index_js_1.prisma.project.findUnique({
                            where: { id: projectId },
                            select: { executionResults: true },
                        })];
                    case 1:
                        project = _a.sent();
                        return [2 /*return*/, (project === null || project === void 0 ? void 0 : project.executionResults) || null];
                }
            });
        });
    },
};
// @phase4-owner
exports.__RUNTIME_OWNER__ = {
    "entry": "narrative-gateway",
    "mode": "SYNC"
};
