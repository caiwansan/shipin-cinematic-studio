# 昆仑茶馆 实时同声传译 设计方案（DESIGN-01）

**Date:** 2026-08-08
**掌柜需求:** 点对点视频聊天中，A 讲汉语 → B 听到英语；B 讲俄语 → A 听到汉语（中/英/西/俄等多语种互译），延迟尽量短。

---

## 1. 现状盘点（已检查昆仑茶馆）

| 资产 | 现状 | 可复用度 |
|---|---|---|
| R11 语音/视频 1v1 通话 | WebRTC P2P 直连 + coturn TURN 兜底；信令走 WuKongIM CMD(type=99) 临时私有频道 `rtc_<callId>`；状态机 idle→calling/incoming→connecting→active | 主通路不动，转译作为旁路叠加 |
| 媒体流 | `useRtcCall.ts`：localStream(mic/cam) + remoteStream(ontrack)；已有 echoCancellation/noiseSuppression | mic 轨道可 clone 旁路送转译 |
| ASR | `voice-asr.service.ts`：faster-whisper(small, CPU int8) 常驻 Python worker，IM-CHA-M10 语音转文字；**整句离线式**（非流式） | 需加流式/半句模式或换流式模型 |
| TTS | `voice-runtime.ts` Provider 注册中心：edge-tts + aliyun-tts；`streaming-audio-runtime.ts` 已支持边生成边播放 | 已有流式管道，多语种需补音色 |
| LLM/翻译 | `ai-router.service.ts` 模型路由（deepseek-llm.provider） | 翻译引擎可走 DeepSeek 流式，或专用小模型 |
| 合规哲学 | R3「内容不过平台」；ASR 本地转写不出平台 | 同传需显式用户授权后才上传音频，用完即弃 |

## 2. 需求理解与延迟目标

同传体验分级（对齐国际同传标准 AIIC：滞后 2-4s 合格）：

- **字幕同传（阶段一目标）：** 说话人开口 → 对方看到译文字幕 ≤ **1s**（优秀） / ≤1.5s（合格）
- **语音同传（阶段二目标）：** 说话人开口 → 对方听到译文语音 ≤ **2s**（优秀） / ≤3s（合格）
- **物理极限认知：** ASR + MT + TTS 三段最小管线 ≈ 700ms-1s，再压缩只能靠端侧小模型牺牲质量。**不存在「边说边同步听到译文」**，但「说完半句对方已开始听到译文」是可达成的（流式 partial 翻译）。

## 3. 总体架构：对称双端旁路转译

核心决策：**各自转译自己的声音**（A 端处理 A 的 mic → 译文给 B；B 端处理 B 的 mic → 译文给 A）。

为什么转本端而不是对端：
- 本端 mic 原始采样质量最好，无 P2P 传输损耗、无回声处理污染
- 不等对端音频到达，天然少一跳网络延迟
- 对称设计：双方各自一条转译链路，互不依赖、互不阻塞；双人同时讲话天然并行
- 可选：B 想只听译文时，静音 A 的原文轨道（本地 P2P 轨道 muted，不破坏直连）

```
A(讲汉语)                         B(听英语)
 ┌─────────────┐   P2P 原声(不变)   ┌─────────────┐
 │  mic ───────┼──────────────────→│ 原文可静音   │
 │  │clone     │                   │  ▲译文音频   │
 │  ▼          │                   │  │(AudioWorklet)│
 │ 转译网关A   │                   │  └─ WS 帧    │
 │ VAD→ASR→MT  │←─── 翻译服务 ────→│  字幕渲染    │
 │ →TTS 流     │   (WS Opus帧/JSON) │             │
 └─────────────┘                   └─────────────┘
```

**媒体路径（不动 P2P 主通路）：**
1. A 端 `micTrack.clone()` → AudioWorklet 采集 Opus 16kHz 单声道（转译够用，带宽 ~24kbps）→ WebSocket 送转译网关（会话维度 = 现有 `callId`，完美复用 RTC 信令上下文）
2. 网关流水线：**VAD 断句 → 流式 ASR → 流式翻译 → 流式 TTS**，产出两路：
   - 字幕 JSON（WS 直推，延迟 ~0.6-1s）
   - 译文音频（WS Opus 帧 → B 端 AudioWorklet 播放，延迟 ~1.2-2s）
3. B 端 UI：通话界面出现译文字幕条 + 「听原文 / 听译文 / 双声道」切换；译文语音与原文可同播（双声道）或替换

**为什么不用第二条 WebRTC 连网关：** AudioWorklet + WS 实现更简单可靠，且容易做原文/译文混音切换；WebRTC 注入要额外 ICE/信令/重协商，收益不大。

