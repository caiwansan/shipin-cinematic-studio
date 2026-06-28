# 角色定妆图审计报告

**日期**: 2026-06-23  
**审计范围**: 四视定妆图生成 → 入库 → 加载 → 展示 全链路  
**数据取证项目**: 7e4d55cf-e70e-46bb-bf93-f326a928fd48（"战狼"）

---

## 一、问题总览

| 问题 # | 严重度 | 描述 |
|--------|--------|------|
| P0 | 🔴 高 | **四视定妆图中大头照（portrait）被大模型输出为正面全身** |
| P1 | 🔴 高 | **角色图生成后，合并图（makeup variant）未正确入库覆盖旧数据** |
| P2 | 🟡 中 | **未上传参考图的角色大头照仍以图生图模式运行，seed 固定的参考图会带偏构图** |
| P3 | 🟡 中 | **单张视图（full_front/side/back）使用临时火山引擎链接，未持久化到 COS** |
| P4 | 🟠 低 | **useStudioStore.ts 前端角色对象缺少 `frontUrl` 字段映射（已修复）** |
| P5 | 🔵 信息 | **多次生成时旧 variant 空串记录与新 makeup 记录相互干扰** |

---

## 二、问题详情

### P0: 大头照被大模型输出为正面全身照

**症状**: 用户描述"大头照没有了，变成了两张正面照"  
**触发路径**: `execution-images.ts` 第 328 行 + `character-pipeline.ts` 第 108 行

**根因**: 大头照（portrait）生成时传了用户上传的参考图（`userRefImage`）做图生图。  
Seedream / 通义万相 等模型在 `img2img` 模式下会优先保持参考图的构图（全身/半身）和整体风格，导致 `extreme close-up portrait, face only, headshot from shoulders up` 等 prompt 约束被模型忽略，最终输出的是正面全身照而非大头特写。

**代码位置**:
- `execution-images.ts:328` — `portraitUrl = submitImageTask(portraitPromptStr, portraitNegative, ..., userRefImage)`
- `character-pipeline.ts:108` — `{ referenceImage: userRefImage, referenceImages: ... }`

**数据取证**: "战狼"项目中 2026-06-23 生成的记录只有 `portrait(sortOrder=10)`、`side(11)`、`back(12)`，缺少 `full_front(2)`。但 `portrait` variant 存储的 URL 是 volces 临时链接（火山引擎），说明该次生成确实走了 portrait 路径，但输出不是大头照。

---

### P1: 合并图（makeup variant）未正确入库覆盖

**症状**: 刷新页面后角色定妆图卡片显示旧图或空白  
**触发路径**: `execution-images.ts` 第 370-450 行（合并裁剪）+ 第 534-540 行（入库）

**根因**: 这是一个**级联失败**。

1. **大头照输出为全身照** (P0) → 合并图生成时 `portraitImageUrl` 存了全身照 URL  
2. `viewUrls` = `[portraitUrl, frontUrl, sideUrl, backUrl]` — 但 `frontUrl` 也可能为空  
3. `generateDynamicViewCharacterSheet` 合并器收到 `frontImageUrl = ''` → 尝试下载空 URL → **下载异常**  
4. 合并器 `mergeImagesWithPillow` 的 `Promise.all(downloadPromises)` 中若有失败 → 合并图整体失败  
5. `catch (e)` → `imageUrl = viewUrls[0]` — 回退到 viewUrls 第一张  
6. 但**更严重的是** viewUrls 第一张 == portrait（已被大模型输出为全身照），所以最终入库的 `makeup` variant 存的是**正面全身照代替了大头照**，覆盖了旧合并图

**结论**: 合并图要么完全失败（不走入库），要么入库了一个错误的内容（大头照=正脸），导致刷新后角色图卡片内容混乱。

---

### P2: 未上传参考图的角色仍走图生图

**触发路径**: `CharacterWorkspace.vue` 第 599 行

```ts
const refUrl = refImageUrls[chId] || charImages[chId] || ch.imageUrl || ''
// ...
if (refUrl) {
  body.referenceImage = refUrl
  body.mode = 'img2img'
}
```

