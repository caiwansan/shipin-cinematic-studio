#!/bin/bash
cd /root/shipin-cinematic-studio/backend

# 1) Replace the duplicate AgentExecution lines (4376-4398) with AgentStepExecution
# 2) Replace the duplicate AgentMemory lines (4412-4427) with AgentContextMemory
# 3) Fix the permissions field conflict in AgentDefinition

# Use perl for these edits
perl -i -0777 -pe '
# Rename the NEW AgentExecution model to AgentStepExecution
s/model AgentExecution \{\n  id             String   \@id \@default\(uuid\(\)\)\n  sessionId      String\n  stepName       String\n  planId         String   \/\/ link to ExecutionPlan\n  executionId    String   \/\/ link to ExecutionRuntime execution\n  capability     String\n  status         String   \/\/ pending, running, completed, failed, skipped\n  input          String\?  \/\/ JSON\n  output         String\?  \/\/ JSON\n  cost           Float\?\n  tokenCount     Int\?\n  latencyMs      Int\?\n  error          String\?\n  startedAt      DateTime\?\n  completedAt    DateTime\?\n  metadata       String\?  \/\/ JSON\n  createdAt      DateTime \@default\(now\(\)\)\n\n  session        AgentSession \@relation\(fields: \[sessionId\], references: \[id\], onDelete: Cascade\)\n\n  \@\@map\("agent_execution"\)\n}/model AgentStepExecution {\n  id             String   @id @default(uuid())\n  sessionId      String\n  stepName       String\n  planId         String   // link to ExecutionPlan\n  executionId    String   // link to ExecutionRuntime execution\n  capability     String\n  status         String   // pending, running, completed, failed, skipped\n  input          String?  // JSON\n  output         String?  // JSON\n  cost           Float?\n  tokenCount     Int?\n  latencyMs      Int?\n  error          String?\n  startedAt      DateTime?\n  completedAt    DateTime?\n  metadata       String?  // JSON\n  createdAt      DateTime @default(now())\n\n  session        AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)\n\n  @@map("agent_step_execution")\n}/g;

# Rename the NEW AgentMemory model to AgentContextMemory
s/model AgentMemory \{\n  id             String   \@id \@default\(uuid\(\)\)\n  sessionId      String\n  type           String   \/\/ shortTerm, workspace, knowledge, summary\n  content        String   \/\/ JSON\n  relevanceScore Float\?\n  ttl            Int\?     \/\/ time-to-live in seconds\n  metadata       String\?  \/\/ JSON\n  createdAt      DateTime \@default\(now\(\)\)\n  expiresAt      DateTime\?\n\n  session        AgentSession \@relation\(fields: \[sessionId\], references: \[id\], onDelete: Cascade\)\n\n  \@\@map\("agent_memory"\)\n}/model AgentContextMemory {\n  id             String   @id @default(uuid())\n  sessionId      String\n  type           String   // shortTerm, workspace, knowledge, summary\n  content        String   // JSON\n  relevanceScore Float?   // 0-1\n  ttl            Int?     // time-to-live in seconds\n  metadata       String?  // JSON\n  createdAt      DateTime @default(now())\n  expiresAt      DateTime?\n\n  session        AgentSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)\n\n  @@map("agent_context_memory")\n}/g;

# Fix AgentDefinition - rename the relation field from "permissions" to "agentPermissions"
# The model has: permissions String? and permissions AgentPermission[]
s/(  queues          AgentQueue\[\]\n\n  )permissions(     AgentPermission\[\])/$1agentPerms$2/g;
' prisma/schema.prisma

echo "Done fixing"
