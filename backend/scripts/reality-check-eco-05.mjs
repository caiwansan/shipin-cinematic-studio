/**
 * SPRINT-ECO-05 — Reality Gate 验证脚本（掌柜验收 G1-G3 + 回归）
 *   G1: Author Ownership — 开发者 A 不能修改开发者 B 的插件
 *   G2: Permission Intersection — manifest.permissions ∩ developerAllowed ∩ platformAllowed，越界拒绝发布
 *   G3: Version Ownership — (plugin-id + version + author) 唯一，防恶意覆盖
 *   回归: G1-G6（ECO-04 基线）+ G7/G8（授权隔离不受影响）
 *   回滚: DROP 3 张新表无依赖 → 重建幂等 → 恢复现场
 *
 * 执行：node scripts/reality-check-eco-05.mjs
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
const api = async (path, method, headers, body) => {
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return res.json();
};
const regPlugin = async (H, manifest) => {
  const res = await api('/api/ecosystem/plugins/register', 'POST', H, { manifest });
  return res;
};
const pluginEcoId = (id) => execSync(`psql "${PG}" -t -A -c "SELECT id FROM ecology_plugins WHERE plugin_id='${id}';"`, { encoding: 'utf8' }).trim();
const versionEcoId = (pid) => execSync(`psql "${PG}" -t -A -c "SELECT id FROM ecology_plugin_versions WHERE plugin_id='${pid}' AND version='1.0.0';"`, { encoding: 'utf8' }).trim();

async function main() {
  console.log(`\n══════════════════════════════════════════`);
  console.log(` SPRINT-ECO-05 Developer Center Foundation — Reality Gate`);
  console.log(` 目标: ${API}`);
  console.log(`══════════════════════════════════════════\n`);

  const tokenA = await login(ORG_A);
  const tokenB = await login(ORG_B);
  check('组织 A 登录', !!tokenA);
  check('组织 B 登录', !!tokenB);
  if (!tokenA || !tokenB) { console.log('\n  ⛔ 无法登录'); process.exit(1); }
  const HA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
  const HB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

  // ── 测试数据：开发者 A / B ──
  console.log('\n准备: 开发者 A（组织 A）与开发者 B（组织 B）');
  const regA = await api('/api/ecosystem/developer/register', 'POST', HA, { developerName: 'ECO5-Dev-A' });
  const devA = regA.data?.developer;
  const regB = await api('/api/ecosystem/developer/register', 'POST', HB, { developerName: 'ECO5-Dev-B' });
  const devB = regB.data?.developer;
  check('开发者 A 注册', regA.code === 0 && !!devA, `${devA?.developerId} (${devA?.status})`);
  check('开发者 B 注册', regB.code === 0 && !!devB, `${devB?.developerId} (${devB?.status})`);
  check('开发者 ID 唯一格式', devA?.developerId?.startsWith('dev-') && devA.developerId !== devB.developerId);
  const agA = await api(`/api/ecosystem/developer/${devA.developerId}/agreements`, 'POST', HA, { agreementType: 'revenue_share', version: '1.0', content: '分佣 70/30 测试条款' });
  check('开发者协议留痕（分成）', agA.code === 0 && agA.data?.agreement?.agreementType === 'revenue_share', `type=${agA.data?.agreement?.agreementType} v${agA.data?.agreement?.version}`);
  const agA2 = await api(`/api/ecosystem/developer/${devA.developerId}/agreements`, 'POST', HA, { agreementType: 'plugin_liability', version: '1.0', content: '插件责任条款留痕' });
  check('开发者协议留痕（插件责任）', agA2.code === 0, `type=${agA2.data?.agreement?.agreementType}`);
  const agList = await api(`/api/ecosystem/developer/${devA.developerId}/agreements`, 'GET', HA, undefined);
  check('协议列表查询', agList.code === 0 && agList.data?.agreements?.length >= 2, `count=${agList.data?.agreements?.length}`);
  const vfA = await api(`/api/ecosystem/developer/${devA.developerId}/verify`, 'POST', HA, {});
  check('开发者验证 CREATED→VERIFIED', vfA.data?.developer?.status === 'VERIFIED', vfA.data?.developer?.status);

  // ── G1: Author Ownership ──
  console.log('\nG1: Author Ownership（开发者 A 不能修改开发者 B 的插件）');
  const suffix = Date.now() % 1000000;
  const pluginAId = `eco5-a-${suffix}`;
  const regPA = await regPlugin(HA, { id: pluginAId, name: 'ECO5 Plugin A', type: 'agent', version: '1.0.0', author: devA.developerId, permissions: ['browser'], runtime: { kaor: true } });
  const ecoA = pluginEcoId(pluginAId);
  const verA = versionEcoId(ecoA);
  const authorA = execSync(`psql "${PG}" -t -A -c "SELECT author FROM ecology_plugins WHERE id='${ecoA}';"`, { encoding: 'utf8' }).trim();
  check('插件 A 注册（author=devA）', regPA.code === 0 && authorA === devA.developerId, `author=${authorA}`);
  const attemptB = await api('/api/ecosystem/developer/publish-requests', 'POST', HB, { pluginId: ecoA, versionId: verA });
  check('devB 操作 devA 插件 → 拒绝', attemptB.code === 403 && attemptB.errorCode === 'AUTHOR_MISMATCH', `${attemptB.errorCode}`);
  const reqA = await api('/api/ecosystem/developer/publish-requests', 'POST', HA, { pluginId: ecoA, versionId: verA });
  check('devA 本人创建发布申请 → DRAFT', reqA.code === 0 && reqA.data?.request?.status === 'DRAFT', `status=${reqA.data?.request?.status}`);
  const reqAId = reqA.data.request.id;
  const reqA2 = await api('/api/ecosystem/developer/publish-requests', 'POST', HA, { pluginId: ecoA, versionId: verA });
  check('重复创建幂等（G3 唯一兜底）', reqA2.code === 0 && reqA2.data?.idempotent === true, 'idempotent');

  // ── G3: Version Ownership ──
  console.log('\nG3: Version Ownership（(plugin-id + version) 归属唯一，防恶意覆盖）');
  const pluginXId = `eco5-x-${suffix}`;
  await regPlugin(HA, { id: pluginXId, name: 'ECO5 Plugin X', type: 'agent', version: '1.0.0', author: devA.developerId, permissions: ['browser'], runtime: { kaor: true } });
  const ecoX = pluginEcoId(pluginXId);
  const verX = versionEcoId(ecoX);
  const crossVersion = await api('/api/ecosystem/developer/publish-requests', 'POST', HA, { pluginId: ecoA, versionId: verX });
  check('跨插件挂版本 → 拒绝', crossVersion.code === 403 && crossVersion.errorCode === 'VERSION_MISMATCH', `${crossVersion.errorCode}`);
  const dupPluginId = `eco5-dup-${suffix}`;
  const regDup = await regPlugin(HA, { id: dupPluginId, name: 'ECO5 Dup', type: 'agent', version: '1.0.0', author: devA.developerId, permissions: ['browser'], runtime: { kaor: true } });
  check('同 author 独立新插件（非覆盖）', regDup.code === 0, `code=${regDup.code}`);
  const dupCount = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM ecology_plugins WHERE plugin_id='${dupPluginId}';"`, { encoding: 'utf8' }).trim();
  check('插件记录唯一（无覆盖）', Number(dupCount) === 1, `count=${dupCount}`);

  // ── G2: Permission Intersection ──
  console.log('\nG2: Permission Intersection（声明 ∩ 开发者允许 ∩ 平台白名单）');
  const permA = await api('/api/ecosystem/developer/permission-check', 'POST', HA, { pluginId: ecoA, versionId: verA });
  check('devA(VERIFIED) browser → allowed', permA.data?.allowed === true && permA.data?.developerStatus === 'VERIFIED', `reason=${permA.data?.reason}`);
  const permList = await api('/api/ecosystem/developer/permission-check', 'POST', HA, { pluginId: ecoA, versionId: verA });
  check('G2 返回三层集合', Array.isArray(permList.data?.manifestPermissions) && Array.isArray(permList.data?.developerAllowed) && Array.isArray(permList.data?.platformAllowed), `devAllowed=[${permList.data?.developerAllowed}]`);
  // devB（CREATED）: browser ∉ [content, analytics] → 拒绝
  const pluginBBadId = `eco5-bbad-${suffix}`;
  await regPlugin(HB, { id: pluginBBadId, name: 'ECO5 B Bad', type: 'agent', version: '1.0.0', author: devB.developerId, permissions: ['browser'], runtime: { kaor: true } });
  const ecoBBad = pluginEcoId(pluginBBadId);
  const verBBad = versionEcoId(ecoBBad);
  const reqBBad = await api('/api/ecosystem/developer/publish-requests', 'POST', HB, { pluginId: ecoBBad, versionId: verBBad });
  const submitBBad = await api(`/api/ecosystem/developer/publish-requests/${reqBBad.data?.request?.id}/submit`, 'POST', HB, {});
  check('devB(CREATED) browser 提交 → 拒绝', submitBBad.code === 403 && submitBBad.errorCode === 'PERMISSION_OUT_OF_SCOPE', `${submitBBad.errorCode}`);
  // devB（CREATED）: content ∈ [content, analytics] → 通过
  const pluginBOkId = `eco5-bok-${suffix}`;
  await regPlugin(HB, { id: pluginBOkId, name: 'ECO5 B Ok', type: 'agent', version: '1.0.0', author: devB.developerId, permissions: ['content'], runtime: { kaor: true } });
  const ecoBOk = pluginEcoId(pluginBOkId);
  const verBOk = versionEcoId(ecoBOk);
  const reqBOk = await api('/api/ecosystem/developer/publish-requests', 'POST', HB, { pluginId: ecoBOk, versionId: verBOk });
  const submitBOk = await api(`/api/ecosystem/developer/publish-requests/${reqBOk.data?.request?.id}/submit`, 'POST', HB, {});
  check('devB(CREATED) content 提交 → 通过', submitBOk.data?.request?.status === 'SUBMITTED', submitBOk.data?.request?.status);
  // 平台白名单层：manifest 枚举外权限 → 注册层即拒绝（ECO-02 zod 防线）
  const regBadPerm = await regPlugin(HA, { id: `eco5-root-${suffix}`, name: 'ECO5 Root', type: 'agent', version: '1.0.0', author: devA.developerId, permissions: ['root'], runtime: { kaor: true } });
  check('越界枚举权限（root）注册 → 拒绝', regBadPerm.code === 400 && regBadPerm.errorCode === 'INVALID_MANIFEST', `${regBadPerm.errorCode}`);
  // devA 合法插件提交 → SUBMITTED → APPROVED → PUBLISHED
  const submitOk = await api(`/api/ecosystem/developer/publish-requests/${reqAId}/submit`, 'POST', HA, {});
  check('devA browser 提交 DRAFT→SUBMITTED', submitOk.data?.request?.status === 'SUBMITTED', submitOk.data?.request?.status);
  const approve = await api(`/api/ecosystem/developer/publish-requests/${reqAId}/approve`, 'POST', HA, { note: 'ECO-05 gate 登记' });
  check('审批 SUBMITTED→APPROVED（Marketplace Ready）', approve.data?.request?.status === 'APPROVED', approve.data?.request?.status);
  const pluginStatus = execSync(`psql "${PG}" -t -A -c "SELECT status FROM ecology_plugins WHERE id='${ecoA}';"`, { encoding: 'utf8' }).trim();
  check('APPROVED → 插件 PUBLISHED', pluginStatus === 'PUBLISHED', pluginStatus);
  const rejFlow = await api(`/api/ecosystem/developer/publish-requests/${reqBOk.data?.request?.id}/reject`, 'POST', HA, { note: '平台驳回登记' });
  check('REJECTED 流转登记', rejFlow.code === 0 && rejFlow.data?.request?.status === 'REJECTED', rejFlow.data?.request?.status);
  const listReq = await api('/api/ecosystem/developer/publish-requests', 'GET', HA, undefined);
  check('发布申请列表（devA）', listReq.code === 0 && listReq.data?.requests?.length >= 1, `count=${listReq.data?.requests?.length}`);
  const mine = await api('/api/ecosystem/developer/mine', 'GET', HA, undefined);
  check('GET /developer/mine', mine.code === 0 && mine.data?.developer?.developerId === devA.developerId);
  // suspend 演示
  const suspB = await api(`/api/ecosystem/developer/${devB.developerId}/suspend`, 'POST', HB, {});
  check('开发者 SUSPENDED', suspB.data?.developer?.status === 'SUSPENDED', suspB.data?.developer?.status);
  const permSusp = await api('/api/ecosystem/developer/permission-check', 'POST', HB, { pluginId: ecoBOk, versionId: verBOk });
  check('SUSPENDED 开发者允许集为空', Array.isArray(permSusp.data?.developerAllowed) && permSusp.data?.developerAllowed.length === 0, `devAllowed=[]`);

  // ── 回归: ECO-04 基线 G1-G6 ──
  console.log('\n回归 G1-G6（ECO-04 基线）: 现有生态不受影响');
  const instCount = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM enterprise_agent_instance;"`, { encoding: 'utf8' }).trim();
  check('EnterpriseAgentInstance 正常', Number(instCount) >= 23, `instances=${instCount}`);
  const overview = await api('/api/enterprise/agent-profiles/overview', 'GET', HA, undefined);
  check('agent-profiles/overview 可用', overview?.code === 0, `code=${overview?.code}`);
  const wf = await api('/api/ai/agent-workflow-templates', 'GET', HA, undefined);
  check('工作流模板链路可用', wf?.code === 0 || Array.isArray(wf?.data));
  const rtHealth = await api('/api/ecosystem/runtime-health', 'GET', HA, undefined);
  check('runtime-health 正常', rtHealth?.code === 0 || Array.isArray(rtHealth?.data), `code=${rtHealth?.code}`);
  const ecoTables = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_%';"`, { encoding: 'utf8' }).trim();
  check('ecology 表 13 → 16 张', Number(ecoTables) === 16, `tables=${ecoTables}`);
  const t1 = execSync(`psql "${PG}" -t -A -c "SELECT to_regclass('public.ecology_developers');"`, { encoding: 'utf8' }).trim();
  const t2 = execSync(`psql "${PG}" -t -A -c "SELECT to_regclass('public.ecology_plugin_publish_requests');"`, { encoding: 'utf8' }).trim();
  const t3 = execSync(`psql "${PG}" -t -A -c "SELECT to_regclass('public.ecology_developer_agreements');"`, { encoding: 'utf8' }).trim();
  check('ECO-05 新增 3 张全存在', t1 && t2 && t3, `${t1} / ${t2} / ${t3}`);
  const bizFiles = execSync(`cd ${REPO} && git diff --name-only HEAD -- backend/src | grep -iE 'payment|subscription|user|organization|agent-runtime|hermes|billing' || true`, { encoding: 'utf8' }).trim();
  check('PaymentOrder/Subscription/User/Organization/Agent/Hermes 零改动', bizFiles === '', bizFiles || '(合规)');
  const changed = execSync(`cd ${REPO} && git diff --name-only HEAD -- backend/src backend/prisma/schema.prisma`, { encoding: 'utf8' }).split('\n').filter(Boolean);
  const eco5Only = changed.every(f => f.includes('developer') || f === 'backend/src/index.ts' || f === 'backend/prisma/schema.prisma');
  check('ECO-05 改动仅限生态层新增', eco5Only, changed.join(', '));
  const mgr = execSync(`cd ${REPO} && cat backend/prisma/migrations/sprint-eco-05-developer-center-foundation/migration.sql | grep -oE 'CREATE TABLE IF NOT EXISTS "[a-z_]+"' | sort -u`, { encoding: 'utf8' }).trim();
  const mgrTables = mgr.split('\n').map(l => l.replace(/^CREATE TABLE IF NOT EXISTS "([a-z_]+)"$/, '$1'));
  const expected = ['ecology_developers', 'ecology_plugin_publish_requests', 'ecology_developer_agreements'];
  check('迁移 SQL 只建 3 张 ecology 新表', mgrTables.length === 3 && mgrTables.every(t => expected.includes(t)), mgrTables.join(' '));

  // ── 回归: G7/G8（授权隔离不受影响）──
  console.log('\n回归 G7/G8（License 授权链路不受影响）');
  const g7Plugin = `eco5-g7-${suffix}`;
  await regPlugin(HA, { id: g7Plugin, name: 'G7 Eco5', type: 'agent', version: '1.0.0', author: devA.developerId, permissions: ['browser'], runtime: { kaor: true } });
  const grant = await api('/api/ecosystem/license/grant', 'POST', HA, { pluginId: g7Plugin, licenseType: 'trial', durationDays: 1 });
  check('G7 授权 ACTIVE', grant.code === 0 && grant.data?.license?.status === 'ACTIVE', `licenseId=${grant.data?.license?.id?.slice(0, 8)}`);
  const chkA = await api('/api/ecosystem/license/check', 'POST', HA, { pluginId: g7Plugin });
  check('G7 组织 A 可用', chkA.data?.allowed === true, `reason=${chkA.data?.reason}`);
  const chkB = await api('/api/ecosystem/license/check', 'POST', HB, { pluginId: g7Plugin });
  check('G8 组织 B 不可用（NO_LICENSE）', chkB.data?.allowed === false && chkB.data?.reason === 'NO_LICENSE', `reason=${chkB.data?.reason}`);
  const bLic = await api('/api/ecosystem/license/mine', 'GET', HB, undefined);
  check('G8 组织 B 许可列表不含 A 插件', !(bLic?.data?.licenses ?? []).some((l) => l?.plugin?.pluginId === g7Plugin));

  // ── 回滚验证 ──
  console.log('\n回滚验证（DROP 3 张新表无依赖 → 重建幂等 → 恢复现场）');
  execSync(`psql "${PG}" -c "DROP TABLE IF EXISTS ecology_plugin_publish_requests; DROP TABLE IF EXISTS ecology_developer_agreements; DROP TABLE IF EXISTS ecology_developers;"`, { encoding: 'utf8' });
  const afterDrop = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_%';"`, { encoding: 'utf8' }).trim();
  check('DROP 后回到 13 张（无依赖）', Number(afterDrop) === 13, `tables=${afterDrop}`);
  execSync(`psql "${PG}" -f ${REPO}/backend/prisma/migrations/sprint-eco-05-developer-center-foundation/migration.sql`, { encoding: 'utf8' });
  const afterRe = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_%';"`, { encoding: 'utf8' }).trim();
  check('重建幂等（16 张）', Number(afterRe) === 16, `tables=${afterRe}`);
  const uni = execSync(`psql "${PG}" -t -A -c "SELECT count(*) FROM pg_constraint WHERE conname LIKE 'ecology_plugin_publish_requests_plugin_id_version_id_key';"`, { encoding: 'utf8' }).trim();
  check('唯一约束保留（plugin+version）', Number(uni) >= 1);

  // 恢复现场：重新注册开发者
  const rA = await api('/api/ecosystem/developer/register', 'POST', HA, { developerName: 'ECO5-Dev-A' });
  const rB = await api('/api/ecosystem/developer/register', 'POST', HB, { developerName: 'ECO5-Dev-B' });
  check('恢复现场（重注册 devA/devB）', rA.code === 0 && rB.code === 0, `${rA.data?.developer?.developerId} / ${rB.data?.developer?.developerId}`);

  console.log(`\n══════════════════════════════════════════`);
  console.log(` 结果: ${PASS} PASS / ${FAIL} FAIL`);
  if (failures.length) console.log(` 失败项: ${failures.join(', ')}`);
  console.log(`══════════════════════════════════════════\n`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
