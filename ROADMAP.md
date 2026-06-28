# 昆仑镜 — 动漫制作水平优化路线图

## 第一阶段 ✅ 已完成 — 风格配置中台

### 后端
- [x] DB 表 `style_profiles`：存储所有视觉风格配置
- [x] `StyleProfileService`：从 DB 读取，禁止硬编码
- [x] `style-injector.ts`：统一风格注入工具
- [x] API 路由 `GET/POST/PUT/DELETE /api/v1/style-profiles`
- [x] Seed 数据：7 种风格（realistic, anime, 3d, cartoon, cyberpunk, ink, oil）
- [x] 每个风格含：正面修饰词、负面修饰词、环节模板、模型路由

### 前端
- [x] `VideoStylePanel.vue`：动态加载风格列表（硬编码已移除）
- [x] `useStyleLock.ts`：全局风格锁定 composable（prompt 构建、模型路由）
- [x] `admin/aigc/styles.vue`：风格管理后台

## 第二阶段 🔜 下一步 — 全链路风格注入

- [ ] 替换 `character-design/CharacterWorkspace.vue` 中的 `STYLE_KEYWORDS` 硬编码
- [ ] 替换 `scene-design/SceneWorkspace.vue` 中的风格关键词映射
- [ ] 替换 `execution-images.ts` 中的 `styleSuffixMap` 硬编码
- [ ] 替换 `narrative-llm.ts` 中的 `styleSuffixMap` 硬编码
- [ ] 替换 `prompt-compiler.ts` 中的艺术风格映射

## 第三阶段 — 画风一致性

- [ ] 视频生成时传入角色参考图实现角色一致
- [ ] 画风指纹（Cinematic Identity 落地）
- [ ] 关键帧序列替代单张分镜

## 第四阶段 — 高级动漫能力

- [ ] 动漫特效自动生成
- [ ] 多角色一致性系统
- [ ] 唇形同步
- [ ] 本地动漫模型部署（AnimateDiff / ComfyUI）
