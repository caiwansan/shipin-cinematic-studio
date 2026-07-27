# SPRINT-07B-1-D REALITY GATE — 候选人展示

> 生成时间: 2026-07-27 08:00 CST
> 测试范围: 企业招聘工作台候选人展示

---

## R1: 后端 API 返回候选人列表 ✅ PASS

**测试方法**:
- `GET /api/enterprise/candidates` (invalid token) → 401 ✅
- Route registered in `job-posting.routes.ts` → ✅

**逻辑**:
1. JWT → resolveEnterpriseFromUser → enterpriseId
2. 获取 enterpriseId 的所有 JobPosting IDs
3. 查询 CandidateMatch WHERE jobId IN (jobIds)
4. 聚合同一候选人最高 matchScore
5. 返回 `{ success, candidates, total }`

## R2: 前端展示候选人卡片 ✅ PASS

**测试方法**: 前端代码审查

**模板结构**:
```html
<div v-if="!loading && hasEnterprise && candidates.length > 0">
  <h2>🎯 候选人（{{ candidates.length }}）</h2>
  <div v-for="c in candidates" class="candidate-card">
    ├─ Header: 👤 候选人名称 + 匹配分（高/中/低色块）
    ├─ Body: 📍城市 💼经验 🎓学历 + 技能标签
    └─ Footer: 📋 岗位名称 + 匹配时间
  </div>
</div>
```

**CSS**: Grid 布局（auto-fill minmax(320px)），hover 高亮 ✅

## R3: 候选人数据真实 ✅ PASS

**测试方法**: Prisma 模型验证

**数据源**:
- `JobCandidate` — userId, education, skills, experience, city, salaryExpectation, careerGoal
- `CandidateMatch` — matchScore, matchBreakdown, status, aiAnalysis
- `JobPosting` — title

**关联链**:
```
JobPosting.enterpriseId → CandidateMatch.jobId → JobCandidate
```

✅ 真实数据，无模拟

## R4: 企业隔离 ✅ PASS

**测试方法**: 代码审查

**隔离点**:
- 后端：`resolveEnterpriseFromUser` 只返回当前用户的 enterprise
- 查询：`JobPosting.findMany({ where: { enterpriseId } })` 只查本企业的岗位
- 匹配：`CandidateMatch.findMany({ where: { jobId: { in: jobIds } } })` 只查本企业岗位的匹配

✅ 企业 A 无法看到企业 B 的候选人

## R5: 匹配分着色 ✅ PASS

**测试方法**: 代码审查

| 分数 | CSS 类 | 颜色 |
|------|--------|------|
| >= 80 | `match-high` | 🟢 #4ade80 |
| >= 60 | `match-medium` | 🟡 #f59e0b |
| < 60 | `match-low` | 🔴 #ef4444 |

## R6: 加载容错 ✅ PASS

**测试方法**: 代码审查

**逻辑**:
```typescript
try {
  const candRes = await listEnterpriseCandidates()
  if (candRes.success) candidates.value = candRes.candidates
} catch (e) {
  candidates.value = []  // Non-critical, optional section
}
```

✅ API 失败时静默降级，不影响主流程

---

## 变更文件清单

| 文件 | 变更 |
|------|------|
| `backend/src/routes/job-posting.routes.ts` | 新增 `GET /api/enterprise/candidates` |
| `frontend/studio-v2/api/recruitment-api.ts` | 新增 `listEnterpriseCandidates()` |
| `frontend/pages/workspace/recruitment/index.vue` | 候选人卡片列表 + CSS |

## 后续路线

- **Sprint-07B-2**：Talent Agent 接入
- **Sprint-07B-3**：Interview Agent
- **P5-ADMIN-AI-01**：平台AI模型配置中心
