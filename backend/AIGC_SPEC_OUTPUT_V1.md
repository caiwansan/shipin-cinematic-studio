# AIGC_SPEC_OUTPUT_V1.md — AigcSpecOutput Schema Contract

**创建时间:** 2026-06-27  
**状态:** ✅ FROZEN  
**当前版本:** v1.0  
**兼容性规则:** 新增字段必须 optional。删除字段必须标记 deprecated 至少一个版本。

---

## 1. 概述

`AigcSpecOutput` 是 `aigcOrchestrator` 的最终输出，也是整个短剧工作台的数据契约。所有 Agent 输出最终合并为此类型，然后序列化存入 `Project.executionResults`。

---

## 2. Schema 定义

### 2.1 顶层字段

| 字段 | 类型 | 版本 | 必需 | 来源 Agent | 说明 |
|------|------|------|------|-----------|------|
| `schemaVersion` | `string` | v1.0 | ❌ (建议加) | — | Schema 版本标识，当前无，建议 v1.0 |
| `plotBlueprint` | `object` | v1.0 | ❌ | 剧情总指挥 | 剧情蓝图(故事类型/角色概览/场景分布) |
| `characterSpecs` | `CharacterSpec[]` | v1.0 | ❌ | 角色设计师 | 角色详细规格 |
| `characterMakeupSpecs` | `MakeupSpec[]` | v1.0 | ❌ | 角色定妆师 | 定妆规格 |
| `sceneSpecs` | `SceneSpec[]` | v1.0 | ❌ | 场景设计师 | 场景详细规格 |
| `voiceConfigs` | `VoiceConfig[]` | v1.0 | ❌ | 声音设计师 | 每个角色的音色配置 |
| `videoSegments` | `VideoSegment[]` | v1.0 | ❌ | 画面设计师 | **最核心字段** — 分镜段落 |
| `frameDesign` | `FrameDesign[]` | v1.0 | ❌ | 画面设计师 | 画面设计规格 |
| `videoProduction` | `object` | v1.0 | ❌ | 画面设计师 | 视频制作参数 |
| `propSpecs` | `PropSpec[]` | v1.0 | ❌ | 道具设计师 | 道具规格 |
| `effectSpecs` | `EffectSpec[]` | v1.0 | ❌ | 镜头/特效师 | 镜头和特效规格 |
| `actionSpecs` | `ActionSpec[]` | v1.0 | ❌ | effectSpecs/plotBlueprint | 动作规格 |
| `cameraSpecs` | `CameraSpec[]` | v1.0 | ❌ | effectSpecs/plotBlueprint | 镜头规格 |
| `emotionSpecs` | `EmotionSpec[]` | v1.0 | ❌ | effectSpecs | 情绪曲线 |
| `storyboardSpecs` | `StoryboardSpec[]` | v1.0 | ❌ | 预留 | 预留字段 |

### 2.2 V3 向后兼容别名

以下字段是 `aigcOrchestrator.ts` 中的运行时扩展，供 V3 旧格式兼容：

| 别名 | 映射到 |
|------|--------|
| `characters` | `characterSpecs` |
| `scenes` | `sceneSpecs` |
| `voices` | `voiceConfigs` |
| `props` | `propSpecs` |
| `effects` | `effectSpecs` |
| `segments` | `videoSegments` |
| `emotionCurve` | `emotionSpecs` |
| `storyArc` | `plotBlueprint` |

**注意:** 别名字段只在 `AigcSpecOutput` 顶层使用，`executionResults` 中的旧数据也可能包含这些。`loadFromServer()` 的 400 行解析逻辑中已有兼容处理。

### 2.3 关键子类型定义

<details>
<summary>CharacterSpec (点击展开)</summary>

```typescript
interface CharacterSpec {
  name: string              // 角色名（中文）
  alias?: string            // 别名
  gender: string            // 性别
  age?: string              // 年龄
  personality?: string      // 性格
  appearance?: string       // 外貌描述
  costume?: string          // 服装描述
  role?: string             // 角色定位（主角/配角）
  voiceType?: string        // 音色类型
  physicalDescription?: string  // 体态描述
}
```
</details>

