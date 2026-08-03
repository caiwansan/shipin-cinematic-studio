/**
 * SPRINT-ECO-04 — Reality Gate 验证脚本（掌柜验收 G1-G8）
 *   G1: 现有 23 AI员工全部正常（回归）
 *   G2: Agent 创建流程不变（回归）
 *   G3: Hermes 调用链不变（回归）
 *   G4: Plugin/Runtime 生态链不受影响（ECO-02/03 回归）
 *   G5: 数据库只能新增 ecology_license* 表
 *   G6: 零修改现有商业系统（PaymentOrder/Subscription/User/Organization/Agent/Hermes）
 *   G7: 插件过期 → 应用继续打开，插件不可运行（商业原则）
 *   G8: 组织隔离：A 组织购买，B 组织不能使用
 *   回滚: DROP 3 张新表无依赖 → 重建幂等
 *
 * 执行：node scripts/reality-check-eco-04.mjs
 */
import { execSync } from 'node:child_process';

const API = process.env.ECO_API || 'http://127.0.0.1:4002';
const PG = 'postgresql://postgres:BpgOMgBXybiNjnbyMCKCpPqh@localhost:5432/aigc_scs';
const REPO = '/root/shipin-cinematic-studio';
const ORG_A = { email: 'tenant_org_test@audit.local', password: 'AuditTest@123' };
const ORG_B = { email: 'tenant_iso_test@audit.local', password: 'AuditTest@123' };

