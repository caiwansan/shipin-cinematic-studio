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
exports.__RUNTIME_OWNER__ = exports.taskEventEmitter = exports.projectService = exports.prisma = void 0;
exports.sleep = sleep;
exports.getRouteConfig = getRouteConfig;
exports.getRouteConfigGroup = getRouteConfigGroup;
exports.getRouteConfigProviders = getRouteConfigProviders;
var client_1 = require("@prisma/client");
var events_1 = require("events");
exports.prisma = new client_1.PrismaClient();
var project_service_js_1 = require("../services/project.service.js");
Object.defineProperty(exports, "projectService", { enumerable: true, get: function () { return project_service_js_1.projectService; } });
exports.taskEventEmitter = new events_1.EventEmitter();
// 防止内存泄漏，最多 50 个 listener
exports.taskEventEmitter.setMaxListeners(50);
function sleep(ms) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, new Promise(function (resolve) { return setTimeout(resolve, ms); })];
        });
    });
}
// ====== Route Config 辅助函数（去硬编码） ======
/**
 * 从 RouteConfig 表读取单条配置，支持 scope 过滤
 * 读取不到时返回 defaultValue（硬编码 fallback）
 */
function getRouteConfig(scope, key, defaultValue) {
    return __awaiter(this, void 0, void 0, function () {
        var row, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.prisma.routeConfig.findUnique({
                            where: { scope_key: { scope: scope, key: key } }
                        })];
                case 1:
                    row = _a.sent();
                    return [2 /*return*/, row ? row.value : defaultValue];
                case 2:
                    e_1 = _a.sent();
                    // DB 不可用时回退到默认值
                    return [2 /*return*/, defaultValue];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * 读取 scope 下所有配置，返回扁平对象 { key: value }
 */
function getRouteConfigGroup(scope) {
    return __awaiter(this, void 0, void 0, function () {
        var rows, result, _i, rows_1, r, e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, exports.prisma.routeConfig.findMany({
                            where: { scope: scope, isActive: true }
                        })];
                case 1:
                    rows = _a.sent();
                    result = {};
                    for (_i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                        r = rows_1[_i];
                        result[r.key] = r.value;
                    }
                    return [2 /*return*/, result];
                case 2:
                    e_2 = _a.sent();
                    return [2 /*return*/, {}];
                case 3: return [2 /*return*/];
            }
        });
    });
}
/**
 * 从 RouteConfig 表读取 providers 数组（便携函数）
 */
function getRouteConfigProviders(scope) {
    return __awaiter(this, void 0, void 0, function () {
        var providers;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getRouteConfig(scope, 'providers', [])];
                case 1:
                    providers = _a.sent();
                    return [2 /*return*/, providers];
            }
        });
    });
}
// @phase4-owner
exports.__RUNTIME_OWNER__ = {
    "entry": "narrative-gateway",
    "mode": "SYNC"
};