<details>
<summary>SceneSpec (点击展开)</summary>

```typescript
interface SceneSpec {
  name: string              // 场景名
  description?: string      // 场景描述
  environment?: string      // 环境
  lighting?: string         // 光影
  colorTone?: string        // 色调
  mood?: string             // 氛围
  timeOfDay?: string        // 时间
  weather?: string          // 天气
}
```
</details>

<details>
<summary>VideoSegment (核心)</summary>

```typescript
interface VideoSegment {
  id?: string | number      // 段落 ID
  segmentId?: string        // 别名
  sequence: number          // 段落序号
  title?: string            // 段落标题
  description: string       // 描述文本
  emotion?: string          // 情绪
  camera?: string           // 镜头
  lighting?: string         // 光影
  duration?: string         // 时长
  sceneId?: string          // 关联场景 ID
  characterName?: string    // 关联角色名
  dialogue?: string         // 对白
  location?: string         // 地点
  characterRefs?: string[]  // 角色参考图 URL
  sceneRef?: string         // 场景参考图 URL
  imagePrompt?: string      // 图像 Prompt
  videoPrompt?: string      // 视频 Prompt
}
```
</details>

<details>
<summary>VoiceConfig (点击展开)</summary>

```typescript
interface VoiceConfig {
  characterName: string     // 角色名
  voiceType?: string        // 音色类型
  speed?: number            // 语速
  pitch?: number            // 音高
  emotion?: string          // 默认情绪
}
```
</details>

<details>
<summary>PropSpec (点击展开)</summary>

```typescript
interface PropSpec {
  name: string              // 道具名
  sceneName?: string        // 所属场景
  description?: string      // 描述
  category?: string         // 分类
}
```
</details>

---

## 3. 版本兼容性规则

### 3.1 字段变更

| 操作 | 规则 |
|------|------|
| 新增字段 | 必须 optional (`?`) |
| 删除字段 | 先标记 deprecated（保留字段名，注释说明）至少一个 major 版本 |
| 重命名字段 | 不允许。必须保留旧字段，新增字段 |
| 类型变更 | 不允许。如需变更类型，必须新增字段 |

### 3.2 版本号

当前无 `schemaVersion` 字段。建议 v1.1 时增加：

```typescript
schemaVersion: "1.0"  // 推荐的版本标识
```

### 3.3 消费者无感知规则

所有前端 consumer 必须：
1. 用 `?.` 访问字段（避免 undefined 崩溃）
2. 不假设任何字段存在
3. 对缺失字段提供 fallback UI（"未设定" / "待生成"）

---

## 4. 验证规则

### 4.1 写入前验证（建议 P4-2 实现）

Agent 输出合并为 `AigcSpecOutput` 后，应经过以下验证：
1. **顶层验证**: 至少包含 `characterSpecs`、`sceneSpecs`、`videoSegments` 之一
2. **类型验证**: 数组字段是否为数组，对象字段是否为对象
3. **必填字段**: `VideoSegment.description` 不能为空
4. **关联完整性**: 如果 `videoSegments[i].characterName` 有值，`characterSpecs` 中应有匹配项

### 4.2 拒绝规则

如果验证失败：
1. **记录错误**: 详细日志出哪个 Agent 的哪个字段非法
2. **拒绝保存**: 不写入 executionResults
3. **不阻塞流程**: 返回错误给前端，允许重试

---

## 5. 扩展方式

### 5.1 新增 Agent

1. 在 `AGENTS` 数组中按 DAG 阶段注册
2. 新增 `AigcSpecOutput` 字段
3. 更新 `OWNERSHIP & CONSUMER` 矩阵（见 `WORKFLOW_ARCHITECTURE_V1.md`）
4. 更新 `loadFromServer()` 解析逻辑

### 5.2 新增工作台

1. 确认读取哪个 Agent 输出
2. 从 `store` 获取数据
3. 调用 `POST /api/tasks/ai-generate` 触发 AI 生成
4. 更新依赖图

---

**本文件是 Architecture Freeze 的一部分。Schema 变更需审批。**