let PASS = 0, FAIL = 0;
const failures = [];
function check(name, ok, detail = '') {
  if (ok) { PASS++; console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`); }
  else { FAIL++; failures.push(name); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}
async function login(acc) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: acc.email, password: acc.password }),
  });
  const body = await res.json();
  return body?.accessToken || body?.data?.token || null;
}
const regPlugin = async (H, id, type) => {
  const res = await fetch(`${API}/api/ecosystem/plugins/register`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ manifest: { id, name: id, type, version: '1.0.0', author: 'eco4-tester', permissions: ['browser'], runtime: { kaor: true } } }),
  });
  return res.json();
};

async function main() {
  console.log(`\n══════════════════════════════════════════`);
  console.log(` SPRINT-ECO-04 License & Entitlement Boundary — Reality Gate`);
  console.log(` 目标: ${API}`);
  console.log(`══════════════════════════════════════════\n`);

  const tokenA = await login(ORG_A);
  const tokenB = await login(ORG_B);
  check('组织 A 登录', !!tokenA);
  check('组织 B 登录', !!tokenB);
  if (!tokenA || !tokenB) { console.log('\n  ⛔ 无法登录'); process.exit(1); }
  const HA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
  const HB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

  // ── G1: 现有 AI 员工全部正常 ──
  console.log('\nG1: 现有 AI 员工全部正常');
  const instCount = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM enterprise_agent_instance;"`, { encoding: 'utf8' }).trim();
  const activeCount = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM enterprise_agent_instance WHERE runtime_status='active';"`, { encoding: 'utf8' }).trim();
  check('EnterpriseAgentInstance 计数正常', Number(instCount) >= 23, `instances=${instCount} active=${activeCount}`);
  const hbCount = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM hermes_profile_binding;"`, { encoding: 'utf8' }).trim();
  check('HermesProfileBinding 计数正常', Number(hbCount) >= 23, `bindings=${hbCount}`);

  // ── G2: Agent 创建流程不变 ──
  console.log('\nG2: Agent 创建流程不变');
  const overview = await (await fetch(`${API}/api/enterprise/agent-profiles/overview`, { headers: HA })).json();
  check('agent-profiles/overview → code=0', overview?.code === 0, `code=${overview?.code}`);
  const tmplCount = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM agent_template;"`, { encoding: 'utf8' }).trim();
  check('AgentTemplate 计数正常', Number(tmplCount) > 0, `templates=${tmplCount}`);

  // ── G3: Hermes 调用链不变 ──
  console.log('\nG3: Hermes 调用链不变');
  const workflowTpl = await (await fetch(`${API}/api/ai/agent-workflow-templates`, { headers: HA })).json();
  check('工作流模板链路可用', workflowTpl?.code === 0 || Array.isArray(workflowTpl?.data));

  // ── G4: Plugin/Runtime 生态链不受影响（ECO-02/03 回归）──
  console.log('\nG4: Plugin/Runtime 生态链不受影响');
  await regPlugin(HA, 'eco4-regression-demo', 'tool');
  const bind = await (await fetch(`${API}/api/ecosystem/runtime/mapping/eco4-regression-demo/bind`, { method: 'POST', headers: HA })).json();
  check('插件注册 + Runtime 绑定回归', bind?.code === 0, `caps=${bind?.data?.capabilities?.join(',') ?? ''}`);
  const health = await (await fetch(`${API}/api/ecosystem/runtime-health`, { headers: HA })).json();
  check('runtime-health 正常', health?.code === 0 && health?.data?.runtimes === 1);

  // ── G5: 数据库只能新增 ecology_license* 表 ──
  console.log('\nG5: 数据库只能新增 ecology_license* 表');
  const ecoTables = execSync(`psql "${PG}" -t -A -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology%' ORDER BY table_name;"`, { encoding: 'utf8' }).split('\n').filter(Boolean);
  check('ecology 表 10 → 13 张', ecoTables.length === 13, ecoTables.join(','));
  check('ECO-04 新增 3 张全存在', ['ecology_licenses', 'ecology_license_events', 'ecology_license_check_logs'].every(t => ecoTables.includes(t)));
  const modelsNow = execSync(`cd ${REPO} && grep -E '^model ' backend/prisma/schema.prisma | awk '{print $2}' | sort`, { encoding: 'utf8' }).trim().split('\n');
  const modelsEco3 = execSync(`cd ${REPO} && git show b3ee6462:backend/prisma/schema.prisma | grep -E '^model ' | awk '{print $2}' | sort`, { encoding: 'utf8' }).trim().split('\n');
  const added = modelsNow.filter(m => !modelsEco3.includes(m));
  const removed = modelsEco3.filter(m => !modelsNow.includes(m));
  check('schema 模型差异仅 3 个 License 新增', added.length === 3 && added.every(m => m.startsWith('EcologyLicense')) && removed.length === 0, `added=${added.join(',')} removed=${removed.join(',') || '无'}`);
  const sqlTables = execSync(`grep -oE 'CREATE TABLE IF NOT EXISTS "[a-z_]*"' ${REPO}/backend/prisma/migrations/sprint-eco-04-license-entitlement-boundary/migration.sql | sed 's/CREATE TABLE IF NOT EXISTS //g' | tr -d '"' | tr '\\n' ','`, { encoding: 'utf8' }).replace(/,$/, '');
  check('迁移 SQL 只建 ecology_license* 表', sqlTables.split(',').every(t => t.startsWith('ecology_license')), sqlTables);

  // ── G6: 零修改现有商业系统 ──
  console.log('\nG6: 零修改现有商业系统');
  const bizFiles = execSync(`cd ${REPO} && git diff --name-only HEAD -- backend/src | grep -iE 'payment|subscription|user|organization|agent-runtime|hermes|billing' || true`, { encoding: 'utf8' }).trim();
  check('PaymentOrder/Subscription/User/Organization/Agent/Hermes 零改动', bizFiles === '', bizFiles || '(合规)');
  const changed = execSync(`cd ${REPO} && git diff --name-only HEAD -- backend/src backend/prisma/schema.prisma`, { encoding: 'utf8' }).split('\n').filter(Boolean);
  const allowed = ['backend/src/ecosystem/license.service.ts', 'backend/src/routes/ecology-license.routes.ts', 'backend/src/index.ts', 'backend/prisma/schema.prisma'];
  check('ECO-04 改动仅限生态层', changed.every(f => allowed.includes(f)), changed.join(',') || '(合规)');

  // ── G7: 插件过期 → 应用继续打开，插件不可运行 ──
  console.log('\nG7: 插件过期 → 应用继续打开，插件不可运行');
  const g7Plugin = 'eco4-expire-demo';
  await regPlugin(HA, g7Plugin, 'tool');
  const grant = await (await fetch(`${API}/api/ecosystem/license/grant`, { method: 'POST', headers: HA, body: JSON.stringify({ pluginId: g7Plugin, licenseType: 'subscription', durationDays: 1 }) })).json();
  check('G7 授权 ACTIVE', grant?.data?.license?.status === 'ACTIVE', `licenseId=${grant?.data?.license?.id?.slice(0, 8)}`);
  const lid = grant?.data?.license?.id;
  const cOk = await (await fetch(`${API}/api/ecosystem/license/check`, { method: 'POST', headers: HA, body: JSON.stringify({ pluginId: g7Plugin }) })).json();
  check('G7 过期前插件可运行', cOk?.data?.allowed === true, cOk?.data?.reason);
  // 强制过期（模拟到期）
  const expire = await (await fetch(`${API}/api/ecosystem/license/${lid}/expire`, { method: 'POST', headers: HA, body: JSON.stringify({ reason: 'G7_TEST_EXPIRE' }) })).json();
  check('G7 许可流转 EXPIRED', expire?.data?.status === 'EXPIRED');
  const cDenied = await (await fetch(`${API}/api/ecosystem/license/check`, { method: 'POST', headers: HA, body: JSON.stringify({ pluginId: g7Plugin }) })).json();
  check('G7 过期后插件不可运行', cDenied?.data?.allowed === false && cDenied?.data?.reason === 'EXPIRED', `reason=${cDenied?.data?.reason}`);
  // 应用继续打开：工作台核心 API 不受影响
  const appAlive = await (await fetch(`${API}/api/enterprise/agent-profiles`, { headers: HA })).json();
  const appAlive2 = await (await fetch(`${API}/api/ai/agent-workflow-templates`, { headers: HA })).json();
  check('G7 应用继续打开（agent-profiles + templates 正常）', appAlive?.code === 0 && (appAlive2?.code === 0 || Array.isArray(appAlive2?.data)));
  // 续期恢复
  const renew = await (await fetch(`${API}/api/ecosystem/license/${lid}/renew`, { method: 'POST', headers: HA, body: JSON.stringify({ durationDays: 30 }) })).json();
  const cRenew = await (await fetch(`${API}/api/ecosystem/license/check`, { method: 'POST', headers: HA, body: JSON.stringify({ pluginId: g7Plugin }) })).json();
  check('G7 EXPIRED → renew → ACTIVE 恢复', renew?.data?.status === 'ACTIVE' && cRenew?.data?.allowed === true);

  // ── G8: 组织隔离 ──
  console.log('\nG8: 组织隔离（A 购买 B 不能用）');
  const g8Plugin = 'eco4-isolation-demo';
  await regPlugin(HA, g8Plugin, 'tool');
  const g8grant = await (await fetch(`${API}/api/ecosystem/license/grant`, { method: 'POST', headers: HA, body: JSON.stringify({ pluginId: g8Plugin, durationDays: 90 }) })).json();
  check('G8 组织 A 购买成功', g8grant?.data?.license?.status === 'ACTIVE');
  const aCheck = await (await fetch(`${API}/api/ecosystem/license/check`, { method: 'POST', headers: HA, body: JSON.stringify({ pluginId: g8Plugin }) })).json();
  check('G8 组织 A 可用', aCheck?.data?.allowed === true);
  const bCheck = await (await fetch(`${API}/api/ecosystem/license/check`, { method: 'POST', headers: HB, body: JSON.stringify({ pluginId: g8Plugin }) })).json();
  check('G8 组织 B 不可用（NO_LICENSE）', bCheck?.data?.allowed === false && bCheck?.data?.reason === 'NO_LICENSE', `reason=${bCheck?.data?.reason}`);
  const bLicenses = await (await fetch(`${API}/api/ecosystem/license/mine`, { headers: HB })).json();
  check('G8 组织 B 许可列表不含 A 的插件', !(bLicenses?.data?.licenses ?? []).some((l) => l?.plugin?.pluginId === g8Plugin));

  // ── 回滚验证 ──
  console.log('\n回滚验证（DROP 3 张新表无依赖 → 重建幂等）');
  execSync(`psql "${PG}" -c "DROP TABLE IF EXISTS ecology_license_check_logs; DROP TABLE IF EXISTS ecology_license_events; DROP TABLE IF EXISTS ecology_licenses;"`, { encoding: 'utf8' });
  execSync(`psql "${PG}" -f ${REPO}/backend/prisma/migrations/sprint-eco-04-license-entitlement-boundary/migration.sql`, { encoding: 'utf8' });
  const licCount = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM ecology_licenses;"`, { encoding: 'utf8' }).trim();
  check('DROP 后重建成功（迁移幂等）', licCount === '0', `licenses=${licCount}`);
  check('唯一约束保留（org+plugin 唯一）', execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM pg_indexes WHERE tablename='ecology_licenses' AND indexname='ecology_licenses_organization_id_plugin_id_key';"`, { encoding: 'utf8' }).trim() === '1');

  // 恢复现场
  console.log('\n恢复现场（重建 grant 数据）');
  const reGrant = await (await fetch(`${API}/api/ecosystem/license/grant`, { method: 'POST', headers: HA, body: JSON.stringify({ pluginId: g8Plugin, durationDays: 90 }) })).json();
  check('恢复 grant 正常', reGrant?.code === 0 && reGrant?.data?.license?.status === 'ACTIVE');

  console.log(`\n══════════════════════════════════════════`);
  console.log(` 结果: ${PASS} PASS / ${FAIL} FAIL`);
  if (failures.length) console.log(` 失败项: ${failures.join(', ')}`);
  console.log(`══════════════════════════════════════════\n`);
  process.exit(FAIL > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
