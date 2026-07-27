-- ============================================================
-- P0-3 Identity Recovery Sprint — Migration SQL
-- ============================================================
-- Generated: 2026-07-17
-- CTO Approval: Architecture Recovery
-- 
-- 冻结 Organization 新模型，采用 governance_organization 为唯一事实源
-- ============================================================

BEGIN;

-- ━━━ P0-3-03: 修复 enterprise_profile 数据错误 ━━━

-- 当前 enterprise_profile 有一条 organization_id 指向 User ID 而非 Organization ID
-- 需要先找到正确的 Organization ID
-- （该 Profile 属于 test_auth 用户，对应 Organization: 2adf05ef-cafb-4d8e-8b1c-9a7f4994d86f）
UPDATE enterprise_profile
SET organization_id = '2adf05ef-cafb-4d8e-8b1c-9a7f4994d86f'
WHERE id = 'ff294466-03a3-41cb-adb8-40bc34c3c3ac'
  AND organization_id = '6e476e6a-2495-41ca-b618-4e94e9ffa856';

-- ━━━ P0-3-04: 给 15 张空表增加 organization_id ━━━
-- 全部为空表，无数据迁移风险

-- 1. enterprise_action
ALTER TABLE enterprise_action 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 2. enterprise_signal
ALTER TABLE enterprise_signal 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 3. enterprise_knowledge
ALTER TABLE enterprise_knowledge 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 4. enterprise_command
ALTER TABLE enterprise_command 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 5. enterprise_recommendation
ALTER TABLE enterprise_recommendation 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 6. enterprise_roi_snapshot
ALTER TABLE enterprise_roi_snapshot 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 7. enterprise_operation_event
ALTER TABLE enterprise_operation_event 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 8. agent_context_memory
ALTER TABLE agent_context_memory 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 9. agent_goal
ALTER TABLE agent_goal 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 10. agent_session
ALTER TABLE agent_session 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 11. agent_step_execution
ALTER TABLE agent_step_execution 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 12. agent_artifact
ALTER TABLE agent_artifact 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 13. agent_event
ALTER TABLE agent_event 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 14. agent_schedule
ALTER TABLE agent_schedule 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- 15. agent_queue
ALTER TABLE agent_queue 
  ADD COLUMN IF NOT EXISTS organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- ━━━ 添加外键约束 ━━━
-- 所有表均引用 governance_organization（Source of Truth）

ALTER TABLE enterprise_action 
  ADD CONSTRAINT fk_enterprise_action_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE enterprise_signal 
  ADD CONSTRAINT fk_enterprise_signal_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE enterprise_knowledge 
  ADD CONSTRAINT fk_enterprise_knowledge_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE enterprise_command 
  ADD CONSTRAINT fk_enterprise_command_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE enterprise_recommendation 
  ADD CONSTRAINT fk_enterprise_recommendation_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE enterprise_roi_snapshot 
  ADD CONSTRAINT fk_enterprise_roi_snapshot_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE enterprise_operation_event 
  ADD CONSTRAINT fk_enterprise_operation_event_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE agent_context_memory 
  ADD CONSTRAINT fk_agent_context_memory_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE agent_goal 
  ADD CONSTRAINT fk_agent_goal_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE agent_session 
  ADD CONSTRAINT fk_agent_session_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE agent_step_execution 
  ADD CONSTRAINT fk_agent_step_execution_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE agent_artifact 
  ADD CONSTRAINT fk_agent_artifact_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE agent_event 
  ADD CONSTRAINT fk_agent_event_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE agent_schedule 
  ADD CONSTRAINT fk_agent_schedule_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

ALTER TABLE agent_queue 
  ADD CONSTRAINT fk_agent_queue_org 
  FOREIGN KEY (organization_id) REFERENCES governance_organization(id);

-- ━━━ 创建索引以优化查询性能 ━━━
CREATE INDEX IF NOT EXISTS idx_enterprise_action_org ON enterprise_action(organization_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_signal_org ON enterprise_signal(organization_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_knowledge_org ON enterprise_knowledge(organization_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_command_org ON enterprise_command(organization_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_recommendation_org ON enterprise_recommendation(organization_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_roi_snapshot_org ON enterprise_roi_snapshot(organization_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_operation_event_org ON enterprise_operation_event(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_context_memory_org ON agent_context_memory(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_goal_org ON agent_goal(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_session_org ON agent_session(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_step_execution_org ON agent_step_execution(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_artifact_org ON agent_artifact(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_event_org ON agent_event(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_schedule_org ON agent_schedule(organization_id);
CREATE INDEX IF NOT EXISTS idx_agent_queue_org ON agent_queue(organization_id);

COMMIT;
