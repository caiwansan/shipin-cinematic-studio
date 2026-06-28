# 大模型设置切换不成功 — 审查报告

**日期**: 2026-05-25 22:05  
**审查目标**: 用户从硅基流动切换到火山引擎 TTS，切换后不生效

---

## 1. 前端逻辑审查 (ModelSettingsModal.vue)

### 保存流程
```ts
handleSaveAll()
  → body[card.key + 'Provider'] = card.provider  // 正确写入新 provider
  → body[card.modelField] = card.modelName        // 写入 MODEL NAME
  → POST /api/v2/user/model-config
```

### ✅ 正确做的
- provider 写入 DB（`body.ttsProvider = 'volcengine'`）

### ❌ 没做的 — 切换 provider 时 model 没有联动
用户从 siliconflow 切到 volcengine 时，前端弹窗里的 `modelName` 输入框**保留的是旧值**（`fishaudio/fish-speech-1.5`）。保存时：

```
body = {
  ttsProvider: 'volcengine',      // ✅ 新 provider
  ttsModel: 'fishaudio/fish-speech-1.5',  // ❌ 还是硅基的模型
}
```

## 2. 后端保存审查 (user-model-config-v2.ts)

### POST 逻辑
```ts
data.ttsProvider = body.ttsProvider  // → 'volcengine' ✅
data.ttsModel = body.ttsModel        // → 'fishaudio/fish-speech-1.5' ❌
```

更新到 DB 后：
```json
{
  "ttsProvider": "volcengine",
  "ttsModel": "fishaudio/fish-speech-1.5",
  "ttsApiKey": "..."
}
```

## 3. 运行时解析审查 (resolveProviderFromUserConfig)

当用户提交 TTS 任务时，resolveProviderFromUserConfig 读 DB：
- `provider: volcengine` → 用 volcengine 的 API Key
- `model: fishaudio/fish-speech-1.5` → 用这个模型名去 volcengine 的 adapter

volcengine TTS 适配器期望的模型名是 `doubao-tts-1` 等。`fishaudio/fish-speech-1.5` 在 volcengine 不存在，最终报错。

## 4. 根因总结

| 层级 | 问题 |
|------|------|
| **前端** 🔴 | model 名称没有随 provider 选择联动 |
| **后端** 🟡 | 接受任何 model name，不做 provider→model 一致性校验 |
| **运行时** 🟡 | model 与 provider 不匹配时无降级/纠正 |

**一句话**：前端切换 provider 后，用户**需要手动改模型名**才能用。如果是通过下拉选 provider，应该自动填充该 provider 的默认模型名。

## 5. 修复建议

### P0（用户体验）
前端 `handleSaveAll` 或切换 provider 时，如果 modelName 未显式修改，自动填写对应的默认模型：
```ts
const DEFAULT_MODELS: Record<string, Record<string, string>> = {
  tts: {
    volcengine: 'doubao-tts-1',
    siliconflow: 'fishaudio/fish-speech-1.5',
    aliyun: 'cosyvoice-v3.5-plus',
  },
  ...
}
```

### P1（系统健壮性）
后端 POST 时做 provider↔model 基础校验，不匹配时拒绝或自动纠正。