## 4. 延迟预算表（每段可独立优化）

| 段 | 手段 | 延迟 | 说明 |
|---|---|---|---|
| VAD 断句 | Silero VAD（端侧 onnx ~1.5MB）+ 语义双触发 | 0-800ms | 不傻等句号：停顿>1.2s 强制提交；连续语流按 1.5-3s 滑窗切 |
| ASR 首字 | SenseVoice/FunASR 流式（GPU）或 faster-whisper 半句滑窗（CPU） | 200-400ms | faster-whisper 非流式，MVP 用重叠滑窗，阶段三换流式模型 |
| 翻译增量 | DeepSeek 流式输出（首 token 300-800ms）或 NLLB-200-distilled 600M 自托管（150-400ms） | 150-800ms | 同传场景专用小模型更稳；DeepSeek 质量好但首字延迟抖动 |
| TTS 首包 | edge-tts（zh/en/es/ru 全支持）/ CosyVoice2 流式 | 100-300ms | 已有 streaming-audio-runtime 管道 |
| 网络 | 就近部署 + WS 二进制帧 | 30-80ms | — |
| **字幕端到端** | | **~0.6-1.2s** | 边说边出 |
| **语音端到端** | | **~1.2-2.5s** | 半句后开始播放译文 |

**节奏控制（同传灵魂）：** TTS 按句播放、新句**打断**旧句尾音（interrupt），保证译文节奏跟着说话人走，不越积越慢。

## 5. 技术选型

| 环节 | 选型 | 备注 |
|---|---|---|
| 端侧 VAD | Silero VAD（onnxruntime-web） | 浏览器端零延迟断句 |
| ASR | MVP：复用 faster-whisper worker 加滑窗半句提交；迭代：SenseVoice 流式 | 中英西俄全覆盖 |
| 翻译 | 首选 DeepSeek（复用 ai-router，prompt 指定 targetLang，增量 partial 翻译）；延迟敏感时降级 NLLB-200 小模型 | 双引擎可切换 |
| TTS | edge-tts（现成，4 语种音色）→ 迭代 CosyVoice2 自托管 | 复用 voice-runtime 注册中心，新增 provider 即可 |
| 传输 | WebSocket + Opus 帧（客户端→网关音频 / 网关→客户端音频+字幕 JSON） | 不用 WebRTC 第二连接 |
| 会话管理 | 复用 RTC `callId` 维度；网关会话 = callId + 双方 uid | 通话结束自动销毁，用完即弃 |

## 6. 分期落地

- **阶段一 · 字幕同传（MVP）：** 后端 `/api/im/rtc/translate` 网关（VAD+ASR+DeepSeek 流式）+ 前端 mic clone 采集 + 通话 UI 译文字幕条。延迟 ≤1.5s。**不改音频通路**，改动面小，先验证翻译质量和节奏。
- **阶段二 · 语音同传：** 流式 TTS + AudioWorklet 播放 + 原文/译文/双声道切换 + 打断策略。延迟 ≤2.5s。
- **阶段三 · 体验优化：** VAD 断句调优、称呼/术语库（人名地名不翻错）、双讲并行渲染、语速自适应、口音适配、离线缓存常用句。

## 7. 风险与权衡

| 风险 | 应对 |
|---|---|
| faster-whisper 非流式，半句滑窗有重复/漏字 | 阶段一接受小瑕疵；阶段三换 SenseVoice 流式 |
| DeepSeek 流式首字延迟抖动（1-3s 偶发） | 超时降级：翻译引擎切换 NLLB；或先出 ASR 原文字幕兜底 |
| 音频出平台（R3 哲学） | **显式授权**：用户开启同传才上传；网关不落盘、通话结束即弃；字幕 JSON 只留通话内 |
| TTS 多语种音色自然度（西/俄） | edge-tts 标准音色保底；CosyVoice 多语种模型迭代 |
| 算力成本 | ASR/TTS 是算力大头：自托管 GPU 单卡约 10-20 路并发；可配按通话计费/额度 |
| 移动端后台采集暂停 | 切后台自动暂停转译，回前台恢复（状态提示） |

## 8. 结论

**在现有 R11 P2P 通话上叠加「对称旁路转译」是低侵入、可分期的最优解**：主通路零改动，转译作为可选增值能力（显式授权才启用）。延迟上「字幕 1s / 语音 2s」是当前技术栈可达的合格同传水平，物理下限约 700ms-1s。所有 AI 资产（ASR worker / VoiceRuntime / ai-router）均可复用，新增一个转译网关 + 前端旁路采集即可启动阶段一。
