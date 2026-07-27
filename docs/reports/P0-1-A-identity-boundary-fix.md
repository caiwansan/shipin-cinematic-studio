# P0-1-A Identity Boundary Fix Report

## 任务
修复 `admin/enterprise/recruitment.vue` 中 enterprise_id 硬编码 fallback，确保 Single Identity Authority。

## 修改文件
- `frontend/pages/admin/enterprise/recruitment.vue`

## 修改内容

### 1. getEnterpriseId() 返回类型调整

**Before:**
```ts
function getEnterpriseId(): string {
  return route.params.id as string || route.query.id as string || localStorage.getItem('enterprise_id') || '5ba4891a-511f-4620-8862-7dc83f37ea75'
}
```

**After:**
```ts
function getEnterpriseId(): string | null {
  const id = route.params.id as string || route.query.id as string || null
  return id && id.trim() !== '' ? id : null
}
```

### 2. 调用方 null 检查

- `loadRecruitmentData()` — 无 enterpriseId 时设置 `error.value = 'NO_ENTERPRISE_ID：缺少企业身份，请从企业列表选择一家企业后进入'`，不发起请求
- `loadLogs()` — 无 enterpriseId 时直接 return
- `freezeEnterprise()` — 无 enterpriseId 时直接 return
- `unfreezeEnterprise()` — 无 enterpriseId 时直接 return

### 3. 删除内容
- ❌ `localStorage.getItem('enterprise_id')` fallback
- ❌ `'5ba4891a-511f-4620-8862-7dc83f37ea75'` 硬编码 UUID

## 验证结果

| 检查项 | 结果 |
|--------|------|
| `npm run build` | ✅ 通过 |
| 首页 HTTP | ✅ 200 |
| JS 资源 HTTP | ✅ 200 |
| Admin 页面 SSR | ✅ 200 |
| 硬编码 UUID 残留 | ✅ 已清除 |

## 未修改（掌柜指令）
- `workspace/enterprise/onboarding.vue` — 留作 P0-1-B
- 后端 API — 不改
- 其他页面 — 不改

## 状态
✅ 完成，等待下一步指令
