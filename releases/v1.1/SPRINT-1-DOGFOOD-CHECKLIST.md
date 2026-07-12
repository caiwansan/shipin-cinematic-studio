# Sprint 1 — Dogfood 验收清单

所有验收项目必须可通过自动脚本或 Dogfood 手动验证。不应有模糊/主观描述。

---

## A. 数据模型验收 (Backend)

### A1. MissionDecision 接口存在且完整

```bash
# 验证新接口文件存在
test -f backend/src/services/geo/domain/mission-decision.ts && echo "✅ PASS" || echo "❌ FAIL"

# 验证所有关键类型导出
grep -q "export interface MissionDecision" backend/src/services/geo/domain/mission-decision.ts && echo "✅ PASS" || echo "❌ FAIL mission-decision.ts"
grep -q "export interface DecisionEvidence" backend/src/services/geo/domain/mission-decision.ts && echo "✅ PASS" || echo "❌ FAIL"
grep -q "export interface TriggeredRule" backend/src/services/geo/domain/mission-decision.ts && echo "✅ PASS" || echo "❌ FAIL"
grep -q "export interface ThresholdDecision" backend/src/services/geo/domain/mission-decision.ts && echo "✅ PASS" || echo "❌ FAIL"
grep -q "export interface ScoreImpactBreakdown" backend/src/services/geo/domain/mission-decision.ts && echo "✅ PASS" || echo "❌ FAIL"

# 验证 evidence[] / triggeredRules[] / thresholds[] / scoreImpact / confidence / reasoning / generatedAt 字段
for field in evidence triggeredRules thresholds scoreImpact confidence reasoning generatedAt; do
  grep -q "  $field" backend/src/services/geo/domain/mission-decision.ts && echo "✅ field $field exists" || echo "❌ field $field MISSING"
done
```

### A2. MissionExplainProvider 存在且注册

```bash
# 验证 provider 文件存在
test -f backend/src/services/geo/explain/providers/mission.provider.ts && echo "✅ PASS" || echo "❌ FAIL"

# 验证 provider 已注册
grep -q "mission.provider" backend/src/services/geo/explain/registry.ts && echo "✅ PASS" || echo "❌ FAIL"

# 验证 canHandle 逻辑
grep -q "canHandle.*mission" backend/src/services/geo/explain/providers/mission.provider.ts && echo "✅ PASS" || echo "❌ FAIL"
```

### A3. TypeScript 编译通过

```bash
# 从 backend 根目录执行 TypeScript 类型检查
cd backend && npx tsc --noEmit 2>&1 | grep -q "error TS" && echo "❌ FAIL (TS errors)" || echo "✅ PASS (no TS errors)"
```

---

## B. API 验收

### B1. 新增 Explain 路由

```bash
# 验证路由文件中包含 explain endpoint
grep -q "missions/:id/explain" backend/src/services/geo/mission-engine/routes.ts && echo "✅ PASS" || echo "❌ FAIL"

# 验证路由注册正确（Fastify GET）
grep -q "fastify.get.*missions/:id/explain" backend/src/services/geo/mission-engine/routes.ts && echo "✅ PASS" || echo "❌ FAIL"
```

### B2. API 端点可访问

```bash
# (需要后端运行) 调用 explain API 并验证 200 或 400 响应
# 400 也 OK（brandId required 说明路由已注册）
# 记得替换为真实 brandId
# STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:PORT/api/geo/missions/nonexistent/explain?brandId=test")
# echo "HTTP $STATUS"
# [ "$STATUS" != "404" ] && echo "✅ PASS" || echo "❌ FAIL"
```

Dogfood 操作: 在浏览器中访问 `http://localhost:PORT/api/geo/missions/{real-mission-id}/explain?brandId={real-brand-id}`，确认返回 200 JSON。

### B3. Response 结构验证

Dogfood 操作: 调用成功 explain API 后，验证返回 JSON 包含以下字段：

```
✓ success === true
✓ data.missionId (string)
✓ data.title (string)
✓ data.summary (string)
✓ data.confidence (number, 0-100)
✓ data.score (number, 0-100)
✓ data.scoreImpact (object)
  ✓ dimension (string)
  ✓ currentScore (number)
  ✓ expectedScore (number)
  ✓ delta (number)
  ✓ factors (array)
✓ data.evidence (array)
  ✓ evidence[0].id (string)
  ✓ evidence[0].polarity (string: "positive" | "negative")
✓ data.triggeredRules (array)
  ✓ triggeredRules[0].ruleId (string)
  ✓ triggeredRules[0].satisfied (boolean)
✓ data.thresholds (array)
  ✓ thresholds[0].passed (boolean)
✓ data.reasoning (string)
✓ data.generatedAt (string, ISO 8601 date)
✓ data.version (string)
```

### B4. Error 处理

```bash
# Missing brandId → 400
curl -s "http://localhost:PORT/api/geo/missions/test/explain" | jq '.success == false and .code == "MISSING_PARAM"' | grep -q true && echo "✅ PASS" || echo "❌ FAIL"

# Non-existent mission → 404
curl -s "http://localhost:PORT/api/geo/missions/nonexistent/explain?brandId=test" | jq '.success == false and .code == "MISSION_NOT_FOUND"' | grep -q true && echo "✅ PASS" || echo "❌ FAIL"
```

---

## C. Explain Drawer 验收

### C1. 组件文件存在

