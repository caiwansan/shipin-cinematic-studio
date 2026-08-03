/**
 * SPRINT-ECO-06 — Reality Gate 验证脚本（掌柜验收 G1-G4 + 回归）
 *   G1 发布权限 — 开发者 A 只能上架自己的插件（author 强校验）
 *   G2 安装授权联动 — 用户安装 → License ACTIVE（复用 ECO-04）
 *   G3 卸载行为 — installation.status = REMOVED（不删行），license 保留历史
 *   G4 未授权启动 — 无 License / 未安装 / 过期 → 插件不可运行
 *   回归: ECO-01~05 基线不受影响
 *   回滚: DROP 2 新表 + 还原 installations 扩展列 → 重建幂等 → 恢复现场
 *
 * 执行：node scripts/reality-check-eco-06.mjs
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
const q = (sql) => execSync(`psql "${PG}" -t -A -c "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();

async function main() {
  console.log(`\n══════════════════════════════════════════`);
  console.log(` SPRINT-ECO-06 Marketplace Foundation — Reality Gate`);
  console.log(` 目标: ${API}`);
  console.log(`══════════════════════════════════════════\n`);

  const tokenA = await login(ORG_A);
  const tokenB = await login(ORG_B);
  check('组织 A 登录', !!tokenA);
  check('组织 B 登录', !!tokenB);
  if (!tokenA || !tokenB) { console.log('\n  ⛔ 无法登录'); process.exit(1); }
  const HA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
  const HB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

  // ── 准备：devA/devB + devA 插件发布审批 → PUBLISHED ──
  console.log('\n准备: 开发者 + 插件发布审批（ECO-05 链路复用）');
  const regA = await api('/api/ecosystem/developer/register', 'POST', HA, { developerName: 'ECO6-Dev-A' });
  const devA = regA.data?.developer;
  const regB = await api('/api/ecosystem/developer/register', 'POST', HB, { developerName: 'ECO6-Dev-B' });
  const devB = regB.data?.developer;
  check('devA/devB 注册', regA.code === 0 && regB.code === 0, `${devA?.developerId} / ${devB?.developerId}`);
  if (devA?.status !== 'VERIFIED') {
    await api(`/api/ecosystem/developer/${devA.developerId}/verify`, 'POST', HA, {});
  }
  const suffix = Date.now() % 1000000;
  const pidMain = `eco6-main-${suffix}`;
  const regP = await api('/api/ecosystem/plugins/register', 'POST', HA, { manifest: { id: pidMain, name: 'ECO6 数据分析员', type: 'agent', version: '1.0.0', author: devA.developerId, permissions: ['browser', 'analytics'], runtime: { kaor: true } } });
  const ecoMain = q(`SELECT id FROM ecology_plugins WHERE plugin_id='${pidMain}'`);
  const verMain = q(`SELECT id FROM ecology_plugin_versions WHERE plugin_id='${ecoMain}' AND version='1.0.0'`);
  const reqMain = await api('/api/ecosystem/developer/publish-requests', 'POST', HA, { pluginId: ecoMain, versionId: verMain });
  const submitMain = await api(`/api/ecosystem/developer/publish-requests/${reqMain.data?.request?.id}/submit`, 'POST', HA, {});
  const apprMain = await api(`/api/ecosystem/developer/publish-requests/${reqMain.data?.request?.id}/approve`, 'POST', HA, { note: 'ECO-06 gate 审批' });
  const pubStatus = q(`SELECT status FROM ecology_plugins WHERE id='${ecoMain}'`);
  check('插件审批 → PUBLISHED', pubStatus === 'PUBLISHED', pubStatus);
  // 未审批插件（G1 拒绝路径）
  const pidRaw = `eco6-raw-${suffix}`;
  await api('/api/ecosystem/plugins/register', 'POST', HA, { manifest: { id: pidRaw, name: 'ECO6 未审批', type: 'agent', version: '1.0.0', author: devA.developerId, permissions: ['content'], runtime: { kaor: true } } });
  const ecoRaw = q(`SELECT id FROM ecology_plugins WHERE plugin_id='${pidRaw}'`);

  // ── G1: 发布权限 ──
  console.log('\nG1: 发布权限（开发者 A 只能上架自己的插件）');
  const listA = await api('/api/ecosystem/marketplace/items', 'POST', HA, { pluginId: ecoMain, displayName: 'ECO6 数据分析员', category: 'agent', pricingModel: 'TRIAL' });
  check('devA 上架自己插件 → LISTED', listA.code === 0 && listA.data?.item?.status === 'LISTED', `status=${listA.data?.item?.status}`);
  const listedRow = q(`SELECT status FROM ecology_marketplace_items WHERE plugin_id='${ecoMain}'`);
  check('DB 落库 LISTED', listedRow === 'LISTED', listedRow);
  const listB = await api('/api/ecosystem/marketplace/items', 'POST', HB, { pluginId: ecoMain });
  check('devB 上架 devA 插件 → 拒绝', listB.code === 403 && listB.errorCode === 'AUTHOR_MISMATCH', `${listB.errorCode}`);
  const listRaw = await api('/api/ecosystem/marketplace/items', 'POST', HA, { pluginId: ecoRaw });
  check('未审批插件上架 → 拒绝', listRaw.code === 400 && listRaw.errorCode === 'PLUGIN_NOT_PUBLISHED', `${listRaw.errorCode}`);
  const listA2 = await api('/api/ecosystem/marketplace/items', 'POST', HA, { pluginId: ecoMain, displayName: 'ECO6 数据分析员 Pro' });
  check('重复上架幂等（更新信息）', listA2.code === 0 && listA2.data?.idempotent === true, `name=${listA2.data?.item?.displayName}`);
  const unlist = await api('/api/ecosystem/marketplace/items/' + ecoMain + '/unlist', 'POST', HA, {});
  check('下架 LISTED→UNLISTED', unlist.data?.item?.status === 'UNLISTED', unlist.data?.item?.status);
  const unlistB = await api('/api/ecosystem/marketplace/items/' + ecoMain + '/unlist', 'POST', HB, {});
  check('devB 下架 devA 商品 → 拒绝', unlistB.code === 403 && unlistB.errorCode === 'AUTHOR_MISMATCH', `${unlistB.errorCode}`);
  // 重新上架（G2 需要 LISTED）
  const relist = await api('/api/ecosystem/marketplace/items', 'POST', HA, { pluginId: ecoMain });
  check('重新上架 → LISTED', relist.data?.item?.status === 'LISTED', relist.data?.item?.status);

  // ── G2: 安装授权联动 ──
  console.log('\nG2: 安装授权联动（用户安装 → License ACTIVE）');
  const instA = await api('/api/ecosystem/marketplace/install', 'POST', HA, { pluginId: ecoMain });
  check('组织 A 安装 → INSTALLED', instA.code === 0 && instA.data?.install?.status === 'INSTALLED', instA.data?.install?.status);
  check('联动生成 License ACTIVE', instA.data?.license?.status === 'ACTIVE', `licenseId=${instA.data?.license?.id?.slice(0, 8)}`);
  const licRow = q(`SELECT status FROM ecology_licenses WHERE plugin_id='${ecoMain}'`);
  check('ecology_licenses 落库 ACTIVE', licRow === 'ACTIVE', licRow);
  const instA2 = await api('/api/ecosystem/marketplace/install', 'POST', HA, { pluginId: ecoMain });
  check('重复安装幂等', instA2.data?.idempotent === true, 'idempotent');
  const instB = await api('/api/ecosystem/marketplace/install', 'POST', HB, { pluginId: ecoMain });
  check('组织 B 独立安装 → INSTALLED', instB.code === 0 && instB.data?.install?.status === 'INSTALLED', 'INSTALLED');
  const licCount = q(`SELECT count(*) FROM ecology_licenses WHERE plugin_id='${ecoMain}'`);
  check('双组织 → 双 License（隔离）', Number(licCount) === 2, `licenses=${licCount}`);
  const instRaw = await api('/api/ecosystem/marketplace/install', 'POST', HA, { pluginId: ecoRaw });
  check('未上架插件安装 → 拒绝', instRaw.code === 400 && instRaw.errorCode === 'ITEM_NOT_FOUND', `${instRaw.errorCode}`);
  const discovery = await api('/api/ecosystem/marketplace/items', 'GET', HA, undefined);
  const mainItem = discovery.data?.items?.find(i => i.pluginId === pidMain);
  check('发现接口含商品 + 已安装标记', !!mainItem && mainItem.install?.status === 'INSTALLED', `install=${mainItem?.install?.status ?? 'null'}`);
  const myInstalls = await api('/api/ecosystem/marketplace/installs', 'GET', HA, undefined);
  check('组织 A 安装列表', myInstalls.code === 0 && myInstalls.data?.installs?.length >= 1, `count=${myInstalls.data?.installs?.length}`);

  // ── G3: 卸载行为 ──
  console.log('\nG3: 卸载行为（REMOVED 不删行，license 保留历史）');
  const uninstA = await api('/api/ecosystem/marketplace/uninstall', 'POST', HA, { pluginId: ecoMain });
  check('组织 A 卸载 → REMOVED', uninstA.data?.install?.status === 'REMOVED', uninstA.data?.install?.status);
  const rowCount = q(`SELECT count(*) FROM ecology_plugin_installations WHERE plugin_id='${ecoMain}'`);
  check('安装行保留（不删除历史）', Number(rowCount) === 2, `rows=${rowCount}（A+B）`);
  const licAfter = q(`SELECT status FROM ecology_licenses WHERE plugin_id='${ecoMain}' ORDER BY created_at LIMIT 1`);
  check('License 保留（仍 ACTIVE）', licAfter === 'ACTIVE', licAfter);
  const licRowCount = q(`SELECT count(*) FROM ecology_licenses WHERE plugin_id='${ecoMain}'`);
  check('License 行不删', Number(licRowCount) === 2, `licenses=${licRowCount}`);
  const reInst = await api('/api/ecosystem/marketplace/install', 'POST', HA, { pluginId: ecoMain });
  check('卸载后可重新安装（复用行）', reInst.code === 0 && reInst.data?.install?.status === 'INSTALLED', reInst.data?.install?.status);

  // ── G4: 未授权启动 ──
  console.log('\nG4: 未授权启动（无 License / 未安装 / 过期 → 不可运行）');
  const launchOk = await api('/api/ecosystem/marketplace/launch-check', 'POST', HA, { pluginId: ecoMain });
  check('已安装 ACTIVE → 可运行', launchOk.data?.allowed === true && launchOk.data?.reason === 'OK', launchOk.data?.reason);
  const launchNotInst = await api('/api/ecosystem/marketplace/launch-check', 'POST', HA, { pluginId: ecoRaw });
  check('未安装插件 → 不可运行', launchNotInst.data?.allowed === false && launchNotInst.data?.reason === 'NOT_INSTALLED', launchNotInst.data?.reason);
  // 过期场景：先拿到组织 A 的 licenseId，精确置过期 → launch-check EXPIRED
  const licIdA = launchOk.data?.license?.licenseId ?? q(`SELECT license_id FROM ecology_plugin_installations WHERE plugin_id='${ecoMain}' LIMIT 1`);
  q(`UPDATE ecology_licenses SET status='EXPIRED' WHERE id='${licIdA}'`);
  const launchExpired = await api('/api/ecosystem/marketplace/launch-check', 'POST', HA, { pluginId: ecoMain });
  check('License 过期 → 不可运行', launchExpired.data?.allowed === false && launchExpired.data?.reason === 'EXPIRED', launchExpired.data?.reason);
  // 恢复 ACTIVE（保持现场）
  q(`UPDATE ecology_licenses SET status='ACTIVE' WHERE id='${licIdA}'`);
  const launchRecover = await api('/api/ecosystem/marketplace/launch-check', 'POST', HA, { pluginId: ecoMain });
  check('License 恢复 → 可运行', launchRecover.data?.allowed === true, launchRecover.data?.reason);

  // ── 结算数据快照 ──
  console.log('\n结算数据快照（非结算：只登记，ECO-07 使用）');
  const snap = await api('/api/ecosystem/marketplace/revenue-snapshot', 'POST', HA, { period: '2026-08' });
  check('快照登记', snap.code === 0 && snap.data?.period === '2026-08', `pluginCount=${snap.data?.pluginCount}`);
  const snapRow = q(`SELECT subscription_count || '|' || gross_amount || '|' || status FROM ecology_revenue_snapshots WHERE plugin_id='${ecoMain}' AND period='2026-08'`);
  const [subCount, gross, snapStatus] = snapRow.split('|');
  check('快照 subscriptionCount=ACTIVE 真实数', Number(subCount) >= 1, `count=${subCount}`);
  check('快照 grossAmount=0（未接支付诚实登记）', Number(gross) === 0, `gross=${gross}`);
  check('快照 status=DRAFT', snapStatus === 'DRAFT', snapStatus);
  const snapBad = await api('/api/ecosystem/marketplace/revenue-snapshot', 'POST', HA, { period: '2026-13' });
  check('非法周期 → 拒绝', snapBad.code === 400, `${snapBad.errorCode ?? ''}`);
  const snapList = await api('/api/ecosystem/marketplace/revenue-snapshots?period=2026-08', 'GET', HA, undefined);
  check('快照列表查询', snapList.code === 0 && snapList.data?.snapshots?.length >= 1, `count=${snapList.data?.snapshots?.length}`);

  // ── 回归: ECO-01~05 ──
  console.log('\n回归 ECO-01~05（现有生态不受影响）');
  const ecoTables = q(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_%'`);
  check("ecology 表基线 25 张（ECO-06/07/08 累积）", Number(ecoTables) === 25, `tables=${ecoTables}`);
  const instCount = q(`SELECT count(*) FROM enterprise_agent_instance`);
  check('EnterpriseAgentInstance 正常', Number(instCount) >= 23, `instances=${instCount}`);
  const chkLic = await api('/api/ecosystem/license/check', 'POST', HA, { pluginId: pidMain });
  check('License 链路正常（ECO-04 回归）', chkLic.data?.allowed === true, chkLic.data?.reason);
  const mine = await api('/api/ecosystem/developer/mine', 'GET', HA, undefined);
  check('Developer 链路正常（ECO-05 回归）', mine.code === 0, `code=${mine.code}`);
  const rtHealth = await api('/api/ecosystem/runtime-health', 'GET', HA, undefined);
  check('runtime-health 正常（ECO-03 回归）', rtHealth?.code === 0, `code=${rtHealth?.code}`);
  const overview = await api('/api/enterprise/agent-profiles/overview', 'GET', HA, undefined);
  check('agent-profiles/overview 可用（工作台回归）', overview?.code === 0, `code=${overview?.code}`);
  const bizFiles = execSync(`cd ${REPO} && git diff --name-only HEAD -- backend/src | grep -iE 'payment|subscription|user|organization|agent-runtime|hermes|billing' || true`, { encoding: 'utf8' }).trim();
  check('PaymentOrder/Subscription/User/Organization/Agent/Hermes 零改动', bizFiles === '', bizFiles || '(合规)');
  const changed = execSync(`cd ${REPO} && git diff --name-only HEAD -- backend/src backend/prisma/schema.prisma`, { encoding: 'utf8' }).split('\n').filter(Boolean);
  const eco6Only = changed.every(f => f.includes('marketplace') || f === 'backend/src/index.ts' || f === 'backend/prisma/schema.prisma');
  check('ECO-06 改动仅限生态层新增', eco6Only, changed.join(', '));

  // ── 回滚验证 ──
  // ECO-10 升级：破坏性演练 → 事务内演练（BEGIN → DROP → 重建 → 检查 → ROLLBACK）
  // 原因：官方种子商品/price 列/安装数据是生态资产，不能被 gate 清空（ECO-10 实锤：曾 DROP 后丢 price 列 + 清空官方商品）
  console.log('\n回滚验证（事务内演练：DROP → 重建 → ROLLBACK，现场零破坏）');
  const txnOut = execSync(
    `psql "${PG}" -c "BEGIN;" -c "DROP TABLE IF EXISTS ecology_revenue_snapshots; DROP TABLE IF EXISTS ecology_marketplace_items;" ` +
    `-c "ALTER TABLE ecology_plugin_installations DROP COLUMN IF EXISTS license_id; ALTER TABLE ecology_plugin_installations DROP COLUMN IF EXISTS removed_at;" ` +
    `-f ${REPO}/backend/prisma/migrations/sprint-eco-06-marketplace-foundation/migration.sql ` +
    `-c "ALTER TABLE ecology_marketplace_items ADD COLUMN IF NOT EXISTS price DECIMAL(12,2);" ` +
    `-c "SELECT 'txn_tables=' || count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_%';" ` +
    `-c "SELECT 'txn_uniq=' || count(*) FROM pg_indexes WHERE indexname IN ('ecology_marketplace_items_plugin_id_key','ecology_revenue_snapshots_plugin_id_period_key');" ` +
    `-c "ROLLBACK;"`,
    { encoding: 'utf8' },
  );
  const txnTables = Number((txnOut.match(/txn_tables=(\d+)/) || [])[1] ?? -1);
  const txnUniq = Number((txnOut.match(/txn_uniq=(\d+)/) || [])[1] ?? -1);
  check('事务内重建幂等（25 张）', txnTables === 25, `tables=${txnTables}`);
  check('唯一索引保留（plugin / plugin+period）', txnUniq >= 2, `uniq=${txnUniq}`);
  // ROLLBACK 后现场必须完好（官方种子 + price 列 + install 数据零丢失）
  const afterRb = q(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_%'`);
  check('ROLLBACK 后表数还原（25 张）', Number(afterRb) === 25, `tables=${afterRb}`);
  const priceStill = q(`SELECT count(*) FROM information_schema.columns WHERE table_name='ecology_marketplace_items' AND column_name='price'`);
  check('ROLLBACK 后 price 列保留（ECO-07 资产）', priceStill === '1', `cols=${priceStill}`);
  const licCol = q(`SELECT count(*) FROM information_schema.columns WHERE table_name='ecology_plugin_installations' AND column_name='license_id'`);
  check('ROLLBACK 后 license_id 列保留', licCol === '1', `cols=${licCol}`);
  const officialLeft = q(`SELECT count(*) FROM ecology_marketplace_items mi JOIN ecology_plugins p ON p.id=mi.plugin_id WHERE p.author='kunlun-official' AND mi.status='LISTED'`);
  check('ROLLBACK 后官方商品完好（5 款）', Number(officialLeft) === 5, `count=${officialLeft}`);
  // 恢复现场：重上架 + 重装验证（演练已回滚，测试商品 ecoMain 仍在，直接幂等确认）
  await api('/api/ecosystem/marketplace/items', 'POST', HA, { pluginId: ecoMain, displayName: 'ECO6 数据分析员', category: 'agent', pricingModel: 'TRIAL' });
  const reInst2 = await api('/api/ecosystem/marketplace/install', 'POST', HA, { pluginId: ecoMain });
  check('恢复现场（重新上架 + 重装组织 A）', reInst2.code === 0 && reInst2.data?.install?.status === 'INSTALLED', reInst2.data?.install?.status);
  // ECO-10 治理：验证完成后下架测试商品，插件发现中心只保留官方商品（不污染用户可见入口）
  await api(`/api/ecosystem/marketplace/items/${ecoMain}/unlist`, 'POST', HA, {});

  console.log(`\n══════════════════════════════════════════`);
  console.log(` 结果: ${PASS} PASS / ${FAIL} FAIL`);
  if (failures.length) console.log(` 失败项: ${failures.join(', ')}`);
  console.log(`══════════════════════════════════════════\n`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
