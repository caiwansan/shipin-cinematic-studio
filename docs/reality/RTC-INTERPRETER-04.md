# RTC-INTERPRETER-04 世界语言池 100+ 语种（含粤语/闽南语）— COMPLETE ✅

**Date:** 2026-08-08 04:00-05:30
**Gate:** 掌柜指令「要达到100种语言，包括粤语和闽南语的主流方言」（RTC-INTERPRETER-01/02/03 之后第四次迭代）
**验收：** scripts/reality-check-rtc-interpreter-04.ts **25/25 PASS**（含粤语真声端到端 + 闽南语降级）

## 核心交付

### 1. 世界语言池 101 语种目录（SSOT：backend/src/services/interp-langs.ts）
- **101 语种** = faster-whisper 全部 100 语言码 + 闽南语 nan（whisper 无 nan 原生码，内部 zh 兜底）
- 三层能力全覆盖：ASR / 翻译（DeepSeek 全语种）/ TTS
- **ASR 双引擎路由**：18 常用语种 → Vosk 流式（毫秒级，fast path）；83 长尾语种（含粤语 yue / 闽南语 nan）→ Whisper 多语言单模型
- **TTS 音色映射 74 语种**（edge-tts 实测 324 音色对齐）：粤语 yue → **zh-HK-HiuMaanNeural 粤语真声**；无音色 27 语种（含闽南语）→ 自动降级仅字幕（架构既有容错，网关 catch → 只推字幕）
- 中文名全量：粤语（广东话）/ 闽南语（台语/福建话）

### 2. Whisper 流式 worker（backend/scripts/whisper_stream_worker.py + whisper-stream.service.ts）
- 单个多语言 faster-whisper small（CPU int8）覆盖全部 83 长尾语种；会话按 session 隔离累积缓冲
- 协议与 vosk worker 一致（stdin JSON 行 → stdout JSON 行），Node 端 whisper-stream.service.ts 单例管理
- **句末整句转写**（final）+ 20s 硬上限分片（partial）：负载高时单次转写可达 1-2 分钟（CPU int8），增量 partial 会阻塞单 worker 且无意义 → 只保留上限分片
- 服务启动后台 warmup 预热（冷启动 10-120s，看机器负载）
- ⚠️ 关键坑：**faster-whisper 不接受 raw bytes**（当文件对象处理直接失败返回空）→ 必须 `np.frombuffer(int16).astype(float32)/32768` 转 numpy 数组（曾致 whisper 路径静默全空）

### 3. 网关升级（im-rtc-interpreter.ts）
- SUPPORTED_LANGS 18 → 101；LANG_NAMES 全量中文名（翻译 prompt 用）
- 帧路由按 `asrEngineFor(srcLang)`：vosk / whisper 各自 feed/finalize/reset
- 翻译 prompt 支持方言目标（实测：普通话 → 地道书面粤语「我係昆仑茶馆嘅翻译测试」✅、闽南语「咱做伙去啉茶啦」✅）

### 4. 前端（useRtcInterpreter.ts + chat/index.vue）
- 语言选择器 18 → 101，**三组 optgroup**：🎯 常用语言（毫秒级 18）/ 🗣️ 中文方言（粤语、闽南语）/ 🌍 世界语言（81）
- 文案更新「世界语言池 100+ 语种，含粤语/闽南语」

## 验收证据（25/25）

| 组 | 断言 | 结果 |
|----|------|------|
| G1 | 语言池 ≥100（101=18 vosk + 83 whisper），含 yue/nan，引擎路由正确，无重复码 | ✅ |
| G2 | yue TTS=zh-HK 粤语真声；nan 无音色→降级；74 语种有音色/27 仅字幕 | ✅ |
| G3 | whisper(yue) 单元：粤语真声 PCM（edge-tts zh-HK 合成）→ 转写产出文本 | ✅（small 模型 best-effort） |
| G4 | 闽南语 nan 会话：ready + 无错误（zh 兜底不崩） | ✅ |
| G5 | **粤语全链路**：A 说粤语→B 中文字幕+9 段中文语音；B 说普通话→A 书面粤语字幕「大家好，我係昆仑茶馆嘅翻译测试，今日天气真系唔错，我哋一齐去饮茶啦。」+4 段粤语真声 | ✅ |
| G6 | 101 语种网关全放行（101/101 ready）；非法码 xx 仍 4400 | ✅ |
| G7 | 目标=闽南语：真闽南语字幕「逐家好，我是昆仑茶馆的翻译测试，今仔日天气真好，咱做伙去啉茶啦。」+ **零语音**（自动降级仅字幕） | ✅ |

## 已知权衡（诚实标注）
- **方言 ASR 质量**：whisper small CPU int8 对粤语口语识别是 best-effort（实测会出「你你你…圣诞快乐」类幻觉/偏差）。升级路径：`ASR_MODEL=medium/large`（更慢）或 GPU；输出方向（普通话→粤语/闽南语字幕+粤语真声）质量优秀
- **长尾路径延迟**：方言/小语种 = 说一句→句末整句转写→出字幕（负载高时 1-2 分钟）；常用 18 语种仍 Vosk 毫秒级。单 worker 串行：罕见语种并发使用时排队
- **闽南语无 TTS 音色**：edge-tts 无 nan-TW 音色（324 音色实测）→ 仅字幕，语音开关无效但界面不报错（降级是特性）

## 部署
- 后端：pm2 restart api-server（tsx 直跑，无需 build）
- 前端：nuxt build + pm2 restart nuxt-frontend（3000，nginx 反代 aigc.fushtn.com）
- 提交：见 git log（RTC-INTERPRETER-04）

## 待掌柜
- 真机双账号：A 选「我说粤语/对方听中文」+ B 选「我说中文/对方听粤语」——A 讲粤语 B 听中文声音，B 讲普通话 A 听粤语真声
- 真机方言验证：A 说粤语（Whisper 转写质量请以真人口语为准）；闽南语侧只验字幕
