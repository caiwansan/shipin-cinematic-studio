ALTER TABLE optimization_executions ADD COLUMN IF NOT EXISTS items_created INTEGER;
ALTER TABLE optimization_executions ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE optimization_executions ADD COLUMN IF NOT EXISTS error_message TEXT;