```bash
# 新增子组件
for comp in GeoExplainDrawerMission GeoExplainDrawerDecisionChain GeoExplainDrawerEvidenceList GeoExplainDrawerRules; do
  test -f "frontend/workspaces/geo/components/GeoExplainDrawer/${comp}.vue" && echo "✅ $comp exists" || echo "❌ $comp MISSING"
done
```

### C2. GeoExplainDrawer 支持双模式

```bash
# 验证 props 包含 mode
grep -q "mode" frontend/workspaces/geo/components/GeoExplainDrawer/index.vue && echo "✅ PASS" || echo "❌ FAIL"

# 验证支持 mission mode 渲染
grep -q "missionDecision" frontend/workspaces/geo/components/GeoExplainDrawer/index.vue && echo "✅ PASS" || echo "❌ FAIL"

# 验证向后兼容：未传 missionDecision 时仍可使用原有的 explain
grep -q "GeoExplainCard" frontend/workspaces/geo/components/GeoExplainDrawer/index.vue && echo "✅ PASS" || echo "❌ FAIL"
```

### C3. Drawer 功能验收 (Dogfood)

在任一 GEO 页面（Dashboard Mission Control 或任何已有 Explain Button 的页面）操作：

1. ✅ 点击 Mission 的 Explain 按钮 → 加载状态 → Drawer 打开
2. ✅ Drawer 显示 "Mission Explain" 标题
3. ✅ 显示决策摘要 (summary)
4. ✅ 显示 Score + Confidence
5. ✅ 显示评分影响分解 (Score Impact: current → expected + delta)
6. ✅ 显示 Evidence 列表，按 polarity 分组
7. ✅ 显示 Triggered Rules 列表
8. ✅ 显示 Thresholds 判定
9. ✅ 显示 Reasoning 自然语言推理
10. ✅ 关闭按钮可关闭 Drawer
11. ✅ 点击 overlay 也可关闭 Drawer
12. ✅ Drawer 宽度 420px (与现有 GeoExplainDrawer 一致)
13. ✅ 通用 Explain 模式仍然正常工作（非 mission 场景不受影响）

---

## D. Mission Card 升级验收

### D1. MissionCard 显示 Explain 按钮

```bash
# 验证 MissionCard 组件包含 explain emit
grep -q "explain:" frontend/workspaces/geo/components/MissionCard.vue && echo "✅ PASS" || echo "❌ FAIL"

# 验证模板包含 explain 按钮
grep -q "GeoExplainButton" frontend/workspaces/geo/components/MissionCard.vue && echo "✅ PASS" || echo "❌ FAIL"
```

### D2. Evidence 摘要展开 (Dogfood)

1. ✅ 在 Mission Card 下方能看到 Explain 按钮 (ⓘ)
2. ✅ 点击后 Evidence 摘要区域展开在卡片内
3. ✅ 摘要区域显示证据项目（polarity 标签 + label）
4. ✅ 存在 "查看完整决策链 →" 链接
5. ✅ 点击该链接打开 Explain Drawer
6. ✅ 原有 "why" 折叠功能不受影响

### D3. 旧功能不受影响 (Dogfood)

1. ✅ Mission Card 的 action button 仍然正常工作
2. ✅ skip button 正常
3. ✅ status bar 显示正确
4. ✅ "为什么要做" 折叠正常
5. ✅ impact 列表正常显示
6. ✅ 时间 + 难度标签正常
7. ✅ pending/completed/skipped/in_progress 四种状态样式正确

---

## E. 前端编译验收

```bash
# 验证 Geo workspace TypeScript 编译无错误
cd frontend && npx vue-tsc --noEmit 2>&1 | grep -q "error TS" && echo "❌ FAIL (TS errors)" || echo "✅ PASS (no TS errors)"

# 验证 Vite 构建可以通过
cd frontend && npx vite build --mode production 2>&1 | tail -5
```

---

## F. 前端服务层验收

```bash
# 验证 missionService.ts 包含 fetchMissionExplain
grep -q "fetchMissionExplain" frontend/workspaces/geo/services/missionService.ts && echo "✅ PASS" || echo "❌ FAIL"
grep -q "missions.*explain" frontend/workspaces/geo/services/missionService.ts && echo "✅ PASS" || echo "❌ FAIL"

# 验证 mission-decision 类型文件存在
test -f frontend/workspaces/geo/types/mission-decision.ts && echo "✅ PASS" || echo "❌ FAIL"
```

---

## G. 架构/文档验收

```bash
# 验证所有 4 个设计文档存在
for doc in \
  "releases/v1.1/SPRINT-1-mission-explainability.md" \
  "releases/v1.1/SPRINT-1-BACKEND-API-CONTRACT.md" \
  "releases/v1.1/SPRINT-1-DOGFOOD-CHECKLIST.md" \
  "releases/v1.1/SPRINT-1-FRONTEND-DESIGN.md"; do
  test -f "$doc" && echo "✅ $doc exists" || echo "❌ $doc MISSING"
done
```

---

## H. 回归测试

| # | 验收项 | 验证方式 |
|---|--------|---------|
| H1 | Dashboard Mission Control 页面加载正常 | Dogfood |
| H2 | Mission 列表渲染正常 | Dogfood |
| H3 | 完成/跳过 Mission 功能正常 | Dogfood |
| H4 | Mission Center 状态统计正常 | Dogfood |
| H5 | 通用 Explain（Discovery/Verification/Publishing 等）不受影响 | Dogfood: 在原有 Explain 位置点击，确认仍显示通用 Explain 面板而非 Mission 面板 |
