# Video-Image Dependency Matrix

## 检查时间
2026-06-24

## 结论
**首尾帧图片 = 可选增强，非强制前置**

---

## Provider 能力矩阵

| 视频模型 | 纯文本 (t2v) | 参考图 (i2v/r2v) | 强制图片? |
|-----------|:---:|:---:|:---:|
| 豆包 Seedance (volcengine) | ✅ | ✅ (1-9张) | ❌ |
| 阿里万相 Wan (aliyun) | ✅ t2v | ✅ r2v / 首尾帧 | ❌ |
| Kling (可灵) | ✅ | ✅ | ❌ |
| Hailuo (海螺) | ✅ | ✅ | ❌ |
| Sora | ✅ | ✅ | ❌ |
| Runway | ✅ | ✅ | ❌ |
| Minimax | ✅ | ✅ | ❌ |

**结论：所有支持的视频模型都接受纯文本生成，参考图是可选增强。**

---

## 代码层面的图片依赖

### worker-runtime.ts (视频生成入口)

```
firstFrameUrl = payload.input?.firstFrameUrl || payload.input?.referenceImage || ''   ← 可选, 默认空
lastFrameUrl  = payload.input?.lastFrameUrl || ''                                       ← 可选, 默认空
firstFrameDesc = payload.input?.firstFrameDescription || ''                             ← 可选, 默认空
lastFrameDesc = payload.input?.lastFrameDescription || ''                               ← 可选, 默认空

frameRefs.push() 只在 URL 非空时发生
frameDesc 拼接 只在描述非空时发生
```

**结论：Worker 层完全可选，无图片走纯文本生成。** ✅

### queue/frame-sequence-engine.ts (帧序列引擎)

```
firstFrameUrl: string        ← 类型定义（非强制，可传空字符串）
referenceImages: {}           ← 空对象不触发任何注入逻辑
```

**结论：不强制，空对象跳过参考图注入。** ✅

### VideoGenerationWorkspace.vue (前端 UI)

```
首帧/中帧/尾帧 UI 区域            ← 渲染存在，但可以为空
"生成首中尾帧图" 按钮             ← 用户可跳过
"🎞️" 按钮不阻塞视频生成流程       ← 用户可不生成帧图直接去生成视频
```

**结论：前端 UI 渲染帧图区域但不强制用户使用。** ✅

---

## 前端引用依赖统计

| 文件 | 引用模式 | 是否强制 |
|------|-----------|----------|
| `VideoGenerationWorkspace.vue` | 帧图选择/生成/展示 | ❌ 可选 |
| `useStudioStore.ts` | `aiFrameDesigns.firstFramePrompt` fallback | ❌ 仅回填 |
| `aigc-orchestrator.ts` | `frameDesign.firstFrame.imagePrompt` 合并 | ❌ 仅合并 |
| `aigc-spec-agent.ts` | firstFrame/lastFrame 结构校验 | 🟡 Agent 输出约束 |
| `AdvertisementWorkspace.vue` | 图片作为视频参考 | ❌ 可选 |

## 建议

**首尾帧可以作为高级选项折叠，而不是前置步骤。**

当前 UI 可以改为：

```
┌─ 视频生成 ──────────────────────┐
│                                  │
│  [优化视频描述]                    │
│  [生成视频]                       │
│                                  │
│  ▼ 参考图控制（可选）              │
│    生成角色参考图                   │
│    生成场景参考图                   │
│    上传参考图                      │
│                                  │
└──────────────────────────────────┘
```

这样不改变核心链路，不会破坏已有 Provider 的图片增强能力，同时显著降低用户的操作路径长度。
