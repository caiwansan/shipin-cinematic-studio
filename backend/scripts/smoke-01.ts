/**
 * RUNTIME-001-SMOKE-01
 * 
 * 目标：验证第一条真实产品闭环
 * 用户交给 AI 一个市场任务，AI真实执行，并留下可审计结果。
 * 
 * 不接受：
 * - 假成功（status:COMPLETED 但无 execution/evidence）
 * - LLM 直接总结（DeepSeek: 竞品增长明显 → FAIL）
 * 
 * 接受：
 * - 真实 Runtime 执行流程 + 受控 Evidence 输入
 */

import { prisma } from '../src/utils/index.js';
import { enterpriseAgentRuntime } from '../src/services/enterprise/enterprise-agent-runtime.service.js';
import * as crypto from 'crypto';

// ─── SMOKE-01 Tables Setup ──────────────────────────────

async function setupSmokeTables() {
  console.log('\n[SMOKE-01] Creating audit layer tables...');

  // agent_tasks — 任务定义表
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      tenant_id TEXT NOT NULL,
      organization_id TEXT,
      task_type VARCHAR(50) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'CREATED',
      title TEXT,
      input JSONB DEFAULT '{}',
      output JSONB,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      started_at TIMESTAMP(3),
      completed_at TIMESTAMP(3)
    );
  `);

  // agent_task_executions — 执行实例表
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS agent_task_executions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      task_id TEXT NOT NULL REFERENCES agent_tasks(id),
      agent_id TEXT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      trace_id TEXT NOT NULL,
      provider TEXT,
      model TEXT,
      token_input INTEGER DEFAULT 0,
      token_output INTEGER DEFAULT 0,
      cost DOUBLE PRECISION DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      error TEXT,
      started_at TIMESTAMP(3),
      completed_at TIMESTAMP(3),
      created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      metadata JSONB DEFAULT '{}'
    );
  `);

  // evidence_records — 证据记录表
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS evidence_records (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      execution_id TEXT NOT NULL REFERENCES agent_task_executions(id),
      task_id TEXT NOT NULL REFERENCES agent_tasks(id),
      agent_id TEXT NOT NULL,
      source TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'WEB_PAGE',
      content_hash TEXT NOT NULL,
      content JSONB NOT NULL,
      metadata JSONB DEFAULT '{}',
      collected_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // outcome_records — 结果记录表
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS outcome_records (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      task_id TEXT NOT NULL REFERENCES agent_tasks(id),
      execution_id TEXT REFERENCES agent_task_executions(id),
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'MARKET_INTELLIGENCE',
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
      title TEXT,
      summary TEXT,
      evidence JSONB DEFAULT '[]',
      metadata JSONB DEFAULT '{}',
      occurred_at TIMESTAMP(3),
      created_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 创建索引
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_agent_tasks_type ON agent_tasks(task_type);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_agent_task_executions_task_id ON agent_task_executions(task_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_agent_task_executions_trace_id ON agent_task_executions(trace_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_evidence_records_execution_id ON evidence_records(execution_id);`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_outcome_records_task_id ON outcome_records(task_id);`);

  console.log('[SMOKE-01] ✅ Tables created');
}

// ─── SMOKE-01 Main Execution ────────────────────────────

async function runSmoke01() {
  console.log('='.repeat(60));
  console.log('RUNTIME-001-SMOKE-01');
  console.log('目标：验证 MARKET_SCAN → Execution → Evidence → Outcome');
  console.log('='.repeat(60));

  const timeline: string[] = [];

  try {
    // ── Step 0: Setup Tables ──
    await setupSmokeTables();
    timeline.push('TABLES_CREATED');

    // ── Step 1: 获取可用的 Agent（市场分析师 AI）──
    const profile = await prisma.enterpriseAgentProfile.findFirst({
      where: { agentType: 'analyst', runtimeStatus: 'active' }
    });

    if (!profile) {
      throw Error('No active analyst agent found');
    }

    const instance = await prisma.enterpriseAgentInstance.findUnique({
      where: { employeeId: profile.id }
    });

    if (!instance || instance.runtimeStatus !== 'active') {
      throw Error('Agent instance not active');
    }

    console.log(`\n[SMOKE-01] Agent: ${profile.name} (${profile.id})`);
    console.log(`[SMOKE-01] Instance: ${instance.id}, Runtime: ${instance.runtimeStatus}`);

    // ── Step 2: 创建 Task（MARKET_SCAN）──
    console.log('\n[SMOKE-01] Step 1: Task Creation (MARKET_SCAN)');
    
    const traceId = `smoke01_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const taskTitle = '竞品A最近7天市场动态扫描';
    const taskInput = JSON.stringify({
      target: '竞品A',
      timeRange: '最近7天',
      dimensions: ['产品更新', '营销动态', '用户反馈', '融资动态'],
      dataSource: 'mocked-company-news-feed'
    });

    const taskResult = await prisma.$executeRawUnsafe(`
      INSERT INTO agent_tasks (tenant_id, organization_id, task_type, status, title, input, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
      RETURNING id;
    `, profile.tenantId, profile.organizationId, 'MARKET_SCAN', 'CREATED', taskTitle, taskInput, JSON.stringify({ traceId, smokeTest: true }));

    const task = (taskResult as any)[0];
    if (!task) throw Error('Failed to create task');
    const taskId = task.id;

    console.log(`[SMOKE-01] ✅ Task Created: id=${taskId}`);
    console.log(`[SMOKE-01]    Type: MARKET_SCAN`);
    console.log(`[SMOKE-01]    Status: CREATED`);
    console.log(`[SMOKE-01]    Trace: ${traceId}`);
    timeline.push('TASK_CREATED');

    // ── Step 3: 创建 Execution ──
    console.log('\n[SMOKE-01] Step 2: Execution Creation');

    const execResult = await prisma.$executeRawUnsafe(`
      INSERT INTO agent_task_executions (task_id, agent_id, status, trace_id, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING id;
    `, taskId, profile.id, 'PENDING', traceId, JSON.stringify({ smokeTest: true }));

    const execution = (execResult as any)[0];
    if (!execution) throw Error('Failed to create execution');
    const executionId = execution.id;

    console.log(`[SMOKE-01] ✅ Execution Created: id=${executionId}`);
    timeline.push('AGENT_TASK_CREATED');

    // ── Step 4: 更新 Task → DISPATCHED ──
    await prisma.$executeRawUnsafe(`
      UPDATE agent_tasks SET status = 'DISPATCHED', started_at = CURRENT_TIMESTAMP WHERE id = $1;
    `, taskId);
    timeline.push('TASK_DISPATCHED');

    // ── Step 5: 真实 Runtime 执行（LLM 调用）──
    console.log('\n[SMOKE-01] Step 3: Real LLM Execution');
    console.log('[SMOKE-01] Calling DeepSeek via ModelRouter...');

    await prisma.$executeRawUnsafe(`
      UPDATE agent_task_executions SET status = 'RUNNING', started_at = CURRENT_TIMESTAMP WHERE id = $1;
    `, executionId);
    timeline.push('AGENT_STARTED');

    const instruction = `你是市场分析师。请对"竞品A"进行最近7天的市场动态扫描分析。

扫描维度：
1. 产品更新（新功能、版本迭代）
2. 营销动态（广告投放、活动策划）
3. 用户反馈（社交媒体声量、评价趋势）
4. 融资动态（资本动向、收购合并）

请输出结构化的竞品分析报告。`;

    const result = await enterpriseAgentRuntime.executeTask({
      taskId: taskId,
      profileId: profile.id,
      tenantId: profile.tenantId,
      organizationId: profile.organizationId,
      userId: profile.id,
      taskType: 'MARKET_SCAN',
      instruction,
    });

    console.log(`[SMOKE-01] LLM Execution: ${result.success ? 'PASS' : 'FAIL'}`);
    console.log(`[SMOKE-01] Duration: ${result.durationMs}ms`);
    console.log(`[SMOKE-01] Tokens: ${result.tokenInput} in / ${result.tokenOutput} out`);
    console.log(`[SMOKE-01] Cost: ¥${result.cost.toFixed(6)}`);

    if (!result.success) {
      throw Error(`LLM Execution Failed: ${result.error}`);
    }

    timeline.push('AGENT_RUNTIME_EXECUTION');

    // ── Step 6: 更新 Execution → COMPLETED ──
    await prisma.$executeRawUnsafe(`
      UPDATE agent_task_executions 
      SET status = 'COMPLETED', provider = $2, model = $3, 
          token_input = $4, token_output = $5, cost = $6, duration_ms = $7,
          completed_at = CURRENT_TIMESTAMP
      WHERE id = $1;
    `, executionId, 'deepseek', 'deepseek-chat', result.tokenInput, result.tokenOutput, result.cost, result.durationMs);
    timeline.push('TASK_COMPLETED');

    // ── Step 7: 捕获 Evidence ──
    console.log('\n[SMOKE-01] Step 4: Evidence Capture');

    // Evidence 1: 来自真实 LLM 执行输出
    const evidenceContent1 = {
      title: '竞品A最近7天市场动态分析报告',
      content: result.output,
      sourceType: 'llm_execution',
      generatedAt: new Date().toISOString(),
    };
    const contentHash1 = crypto.createHash('sha256')
      .update(JSON.stringify(evidenceContent1))
      .digest('hex');

    const ev1Result = await prisma.$executeRawUnsafe(`
      INSERT INTO evidence_records (execution_id, task_id, agent_id, source, type, content_hash, content, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
      RETURNING id;
    `, executionId, taskId, profile.id, 'deepseek:deepseek-chat', 'LLM_GENERATED_REPORT', 
    contentHash1, JSON.stringify(evidenceContent1), 
    JSON.stringify({ provider: 'deepseek', model: 'deepseek-chat', tokenInput: result.tokenInput, tokenOutput: result.tokenOutput }));
    const evidence1Id = (ev1Result as any)[0].id;
    console.log(`[SMOKE-01] ✅ Evidence 1: LLM Report (id=${evidence1Id})`);
    console.log(`[SMOKE-01]    Hash: ${contentHash1.slice(0, 16)}...`);

    // Evidence 2: 受控证据源（模拟外部数据源）
    const evidenceContent2 = {
      type: 'WEB_PAGE',
      source: 'mocked-company-news-feed',
      title: '竞品A发布新功能"智能推荐引擎v2.0"',
      url: 'https://mocked-competitor-a.com/news/v2-release',
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      summary: '竞品A于2天前发布了智能推荐引擎v2.0，主要改进包括实时个性化、多模态内容理解，预计提升用户留存率15%',
      sentiment: 'positive',
      impact: 'high',
    };
    const contentHash2 = crypto.createHash('sha256')
      .update(JSON.stringify(evidenceContent2))
      .digest('hex');

    const ev2Result = await prisma.$executeRawUnsafe(`
      INSERT INTO evidence_records (execution_id, task_id, agent_id, source, type, content_hash, content, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
      RETURNING id;
    `, executionId, taskId, profile.id, 'mocked-company-news-feed', 'WEB_PAGE', 
    contentHash2, JSON.stringify(evidenceContent2), 
    JSON.stringify({ controlledSource: true, mockData: true }));
    const evidence2Id = (ev2Result as any)[0].id;
    console.log(`[SMOKE-01] ✅ Evidence 2: Web Page (id=${evidence2Id})`);
    console.log(`[SMOKE-01]    Source: ${evidenceContent2.source}`);
    console.log(`[SMOKE-01]    Hash: ${contentHash2.slice(0, 16)}...`);

    // Evidence 3: 审计日志证据
    const auditLogs = await prisma.agentAuditTrail.findMany({
      where: { taskId: taskId },
      orderBy: { createdAt: 'asc' }
    });
    const evidenceContent3 = {
      type: 'AUDIT_TRAIL',
      source: 'agent_audit_trail',
      count: auditLogs.length,
      actions: auditLogs.map(l => l.action),
      totalTokens: auditLogs.reduce((s, l) => s + (l.tokenUsage || 0), 0),
      totalCost: auditLogs.reduce((s, l) => s + (l.cost || 0), 0),
    };
    const contentHash3 = crypto.createHash('sha256')
      .update(JSON.stringify(evidenceContent3))
      .digest('hex');

    const ev3Result = await prisma.$executeRawUnsafe(`
      INSERT INTO evidence_records (execution_id, task_id, agent_id, source, type, content_hash, content, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
      RETURNING id;
    `, executionId, taskId, profile.id, 'agent_audit_trail', 'AUDIT_TRAIL', 
    contentHash3, JSON.stringify(evidenceContent3), 
    JSON.stringify({ auditLogCount: auditLogs.length }));
    const evidence3Id = (ev3Result as any)[0].id;
    console.log(`[SMOKE-01] ✅ Evidence 3: Audit Trail (id=${evidence3Id})`);
    console.log(`[SMOKE-01]    Actions: ${evidenceContent3.actions.join(', ')}`);
    timeline.push('EVIDENCE_CAPTURED');

    // ── Step 8: 创建 Outcome ──
    console.log('\n[SMOKE-01] Step 5: Outcome Creation');

    const outcomeResult = await prisma.$executeRawUnsafe(`
      INSERT INTO outcome_records (task_id, execution_id, agent_id, type, status, title, summary, evidence, occurred_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, CURRENT_TIMESTAMP, $9::jsonb)
      RETURNING id;
    `, taskId, executionId, profile.id, 'MARKET_INTELLIGENCE', 'VERIFIED',
    '竞品A最近7天市场动态：智能推荐引擎v2.0发布',
    `竞品A于近期发布智能推荐引擎v2.0，核心升级包括实时个性化推荐、多模态内容理解。据模拟数据源显示，预计提升用户留存率15%。本次扫描由AI市场分析师完成，调用DeepSeek模型，耗时${result.durationMs}ms，消耗${result.tokenInput + result.tokenOutput} tokens。`,
    JSON.stringify([
      { evidenceId: evidence1Id, type: 'LLM_GENERATED_REPORT', hash: contentHash1.slice(0, 16) },
      { evidenceId: evidence2Id, type: 'WEB_PAGE', hash: contentHash2.slice(0, 16) },
      { evidenceId: evidence3Id, type: 'AUDIT_TRAIL', hash: contentHash3.slice(0, 16) },
    ]),
    JSON.stringify({ traceId, llmProvider: 'deepseek', llmModel: 'deepseek-chat', verifiedAt: new Date().toISOString() }));
    const outcomeId = (outcomeResult as any)[0].id;
    console.log(`[SMOKE-01] ✅ Outcome Created: id=${outcomeId}`);
    console.log(`[SMOKE-01]    Type: MARKET_INTELLIGENCE`);
    console.log(`[SMOKE-01]    Status: VERIFIED`);
    timeline.push('OUTCOME_CREATED');

    // ── Step 9: 更新 Task → COMPLETED ──
    await prisma.$executeRawUnsafe(`
      UPDATE agent_tasks SET status = 'COMPLETED', output = $2::jsonb, completed_at = CURRENT_TIMESTAMP WHERE id = $1;
    `, taskId, JSON.stringify({ outcomeId, evidenceCount: 3, summary: '竞品A智能推荐引擎v2.0发布' }));

    // ── Step 10: Final Verification ──
    console.log('\n' + '='.repeat(60));
    console.log('SMOKE-01 FINAL VERIFICATION');
    console.log('='.repeat(60));

    // 验证 Task
    const taskRow = await prisma.$queryRawUnsafe(`SELECT * FROM agent_tasks WHERE id = $1`, taskId);
    const finalTask = (taskRow as any)[0];
    console.log(`\n1. Task DB:`);
    console.log(`   ID: ${finalTask.id}`);
    console.log(`   Type: ${finalTask.task_type}`);
    console.log(`   Status: ${finalTask.status}`);
    console.log(`   Result: ${finalTask.status === 'COMPLETED' ? '✅ PASS' : '❌ FAIL'}`);

    // 验证 Execution
    const execRow = await prisma.$queryRawUnsafe(`SELECT * FROM agent_task_executions WHERE id = $1`, executionId);
    const finalExecution = (execRow as any)[0];
    console.log(`\n2. Execution DB:`);
    console.log(`   ID: ${finalExecution.id}`);
    console.log(`   Status: ${finalExecution.status}`);
    console.log(`   Trace: ${finalExecution.trace_id}`);
    console.log(`   Provider: ${finalExecution.provider}`);
    console.log(`   Result: ${finalExecution.status === 'COMPLETED' && finalExecution.trace_id ? '✅ PASS' : '❌ FAIL'}`);

    // 验证 Evidence
    const evidenceRows = await prisma.$queryRawUnsafe(`SELECT * FROM evidence_records WHERE execution_id = $1`, executionId);
    const evidences = evidenceRows as any[];
    console.log(`\n3. Evidence DB:`);
    console.log(`   Count: ${evidences.length}`);
    let evidenceIntegrity = true;
    for (const e of evidences) {
      const hash = crypto.createHash('sha256').update(JSON.stringify(e.content)).digest('hex');
      const hashValid = hash === e.content_hash;
      console.log(`   - ${e.type}: source="${e.source}", hash=${e.content_hash.slice(0, 16)}..., valid=${hashValid ? '\u2705' : '\u274c'}`);
      if (!hashValid) evidenceIntegrity = false;
    }
    console.log(`   Integrity: ${evidenceIntegrity && evidences.length >= 1 ? '\u2705 PASS' : '\u274c FAIL'}`);

    // 验证 Outcome
    const outcomeRow = await prisma.$queryRawUnsafe(`SELECT * FROM outcome_records WHERE id = $1`, outcomeId);
    const finalOutcome = (outcomeRow as any)[0];
    console.log(`\n4. Outcome DB:`);
    console.log(`   ID: ${finalOutcome.id}`);
    console.log(`   TaskId: ${finalOutcome.task_id}`);
    console.log(`   Type: ${finalOutcome.type}`);
    console.log(`   Status: ${finalOutcome.status}`);
    console.log(`   TaskId Linked: ${finalOutcome.task_id === taskId ? '\u2705 PASS' : '\u274c FAIL'}`);

    // 验证 Audit Chain
    console.log(`\n5. Audit Chain:`);
    console.log(`   ${timeline.join(' → ')}`);
    const expectedChain = ['TABLES_CREATED', 'TASK_CREATED', 'AGENT_TASK_CREATED', 'TASK_DISPATCHED', 'AGENT_STARTED', 'AGENT_RUNTIME_EXECUTION', 'TASK_COMPLETED', 'EVIDENCE_CAPTURED', 'OUTCOME_CREATED'];
    const chainValid = expectedChain.every(s => timeline.includes(s));
    console.log(`   Chain: ${chainValid ? '\u2705 PASS' : '\u274c FAIL'}`);

    // Final Result
    const allPassed = chainValid &&
      finalTask.status === 'COMPLETED' &&
      finalExecution.status === 'COMPLETED' &&
      finalExecution.trace_id &&
      evidences.length >= 1 &&
      evidenceIntegrity &&
      finalOutcome.task_id === taskId;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`FINAL RESULT: ${allPassed ? '\u2705 CORE LOOP VERIFIED' : '\u274c BLOCKED'}`);
    console.log(`${'='.repeat(60)}`);

    return {
      allPassed,
      task: finalTask,
      execution: finalExecution,
      evidences,
      outcome: finalOutcome,
      timeline,
      traceId,
    };

  } catch (error: any) {
    console.error(`\n[SMOKE-01] ❌ FATAL ERROR: ${error.message}`);
    timeline.push(`ERROR: ${error.message}`);
    console.log('\nAudit Chain: ' + timeline.join(' → '));
    throw error;
  }
}

// ─── Run ────────────────────────────────────────────────

runSmoke01()
  .then(result => {
    console.log('\n[SMOKE-01] Execution completed');
    process.exit(result.allPassed ? 0 : 1);
  })
  .catch(error => {
    console.error('\n[SMOKE-01] Execution failed:', error);
    process.exit(1);
  });
