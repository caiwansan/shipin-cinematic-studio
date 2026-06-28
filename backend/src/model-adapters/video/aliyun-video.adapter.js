"use strict";
/**
 * model-adapters/video/aliyun-video.adapter.ts
 *
 * 阿里百炼万相视频适配器
 *
 * 支持的模型:
 *   wan2.7-i2v, wan2.7-t2v, wan2.7-r2v
 *   wan2.6-i2v, wan2.6-t2v, wan2.6-r2v
 *   wan2.5-i2v, wan2.5-t2v
 *   wan2.2-i2v, wan2.2-t2v, wan2.2-kf2v
 *   wanx2.1-i2v, wanx2.1-t2v, wanx2.1-kf2v
 *   happyhorse-1.0-*
 *
 * 端点: 原生百炼 task/sumbit 端点
 * body 格式按模型类型选择:
 *   wan2.7-i2v → input.media[{type:"first_frame"/"last_frame"}]
 *   wan2.6-i2v → input.img_url + audio_url + shot_type
 *   wan2.7-r2v → input.media[{type:"reference_image"/"reference_video"}]
 *   t2v → prompt only
 *
 * 注: 所有费时任务的端点都是异步 submit + task_id 轮询
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
exports.aliyunVideoAdapter = void 0;
var fs_1 = require("fs");
var provider_middleware_js_1 = require("../../runtime/provider-middleware.js");
var SUBMIT_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis';
var QUERY_URL = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/get-video-task';
/** wan2.7 以上多模态格式视频 */
var MODERN_MODELS = ['wan2.7', 'wan2.6', 'wanx2.1', 'wan2.5', 'happyhorse'];
exports.aliyunVideoAdapter = {
    name: 'aliyun-video',
    supportedModels: [
        'wan2.7-i2v', 'wan2.7-t2v', 'wan2.7-r2v', 'wan2.7-videoedit',
        'wan2.6-i2v', 'wan2.6-t2v', 'wan2.6-r2v',
        'wan2.5-i2v', 'wan2.5-t2v',
        'wan2.2-i2v', 'wan2.2-t2v', 'wan2.2-kf2v',
        'wanx2.1-i2v', 'wanx2.1-t2v', 'wanx2.1-kf2v',
        'happyhorse-1.0-r2v', 'happyhorse-1.0-i2v', 'happyhorse-1.0-t2v', 'happyhorse-1.0-video-edit',
        'happyhorse*', 'wan2*', 'wanx*',
    ],
    taskTypes: ['video'],
    provider: 'aliyun',
    execute: function (runtime, input) {
        return __awaiter(this, void 0, void 0, function () {
            var apiKey, model, prompt, duration, ratio, _a, body, media, i, toB64, b, b, res, _b, _c, _d, data, taskId;
            var _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
            return __generator(this, function (_s) {
                switch (_s.label) {
                    case 0:
                        apiKey = runtime.apiKey || '';
                        if (!apiKey)
                            throw new Error('阿里百炼 API Key 未配置');
                        model = input.model || '';
                        prompt = input.prompt || '';
                        duration = input.duration || 5;
                        _a = input.ratio;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, resolveRatio(input.aspectRatio || '9:16')];
                    case 1:
                        _a = (_s.sent());
                        _s.label = 2;
                    case 2:
                        ratio = _a;
                        console.log("[AliyunVideo] model=".concat(model, ", prompt=").concat(prompt.substring(0, 40), "..."));
                        console.log("[AliyunVideo] input: referenceImages=".concat((_f = (_e = input.referenceImages) === null || _e === void 0 ? void 0 : _e.length) !== null && _f !== void 0 ? _f : 0, "\u5F20, r2vMedia=").concat((_h = (_g = input.r2vMedia) === null || _g === void 0 ? void 0 : _g.length) !== null && _h !== void 0 ? _h : 0, "\u4E2A, imageUrl=").concat(!!input.imageUrl));
                        body = provider_middleware_js_1.providerMiddleware.buildVideoBody({
                            model: model,
                            prompt: prompt,
                            imageUrl: input.imageUrl,
                            imageUrl2: input.imageUrl2,
                            referenceImages: input.referenceImages,
                            audioUrl: input.audioUrl,
                            shotType: input.shotType,
                            duration: duration,
                            ratio: ratio,
                            r2vMedia: input.r2vMedia,
                            negativePrompt: input.negativePrompt,
                        });
                        media = (_j = body === null || body === void 0 ? void 0 : body.input) === null || _j === void 0 ? void 0 : _j.media;
                        if (media === null || media === void 0 ? void 0 : media.length) {
                            console.log("[AliyunVideo] media: ".concat(media.length, "\u9879"));
                            for (i = 0; i < media.length; i++) {
                                console.log("  media[".concat(i, "]: type=").concat(media[i].type, ", url=").concat((media[i].url || '').substring(0, 80)));
                            }
                        }
                        else {
                            console.log("[AliyunVideo] \u26A0\uFE0F media \u4E3A\u7A7A\uFF0Cbody_input_keys=".concat(Object.keys((body === null || body === void 0 ? void 0 : body.input) || {}).join(',')));
                        }
                        toB64 = function (url) {
                            if (!(url === null || url === void 0 ? void 0 : url.startsWith('https://aigc.fushtn.com/')))
                                return null;
                            var localPath = url.replace('https://aigc.fushtn.com', '/root/shipin-cinematic-studio/backend/public');
                            try {
                                var buf = (0, fs_1.readFileSync)(localPath);
                                console.log("[AliyunVideo] \u2705 base64: ".concat(localPath, " (").concat(buf.length, "B)"));
                                return "data:image/jpeg;base64,".concat(buf.toString('base64'));
                            }
                            catch (_a) {
                                return null;
                            }
                        };
                        (_l = (_k = body.input) === null || _k === void 0 ? void 0 : _k.media) === null || _l === void 0 ? void 0 : _l.forEach(function (m) { var b = toB64(m.url); if (b)
                            m.url = b; });
                        if ((_m = body === null || body === void 0 ? void 0 : body.input) === null || _m === void 0 ? void 0 : _m.img_url) {
                            b = toB64(body.input.img_url);
                            if (b)
                                body.input.img_url = b;
                        }
                        if ((_o = body === null || body === void 0 ? void 0 : body.input) === null || _o === void 0 ? void 0 : _o.img_url2) {
                            b = toB64(body.input.img_url2);
                            if (b)
                                body.input.img_url2 = b;
                        }
                        console.log("[AliyunVideo] body \u6784\u5EFA\u5B8C\u6210: ".concat(JSON.stringify(body)));
                        return [4 /*yield*/, fetch(SUBMIT_URL, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Authorization: "Bearer ".concat(apiKey),
                                    'X-DashScope-Async': 'enable',
                                },
                                body: JSON.stringify(body),
                                signal: AbortSignal.timeout(30000),
                            })];
                    case 3:
                        res = _s.sent();
                        if (!!res.ok) return [3 /*break*/, 5];
                        _b = Error.bind;
                        _d = (_c = "\u963F\u91CC\u89C6\u9891\u63D0\u4EA4\u5931\u8D25 (".concat(res.status, "): ")).concat;
                        return [4 /*yield*/, res.text()];
                    case 4: throw new (_b.apply(Error, [void 0, _d.apply(_c, [_s.sent()])]))();
                    case 5: return [4 /*yield*/, res.json()];
                    case 6:
                        data = _s.sent();
                        taskId = ((_p = data === null || data === void 0 ? void 0 : data.output) === null || _p === void 0 ? void 0 : _p.task_id) || (data === null || data === void 0 ? void 0 : data.task_id) || (data === null || data === void 0 ? void 0 : data.request_id);
                        if (!taskId) {
                            // 可能有同步返回的情况
                            if ((_q = data === null || data === void 0 ? void 0 : data.output) === null || _q === void 0 ? void 0 : _q.video_url)
                                return [2 /*return*/, { url: data.output.video_url, provider: 'aliyun' }];
                            if ((_r = data === null || data === void 0 ? void 0 : data.data) === null || _r === void 0 ? void 0 : _r.url)
                                return [2 /*return*/, { url: data.data.url, provider: 'aliyun' }];
                            throw new Error("\u963F\u91CC\u89C6\u9891\u65E0 task_id: ".concat(JSON.stringify(data).substring(0, 200)));
                        }
                        console.log("[AliyunVideo] \u4EFB\u52A1\u5DF2\u63D0\u4EA4: ".concat(taskId));
                        // 轮询结果
                        return [2 /*return*/, pollAliyunVideoResult(taskId, apiKey, model)];
                }
            });
        });
    },
};
function pollAliyunVideoResult(taskId, apiKey, model) {
    return __awaiter(this, void 0, void 0, function () {
        var maxPoll, i, queryBody, res, _a, _b, _c, data, status_1, url, duration, resolution;
        var _d, _e, _f, _g, _h, _j, _k;
        return __generator(this, function (_l) {
            switch (_l.label) {
                case 0:
                    maxPoll = 300 // 最长等 5分钟（300次×1s）
                    ;
                    i = 0;
                    _l.label = 1;
                case 1:
                    if (!(i < maxPoll)) return [3 /*break*/, 8];
                    queryBody = { task_id: taskId };
                    if (model)
                        queryBody.model = model;
                    return [4 /*yield*/, fetch(QUERY_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', Authorization: "Bearer ".concat(apiKey) },
                            body: JSON.stringify(queryBody),
                            signal: AbortSignal.timeout(15000),
                        })];
                case 2:
                    res = _l.sent();
                    if (!!res.ok) return [3 /*break*/, 4];
                    _a = Error.bind;
                    _c = (_b = "\u963F\u91CC\u89C6\u9891\u4EFB\u52A1\u67E5\u8BE2\u5931\u8D25 (".concat(res.status, "): ")).concat;
                    return [4 /*yield*/, res.text()];
                case 3: throw new (_a.apply(Error, [void 0, _c.apply(_b, [_l.sent()])]))();
                case 4: return [4 /*yield*/, res.json()];
                case 5:
                    data = _l.sent();
                    status_1 = ((_d = data === null || data === void 0 ? void 0 : data.output) === null || _d === void 0 ? void 0 : _d.task_status) || (data === null || data === void 0 ? void 0 : data.status) || '';
                    if (status_1 === 'SUCCEEDED' || status_1 === 'succeeded') {
                        url = ((_e = data === null || data === void 0 ? void 0 : data.output) === null || _e === void 0 ? void 0 : _e.video_url) || ((_f = data === null || data === void 0 ? void 0 : data.data) === null || _f === void 0 ? void 0 : _f.url) || (data === null || data === void 0 ? void 0 : data.url);
                        duration = ((_g = data === null || data === void 0 ? void 0 : data.output) === null || _g === void 0 ? void 0 : _g.video_duration) || undefined;
                        resolution = ((_h = data === null || data === void 0 ? void 0 : data.output) === null || _h === void 0 ? void 0 : _h.video_resolution) || ((_j = data === null || data === void 0 ? void 0 : data.output) === null || _j === void 0 ? void 0 : _j.resolution) || undefined;
                        if (url)
                            return [2 /*return*/, { url: url, duration: duration, resolution: resolution, provider: 'aliyun' }];
                        throw new Error("\u963F\u91CC\u89C6\u9891\u4EFB\u52A1\u6210\u529F\u4F46\u65E0 URL: ".concat(JSON.stringify(data).substring(0, 200)));
                    }
                    if (status_1 === 'FAILED' || status_1 === 'failed') {
                        throw new Error("\u963F\u91CC\u89C6\u9891\u4EFB\u52A1\u5931\u8D25: ".concat(((_k = data === null || data === void 0 ? void 0 : data.output) === null || _k === void 0 ? void 0 : _k.message) || (data === null || data === void 0 ? void 0 : data.error) || 'Unknown'));
                    }
                    if (i % 30 === 0) {
                        console.log("[AliyunVideo] \u8F6E\u8BE2\u4E2D: ".concat(i, "s, status=").concat(status_1));
                    }
                    return [4 /*yield*/, new Promise(function (r) { return setTimeout(r, 1000); })];
                case 6:
                    _l.sent();
                    _l.label = 7;
                case 7:
                    i++;
                    return [3 /*break*/, 1];
                case 8: throw new Error("\u963F\u91CC\u89C6\u9891\u4EFB\u52A1\u8D85\u65F6 (taskId=".concat(taskId, ")"));
            }
        });
    });
}
function resolveRatio(aspectRatio) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            if (!aspectRatio)
                return [2 /*return*/, '9:16'];
            if (aspectRatio === '9:16' || aspectRatio === '16:9')
                return [2 /*return*/, aspectRatio];
            return [2 /*return*/, '9:16'];
        });
    });
}