**问题**: 如果 `charImages[chId]` 或 `ch.imageUrl` 是非空值（之前生成的旧图），即使**用户没有上传参考图**，系统也会把旧图作为参考图传给后端，导致 `body.referenceImage` 有值。后端收到后，四张图的全部分支都会走 `img2img`，导致构图被旧图带偏。

**数据取证**: `refUrl` 不是用户主动上传标记（如上传组件的图），而是从之前生成的结果自动回填。这意味着"无参考图"和"有参考图但用旧图"之间没有区分。

---

### P3: 单张视图用火山引擎临时链接

**症状**: `portrait/side/back` 三个 variant 存储的 URL 是 `https://ark-acg-cn-beijing.tos-cn-beijing.volces.com/...`  
**问题**: 火山引擎的临时预签名 URL 有时效性（通常 1 小时），超过后图片不可访问。  
**代码位置**: `execution-images.ts` 第 583 行 `downloadAndUpload` 只对 `front` 视图做了 COS 上传（第 568 行），对 `portrait/side/back` 直接存了原始 URL。

```ts
// 仅 full_front 做了 COS 持久化
if (tripleView && resolvedFront) {
    const frontResult = await downloadAndUpload(resolvedFront, ...)
    frontImgUrl = frontResult.cosUrl || ...
}
// portrait/side/back 直接 upsert 了 resolvedPortrait/resolvedSide/resolvedBack
```

**影响**: 部分视图短期内（几小时后）就会 404，刷新页面后角色图卡片部分格子显示裂图。

---

### P4: 前端角色对象缺 `frontUrl` 字段（已修复）

**症状**: 四视图的正面全身格（第②格）刷新后不显示  
**根因**: `useStudioStore.ts` 第 649 行构建角色对象时漏了 `frontUrl: urls.frontUrl`  
**修复**: 已补上（本次审计前修复）

---

### P5: 旧 variant 空串记录干扰

**数据取证**:

```
姜灼 | ''       | sortOrder=0 | 06-18 11:49  — 旧单张图（空variant）
姜灼 | makeup   | sortOrder=0 | 06-18 11:50  — 合并图
姜灼 | face_ref | sortOrder=1 | ...
姜灼 | full_front | sortOrder=2 | ...
姜灼 | portrait | sortOrder=10 | 06-23 09:51  — volces临时链接
姜灼 | side     | sortOrder=11 | 06-23 09:51  — volces临时链接
姜灼 | back     | sortOrder=12 | 06-23 09:51  — volces临时链接
```

`variant` 字段有值为 `''`（空字符串）的旧记录，`sortOrder` 也为 0，与 `makeup` 相同。  
前端 `useStudioStore.ts` 第 633 行的遍历逻辑中空串 variant 走到 `else if (!existing.imageUrl)` 分支，如果其出现顺序在 `makeup` 之前，会被 `makeup` 正确覆盖。但如果数据库相同 sortOrder 的返回顺序不稳定，可能导致短暂的数据错乱。

---

## 三、数据库表格审计

### character_images 表

```sql
                Table "public.character_images"
    Column     |     Type      | 约束
---------------+---------------+------------------
 id            | uuid          | PK
 projectId     | uuid          | FK → Project(id), NOT NULL
 characterName | text          | NOT NULL
 variant       | text          | NOT NULL DEFAULT ''  ⚠️ 允许空串
 imageUrl      | text          | NOT NULL
 sortOrder     | integer       | NOT NULL DEFAULT 0
 createdAt     | timestamp     | NOT NULL DEFAULT CURRENT_TIMESTAMP

Indexes:
  UNIQUE (projectId, characterName, variant)  ← 唯一约束定义良好
  (variant) — btree
```

**发现的问题**: `variant` 默认值为空字符串 `''`，但 `sortOrder` 也默认为 0。  
多处代码允许生成 `variant=''` 的记录（空串兜底分支），与 `makeup` 处于同一个 `sortOrder` 层级。唯一约束 `(projectId, characterName, variant)` 确保了每个角色每个 variant 只有一条记录，但空串 variant 存在一条旧单张图，语义不明确。

---

