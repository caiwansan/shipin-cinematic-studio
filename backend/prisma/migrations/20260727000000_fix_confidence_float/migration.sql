-- Fix: CandidateSkill.confidence Int → Float
-- 原因：置信度 0.9 被 Int 截断为 0
ALTER TABLE candidate_skill ALTER COLUMN confidence TYPE FLOAT USING confidence::float;
