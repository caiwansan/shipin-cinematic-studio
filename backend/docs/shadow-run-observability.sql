# ============================================================
# Stage 3.2 — Shadow Run Observability
# 实时对账 SQL + 核心指标指标
# ============================================================

## 1️⃣ mismatch rate — Project 双写一致性
-- DUAL_WRITE_PROJECT 激活后，新 Project 字段与旧表是否一致
-- 目标是 0
SELECT
  COUNT(*)                                                           AS total_projects,
  COUNT(*) FILTER (WHERE "type" IS NULL OR "tenantId" IS NULL)      AS null_field_count,
  ROUND(
    COUNT(*) FILTER (WHERE "type" IS NULL OR "tenantId" IS NULL)
    * 100.0 / GREATEST(COUNT(*), 1), 2
  )                                                                 AS null_field_rate_pct
FROM "Project";

## 2️⃣ mismatch rate — GeoProfile 1:1
SELECT
  COUNT(*)                                         AS geo_projects,
  COUNT(*) FILTER (WHERE p2.id IS NULL)            AS missing_profiles,
  ROUND(
    COUNT(*) FILTER (WHERE p2.id IS NULL)
    * 100.0 / GREATEST(COUNT(*), 1), 2
  )                                                AS missing_profile_rate_pct
FROM "Project" p1
LEFT JOIN kmki_geo_project_profiles p2
  ON p1.id = p2."projectId" AND p1.id::text = p2."projectId"::text
WHERE p1.type = 'geo';

## 3️⃣ write latency delta — 双写耗时（来自 Watcher）
-- 在 WatcherReport 中自动记录
-- avgLatencyMs < 100ms 为目标
SELECT avgLatencyMs FROM (
  SELECT
    AVG(latency_ms) AS avgLatencyMs
  FROM (
    -- 从 DualWriteManager.getReport() 获取
    -- 或者从 dual_write_watcher 表读取
    SELECT
      (data->>'latencyMs')::numeric AS latency_ms
    FROM watcher_events
    WHERE event_type = 'DualWriteSync'
      AND created_at > NOW() - INTERVAL '1 hour'
  ) t
) t2;

## 4️⃣ hook drop rate
-- 通过对比 watcher 记录数 vs 实际业务写操作数
-- Hook 未触发的比例应为 0%
SELECT
  total_writes,
  hook_triggered,
  total_writes - hook_triggered AS dropped,
  ROUND(
    (total_writes - hook_triggered) * 100.0 / GREATEST(total_writes, 1), 2
  ) AS drop_rate_pct
FROM (
  SELECT
    (SELECT COUNT(*) FROM "Project") AS total_writes,
    (SELECT COUNT(*) FROM watcher_events WHERE event_type = 'DualWriteSync' AND success = true) AS hook_triggered
) t;

## 5️⃣ retry pressure — 失败重试率
-- retry_count 来自 watcher 的失败记录
SELECT
  COUNT(*) FILTER (WHERE success = false)          AS sync_failures,
  COUNT(*)                                          AS total_syncs,
  ROUND(
    COUNT(*) FILTER (WHERE success = false)
    * 100.0 / GREATEST(COUNT(*), 1), 2
  )                                                 AS failure_rate_pct
FROM watcher_events
WHERE event_type = 'DualWriteSync'
  AND created_at > NOW() - INTERVAL '24 hours';

## 6️⃣ consistency drift trend (最重要)
-- 按天汇总 drift，看是否随时间增加
-- 趋势斜率 ≈ 0 才安全
SELECT
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) FILTER (WHERE success = false) AS failures,
  COUNT(*) AS total_syncs,
  COUNT(*) FILTER (WHERE mismatch IS TRUE) AS mismatches,
  ROUND(
    COUNT(*) FILTER (WHERE mismatch IS TRUE) * 100.0 / GREATEST(COUNT(*), 1), 4
  ) AS mismatch_rate_pct
FROM watcher_events
WHERE event_type = 'DualWriteSync'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

---

## watcher_events 表结构（建议创建）
-- 如果当前没有持久化 watcher 事件，建议创建一张轻量表：
CREATE TABLE IF NOT EXISTS watcher_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  success BOOLEAN,
  mismatch BOOLEAN DEFAULT false,
  latency_ms INTEGER DEFAULT 0,
  error TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_watcher_events_type_created
  ON watcher_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_watcher_events_success
  ON watcher_events (success, created_at DESC);
