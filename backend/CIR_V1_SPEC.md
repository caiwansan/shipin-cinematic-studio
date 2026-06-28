# Cinematic Intermediate Representation（CIR）v1.0

## 原则

1. **Agent 只输出 CIR，不输出 Prompt。**
2. **Prompt 是 Compiler 的产物，不是 Agent 的产物。**
3. **CIR 是所有生产视频的唯一输入。**
4. **CIR 是 Benchmark 评测的入口。**
5. **Optimization Engine 只输出 CIR Patch，不输出 Prompt Patch。**
6. **Learning Memory 只存储 CIR，不存储 Prompt。**

## 架构定位

```
Story Agent / Novel Agent / Third-party SDK
             │
             ▼
          CIR v1.0（SSOT）
             │
        ┌────┴────┐
        ▼         ▼
    Compiler   Capability Benchmark
        │         │
        ▼         ▼
   Provider    Analytics
    Prompt      (CIR Patch)
        │
        ▼
   Video Generation
```

## 核心结构

```yaml
version: 1.0
scene:
  title:
  environment:
    location:
    timeOfDay:
    weather:
    atmosphere:
    colorPalette?:
characters:
  - id: string
    name: string
    alias: string
    gender: string
    age?: string
    appearance: string
    personality: string[]
    emotion: string
    voiceGuide?: string
shots:
  - id: string
    description: string
    durationSeconds: number
    characterIds: string[]
    actions: string[]
    dialogue: string[]
    camera:
      path?:
        type: string
        startPosition?: string
        endPosition?: string
        smoothness?: fluid | stable | rough | shaky
      motion?:
        pattern: string
        speedCurve?: string
      composition?:
        rule: string
        subjectPosition?: string
        lookRoomDirection?: string
        headroom?: string
      scale?: string          # establishing/wide/medium/close_up/extreme_close_up
      angle?: string          # eye/low/high/dutch/overhead
      focus?:
        target: string
        depthOfField?: shallow | medium | deep
        rackFocus?:
          cue: string
          fromTarget: string
          toTarget: string
    lighting?:
      keyLightDirection: string
      colorTemperature: string
      mood: string
      continuity: boolean
    audioCue?: string
    narrativePurpose?: string
storyIntent:
  story: string
  cinematic: string
  lighting?: string
  visual?: string
constraints?:
  maxDuration?: number
  fps?: number
  resolution?: string
providerHints?: object
metadata:
  generatedBy: string
  sourceStoryId?: string
  projectId?: string
  createdAt: string       # ISO timestamp
```

## 禁止

- Agent 输出中**不得包含 prompt、negativePrompt、videoPrompt 等自由文本字段**。
- 任何指向"直接写 Prompt"的行为都是违反 CIR 协议的错误。

## 验证

Agent 输出 CIR 后必须通过 `validateCir()` 验证：
- 验证失败 → CIR 被拒绝，不进入 Compiler，不进入 Production
- 验证警告 → 记录但允许通过

## Capability Registry ↔ CIR 映射

| Capability | CIR Field |
|------------|-----------|
| CAMERA_PATH | camera.path |
| CAMERA_MOTION | camera.motion |
| CAMERA_COMPOSITION | camera.composition |
| SHOT_TRANSITION | camera.scale + camera.angle |
| CAMERA_FOCUS | camera.focus |
| LIGHT_CONTINUITY | lighting |
| OBJECT_PERSISTENCE | shots[].characterIds + character identity |
| SPATIAL_RELATIONSHIP | 由多镜头场景隐式验证 |
| TEMPORAL_CONSISTENCY | 由 shot 序列隐式验证 |

## 文件

- 类型定义：`src/runtime/cir-v1.ts`
- 验证器：`src/runtime/cir-validator.ts`
- 测试：`src/runtime/__tests__/cir-validator.test.ts`
