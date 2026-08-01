# 短剧工作台运行时审计 — 主代理发现（07-31 18:55 启动）

> 注：本文件为主代理运行时审计原始发现，子代理深度报告见 01-04 号文件。

## 部署拓扑
- 前端: nuxt-frontend (pid 1525619) :3000, build 时间 07-31 08:53 ✅ 最新
- 后端: api-server (pid 1524430, tsx) :4002, start 08:52 ✅
- 数据库: PostgreSQL aigc_scs, 448 表, 430 prisma model
- nginx: aigc.fushtn.com → proxy 127.0.0.1:3000

## ✅ 正常
- 健康检查 /api/health OK
- V2 工作台 /api/v2/workbench/project/:id 返回 19 分镜/3角色/3场景 ✅
- aigc-spec load 返回 19 段 visualDescription ✅ displaySource=AiVideoSegment
- HTTPS 公网链路通 ✅
- 宏荼记: script 5083字符, 3角色, 3场景, 19段落, 19张分镜图(storeboard_images), 375个任务
- 剧本提交 POST 校验正常

## ❌ 问题 1: 分镜段落双真相源（严重）
- `ai_video_segments` 表: 19 段（AI 拆解写入，前端加载优先读这里）
- `executionResults.segments` JSONB: 13 段旧数据（前端 saveToServer 写入！）
- 32 个项目有 executionResults.segments，只有 12 个项目有 ai_video_segments
- **读写不对称**: 前端加载优先 aiVideoSegments，但编辑保存走 saveToServer → executionResults.segments → 刷新后编辑丢失！
- 内容也不一致: seg_001 表里"蒸气袅袅，阳光洒在屋顶上" vs JSONB"蒸气袅袅升腾...街道上"

## ❌ 问题 2: 阶段状态真相源断裂（严重）
- 前端判断阶段完成只看 `executionResults.pipelineCompletedStages`
- 后端 AI 任务从不写这个字段（全仓 grep 无写入点）
- 60 个有 executionResults 的项目中 0 个有非空 pipelineCompletedStages
- `pipeline_stages` 表存在但前端只写不读（死表）
- 宏荼记有完整数据但前端显示"剧本分析未开始/角色未开始/场景未开始/分镜未开始"

## ❌ 问题 3: 分镜图双表
- `storyboard_images` 表: 19 张（实际数据）
- `ai_frame_designs` 表: 0 条（新表但没写入）
- V2 API 同时返回两者，前端用 storyboardImages

## ❌ 问题 4: AI 任务失败率 12.3% (141/1147)
- billing_failed (火山欠费) 56 次
- "Body has already been read" 53 次（fastify body 解析，07-08/09 集中出现，疑似自定义 JSON parser parseAs:string 问题）
- 401 InvalidApiKey 5 次
- 40 天前 queued 卡死任务 5 个（06-23 创建仍在 queued）
- 内容安全/账号欠费 各 3 次

## 观察
- prisma schema 有 @@map 正常（表名 snake_case）
- 131 项目中 104 个空壳（无角色无分镜）
- saveToServer 有保存锁 ✅
- executionResults 只存 segments/analyzeV2Data/pipelineCompletedStages 三个 key（宏荼记）
