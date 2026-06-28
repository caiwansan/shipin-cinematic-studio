"use strict";
/**
 * runtime/provider-middleware.ts — 统一大模型中间件层
 *
 * 前端提交任务 → 中间件自动识别用户使用的 model/provider →
 * 选择已注册的兼容方法 → 提交给大模型
 *
 * 架构:
 *   registerProvider(name, handler) → 注册 provider 及其能力
 *   selectHandler(provider, model, taskType) → 自动路由
 *   execute(input) → 统一入口
 *
 * 已注册 providers:
 *   aliyun/bailian  → LLM, Image, Video, TTS (阿里原生 API)
 *   volcengine      → LLM, Image, Video, TTS (火山引擎)
 *   deepseek        → LLM (OpenAI 兼容)
 *   siliconflow     → LLM, Image, TTS (OpenAI 兼容)
 *   openai          → LLM, Image (OpenAI 原生)
 *   custom          → LLM, Image (任何 OpenAI 兼容端点, ollama/vLLM)
 *   local           → LLM, Image (VIP 本地模型, 同 custom)
 *   kling           → Video (待接入, API Key 已支持注入)
 *   replicate       → Image, Video (待接入, API Key 已支持注入)
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
exports.providerMiddleware = exports.VIDEO_FORMAT_MAP = exports.MODEL_PROVIDER_MAP = exports.PROVIDER_CAPABILITIES = void 0;
var v2_js_1 = require("../config/v2.js");
var runtime_event_ledger_js_1 = require("../services/runtime-event-ledger.js");
/**
 * Provider 能力注册表
 * 前端选了什么 provider/model → 这里找到对应 handler → 自动提交
 */
exports.PROVIDER_CAPABILITIES = [
    {
        provider: 'aliyun',
        label: '阿里百炼',
        llm: true, image: true, video: true, tts: true,
        openaiCompat: false,
        handlerName: 'bailian',
        needsKey: true, envKey: 'ALIYUN_API_KEY',
    },
    {
        provider: 'bailian',
        label: '阿里百炼(alias)',
        llm: true, image: true, video: true, tts: true,
        openaiCompat: false,
        handlerName: 'bailian',
        needsKey: true, envKey: 'ALIYUN_API_KEY',
    },
    {
        provider: 'volcengine',
        label: '火山引擎',
        llm: true, image: true, video: true, tts: true,
        openaiCompat: false,
        handlerName: 'volcengine',
        needsKey: true, envKey: 'VOLCENGINE_API_KEY',
    },
    {
        provider: 'deepseek',
        label: 'DeepSeek',
        llm: true, image: false, video: false, tts: false,
        openaiCompat: true,
        handlerName: 'deepseek',
        needsKey: true, envKey: 'DEEPSEEK_API_KEY',
    },
    {
        provider: 'siliconflow',
        label: '硅基流动',
        llm: true, image: true, video: false, tts: true,
        openaiCompat: true,
        handlerName: 'siliconflow',
        needsKey: true, envKey: 'SILICONFLOW_API_KEY',
    },
    {
        provider: 'openai',
        label: 'OpenAI',
        llm: true, image: true, video: false, tts: false,
        openaiCompat: true,
        handlerName: 'openai',
        needsKey: true, envKey: 'OPENAI_API_KEY',
    },
    {
        provider: 'custom',
        label: '自定义端点',
        llm: true, image: true, video: false, tts: false,
        openaiCompat: true,
        handlerName: 'custom',
        needsKey: false,
    },
    {
        provider: 'local',
        label: '本地大模型',
        llm: true, image: true, video: false, tts: false,
        openaiCompat: true,
        handlerName: 'custom',
        needsKey: false,
    },
    {
        provider: 'kling',
        label: '可灵',
        llm: false, image: false, video: true, tts: false,
        openaiCompat: false,
        needsKey: true, envKey: 'KLING_API_KEY',
    },
    {
        provider: 'replicate',
        label: 'Replicate',
        llm: false, image: true, video: true, tts: false,
        openaiCompat: false,
        needsKey: true, envKey: 'REPLICATE_API_KEY',
    },
];
/**
 * 模型名 → Provider 自动识别表
 * 前端只要传 model 名，系统自动识别用哪个 provider
 */
