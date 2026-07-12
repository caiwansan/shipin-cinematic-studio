-- CreateTable: optimization_tasks for per-task status persistence
CREATE TABLE IF NOT EXISTS "optimization_tasks" (
    "id" SERIAL NOT NULL,
    "project_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "optimization_tasks_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one status per task per project
CREATE UNIQUE INDEX IF NOT EXISTS "optimization_tasks_project_id_task_id_key" 
    ON "optimization_tasks"("project_id", "task_id");
