"use strict";
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
exports.default = executionImageRoutes;
const index_js_1 = require("../utils/index.js");
const style_profile_service_js_1 = require("../services/style-profile.service.js");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const https_1 = require("https");
const http_1 = require("http");
async function downloadAndUpload(imageUrl, userId, subDir = 'images') {
    if (!imageUrl)
        return { cosUrl: '', localUrl: '' };
    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
    const path = await Promise.resolve().then(() => __importStar(require('path')));
    const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
    const uploadDir = (0, path_1.resolve)(process.cwd(), 'public/uploads', subDir);
    await (0, promises_1.mkdir)(uploadDir, { recursive: true });
    const ext = ((imageUrl.split('?')[0].match(/\.(\w+)$/) || [])[1] || 'png').toLowerCase();
    const filename = `img_${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const localPath = (0, path_1.resolve)(uploadDir, filename);
    // Download to local
    await new Promise((resolvePromise, reject) => {
        const protocol = imageUrl.startsWith('https') ? https_1.get : http_1.request;
        const req = protocol(imageUrl, (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                downloadAndUploadSingle(res.headers.location, localPath).then(resolvePromise).catch(reject);
                return;
            }
            if (!res.statusCode || res.statusCode >= 400) {
                reject(new Error(`下载失败: HTTP ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => {
                fs.writeFile(localPath, Buffer.concat(chunks)).then(resolvePromise).catch(reject);
            });
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(180000, () => { req.destroy(); reject(new Error('下载超时')); });
        req.end();
    });
    const localUrl = `/uploads/${subDir}/${filename}`;
    // Upload to COS
    let cosUrl = '';
    try {
        const { cosService } = await Promise.resolve().then(() => __importStar(require('../services/cos-service.js')));
        const result = await cosService.uploadFile(imageUrl, 'image', userId);
        cosUrl = result.cosUrl;
        console.log(`[Images] COS uploaded: ${cosUrl}`);
    }
    catch (e) {
        console.warn('[Images] COS 上传失败，使用本地 URL:', e.message);
        cosUrl = localUrl;
    }
    return { cosUrl, localUrl };
}
async function downloadAndUploadSingle(url, dest) {
    const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
    const protocol = url.startsWith('https') ? https_1.get : http_1.request;
    return new Promise((resolvePromise, reject) => {
        const req = protocol(url, (res) => {
            if (!res.statusCode || res.statusCode >= 400) {
                reject(new Error(`下载失败: HTTP ${res.statusCode}`));
                return;
            }
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => fs.writeFile(dest, Buffer.concat(chunks)).then(resolvePromise).catch(reject));
            res.on('error', reject);
        });
        req.on('error', reject);
        req.setTimeout(180000, () => { req.destroy(); reject(new Error('下载超时')); });
        req.end();
    });
}
async function executionImageRoutes(fastify) {
    // ─── 角色图片生成入口（前端新版角色设计页调用） ───
    // ─── 辅助函数：提交图片生成任务并轮询等待 ───
    async function submitImageTask(prompt, negativePrompt, pid, authHeader, characterName, baseUrl, fixedSeed, // 三视图多图间固定 seed 保持角色一致性
    referenceImage) {
        const taskInput = {
            prompt,
            negativePrompt,
            source: 'character_execution',
            characterName,
            name: characterName,
        };
        if (fixedSeed !== undefined)
            taskInput.seed = fixedSeed;
        if (referenceImage) {
            taskInput.referenceImage = referenceImage;
            taskInput.referenceImages = [referenceImage];
        }
        const genRes = await fetch(`${baseUrl}/api/tasks/ai-generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', authorization: authHeader },
            body: JSON.stringify({ projectId: pid, taskType: 'image', input: taskInput }),
        });
        if (!genRes.ok) {
            const errText = await genRes.text().catch(() => '');
            throw new Error(`图片生成任务提交失败: ${genRes.status} ${errText}`);
        }
        const genData = await genRes.json();
        const taskId = genData?.task?.id;
        if (!taskId)
            throw new Error('未获取到任务 ID');
        // 轮询等待（最多 60 秒，每 2 秒检查一次）
        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await fetch(`${baseUrl}/api/tasks/${taskId}/status`, {
                headers: { authorization: authHeader },
            });
            if (!statusRes.ok)
                continue;
            const statusData = await statusRes.json();
            const task = statusData?.task;
            if (!task)
                continue;
            if (task.status === 'completed') {
                const result = task.result || {};
                let url = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || '';
                if (url)
                    return url;
                try {
                    const err = JSON.parse(task.error || '{}');
                    url = err?.output?.imageUrl || err?.output?.url || '';
                }
                catch {
                    // task.error JSON 解析失败，非关键路径
                }
                return url;
            }
            if (task.status === 'failed') {
                console.warn('[Execution-Images] 子任务失败:', task.error);
                return '';
            }
        }
        return '';
    }
    /** 将图片 URL 转为可下载的完整 URL */
    function resolveImageUrl(url, baseUrl, authHeader) {
        if (!url)
            return '';
        if (url.startsWith('http://') || url.startsWith('https://'))
            return url;
        if (url.startsWith('/uploads/'))
            return `${baseUrl}${url}`;
        if (url.startsWith('/'))
            return `${baseUrl}${url}`;
        return url;
    }
    /** 简化版：submitImageTask 返回的已是完整 URL */
    function resolveUrl(url) {
        if (!url)
            return '';
        if (url.startsWith('http://') || url.startsWith('https://'))
            return url;
        if (url.startsWith('/')) {
            const baseUrl = `http://localhost:${process.env.PORT || 4002}`;
            return `${baseUrl}${url}`;
        }
        return url;
    }
    // ─── 角色图片生成入口（新版：支持三视图模式） ───
    fastify.post('/execution-images/characters', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const body = request.body;
        const { characterId, character, storyText } = body || {};
        if (!character || !character.name) {
            console.warn('[Execution-Images] 400: character.name 缺失', JSON.stringify({ hasCharacter: !!character, hasName: character?.name }));
            return reply.status(400).send({ error: 'character object with name required' });
        }
        const imagePrompt = character.imagePrompt || '';
        const negativePrompt = character.negativePrompt || '';
        // ⭐ 中文→英文翻译（词表映射，不调用外部 API，不删未映射的中文）
        // 陛下钦定：直接用中文 prompt 传给大模型
        const enPrompt = imagePrompt;
        const authHeader = request.headers.authorization || '';
        const userId = request.user?.id || 'anonymous';
        let pid = body.projectId;
        if (!pid) {
            const lastProject = await index_js_1.prisma.project.findFirst({
                where: { userId },
                orderBy: { updatedAt: 'desc' },
                select: { id: true },
            });
            if (lastProject) {
                pid = lastProject.id;
            }
            else {
                const newProject = await index_js_1.prisma.project.create({
                    data: { id: crypto.randomUUID(), name: character.name, userId },
                });
                pid = newProject.id;
            }
            console.log('[Execution-Images] projectId 自动兜底:', pid);
        }
        try {
            console.log('[Execution-Images] 🚀收到角色图请求: name=%s, tripleView=%s, prompt_preview=%s', character.name, body.tripleView, enPrompt.slice(0, 150).replace(/\n/g, '\\n'));
            console.log('[Execution-Images] 📝 翻译结果: %s', enPrompt.slice(0, 250).replace(/\n/g, '\\n'));
            // ⭐ 风格后缀从 StyleProfile 动态读取
            const vs = body.videoStyle || 'realistic';
            const profile = await style_profile_service_js_1.StyleProfileService.getByName(vs);
            const styleTokens = profile?.styleTokens || '写实真人，电影级画质';
            const negativeTokens = profile?.negativeTokens || '';
            const baseNegative = (negativePrompt + '\n' + negativeTokens + ', 多人, 人群, 两人以上, 多人群组, 肢体变形, 多出的手臂, 多出的腿, 多出的手指, 多格画面, 网格图, 拼贴图, 多视角, 对比图, 多图, 九宫格, 拼图, 对比图, 网格, 文字, 书写, 字母, 字词, 字符, 标签, 标题, 签名, 标志, 印章, 水印, 排版文字').trim();
            // ⭐ 强约束：自动确保纯白背景+完整全身，用户 prompt 若没写则自动追加
            let forcedPrompt = enPrompt;
            if (!forcedPrompt.includes('纯白') && !forcedPrompt.includes('纯白色') && !forcedPrompt.includes('白色背景')) {
                forcedPrompt += '，纯白色背景';
            }
            if (!forcedPrompt.includes('全身') && !forcedPrompt.includes('完整全身')) {
                forcedPrompt += '，完整全身正面立正站姿，面对镜头，双脚并拢，双臂自然垂于两侧';
            }
            if (!forcedPrompt.includes('从头到脚') && !forcedPrompt.includes('双脚')) {
                forcedPrompt += '，从头到脚完全可见';
            }
            const basePrompt = (forcedPrompt + '\n' + styleTokens).trim();
            const baseUrl = `http://localhost:${process.env.PORT || 4002}`;
            // ⭐ 四视图模式判断（原三视图升级版）
            const tripleView = body.tripleView === true || character.tripleView === true;
            let imageUrl = '';
            let viewUrls = [];
            // ⭐ 四视图各视角最终 URL（提升到外部作用域，供素材库保存使用）
            let resolvedPortrait = '', resolvedFront = '', resolvedSide = '', resolvedBack = '';
            if (tripleView) {
                // ── 四视图模式：从 DB PromptTemplate 读取各视角 prompt（前端表单覆盖优先）──
                console.log(`[Execution-Images] 进入四视图模式: name=${character.name}`);
                // ⭐ 前端表单传递的自定义视角 prompt（最高优先级）
                const frontendViewPrompts = character.fourViewPrompts;
                // ⭐ 从 DB 读取角色四视图各视角 prompt 模板（前端未提供时用）
                const viewTemplates = {
                    portrait: '面部特写，证件照风格，仅显示头部和肩部，头部占画面80%以上，面部完全居中，双眼清晰明亮看向镜头，整个面部细节清晰锐利（额头、眉毛、眼睛、鼻子、嘴唇、下巴轮廓），五官端正自然，柔和均匀正面打光无阴影，纯白色背景，表情自然微笑或中性表情，无身体无躯干无手臂无全身，无文字无标签',
                    front: '正面全身立正站姿，全身从头到脚完全可见，面对镜头，双脚并拢，双臂自然垂于两侧，纯白色背景，单人，柔和均匀光线，无文字无标签',
                    side: '右侧面全身立正站姿，全身从头到脚完全可见，身体旋转90度面对右侧，纯侧面，纯白色背景，单人，柔和均匀光线，无文字无标签',
                    back: '背面全身立正站姿，全身从头到脚完全可见，背对镜头，无面部，纯白色背景，单人，柔和均匀光线，无文字无标签',
                };
                try {
                    const dbTpl = await index_js_1.prisma.promptTemplate.findUnique({
                        where: { name: 'character-view-prompts' },
                    });
                    if (dbTpl?.content && typeof dbTpl.content === 'object') {
                        const dbViews = dbTpl.content;
                        if (dbViews.portrait)
                            viewTemplates.portrait = dbViews.portrait;
                        if (dbViews.front)
                            viewTemplates.front = dbViews.front;
                        if (dbViews.side)
                            viewTemplates.side = dbViews.side;
                        if (dbViews.back)
                            viewTemplates.back = dbViews.back;
                        console.log('[Execution-Images] 从 DB 读取四视图 prompt 模板成功');
                    }
                }
                catch (e) {
                    console.warn('[Execution-Images] 读取 DB prompt 模板失败，使用内置默认值:', e.message);
                }
                // ⭐ 前端表单自定义 prompt 覆盖 DB/默认值
                if (frontendViewPrompts) {
                    if (frontendViewPrompts.portrait)
                        viewTemplates.portrait = frontendViewPrompts.portrait;
                    if (frontendViewPrompts.front)
                        viewTemplates.front = frontendViewPrompts.front;
                    if (frontendViewPrompts.side)
                        viewTemplates.side = frontendViewPrompts.side;
                    if (frontendViewPrompts.back)
                        viewTemplates.back = frontendViewPrompts.back;
                    console.log('[Execution-Images] 前端表单自定义四视图 prompt 已覆盖 DB 默认值');
                }
                // ⭐ 用角色描述 + 视角模板组装 prompt
                let tripleCharDesc = (imagePrompt || character.description || character.name || '').trim();
                const charName = character.name || '';
                if (charName) {
                    tripleCharDesc = tripleCharDesc
                        .replace(new RegExp(`角色名[「『]${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[」』]`, 'g'), '')
                        .replace(new RegExp(`[「『]${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[」』]`, 'g'), '')
                        .replace(new RegExp(`\\b${charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), '')
                        .replace(/\s*角色名[:：]\s*/g, '')
                        .trim();
                }
                // ⭐ 组装四视图 prompt：角色描述 + 视角描述
                const portraitPromptStr = `${tripleCharDesc}，${viewTemplates.portrait}`;
                const frontPrompt = `${tripleCharDesc}，${viewTemplates.front}`;
                const sidePrompt = `${tripleCharDesc}，${viewTemplates.side}`;
                const backPrompt = `${tripleCharDesc}，${viewTemplates.back}`;
                console.log('[Execution-Images] 大头 prompt: %s', portraitPromptStr.slice(0, 150));
                console.log('[Execution-Images] 正脸 prompt: %s', frontPrompt.slice(0, 150));
                let portraitUrl = '', frontUrl = '', sideUrl = '', backUrl = '';
                try {
                    const seed = Math.floor(Math.random() * 2147483647);
                    console.log('[Execution-Images] 使用固定 seed: %d', seed);
                    // ⭐ 大头照：单独生成面部特写，固定 seed，不带参考图
                    portraitUrl = await submitImageTask(portraitPromptStr, baseNegative, pid, authHeader, character.name, baseUrl, seed);
                    console.log('[Execution-Images] 大头照: %s', portraitUrl ? '✅' : '❌');
                    // ⭐ 正脸：全身
                    frontUrl = await submitImageTask(frontPrompt, baseNegative, pid, authHeader, character.name, baseUrl, seed, portraitUrl);
                    console.log('[Execution-Images] 正脸: %s', frontUrl ? '✅' : '❌');
                    // ⭐ 侧脸：用正脸作参考图 + 固定 seed
                    sideUrl = await submitImageTask(sidePrompt, baseNegative, pid, authHeader, character.name, baseUrl, seed, frontUrl);
                    console.log('[Execution-Images] 侧脸: %s', sideUrl ? '✅' : '❌');
                    // ⭐ 背脸：用正脸作参考图 + 固定 seed
                    backUrl = await submitImageTask(backPrompt, baseNegative, pid, authHeader, character.name, baseUrl, seed, frontUrl);
                    console.log('[Execution-Images] 背脸: %s', backUrl ? '✅' : '❌');
                }
                catch (e) {
                    console.warn('[Execution-Images] 四视图生成异常:', e.message);
                }
                resolvedPortrait = resolveUrl(portraitUrl);
                resolvedFront = resolveUrl(frontUrl);
                resolvedSide = resolveUrl(sideUrl);
                resolvedBack = resolveUrl(backUrl);
                console.log(`[Execution-Images] 大头: ${resolvedPortrait ? '✅' : '❌'}, 正: ${resolvedFront ? '✅' : '❌'}, 侧: ${resolvedSide ? '✅' : '❌'}, 背: ${resolvedBack ? '✅' : '❌'}`);
                viewUrls = [resolvedPortrait, resolvedFront, resolvedSide, resolvedBack].filter(Boolean);
                if (viewUrls.length < 2) {
                    // 只生成了不到2张，回退到单张
                    console.warn('[Execution-Images] 四视图生成不足，回退到单张');
                    if (viewUrls.length === 1) {
                        imageUrl = viewUrls[0];
                    }
                    else {
                        const fallbackUrl = await submitImageTask(basePrompt, baseNegative, pid, authHeader, character.name, baseUrl);
                        imageUrl = resolveUrl(fallbackUrl);
                    }
                }
                else {
                    // ⭐ 至少有 2 张以上 → 合并为四视定妆图（2×2网格：大头+正/侧/背）
                    let faceCropUrl = '';
                    try {
                        const { generateFourViewCharacterSheet } = await Promise.resolve().then(() => __importStar(require('../services/four-view-merger.js')));
                        const result = await generateFourViewCharacterSheet({
                            portraitImageUrl: resolvedPortrait || resolvedFront,
                            frontImageUrl: resolvedFront,
                            sideImageUrl: resolvedSide,
                            backImageUrl: resolvedBack,
                            characterName: character.name,
                        });
                        imageUrl = result.mergedImageUrl;
                        faceCropUrl = result.faceCropUrl || '';
                        console.log(`[Execution-Images] 四视定妆图合并完成: ${imageUrl} (${result.width}x${result.height})`);
                        if (faceCropUrl) {
                            console.log(`[Execution-Images] 正脸参考图已裁剪: ${faceCropUrl}`);
                        }
                        if (faceCropUrl) {
                            try {
                                await index_js_1.prisma.characterImage.upsert({
                                    where: {
                                        projectId_characterName_variant: {
                                            projectId: pid,
                                            characterName: character.name,
                                            variant: 'face_ref',
                                        },
                                    },
                                    update: { imageUrl: faceCropUrl, sortOrder: 1 },
                                    create: { projectId: pid, imageUrl: faceCropUrl, characterName: character.name, variant: 'face_ref', sortOrder: 1 },
                                });
                            }
                            catch (e2) {
                                console.warn(`[Execution-Images] 保存 face_ref 失败: ${e2.message}`);
                            }
                        }
                    }
                    catch (e) {
                        console.warn('[Execution-Images] 四视定妆图合并失败，使用第一张:', e.message);
                        imageUrl = viewUrls[0];
                    }
                }
            }
            else {
                // ── 单视图模式（原有逻辑） ──
                const genRes = await fetch(`${baseUrl}/api/tasks/ai-generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', authorization: authHeader },
                    body: JSON.stringify({
                        projectId: pid,
                        taskType: 'image',
                        input: {
                            prompt: basePrompt,
                            negativePrompt: baseNegative,
                            source: 'character_execution',
                            characterName: character.name,
                            name: character.name,
                            ...(body.referenceImage ? { imageUrl: body.referenceImage, mode: body.mode || 'img2img' } : {}),
                        },
                    }),
                });
                if (!genRes.ok)
                    throw new Error(`图片生成任务提交失败: ${genRes.status}`);
                const genData = await genRes.json();
                const taskId = genData?.task?.id;
                if (!taskId)
                    throw new Error('未获取到任务 ID');
                for (let i = 0; i < 30; i++) {
                    await new Promise(r => setTimeout(r, 2000));
                    const statusRes = await fetch(`${baseUrl}/api/tasks/${taskId}/status`, {
                        headers: { authorization: authHeader },
                    });
                    if (!statusRes.ok)
                        continue;
                    const statusData = await statusRes.json();
                    const task = statusData?.task;
                    if (!task)
                        continue;
                    if (task.status === 'completed') {
                        const result = task.result || {};
                        imageUrl = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || '';
                        if (imageUrl)
                            break;
                        try {
                            const err = JSON.parse(task.error || '{}');
                            imageUrl = err?.output?.imageUrl || err?.output?.url || '';
                        }
                        catch {
                            // task.error 解析失败，保持空 imageUrl
                        }
                        break;
                    }
                    if (task.status === 'failed') {
                        console.warn('[Execution-Images] 任务失败:', task.error);
                        break;
                    }
                }
                if (!imageUrl)
                    throw new Error('图片生成超时或失败');
            }
            // ⭐ 持久化：下载到本地
            if (imageUrl) {
                const originalUrl = imageUrl;
                try {
                    const result = await downloadAndUpload(imageUrl, userId, 'characters');
                    imageUrl = result.cosUrl?.startsWith('/uploads') ? originalUrl : (result.cosUrl || originalUrl);
                    console.log(`[Execution-Images] 角色图持久化完成: ${imageUrl}`);
                }
                catch (e) {
                    console.warn('[Execution-Images] 图片持久化失败，使用原 URL:', e.message);
                    imageUrl = originalUrl;
                }
                // 存储到角色图片表
                const existing = await index_js_1.prisma.project.findUnique({ where: { id: pid } });
                if (!existing) {
                    await index_js_1.prisma.project.create({
                        data: { id: pid, name: character.name, userId: request.user.id },
                    }).catch(() => { });
                }
                // 主角色图：三视定妆图（或单张图）
                const saved = await index_js_1.prisma.characterImage.upsert({
                    where: {
                        projectId_characterName_variant: {
                            projectId: pid,
                            characterName: character.name,
                            variant: 'makeup',
                        },
                    },
                    update: { imageUrl, sortOrder: 0 },
                    create: { projectId: pid, imageUrl, characterName: character.name, variant: 'makeup', sortOrder: 0 },
                }).catch(() => { console.warn('[Execution-Images] 存储失败'); return null; });
                // ⭐ 保存到素材库（UserAsset 表）+ COS 持久化 —— 确保角色图不丢失
                try {
                    const uid = request.user?.id || userId;
                    // ⭐ 确保 Membership 存在（外键约束 UserAsset.userId → Membership.userId）
                    const mem = await index_js_1.prisma.membership.findUnique({ where: { userId: uid } });
                    if (!mem) {
                        await index_js_1.prisma.membership.create({
                            data: { userId: uid, tier: 'free', credits: 0, creditsUsed: 0, storageUsed: 0, storageLimit: 104857600 },
                        }).catch(() => { });
                    }
                    // ── 1. 合并图（四视图/单张）存素材库 ──
                    await index_js_1.prisma.userAsset.upsert({
                        where: { id: `char_merged_${character.name}_${pid}` },
                        update: { url: imageUrl, thumbnail: imageUrl, prompt: imagePrompt || '' },
                        create: {
                            id: `char_merged_${character.name}_${pid}`,
                            userId: uid,
                            title: `${character.name} 定妆图`,
                            type: 'character',
                            url: imageUrl,
                            thumbnail: imageUrl,
                            prompt: imagePrompt || '',
                            source: 'character_generation',
                            fileSize: 0,
                        },
                    }).catch((e) => console.warn('[Execution-Images] 素材库保存合并图失败:', e.message));
                    // ── 2. 四视图模式下：正面全身图单独存素材库 + characterImage（variant: full_front） ──
                    if (tripleView && resolvedFront) {
                        // 正面全身图单独 COS 上传
                        let frontImgUrl = resolvedFront;
                        try {
                            const frontResult = await downloadAndUpload(resolvedFront, userId, 'characters');
                            frontImgUrl = frontResult.cosUrl?.startsWith('/uploads') ? resolvedFront : (frontResult.cosUrl || resolvedFront);
                            console.log(`[Execution-Images] 正面全身图 COS 持久化: ${frontImgUrl}`);
                        }
                        catch (e) {
                            console.warn('[Execution-Images] 正面全身图持久化失败，使用原 URL:', e.message);
                        }
                        // 存素材库
                        await index_js_1.prisma.userAsset.upsert({
                            where: { id: `char_front_${character.name}_${pid}` },
                            update: { url: frontImgUrl, thumbnail: frontImgUrl, prompt: `全身正面立正站姿，${imagePrompt || character.name}` },
                            create: {
                                id: `char_front_${character.name}_${pid}`,
                                userId: uid,
                                title: `${character.name} 全身正面图（素材主图）`,
                                type: 'character',
                                url: frontImgUrl,
                                thumbnail: frontImgUrl,
                                prompt: `全身正面立正站姿，${imagePrompt || character.name}`,
                                source: 'character_generation',
                                fileSize: 0,
                            },
                        }).catch((e) => console.warn('[Execution-Images] 素材库保存正面图失败:', e.message));
                        // 也存 characterImage variant
                        await index_js_1.prisma.characterImage.upsert({
                            where: {
                                projectId_characterName_variant: {
                                    projectId: pid,
                                    characterName: character.name,
                                    variant: 'full_front',
                                },
                            },
                            update: { imageUrl: frontImgUrl, sortOrder: 2 },
                            create: { projectId: pid, imageUrl: frontImgUrl, characterName: character.name, variant: 'full_front', sortOrder: 2 },
                        }).catch((e) => console.warn('[Execution-Images] 存正面全身图 charImage 失败:', e.message));
                    }
                    // ── 3. 大头照也存素材库（四视图模式） ──
                    if (tripleView && resolvedPortrait) {
                        await index_js_1.prisma.userAsset.upsert({
                            where: { id: `char_portrait_${character.name}_${pid}` },
                            update: { url: resolvedPortrait, thumbnail: resolvedPortrait },
                            create: {
                                id: `char_portrait_${character.name}_${pid}`,
                                userId: uid,
                                title: `${character.name} 大头特写（面部参考）`,
                                type: 'character',
                                url: resolvedPortrait,
                                thumbnail: resolvedPortrait,
                                prompt: imagePrompt || character.name,
                                source: 'character_generation',
                                fileSize: 0,
                            },
                        }).catch((e) => console.warn('[Execution-Images] 素材库保存大头照失败:', e.message));
                    }
                    console.log(`[Execution-Images] ✅ 素材库保存完成: ${character.name}`);
                }
                catch (e) {
                    console.warn('[Execution-Images] 素材库保存失败（不影响主流程）:', e.message);
                }
                return reply.send({
                    success: true,
                    imageUrl,
                    url: imageUrl,
                    id: saved?.id || '',
                    tripleView: tripleView ? true : undefined,
                    viewUrls: tripleView ? viewUrls : undefined,
                    faceCropUrl: (tripleView && typeof faceCropUrl !== 'undefined') ? faceCropUrl : undefined,
                });
            }
            return reply.status(500).send({ error: '图片生成失败' });
        }
        catch (err) {
            console.warn('[Execution-Images] POST 角色图失败:', err.message);
            return reply.status(500).send({ error: err.message || '角色图片生成失败' });
        }
    });
    // ─── 角色图片 ───
    fastify.put('/execution-images/characters', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId, images } = request.body;
        if (!projectId || !images)
            return reply.status(400).send({ error: 'projectId and images required' });
        // 确保 project 存在（前端可能自动生成了 UUID 但还没写入 DB）
        const existing = await index_js_1.prisma.project.findUnique({ where: { id: projectId } });
        if (!existing) {
            await index_js_1.prisma.project.create({
                data: { id: projectId, name: '临时项目', userId: request.user.id },
            });
        }
        // 逐张 upsert，不整体删除（修复：刷新后只剩最后一张图的问题）
        await index_js_1.prisma.$transaction((images || []).map((img, i) => {
            const charName = img.characterName || (img.characterName === undefined && img.variant ? '' : `char_${i}`);
            return index_js_1.prisma.characterImage.upsert({
                where: {
                    projectId_characterName_variant: {
                        projectId,
                        characterName: charName,
                        variant: img.variant || '',
                    },
                },
                update: { imageUrl: img.url, sortOrder: i },
                create: { projectId, imageUrl: img.url, characterName: charName, variant: img.variant || '', sortOrder: i },
            });
        }));
        return { success: true };
    });
    // ⭐ 翻译 API：前端中文 prompt 调 DeepSeek 翻译为英文
    fastify.get('/execution-images/characters/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId } = request.params;
        // 非 UUID 格式的 projectId 返回空（如前端临时 ID）
        if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
            return { success: true, data: [] };
        }
        const images = await index_js_1.prisma.characterImage.findMany({
            where: { projectId },
            orderBy: { sortOrder: 'asc' }
        });
        return { success: true, data: images };
    });
    // ─── 场景图片生成入口 ───
    fastify.post('/execution-images/scenes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const body = request.body;
        console.log('[Scene] POST body:', JSON.stringify(body).slice(0, 500));
        const { sceneId, scene, projectId: pid } = body || {};
        if (!scene || !scene.name) {
            return reply.status(400).send({ error: 'scene object with name required' });
        }
        const imagePrompt = scene.imagePrompt || scene.description || '';
        const negativePrompt = scene.negativePrompt || '';
        const authHeader = request.headers.authorization || '';
        const projId = pid;
        if (!projId)
            return reply.status(400).send({ error: 'projectId required' });
        // ⭐ 场景风格约束从 StyleProfile 动态读取（禁止硬编码）
        const vsScene = body.videoStyle || 'realistic';
        const sceneProfile = await style_profile_service_js_1.StyleProfileService.getByName(vsScene);
        const sceneTokens = sceneProfile?.styleTokens || '空场景，无人物';
        try {
            const engineScenePrompt = (imagePrompt + '\n' + sceneTokens).trim();
            const taskInput = {
                prompt: engineScenePrompt,
                negativePrompt,
                source: 'scene_execution',
                sceneName: scene.name,
                name: scene.name,
                // ⭐ 传递画面比例
                aspectRatio: body.aspectRatio || '16:9',
            };
            // 传递图生图参数
            const body2 = body;
            if (body2.referenceImage) {
                taskInput.imageUrl = body2.referenceImage;
                taskInput.mode = body2.mode || 'img2img';
            }
            const genRes = await fetch(`http://localhost:${process.env.PORT || 4002}/api/tasks/ai-generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', authorization: authHeader },
                body: JSON.stringify({
                    projectId: projId,
                    taskType: 'image',
                    input: taskInput,
                }),
            });
            if (!genRes.ok) {
                const errText = await genRes.text().catch(() => '');
                throw new Error(`图片生成任务提交失败: ${genRes.status} ${errText}`);
            }
            const genData = await genRes.json();
            const taskId = genData?.task?.id;
            if (!taskId)
                throw new Error('未获取到任务 ID');
            // 轮询等待任务完成
            let imageUrl = '';
            const baseUrl = `http://localhost:${process.env.PORT || 4002}`;
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 2000));
                const statusRes = await fetch(`${baseUrl}/api/tasks/${taskId}/status`, {
                    headers: { authorization: authHeader },
                });
                if (!statusRes.ok)
                    continue;
                const statusData = await statusRes.json();
                const task = statusData?.task;
                if (!task)
                    continue;
                if (task.status === 'completed') {
                    const result = task.result || {};
                    imageUrl = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || '';
                    try {
                        const err = JSON.parse(task.error || '{}');
                        imageUrl = imageUrl || err?.output?.imageUrl || err?.output?.url || '';
                    }
                    catch {
                        // task.error JSON 解析失败，imageUrl 保持当前值
                    }
                    break;
                }
                if (task.status === 'failed') {
                    console.warn('[Execution-Images] 场景图任务失败:', task.error);
                    break;
                }
            }
            if (!imageUrl) {
                throw new Error('图片生成超时或失败，请检查模型配置和 API Key');
            }
            // ⭐ 下载到本地 + 上传到 COS（强制保存，不阻塞生成流程）
            const userId = request.user?.id || 'anonymous';
            const originalUrl = imageUrl;
            try {
                const result = await downloadAndUpload(imageUrl, userId, 'scenes');
                imageUrl = result.cosUrl.startsWith('/uploads') ? originalUrl : result.cosUrl;
                console.log(`[Execution-Images] 场景图持久化完成: ${imageUrl}`);
            }
            catch (e) {
                console.warn('[Execution-Images] 场景图持久化失败，使用原 URL:', e.message);
                imageUrl = originalUrl;
            }
            // 存储到场景图片表
            const existing = await index_js_1.prisma.project.findUnique({ where: { id: projId } });
            if (!existing) {
                await index_js_1.prisma.project.create({
                    data: { id: projId, name: scene.name, userId: request.user.id },
                }).catch(() => { });
            }
            await index_js_1.prisma.sceneImage.upsert({
                where: {
                    projectId_sceneName: {
                        projectId: projId,
                        sceneName: scene.name.trim() || `scene_${Date.now()}`,
                    },
                },
                update: { imageUrl, sortOrder: 0 },
                create: { projectId: projId, imageUrl, sceneName: scene.name.trim() || `scene_${Date.now()}`, sortOrder: 0 },
            }).catch(() => { console.warn('[Execution-Images] 场景图存储失败'); });
            return reply.send({ success: true, imageUrl, url: imageUrl });
        }
        catch (err) {
            console.warn('[Execution-Images] POST 场景图失败:', err.message);
            return reply.status(500).send({ error: err.message || '场景图片生成失败' });
        }
    });
    // ─── 场景图片 ───
    fastify.put('/execution-images/scenes', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId, images } = request.body;
        if (!projectId || !images)
            return reply.status(400).send({ error: 'projectId and images required' });
        // 确保 project 存在
        const existing = await index_js_1.prisma.project.findUnique({ where: { id: projectId } });
        if (!existing) {
            await index_js_1.prisma.project.create({
                data: { id: projectId, name: '临时项目', userId: request.user.id },
            });
        }
        // 逐张 upsert，不整体删除（修复：刷新后只剩最后一张图的问题）
        await index_js_1.prisma.$transaction(images.map((img, i) => {
            const sceneName = img.sceneName ? (img.sceneName.trim() || `scene_${i}`) : `scene_${i}`;
            return index_js_1.prisma.sceneImage.upsert({
                where: {
                    projectId_sceneName: {
                        projectId,
                        sceneName,
                    },
                },
                update: { imageUrl: img.url, sortOrder: i },
                create: { projectId, imageUrl: img.url, sceneName, sortOrder: i },
            });
        }));
        return { success: true };
    });
    fastify.get('/execution-images/scenes/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId } = request.params;
        if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
            return { success: true, data: [] };
        }
        const images = await index_js_1.prisma.sceneImage.findMany({
            where: { projectId },
            orderBy: { sortOrder: 'asc' }
        });
        return { success: true, data: images };
    });
    // ─── 分镜图片 ───
    fastify.put('/execution-images/storyboards', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId, images } = request.body;
        if (!projectId || !images)
            return reply.status(400).send({ error: 'projectId and images required' });
        // 逐张 upsert，不整体删除（修复：刷新后只剩最后一张图的问题）
        await index_js_1.prisma.$transaction(images.map((img, i) => {
            const segId = img.segmentId ? String(img.segmentId) : (img.segmentName ? String(img.segmentName) : `seg_${i}`);
            return index_js_1.prisma.storyboardImage.upsert({
                where: {
                    projectId_segmentId: {
                        projectId,
                        segmentId: segId,
                    },
                },
                update: { imageUrl: img.url, sortOrder: i },
                create: { projectId, imageUrl: img.url, segmentId: segId, sortOrder: i },
            });
        }));
        return { success: true };
    });
    fastify.get('/execution-images/storyboards/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId } = request.params;
        if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
            return { success: true, data: [] };
        }
        const images = await index_js_1.prisma.storyboardImage.findMany({
            where: { projectId },
            orderBy: { sortOrder: 'asc' }
        });
        return { success: true, data: images };
    });
    // GET /execution-images/storyboards/all — 返回所有有故事板图片的项目（给前端兜底用）
    fastify.get('/execution-images/storyboards/all', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const userId = request.user?.id;
        const images = await index_js_1.prisma.storyboardImage.findMany({
            where: userId ? { project: { userId } } : {},
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
        return { success: true, data: images };
    });
    // ─── 全量素材图（含道具图）─ 一次性返回所有素材 ───
    fastify.get('/execution-images/all/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId } = request.params;
        if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
            return { success: true, data: [] };
        }
        const [characters, scenes, storyboards, frames, props] = await Promise.all([
            index_js_1.prisma.characterImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
            index_js_1.prisma.sceneImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
            index_js_1.prisma.storyboardImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
            index_js_1.prisma.frameImage.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } }),
            index_js_1.prisma.propImage.findMany({ where: { projectId }, orderBy: { sortOrder: 'asc' } }),
        ]);
        return {
            success: true,
            data: { characters, scenes, storyboards, frames, props }
        };
    });
    // ─── 道具图片获取 ⭐ ───
    fastify.get('/execution-images/prop-images/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        try {
            const { projectId } = request.params;
            if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
                return { success: true, data: [] };
            }
            const images = await index_js_1.prisma.propImage.findMany({
                where: { projectId },
                orderBy: { sortOrder: 'asc' }
            });
            return { success: true, data: images };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    });
    // ─── 视频帧图片 ───
    fastify.put('/execution-images/frames', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId, images } = request.body;
        if (!projectId || !images)
            return reply.status(400).send({ error: 'projectId and images required' });
        await index_js_1.prisma.$transaction([
            index_js_1.prisma.frameImage.deleteMany({ where: { projectId } }),
            ...images.map((img, i) => index_js_1.prisma.frameImage.create({
                data: { projectId, imageUrl: img.url, segmentId: String(img.segmentId || `seg_${i}`), frameType: img.frameType || 'first' },
            })),
        ]);
        return { success: true };
    });
    fastify.get('/execution-images/frames/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId } = request.params;
        if (!projectId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
            return { success: true, data: [] };
        }
        const images = await index_js_1.prisma.frameImage.findMany({
            where: { projectId },
            orderBy: { createdAt: 'asc' }
        });
        return { success: true, data: images };
    });
    // GET /execution-images/videos/:projectId — 获取已生成的各分镜视频 URL
    fastify.get('/execution-images/videos/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId } = request.params;
        const segments = await index_js_1.prisma.aiVideoSegment.findMany({
            where: { projectId, videoUrl: { not: null } },
            select: { segmentId: true, videoUrl: true, duration: true },
        });
        return { success: true, data: segments };
    });
    // ⭐ POST /execution-images/migrate/:projectId — 从 executionResults / pipelineStage 迁移图片到独立表
    fastify.post('/execution-images/migrate/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId } = request.params;
        const project = await index_js_1.prisma.project.findUnique({
            where: { id: projectId },
            select: { executionResults: true },
        });
        if (!project)
            return reply.status(404).send({ error: '项目不存在' });
        const er = project.executionResults || {};
        const report = { characters: 0, scenes: 0, storyboards: 0, videos: 0, fromPipeline: false };
        // 0️⃣ 优先从 pipelineStage 表提取（最新的场景/角色数据在那里）
        const pipelineStages = await index_js_1.prisma.pipelineStage.findMany({
            where: { projectId, status: 'done' },
        });
        for (const ps of pipelineStages) {
            if (!ps.outputData)
                continue;
            let od;
            try {
                od = typeof ps.outputData === 'string' ? JSON.parse(ps.outputData) : ps.outputData;
            }
            catch {
                od = {};
            }
            if (ps.stageKey === 'scene' && od.scenes) {
                const sceneImages = od.scenes
                    .filter((s) => s.imageResult?.url)
                    .map((s, i) => ({
                    projectId, imageUrl: s.imageResult.url, sceneName: s.sceneName || `scene_${i}`, sortOrder: i,
                }));
                if (sceneImages.length > 0) {
                    await index_js_1.prisma.$transaction([
                        index_js_1.prisma.sceneImage.deleteMany({ where: { projectId } }),
                        ...sceneImages.map((d) => index_js_1.prisma.sceneImage.create({ data: d })),
                    ]);
                    report.scenes = sceneImages.length;
                    report.fromPipeline = true;
                }
            }
            if (ps.stageKey === 'character' && od.characters) {
                const charImages = od.characters
                    .filter((c) => c.imageUrl)
                    .map((c, i) => ({
                    projectId, imageUrl: c.imageUrl, characterName: c.name || c.characterName || `char_${i}`, sortOrder: i,
                }));
                if (charImages.length > 0) {
                    await index_js_1.prisma.$transaction([
                        index_js_1.prisma.characterImage.deleteMany({ where: { projectId } }),
                        ...charImages.map((d) => index_js_1.prisma.characterImage.create({ data: d })),
                    ]);
                    report.characters = charImages.length;
                    report.fromPipeline = true;
                }
            }
            if (ps.stageKey === 'storyboard' && od.storyboards) {
                const sbImages = od.storyboards
                    .filter((s) => s.imageResult?.url)
                    .map((s, i) => ({
                    projectId, imageUrl: s.imageResult.url, segmentId: String(s.segmentId || `seg_${i}`), sortOrder: i,
                }));
                if (sbImages.length > 0) {
                    await index_js_1.prisma.$transaction([
                        index_js_1.prisma.storyboardImage.deleteMany({ where: { projectId } }),
                        ...sbImages.map((d) => index_js_1.prisma.storyboardImage.create({ data: d })),
                    ]);
                    report.storyboards = sbImages.length;
                    report.fromPipeline = true;
                }
            }
        }
        // 1. 迁移角色图片 — characterSpecs[].imageUrl
        const charSpecs = er.characterSpecs || [];
        const charImages = charSpecs
            .filter((c) => c.imageUrl)
            .map((c, i) => ({
            projectId, imageUrl: c.imageUrl, characterName: c.characterName || `char_${i}`,
            variant: c.variant || '',
            sortOrder: i,
        }));
        if (charImages.length > 0) {
            await index_js_1.prisma.$transaction([
                index_js_1.prisma.characterImage.deleteMany({ where: { projectId } }),
                ...charImages.map((d) => index_js_1.prisma.characterImage.create({ data: d })),
            ]);
            report.characters = charImages.length;
        }
        // 2. 迁移场景图片 — sceneSpecs[].imageUrl
        const sceneSpecs = er.sceneSpecs || [];
        const sceneImages = sceneSpecs
            .filter((s) => s.imageUrl)
            .map((s, i) => ({
            projectId, imageUrl: s.imageUrl, sceneName: s.sceneName || `scene_${i}`, sortOrder: i,
        }));
        if (sceneImages.length > 0) {
            await index_js_1.prisma.$transaction([
                index_js_1.prisma.sceneImage.deleteMany({ where: { projectId } }),
                ...sceneImages.map((d) => index_js_1.prisma.sceneImage.create({ data: d })),
            ]);
            report.scenes = sceneImages.length;
        }
        // 3. 迁移分镜图片 — frameDesign[].imageUrl / lastFrameImageUrl
        const fd = er.frameDesign || [];
        const sbImages = [];
        fd.forEach((f, i) => {
            if (f.imageUrl)
                sbImages.push({ projectId, segmentId: String(f.segmentId || `seg_${i}`), imageUrl: f.imageUrl, sortOrder: i * 2 });
            if (f.lastFrameImageUrl)
                sbImages.push({ projectId, segmentId: String(f.segmentId || `seg_${i}`), imageUrl: f.lastFrameImageUrl, sortOrder: i * 2 + 1 });
        });
        if (sbImages.length > 0) {
            await index_js_1.prisma.$transaction([
                index_js_1.prisma.storyboardImage.deleteMany({ where: { projectId } }),
                ...sbImages.map((d) => index_js_1.prisma.storyboardImage.create({ data: d })),
            ]);
            report.storyboards = sbImages.length;
        }
        // 4. 迁移视频 URL — videoSegments[].videoUrl（批量 upsert 替代逐条 updateMany）
        const videoSegs = er.videoSegments || [];
        let videoCount = 0;
        const videoUpdates = videoSegs
            .filter((seg) => seg.videoUrl)
            .map((seg) => ({
            where: { projectId, segmentId: String(seg.segmentId || '') },
            data: { videoUrl: seg.videoUrl },
        }));
        if (videoUpdates.length > 0) {
            await Promise.all(videoUpdates.map((u) => index_js_1.prisma.aiVideoSegment.updateMany({ where: u.where, data: u.data })));
            videoCount = videoUpdates.length;
        }
        report.videos = videoCount;
        return { success: true, message: '迁移完成', report };
    });
    // ─── POST /execution-images/refresh/:projectId — 下载过期的阿里云 OSS 图片到本地并更新 URL
    // 阿里云 dashscope 生成的图片 URL 带临时签名，24h 后过期
    fastify.post('/execution-images/refresh/:projectId', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { projectId } = request.params;
        const fs = await Promise.resolve().then(() => __importStar(require('fs/promises')));
        const path = await Promise.resolve().then(() => __importStar(require('path')));
        const https = await Promise.resolve().then(() => __importStar(require('https')));
        const http = await Promise.resolve().then(() => __importStar(require('http')));
        const uploadDir = path.resolve(process.cwd(), 'public/uploads');
        await fs.mkdir(uploadDir, { recursive: true });
        const report = { downloaded: 0, failed: 0 };
        const urlMap = new Map();
        async function downloadUrl(url) {
            if (urlMap.has(url))
                return urlMap.get(url);
            if (!url.startsWith('http'))
                return url;
            const ext = path.extname(url.split('?')[0]) || '.png';
            const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 8)}${ext}`;
            const filepath = path.join(uploadDir, filename);
            try {
                const body = await new Promise((resolve, reject) => {
                    const client = url.startsWith('https') ? https : http;
                    client.get(url, { timeout: 15000 }, (res) => {
                        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                            client.get(res.headers.location, { timeout: 15000 }, (res2) => {
                                const chunks = [];
                                res2.on('data', (c) => chunks.push(c));
                                res2.on('end', () => resolve(Buffer.concat(chunks)));
                                res2.on('error', reject);
                            }).on('error', reject);
                        }
                        else {
                            const chunks = [];
                            res.on('data', (c) => chunks.push(c));
                            res.on('end', () => resolve(Buffer.concat(chunks)));
                            res.on('error', reject);
                        }
                    }).on('error', reject);
                });
                await fs.writeFile(filepath, body);
                const localUrl = `/uploads/${filename}`;
                urlMap.set(url, localUrl);
                return localUrl;
            }
            catch (e) {
                console.warn(`[refresh-images] 下载失败: ${url.slice(0, 60)}...`, e.message);
                urlMap.set(url, url);
                return url;
            }
        }
        // 1. 从 pipelineStage 表下载
        const pipelineStages = await index_js_1.prisma.pipelineStage.findMany({
            where: { projectId, status: 'done' },
        });
        for (const ps of pipelineStages) {
            if (!ps.outputData)
                continue;
            let od;
            try {
                od = typeof ps.outputData === 'string' ? JSON.parse(ps.outputData) : ps.outputData;
            }
            catch {
                od = {};
            }
            if (ps.stageKey === 'scene' && od.scenes) {
                for (const scene of od.scenes) {
                    if (scene.imageResult?.url) {
                        const localUrl = await downloadUrl(scene.imageResult.url);
                        if (localUrl !== scene.imageResult.url) {
                            scene.imageResult.url = localUrl;
                            report.downloaded++;
                        }
                    }
                }
            }
            if (ps.stageKey === 'character' && od.characters) {
                for (const ch of od.characters) {
                    if (ch.imageUrl) {
                        const localUrl = await downloadUrl(ch.imageUrl);
                        if (localUrl !== ch.imageUrl) {
                            ch.imageUrl = localUrl;
                            report.downloaded++;
                        }
                    }
                }
            }
            if (ps.stageKey === 'storyboard' && od.storyboards) {
                for (const sb of od.storyboards) {
                    if (sb.imageResult?.url) {
                        const localUrl = await downloadUrl(sb.imageResult.url);
                        if (localUrl !== sb.imageResult.url) {
                            sb.imageResult.url = localUrl;
                            report.downloaded++;
                        }
                    }
                }
            }
            await index_js_1.prisma.pipelineStage.update({
                where: { id: ps.id },
                data: { outputData: od },
            });
        }
        // 2. 走一遍 migrate，提取 URL 到独立表 — 直接调用 migrate 逻辑
        // （不使用 fetch，避免端口冲突）
        try {
            const project = await index_js_1.prisma.project.findUnique({ where: { id: projectId }, select: { executionResults: true } });
            if (project?.executionResults) {
                const er = project.executionResults || {};
                // 迁移角色图片
                const charSpecs = er.characterSpecs || [];
                const ci = charSpecs.filter((c) => c.imageUrl).map((c, i) => ({
                    projectId, imageUrl: c.imageUrl, characterName: c.characterName || `char_${i}`, sortOrder: i,
                }));
                if (ci.length > 0) {
                    await index_js_1.prisma.$transaction([
                        index_js_1.prisma.characterImage.deleteMany({ where: { projectId } }),
                        ...ci.map((d) => index_js_1.prisma.characterImage.create({ data: d })),
                    ]);
                    report.characters = (report.characters || 0) + ci.length;
                }
                // 迁移场景图片
                const sceneSpecs = er.sceneSpecs || [];
                const si = sceneSpecs.filter((s) => s.imageUrl).map((s, i) => ({
                    projectId, imageUrl: s.imageUrl, sceneName: s.sceneName || `scene_${i}`, sortOrder: i,
                }));
                if (si.length > 0) {
                    await index_js_1.prisma.$transaction([
                        index_js_1.prisma.sceneImage.deleteMany({ where: { projectId } }),
                        ...si.map((d) => index_js_1.prisma.sceneImage.create({ data: d })),
                    ]);
                    report.scenes = (report.scenes || 0) + si.length;
                }
            }
        }
        catch (e) {
            console.warn('[refresh-images] migrate failed:', e.message);
        }
        return { success: true, message: `下载 ${report.downloaded} 张图片完成`, report };
    });
    // GET /execution-images/proxy — 图片代理（解决 OSS 防盗链问题）
    fastify.get('/execution-images/proxy', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { url } = request.query;
        if (!url)
            return reply.status(400).send({ error: '缺少 url 参数' });
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; shipin-cinematic-studio/1.0)',
                    'Referer': '',
                },
            });
            if (!response.ok) {
                // OSS 签名过期/防盗链 → redirect 到原 URL（让浏览器尝试）
                console.warn(`[Proxy] 上游返回 ${response.status}，fallback 到重定向: ${url.substring(0, 80)}`);
                return reply.redirect(url, 302);
            }
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const buffer = await response.arrayBuffer();
            return reply
                .header('Content-Type', contentType)
                .header('Cache-Control', 'public, max-age=86400')
                .header('Access-Control-Allow-Origin', '*')
                .send(Buffer.from(buffer));
        }
        catch (err) {
            console.warn(`[Proxy] 代理请求异常，fallback 到重定向: ${err.message}`);
            return reply.redirect(url, 302);
        }
    });
    // ─── 删除角色图片（素材库用） ───
    fastify.delete('/execution-images/characters/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        if (!id)
            return reply.status(400).send({ error: 'id required' });
        try {
            await index_js_1.prisma.characterImage.delete({ where: { id } });
            return { success: true };
        }
        catch (e) {
            console.warn('[delete characterImage]', e.message);
            return reply.status(404).send({ error: 'not found' });
        }
    });
    // ─── 删除场景图片（素材库用） ───
    fastify.delete('/execution-images/scenes/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const { id } = request.params;
        if (!id)
            return reply.status(400).send({ error: 'id required' });
        try {
            await index_js_1.prisma.sceneImage.delete({ where: { id } });
            return { success: true };
        }
        catch (e) {
            console.warn('[delete sceneImage]', e.message);
            return reply.status(404).send({ error: 'not found' });
        }
    });
    // ─── 道具图片生成 ───
    // 前端 PropsWorkspace.vue → POST /api/v1/aigc-spec/generate-prop-image
    // 兼容旧路径（studio-v2 工作台调用）和新路径（execution-images 统一入口）
    fastify.post('/v1/aigc-spec/generate-prop-image', { preHandler: [fastify.authenticate] }, async (request, reply) => {
        const body = request.body;
        const { prompt, negativePrompt, projectId, propKey } = body || {};
        // 从前端 prompt 第一行提取道具名（格式：[商品]: xxx）
        const nameFromPrompt = prompt ? prompt.match(/\[商品\]:\s*(.+?)(\n|$)/)?.[1]?.trim() : '';
        const propName = body.propName || body.name || nameFromPrompt || '道具';
        if (!prompt && !propName) {
            return reply.status(400).send({ error: 'prompt or propName required' });
        }
        const authHeader = request.headers.authorization || '';
        const pid = projectId || body.projectId;
        if (!pid)
            return reply.status(400).send({ error: 'projectId required' });
        try {
            // 构造白底道具图 prompt
            const fullPrompt = prompt || `[商品]: ${propName}\n[描述]: 电商白底图，产品摄影，4K高清`;
            // 默认的电商白底图负面 prompt
            const fullNegative = negativePrompt || '人物, 模特, 手, 人体部位, 文字以外文字, 水印, 任何人, 阴影, 复杂背景, 多件物品, 重复, 变形, 模糊, 低质量';
            // 调用 SEEL 入口异步任务
            const taskInput = {
                prompt: fullPrompt,
                negativePrompt: fullNegative,
                source: 'prop_execution',
                propName,
                name: propName,
            };
            // 传递参考图参数（如果有）
            if (body.referenceImage) {
                taskInput.imageUrl = body.referenceImage;
                taskInput.mode = body.mode || 'img2img';
            }
            const genRes = await fetch(`http://localhost:${process.env.PORT || 4002}/api/tasks/ai-generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', authorization: authHeader },
                body: JSON.stringify({
                    projectId: pid,
                    taskType: 'image',
                    input: taskInput,
                }),
            });
            if (!genRes.ok) {
                const errText = await genRes.text().catch(() => '');
                throw new Error(`图片生成任务提交失败: ${genRes.status} ${errText}`);
            }
            const genData = await genRes.json();
            const taskId = genData?.task?.id;
            if (!taskId)
                throw new Error('未获取到任务 ID');
            // 轮询等待任务完成（最多 60 秒，每 2 秒检查一次）
            let imageUrl = '';
            const baseUrl = `http://localhost:${process.env.PORT || 4002}`;
            for (let i = 0; i < 30; i++) {
                await new Promise(r => setTimeout(r, 2000));
                const statusRes = await fetch(`${baseUrl}/api/tasks/${taskId}/status`, {
                    headers: { authorization: authHeader },
                });
                if (!statusRes.ok)
                    continue;
                const statusData = await statusRes.json();
                const task = statusData?.task;
                if (!task)
                    continue;
                if (task.status === 'completed') {
                    const result = task.result || {};
                    imageUrl = result?.data?.imageUrl || result?.data?.url || result?.imageUrl || result?.url || '';
                    if (imageUrl)
                        break;
                    try {
                        const err = JSON.parse(task.error || '{}');
                        imageUrl = err?.output?.imageUrl || err?.output?.url || '';
                    }
                    catch {
                        // task.error JSON 解析失败，保持 imageUrl
                    }
                    break;
                }
                if (task.status === 'failed') {
                    console.warn('[Execution-Images] 道具图任务失败:', task.error);
                    break;
                }
            }
            if (!imageUrl) {
                throw new Error('图片生成超时或失败，请检查模型配置和 API Key');
            }
            // Download to local + upload to COS (force save)
            const userId = request.user?.id || 'anonymous';
            const originalUrl = imageUrl;
            try {
                const result = await downloadAndUpload(imageUrl, userId, 'props');
                imageUrl = result.cosUrl.startsWith('/uploads') ? originalUrl : result.cosUrl;
                console.log(`[Execution-Images] 道具图持久化完成: ${imageUrl}`);
            }
            catch (e) {
                console.warn('[Execution-Images] 道具图持久化失败，使用原 URL:', e.message);
                imageUrl = originalUrl;
            }
            // 确保 project 存在
            const existing = await index_js_1.prisma.project.findUnique({ where: { id: pid } });
            if (!existing) {
                await index_js_1.prisma.project.create({
                    data: { id: pid, name: propName, userId: request.user.id || 'anonymous' },
                }).catch(() => { });
            }
            // 存储到 propImage 表（没有唯一约束，用 findFirst + create/update）
            const existingProp = await index_js_1.prisma.propImage.findFirst({
                where: { projectId: pid, propName },
            });
            if (existingProp) {
                await index_js_1.prisma.propImage.update({
                    where: { id: existingProp.id },
                    data: {
                        imageUrl,
                        imagePrompt: body.imagePrompt || body.description || '',
                        negativePrompt: fullNegative,
                        category: body.category || '通用',
                        description: body.description || '',
                        sortOrder: body.sortOrder ?? 0,
                    },
                });
            }
            else {
                await index_js_1.prisma.propImage.create({
                    data: {
                        projectId: pid,
                        propName,
                        imageUrl,
                        imagePrompt: body.imagePrompt || body.description || '',
                        negativePrompt: fullNegative,
                        category: body.category || '通用',
                        description: body.description || '',
                        sortOrder: body.sortOrder ?? 0,
                    },
                });
            }
            return reply.send({
                success: true,
                data: { imageUrl, url: imageUrl },
                imageUrl,
                url: imageUrl,
            });
        }
        catch (err) {
            console.warn('[Execution-Images] POST 道具图失败:', err.message);
            return reply.status(500).send({ error: err.message || '道具图片生成失败' });
        }
    });
}
// ⭐ 中文 → 英文 翻译函数（后端兜底，确保 Seedream 能理解）
const CN_TO_EN = {
    '构图类型': 'Composition type', '居中构图': 'centered composition', '全身正面': 'full body front view',
    '全身定妆照': 'full body portrait', '立正站姿': 'standing straight', '正面': 'front view',
    '侧面': 'side view', '背面': 'back view', '侧身': 'profile view',
    '角色名': 'Character name', '角色描述': 'Description', '服装': 'Costume',
    '风格关键词': 'Style', '背景环境': 'Background', '表情': 'Expression', '体型': 'Body type',
    '穿着': 'wearing', '身穿': 'wearing', '长发': 'long hair', '短发': 'short hair',
    '直发': 'straight hair', '卷发': 'curly hair', '披肩发': 'shoulder-length hair',
    '马尾': 'ponytail', '丸子头': 'bun', '辫子': 'braid', '刘海': 'bangs',
    '黑发': 'black hair', '白发': 'white hair', '金发': 'blonde hair',
    '棕色头发': 'brown hair', '红发': 'red hair', '粉发': 'pink hair',
    '皮肤白皙': 'fair skin', '小麦色皮肤': 'tan skin', '古铜色皮肤': 'bronze skin',
    '面容清秀': 'delicate features', '五官精致': 'refined facial features',
    '眼神疲惫': 'tired eyes', '眼神空洞': 'hollow eyes', '嘴角下垂': 'downturned mouth',
    '嘴唇紧抿': 'tight lips', '微笑': 'smiling', '面无表情': 'expressionless',
    '严肃': 'serious expression', '忧郁': 'melancholy', '高傲': 'haughty',
    '温柔': 'gentle', '冷漠': 'cold expression', '愤怒': 'angry', '开心': 'happy',
    '悲伤': 'sad', '惊讶': 'surprised', '恐惧': 'scared', '自信': 'confident',
    '穿戴': 'wearing', '上身穿': 'wearing', '下身穿': 'wearing bottom',
    '斜分': 'side part', '三七分': 'side part', '中分': 'center part',
    '外套': 'jacket', '大衣': 'coat', '风衣': 'trench coat', '夹克': 'jacket',
    '羽绒服': 'down jacket', '棉服': 'padded coat', '卫衣': 'hoodie',
    '毛衣': 'sweater', '针织衫': 'knitwear', '衬衫': 'shirt', '背心': 'vest',
    '连衣裙': 'dress', '裙子': 'skirt', '百褶裙': 'pleated skirt',
    '裤子': 'pants', '长裤': 'long pants', '短裤': 'shorts', '牛仔裤': 'jeans',
    '休闲裤': 'casual pants', '阔腿裤': 'wide-leg pants', '紧身裤': 'tight pants',
    '运动裤': 'sweatpants', '连裤袜': 'tights', '丝袜': 'stockings',
    '靴子': 'boots', '高跟鞋': 'high heels', '运动鞋': 'sneakers', '皮鞋': 'leather shoes',
    '帽子': 'hat', '棒球帽': 'baseball cap', '贝雷帽': 'beret', '围巾': 'scarf',
    '领带': 'tie', '领结': 'bow tie', '腰带': 'belt', '眼镜': 'glasses', '墨镜': 'sunglasses',
    '耳环': 'earrings', '项链': 'necklace', '手链': 'bracelet', '戒指': 'ring', '手表': 'watch',
    '黑色': 'black', '白色': 'white', '红色': 'red', '蓝色': 'blue', '绿色': 'green',
    '黄色': 'yellow', '紫色': 'purple', '粉色': 'pink', '橙色': 'orange', '棕色': 'brown',
    '灰色': 'gray', '米色': 'beige', '卡其色': 'khaki', '藏青色': 'navy blue',
    '酒红色': 'burgundy', '军绿色': 'olive green', '驼色': 'camel', '金色': 'gold', '银色': 'silver',
    '衣服': 'clothes', '上装': 'top', '下装': 'bottom', '内搭': 'inner layer',
    '脚穿': 'wearing shoes', '鞋子': 'shoes',
    '灰色羊毛混纺西装外套': 'gray wool blend blazer',
    '白色纯棉衬衫': 'white cotton shirt', '纯棉衬衫': 'cotton shirt',
    'V领': 'v-neck', '圆领': 'crew neck', '高领': 'turtleneck', '立领': 'mandarin collar',
    '翻领': 'lapel collar', '西装领': 'notch lapel', '无领': 'collarless',
    '浅色': 'light color', '深色': 'dark color', '亮色': 'bright color', '暗色': 'dark color',
    '单排扣': 'single breasted', '双排扣': 'double breasted', '拉链': 'zipper', '纽扣': 'button',
    '口袋': 'pocket', '腰带': 'belt', '袖口': 'cuff', '领口': 'collar',
    '影视级质感': 'cinematic quality', '3D渲染': '3D render', '次世代': 'next-gen',
    'PBR材质': 'PBR material', '高精度建模': 'high-precision modeling',
    '三维立体': '3D volumetric', 'CG效果': 'CG effect', '体积感': 'volumetric feel',
    '全局光照': 'global illumination', '写实': 'photorealistic', '真实': 'realistic',
    '纯色背景': 'solid color background', '简单背景': 'simple background',
    '无杂物': 'no clutter', '无遮挡': 'no occlusion', '白色背景': 'white background',
    '纯白背景': 'plain white background',
    '角色定妆照': 'character portrait', '全身人设图': 'full body character design',
    '4K高分辨率': '4K high resolution', '高分辨率': 'high resolution',
    '单人': 'single person', '角色设定': 'character design', '无文字': 'no text',
    '，': ', ', '、': ', ', '。': '. ',
};
// ⭐ 词表映射翻译：将中文关键词替换为英文，不调用任何外部 API
// 未映射的中文保留原样（Seedream 能理解一部分中文，中英混合比全空好）
function translateCnPrompt(text) {
    if (!text)
        return text;
    let result = text;
    // 1. 标签结构替换（兼容 buildStandardPrompt 的输出）
    result = result.replace(/角色名「([^」]*)」/g, 'Character name: $1');
    result = result.replace(/角色名[:：]\s*(.*)$/gm, 'Character name: $1');
    result = result.replace(/角色描述[:：]\s*(.*)$/gm, 'Description: $1');
    result = result.replace(/服装[:：]\s*(.*)$/gm, 'Costume: $1');
    result = result.replace(/风格关键词[:：]\s*(.*)$/gm, 'Style: $1');
    result = result.replace(/背景环境[:：]\s*(.*)$/gm, 'Background: $1');
    result = result.replace(/构图类型[:：]\s*(.*)$/gm, 'Composition: $1');
    result = result.replace(/表情[:：]\s*(.*)$/gm, 'Expression: $1');
    result = result.replace(/体型[:：]\s*(.*)$/gm, 'Body type: $1');
    // 2. 中文标点→英文逗号
    result = result.replace(/[，,]\s*/g, ', ');
    result = result.replace(/[。.]\s*/g, '. ');
    result = result.replace(/[、；;：:！!？?]/g, ', ');
    // 3. 穿戴映射
    result = result.replace(/身穿|穿着|穿戴|上身穿|下身穿|脚穿|身穿|着/g, ' wearing ');
    // 4. CN_TO_EN 词表映射（按长度降序匹配，长词优先）
    const sorted = Object.entries(CN_TO_EN).sort((a, b) => b[0].length - a[0].length);
    for (const [cn, en] of sorted) {
        if (/[:：]/.test(cn))
            continue;
        try {
            result = result.replace(new RegExp(cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), en);
        }
        catch { /* skip bad regex */ }
    }
    // 5. 清理残余：去掉中文引号，压缩空格/空逗号
    result = result.replace(/[「」『』""]/g, '');
    result = result.replace(/\s{2,}/g, ' ');
    result = result.replace(/,(\s*,)+/g, ',');
    result = result.replace(/,\s*$/g, '');
    return result.trim();
}