exports.MODEL_PROVIDER_MAP = [
    // 阿里百炼 wan2.7 系列
    { prefix: 'wan2.7-i2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.7-t2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.7-r2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.7-videoedit', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.7-image', provider: 'aliyun', taskType: 'image' },
    { prefix: 'wan2.6-i2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.6-t2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.6-r2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.5-i2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.5-t2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.2-i2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.2-t2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wan2.2-kf2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wanx2.1-i2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wanx2.1-t2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'wanx2.1-kf2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'qwen-image', provider: 'aliyun', taskType: 'image' },
    { prefix: 'wan2.6-t2i', provider: 'aliyun', taskType: 'image' },
    { prefix: 'wan2.5-t2i', provider: 'aliyun', taskType: 'image' },
    { prefix: 'wan2.2-t2i', provider: 'aliyun', taskType: 'image' },
    { prefix: 'wanx2.1-t2i', provider: 'aliyun', taskType: 'image' },
    { prefix: 'z-image', provider: 'aliyun', taskType: 'image' },
    // qwen 系列 LLM
    { prefix: 'qwen', provider: 'aliyun', taskType: 'llm' },
    { prefix: 'qwq', provider: 'aliyun', taskType: 'llm' },
    { prefix: 'qvq', provider: 'aliyun', taskType: 'llm' },
    { prefix: 'cosyvoice', provider: 'aliyun', taskType: 'tts' },
    { prefix: 'kimi', provider: 'aliyun', taskType: 'llm' },
    { prefix: 'glm', provider: 'aliyun', taskType: 'llm' },
    { prefix: 'deepseek', provider: 'deepseek', taskType: 'llm' },
    // happyhorse 视频
    { prefix: 'happyhorse-1.0-r2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'happyhorse-1.0-i2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'happyhorse-1.0-t2v', provider: 'aliyun', taskType: 'video' },
    { prefix: 'happyhorse-1.0-video-edit', provider: 'aliyun', taskType: 'video' },
    { prefix: 'happyhorse', provider: 'aliyun', taskType: 'video' },
    // 火山引擎
    { prefix: 'doubao', provider: 'volcengine', taskType: 'llm' },
    { prefix: 'Doubao', provider: 'volcengine', taskType: 'llm' },
    { prefix: 'doubao-seedream', provider: 'volcengine', taskType: 'image' },
    { prefix: 'Doubao-Seedream', provider: 'volcengine', taskType: 'image' },
    { prefix: 'doubao-seedance', provider: 'volcengine', taskType: 'video' },
    { prefix: 'Doubao-Seedance', provider: 'volcengine', taskType: 'video' },
    { prefix: 'doubao-tts', provider: 'volcengine', taskType: 'tts' },
    { prefix: 'seed', provider: 'volcengine', taskType: 'llm' },
    // 硅基流动
    { prefix: 'Pro/Qwen', provider: 'siliconflow', taskType: 'llm' },
    { prefix: 'Qwen', provider: 'siliconflow', taskType: 'llm' },
    { prefix: 'deepseek-ai', provider: 'siliconflow', taskType: 'llm' },
    { prefix: 'THUDM', provider: 'siliconflow', taskType: 'llm' },
    { prefix: 'fishaudio', provider: 'siliconflow', taskType: 'tts' },
    // OpenAI
    { prefix: 'gpt', provider: 'openai', taskType: 'llm' },
    { prefix: 'o1', provider: 'openai', taskType: 'llm' },
    { prefix: 'o3', provider: 'openai', taskType: 'llm' },
    { prefix: 'dall-e', provider: 'openai', taskType: 'image' },
];
/**
 * 模型名前缀 → 视频格式映射
 * 新增视频模型只需在这加一行，不需要改 provider 代码
 */
exports.VIDEO_FORMAT_MAP = [
    // wan2.7+ 图生视频: input.media[{type:"first_frame"/"last_frame"}]
    { prefix: 'wan2.7-i2v', format: 'wan2.7-i2v' },
    // wan2.6 i2v: input.img_url + audio_url（含音频）
    { prefix: 'wan2.6-i2v', format: 'wan2.6-legacy' },
    // wan2.5及以下 i2v: 走旧版 img_url 格式（不含 audio）
    { prefix: 'wan2.5-i2v', format: 'wan2.6-legacy' },
    { prefix: 'wan2.4-i2v', format: 'wan2.6-legacy' },
    { prefix: 'wan2.3-i2v', format: 'wan2.6-legacy' },
    { prefix: 'wan2.2-i2v', format: 'wan2.6-legacy' },
    { prefix: 'wan2.1-i2v', format: 'wan2.6-legacy' },
    { prefix: 'wanx2.1-i2v', format: 'wan2.6-legacy' },
    { prefix: 'wan2.2-kf2v', format: 'wan2.6-legacy' },
    { prefix: 'wanx2.1-kf2v', format: 'wan2.6-legacy' },
    // wan2.7-r2v 参考图+视频: input.media[{type:"reference_image"/"reference_video"}]
    { prefix: 'wan2.7-r2v', format: 'wan2.7-r2v' },
    { prefix: 'wan2.6-r2v', format: 'wan2.7-r2v' },
    { prefix: 'wan2.2-r2v', format: 'wan2.7-r2v' },
    // happyhorse 系列: input.media 通用（多类型: first_frame / reference_image / video）
    { prefix: 'happyhorse-1.0-r2v', format: 'wan2.7-r2v' },
    { prefix: 'happyhorse-1.0-i2v', format: 'wan2.7-i2v' },
    { prefix: 'happyhorse-1.0-t2v', format: 't2v-standard' },
    { prefix: 'happyhorse-1.0-video-edit', format: 'wan2.7-r2v' },
    // doubao/seedance 系列: input.media 通用格式（多图 reference_image）
    { prefix: 'Doubao-', format: 'wan2.7-r2v' },
    { prefix: 'doubao-', format: 'wan2.7-r2v' },
    // 文生视频 (t2v): input 无 media/img_url
    { prefix: 'wan2.7-t2v', format: 't2v-standard' },
    { prefix: 'wan2.6-t2v', format: 't2v-standard' },
    { prefix: 'wan2.5-t2v', format: 't2v-standard' },
    { prefix: 'wan2.2-t2v', format: 't2v-standard' },
    { prefix: 'wanx2.1-t2v', format: 't2v-standard' },
];
// ── 中间件核心 ──
exports.providerMiddleware = {
    /**
     * 根据 model 名自动识别 provider 和 taskType
     * 例: "wan2.7-i2v" → { provider: "aliyun", taskType: "video" }
     *      "gpt-4o" → { provider: "openai", taskType: "llm" }
     */
    identify: function (model) {
        for (var _i = 0, MODEL_PROVIDER_MAP_1 = exports.MODEL_PROVIDER_MAP; _i < MODEL_PROVIDER_MAP_1.length; _i++) {
            var m = MODEL_PROVIDER_MAP_1[_i];
            if (model.startsWith(m.prefix)) {
                return { provider: m.provider, taskType: m.taskType };
            }
        }
        return null;
    },
    /**
     * 获取 provider 的能力信息
     */
    getCapability: function (provider) {
        return exports.PROVIDER_CAPABILITIES.find(function (c) { return c.provider === provider; });
    },
    /**
     * 检查 provider 是否支持指定的 taskType
     */
    supports: function (provider, taskType) {
        var cap = this.getCapability(provider);
        if (!cap)
            return false;
        return cap[taskType] === true;
    },
    /**
     * 列出所有支持指定 taskType 的 provider
     */
    listProviders: function (taskType) {
        return exports.PROVIDER_CAPABILITIES
            .filter(function (c) { return c[taskType]; })
            .map(function (c) { return c.provider; });
    },
    /**
     * 根据模型名获取视频 body 组装格式
     */
    getVideoFormat: function (model) {
        for (var _i = 0, VIDEO_FORMAT_MAP_1 = exports.VIDEO_FORMAT_MAP; _i < VIDEO_FORMAT_MAP_1.length; _i++) {
            var m = VIDEO_FORMAT_MAP_1[_i];
            if (model.startsWith(m.prefix))
                return m.format;
        }
        // 默认兼容 wan2.7-i2v 格式
        return 'wan2.7-i2v';
    },
    /**
     * 构建视频请求 body（根据模型格式）
     * 统一入口：所有视频模型的 body 都在这里组装
     * 新增视频模型时，加 VIDEO_FORMAT_MAP 条目 + 此方法新 case
     */
    buildVideoBody: function (input) {
        var _a, _b, _c;
        var format = this.getVideoFormat(input.model);
        var duration = Math.min(15, Math.max(2, Math.round(Number(input.duration || 5))));
        var body = {
            model: input.model,
            input: { prompt: input.prompt },
            parameters: {
                resolution: input.ratio === '9:16' ? '720P' : '720P',
                prompt_extend: true,
                watermark: false,
            },
        };
        // duration: t2v 模型和某些模型不支持自定义时长，不加 duration 参数
        // wan2.7-t2v, wan2.5-t2v 等固定 5 秒
        if (format !== 't2v-standard') {
            body.parameters.duration = duration;
        }
        switch (format) {
            case 'wan2.7-r2v': {
                // 参考图+参考视频: input.media[{type:"reference_image"/"reference_video", url, reference_voice}]
                if ((_a = input.r2vMedia) === null || _a === void 0 ? void 0 : _a.length) {
                    body.input.media = input.r2vMedia.map(function (m) { return (__assign({ type: m.type, url: m.url }, (m.reference_voice ? { reference_voice: m.reference_voice } : {}))); });
                }
                else if ((_b = input.referenceImages) === null || _b === void 0 ? void 0 : _b.length) {
                    // fallback: referenceImages 转为 reference_image
                    console.log("[MediaBuild] r2vMedia\u4E3A\u7A7A\uFF0Cfallback\u5230referenceImages: ".concat(input.referenceImages.length, "\u5F20"));
                    body.input.media = input.referenceImages.map(function (url) { return ({
                        type: 'reference_image',
                        url: url.startsWith('http') ? url : new URL(url, process.env.IMAGE_BASE_URL || 'https://aigc.fushtn.com').href,
                    }); });
                }
                else {
                    console.log("[MediaBuild] \u26A0\uFE0F r2vMedia\u548CreferenceImages\u90FD\u4E3A\u7A7A\uFF0C\u65E0media");
                }
                break;
            }
            case 'wan2.7-i2v': {
                // 新版图生视频: input.media[{type:"first_frame"/"last_frame"/"reference_image", url}]
                var media = [];
                if (input.imageUrl)
                    media.push({ type: 'first_frame', url: input.imageUrl });
                if (input.imageUrl2)
                    media.push({ type: 'last_frame', url: input.imageUrl2 });
                // 多余的参考图也传入（如中帧图）
                if ((_c = input.r2vMedia) === null || _c === void 0 ? void 0 : _c.length) {
                    var seen = new Set([input.imageUrl, input.imageUrl2].filter(Boolean));
                    for (var _i = 0, _d = input.r2vMedia; _i < _d.length; _i++) {
                        var ref = _d[_i];
                        if (!seen.has(ref.url)) {
                            media.push({ type: 'reference_image', url: ref.url });
                            seen.add(ref.url);
                        }
                    }
                }
                if (media.length > 0)
                    body.input.media = media;
                break;
            }
            case 'wan2.6-legacy': {
                // 旧版: input.img_url + audio_url + shot_type
                if (input.imageUrl)
                    body.input.img_url = input.imageUrl;
                if (input.imageUrl2)
                    body.input.img_url2 = input.imageUrl2;
                if (input.audioUrl)
                    body.input.audio_url = input.audioUrl;
                if (input.shotType)
                    body.parameters.shot_type = input.shotType;
                break;
            }
            case 't2v-standard': {
                // 文生视频: prompt only，无图片
                break;
            }
        }
        // 负面提示词：自动合并 AI 优化 + 默认动作相关负面词，保证动作自然
        var defaultNegative = '扭曲,僵硬,抽搐,不自然,瞬移,突变,闪切,抖动,抽风,limbs twisting,unnatural movement,twitching,jerkiness,teleport,肢体变形,多指,指节错位,面部扭曲,嘴型乱动,anime,卡通,cartoon,变形';
        var userNeg = input.negativePrompt || '';
        var combinedNeg = userNeg
            ? "".concat(userNeg, ",").concat(defaultNegative)
            : defaultNegative;
        body.input.negative_prompt = combinedNeg;
        if (input.seed !== undefined)
            body.parameters.seed = input.seed;
        return body;
    },
    /**
     * 注册 handler 到 provider
     * 后续可以扩展到 kling/replicate 等
     */
    _handlers: new Map(),
    register: function (provider, handler) {
        this._handlers.set(provider, handler);
    },
    getHandler: function (provider) {
        return this._handlers.get(provider);
    },
    /**
     * 统一入口：提交任务
     * 1. 通过 model 名自动识别 provider 和 taskType
     * 2. 通过用户配置确认
     * 3. 找到对应 handler 执行
     */
    execute: function (input) {
        return __awaiter(this, void 0, void 0, function () {
            var provider, model, taskType, userId, identified, v2, providerMap, enabledMap, pField, eField, v, enabled, _i, _a, cap_1, p, en, _b, cap, handlerName, handler, handlerInput, result;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        provider = input.provider, model = input.model, taskType = input.taskType, userId = input.userId;
                        // Step 1: 没指定 provider 但有 model → 自动识别
                        if (!provider && model) {
                            identified = this.identify(model);
                            if (identified) {
                                provider = identified.provider;
                                taskType = taskType || identified.taskType;
                                console.log("[ProviderMiddleware] \u81EA\u52A8\u8BC6\u522B: model=".concat(model, " \u2192 provider=").concat(provider, ", taskType=").concat(taskType));
                            }
                        }
                        if (!(!provider && userId)) return [3 /*break*/, 4];
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, (0, v2_js_1.loadFullConfigV2)(userId)];
                    case 2:
                        v2 = _c.sent();
                        if (v2) {
                            providerMap = { image: 'imageProvider', video: 'videoProvider', tts: 'ttsProvider' };
                            enabledMap = { image: 'imageEnabled', video: 'videoEnabled', tts: 'ttsEnabled' };
                            pField = providerMap[taskType || 'image'];
                            eField = enabledMap[taskType || 'image'];
                            if (pField && eField) {
                                v = v2[pField];
                                enabled = v2[eField];
                                if (v && enabled) {
                                    provider = v;
                                }
                            }
                            // 如果没匹配到 taskType 或没有 enabled，用第一个可用的
                            if (!provider) {
                                for (_i = 0, _a = ['image', 'video', 'tts']; _i < _a.length; _i++) {
                                    cap_1 = _a[_i];
                                    p = v2["".concat(cap_1, "Provider")];
                                    en = v2["".concat(cap_1, "Enabled")];
                                    if (p && en) {
                                        provider = p;
                                        break;
                                    }
                                }
                            }
                        }
                        return [3 /*break*/, 4];
                    case 3:
                        _b = _c.sent();
                        return [3 /*break*/, 4];
                    case 4:
                        // Step 3: 仍然没有 → fallback 到 aliyun/bailian
                        if (!provider) {
                            provider = 'aliyun';
                            taskType = taskType || 'llm';
                        }
                        taskType = taskType || 'llm';
                        // Step 4: 验证能力
                        if (!this.supports(provider, taskType)) {
                            throw new Error("Provider ".concat(provider, " \u4E0D\u652F\u6301 ").concat(taskType, " \u7C7B\u578B\u4EFB\u52A1"));
                        }
                        cap = this.getCapability(provider);
                        handlerName = (cap === null || cap === void 0 ? void 0 : cap.handlerName) || provider;
                        handler = this._handlers.get(handlerName);
                        if (!handler) {
                            // fallback: 看看 worker-runtime.ts 的 providerHandlers 是否已注册
                            // 由外部注入，这里留空
                            throw new Error("Provider ".concat(provider, " (").concat(handlerName, ") \u7684 handler \u672A\u6CE8\u518C"));
                        }
                        handlerInput = __assign(__assign({}, input), { model: model || input.model });
                        return [4 /*yield*/, handler(taskType, handlerInput)
                            // Runtime Event Ledger: 记录 provider 调用（非侵入，不阻塞主流程）
                        ];
                    case 5:
                        result = _c.sent();
                        // Runtime Event Ledger: 记录 provider 调用（非侵入，不阻塞主流程）
                        (0, runtime_event_ledger_js_1.writeLedger)({
                            userId: input.userId || 'unknown',
                            projectId: input.projectId,
                            traceId: input.traceId,
                            executionId: input.executionId,
                            stageId: input.stageId,
                            capability: (false || taskType === 'llm') ? 'llm'
                                : taskType === 'image' ? 'image'
                                    : taskType === 'video' ? 'video'
                                        : 'tts',
                            provider: provider || 'unknown',
                            model: model || input.model || 'unknown',
                            status: result.error ? 'failed' : 'success',
                            latencyMs: input._startTime ? Date.now() - input._startTime : null,
                            tokenUsage: result.totalTokens || null,
                            errorMsg: result.error || null,
                            sourcePath: 'provider-middleware',
                            agentType: input.agentType,
                            operationType: taskType === null || taskType === void 0 ? void 0 : taskType.toString(),
                        });
                        return [2 /*return*/, result];
                }
            });
        });
    },
};
exports.default = exports.providerMiddleware;