## 四、修复建议

### 修复 1（P0）— 大头照不传参考图

**位置**: `execution-images.ts:328` / `character-pipeline.ts:108`

**建议**: 大头照（portrait）生成时 `referenceImage` 改为 `undefined`。大头照只需要面部特写，文生图 + 强 negative 约束足够，不需要参考图。  
**风险**: 用户上传的参考图无法影响大头照的面貌一致性，但正脸（front）仍保留参考图，侧脸（side）用正脸结果链式传递。

### 修复 2（P1）— 合并图生成前置校验

**位置**: `four-view-merger.ts` 第 250-275 行（`generateDynamicViewCharacterSheet`）

**建议**: 合并前校验 `input.portraitImageUrl`、`input.frontImageUrl`、`input.sideImageUrl`、`input.backImageUrl` 是否有效。若有空值，在 Python 合并脚本中跳过对应格，不在 2×2 网格中输出空白格。或者**判定有效视图 ≥ 3 张再合并**，否则回退到单张模式。

### 修复 3（P2）— 区分用户主动上传的参考图和自动回填的旧图

**位置**: `CharacterWorkspace.vue` 第 599 行

**建议**: `refUrl` 不自动从 `charImages[chId]` 或 `ch.imageUrl` 回填。只有用户通过上传组件选择了图片后，才设置 `refUrl`。或者新增一个 `hasUserUploadedRef` 布尔标记。

### 修复 4（P3）— 所有视图单独做 COS 持久化

**位置**: `execution-images.ts` 第 578-663 行

**建议**: `portrait`、`side`、`back` 三个 variant 在入库前也调用 `downloadAndUpload` 上传到 COS，避免使用火山引擎临时链接。目前只有 `full_front` 做了 COS 上传。

### 修复 5（P5）— 清理空串 variant 旧数据

**位置**: 数据库

**建议**:
```sql
-- 清理所有 variant='' 且存在 makeup 记录的冗余旧数据
DELETE FROM character_images ci1
WHERE ci1.variant = ''
AND EXISTS (
  SELECT 1 FROM character_images ci2
  WHERE ci2."projectId" = ci1."projectId"
    AND ci2."characterName" = ci1."characterName"
    AND ci2.variant = 'makeup'
);
```

---

## 五、问题关联图

```
用户选择用户上传的参考图
  │
  ▼
referenceImage → body.referenceImage → userRefImage
  │
  ├── P2: 如果用户没上传，但旧图存在，也走了图生图
  │
  ├── portrait (seed, userRefImage)  ← P0: 大头照被带偏成全身照
  ├── front (seed+1, userRefImage)   ← ✓ 正常 (但 P3: 链接短期有效)
  ├── side (seed+2, frontUrl)        ← ✓ 链式参考
  └── back (seed+3, undefined)       ← ✓ 纯文生图
  │
  ▼
viewUrls = [portrait(A), front(B), side(C), back(D)]
  │
  ▼
四视图合并器 generateDynamicViewCharacterSheet
  ├── portraitImageUrl = A (=全身照而非大头) → P0 污染
  ├── frontImageUrl = B (=空或全身)          → 可能为空 → P1
  ├── sideImageUrl = C
  └── backImageUrl = D
  │
  ▼
合并图生成失败或生成错误合并图 → 不入库/入库错误 → P1
  │
  ▼
刷新页面 → loadFromServer → characterImages → 
  └── useStudioStore.ts (原缺失 frontUrl → 已修复 P4)
      └── CharacterWorkspace.vue 显示混乱

```

---

## 六、综合优先级

| 优先级 | 修复项 | 工作量 | 影响范围 |
|--------|--------|--------|----------|
| P0+P1 | 大头照不传参考图 + 合并图前置校验 | 小（改3行+加校验） | 所有角色四视图生成 |
| P3 | 视图 COS 持久化 | 中（加3次 downloadAndUpload） | 图片长期可用性 |
| P2 | 区分用户主动上传/自动回填 | 中（前端逻辑调整） | 无参考图用户的生成质量 |
| P5 | 清理空串旧数据 | 小（SQL） | 数据库整洁度 |
