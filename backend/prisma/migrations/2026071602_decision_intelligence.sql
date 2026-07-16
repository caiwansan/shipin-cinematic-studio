-- Sprint 4.2.2 — Decision Intelligence v1
-- CTO Confirmed: 2026-07-15
-- 增强 enterprise_recommendation 表

ALTER TABLE enterprise_recommendation
    ADD COLUMN priority_score INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN priority_level VARCHAR(10),
    ADD COLUMN impact INTEGER,
    ADD COLUMN urgency INTEGER,
    ADD COLUMN confidence INTEGER,
    ADD COLUMN decision_status VARCHAR(20) NOT NULL DEFAULT 'detected',
    ADD COLUMN evidence_graph JSONB DEFAULT '[]';

CREATE INDEX idx_rec_tenant_decision_status ON enterprise_recommendation (tenant_id, decision_status);
CREATE INDEX idx_rec_tenant_priority_score ON enterprise_recommendation (tenant_id, priority_score DESC);

-- 回填已有数据（默认值）
UPDATE enterprise_recommendation SET priority_level = 'P3' WHERE priority_score < 40;
UPDATE enterprise_recommendation SET priority_level = 'P2' WHERE priority_score >= 40 AND priority_score < 70;
UPDATE enterprise_recommendation SET priority_level = 'P1' WHERE priority_score >= 70;
