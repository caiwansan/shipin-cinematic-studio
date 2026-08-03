/**
 * SPRINT-ECO-07 — Reality Gate 验证脚本（掌柜验收 G1-G5 + 回归 + 回滚）
 *   G1 配置化分成 — 插件级 > 开发者级 > 平台默认；不同开发者不同比例（不写死）
 *   G2 结算可追溯 — settlement → items → licenseId → license_events 全链路
 *   G3 对账一致性 — grossAmount = Σitems.amount；developerAmount + platformAmount = grossAmount
 *   G4 结算状态机 — DRAFT → CONFIRMED → FINALIZED（不可回退，同周期不覆盖）
 *   G5 平台收入记录 — platformAmount 独立可查；REGISTERED 标注（未接支付实收 0）
 *   回归: ECO-01~06 基线
 *   回滚: DROP 3 新表 + 还原 price 列 → 重建幂等 → 恢复现场
 *
 * 执行：node scripts/reality-check-eco-07.mjs
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
  console.log(` SPRINT-ECO-07 Revenue Settlement Foundation — Reality Gate`);
  console.log(` 目标: ${API}`);
  console.log(`══════════════════════════════════════════\n`);

  const tokenA = await login(ORG_A);
  const tokenB = await login(ORG_B);
  check('组织 A/B 登录', !!tokenA && !!tokenB);
  if (!tokenA || !tokenB) { console.log('  ⛔ 无法登录'); process.exit(1); }
  const HA = { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' };
  const HB = { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' };

  // ── 准备：devA/devB + 插件 A/B 审批 PUBLISHED + 上架 + 安装（License ACTIVE）──
  console.log('\n准备: 开发者 + 插件审批 + 上架定价 + 安装授权');
  const suffix = Date.now() % 1000000;
  const regA = await api('/api/ecosystem/developer/register', 'POST', HA, { developerName: 'ECO7-Dev-A' });
  const regB = await api('/api/ecosystem/developer/register', 'POST', HB, { developerName: 'ECO7-Dev-B' });
  const devA = regA.data?.developer;
  const devB = regB.data?.developer;
  check('devA/devB 注册', regA.code === 0 && regB.code === 0, `${devA?.developerId}/${devB?.developerId}`);
  if (devA?.status !== 'VERIFIED') await api(`/api/ecosystem/developer/${devA.developerId}/verify`, 'POST', HA, {});
  if (devB?.status !== 'VERIFIED') await api(`/api/ecosystem/developer/${devB.developerId}/verify`, 'POST', HB, {});

  const makePlugin = async (pid, name, headers, devId) => {
    await api('/api/ecosystem/plugins/register', 'POST', headers, { manifest: { id: pid, name, type: 'agent', version: '1.0.0', author: devId, permissions: ['analytics'], runtime: { kaor: true } } });
    const ecoId = q(`SELECT id FROM ecology_plugins WHERE plugin_id='${pid}'`);
    const verId = q(`SELECT id FROM ecology_plugin_versions WHERE plugin_id='${ecoId}' AND version='1.0.0'`);
    const req = await api('/api/ecosystem/developer/publish-requests', 'POST', headers, { pluginId: ecoId, versionId: verId });
    await api(`/api/ecosystem/developer/publish-requests/${req.data?.request?.id}/submit`, 'POST', headers, {});
    await api(`/api/ecosystem/developer/publish-requests/${req.data?.request?.id}/approve`, 'POST', headers, { note: 'ECO-07 gate 审批' });
    return ecoId;
  };
  const ecoA = await makePlugin(`eco7-a-${suffix}`, 'ECO7 插件A（DevA）', HA, devA.developerId);
  const ecoB = await makePlugin(`eco7-b-${suffix}`, 'ECO7 插件B（DevB）', HB, devB.developerId);
  // 上架 + 定价登记（price = 订阅单价，应计收入计算依据）
  const listA = await api('/api/ecosystem/marketplace/items', 'POST', HA, { pluginId: ecoA, displayName: 'ECO7 A 数据分析', category: 'agent', pricingModel: 'SUBSCRIPTION' });
  q(`UPDATE ecology_marketplace_items SET price=100.00 WHERE plugin_id='${ecoA}'`);
  const listB = await api('/api/ecosystem/marketplace/items', 'POST', HB, { pluginId: ecoB, displayName: 'ECO7 B 内容助手', category: 'agent', pricingModel: 'SUBSCRIPTION' });
  q(`UPDATE ecology_marketplace_items SET price=50.00 WHERE plugin_id='${ecoB}'`);
  check('插件 A/B 上架定价', listA.code === 0 && listB.code === 0, '100.00 / 50.00');
  // 安装（A：组织 A+B 各一许可；B：组织 A 一许可）→ License ACTIVE + 事件
  const instA1 = await api('/api/ecosystem/marketplace/install', 'POST', HA, { pluginId: ecoA });
  const instA2 = await api('/api/ecosystem/marketplace/install', 'POST', HB, { pluginId: ecoA });
  const instB1 = await api('/api/ecosystem/marketplace/install', 'POST', HA, { pluginId: ecoB });
  check('安装完成（A×2 组织 + B×1 组织）', instA1.code === 0 && instA2.code === 0 && instB1.code === 0, `A=${instA1.data?.license?.status}/${instA2.data?.license?.status} B=${instB1.data?.license?.status}`);

  // 快照登记（ECO-06 复用）
  const period = '2026-08';
  await api('/api/ecosystem/marketplace/revenue-snapshot', 'POST', HA, { period });
  const snapA = q(`SELECT subscription_count FROM ecology_revenue_snapshots WHERE plugin_id='${ecoA}' AND period='${period}'`);
  const snapB = q(`SELECT subscription_count FROM ecology_revenue_snapshots WHERE plugin_id='${ecoB}' AND period='${period}'`);
  check('快照登记（A=2 许可 B=1 许可）', Number(snapA) === 2 && Number(snapB) === 1, `A=${snapA} B=${snapB}`);

  // ── G1: 配置化分成 ──
  console.log('\nG1: 配置化分成（插件级 > 开发者级 > 平台默认，不写死）');
  const defaultPol = await api('/api/ecosystem/settlements/policies', 'GET', HA, undefined);
  const platformDefault = defaultPol.data?.policies?.find(p => p.level === 'PLATFORM_DEFAULT');
  check('平台默认策略存在（种子配置）', !!platformDefault, `dev=${platformDefault?.developerRate} platform=${platformDefault?.platformRate}`);
  // 开发者级：devA = 80/20
  const devPol = await api('/api/ecosystem/settlements/policies', 'PUT', HA, { developerId: devA.id, developerRate: 0.80, platformRate: 0.20 });
  check('devA 开发者级策略 80/20', devPol.data?.policy?.developerRate === '80.00' || Number(devPol.data?.policy?.developerRate) === 0.8, `rate=${devPol.data?.policy?.developerRate}`);
  // 插件级：插件 B = 90/10（覆盖 devB 的默认）
  const pluginPol = await api('/api/ecosystem/settlements/policies', 'PUT', HB, { developerId: devB.id, pluginId: ecoB, developerRate: 0.90, platformRate: 0.10 });
  check('插件 B 插件级策略 90/10', Number(pluginPol.data?.policy?.developerRate) === 0.9, `rate=${pluginPol.data?.policy?.developerRate}`);
  const badRate = await api('/api/ecosystem/settlements/policies', 'PUT', HA, { developerId: devA.id, developerRate: 1.5 });
  check('非法比例（1.5）→ 拒绝', badRate.code === 400, `${badRate.errorCode}`);
  const badSum = await api('/api/ecosystem/settlements/policies', 'PUT', HA, { developerId: devA.id, developerRate: 0.6, platformRate: 0.5 });
  check('比例之和 ≠1 → 拒绝', badSum.code === 400, `${badSum.errorCode}`);

  // ── 对账 ──
  console.log('\n对账（快照 vs license_events）');
  const rec = await api('/api/ecosystem/settlements/reconcile?period=' + period, 'GET', HA, undefined);
  const recA = rec.data?.reconciled?.find(r => r.pluginId === ecoA);
  check('插件 A 对账 match（快照 2 = 事件许可 2）', recA?.match === true, `snapshot=${recA?.snapshotCount} events=${recA?.eventLicenseCount}`);
  const recB = rec.data?.reconciled?.find(r => r.pluginId === ecoB);
  check('插件 B 对账 match（快照 1 = 事件许可 1）', recB?.match === true, `snapshot=${recB?.snapshotCount} events=${recB?.eventLicenseCount}`);

  // ── 结算生成 ──
  console.log('\n结算生成（收入快照确认 + 分成计算 + items 落库）');
  const settle = await api('/api/ecosystem/settlements/settle', 'POST', HA, { period });
  check('结算生成成功', settle.code === 0 && settle.data?.count >= 2, `count=${settle.data?.count}`);
  const stA = settle.data?.settlements?.find(s => s.settlement?.pluginId === ecoA)?.settlement;
  const stB = settle.data?.settlements?.find(s => s.settlement?.pluginId === ecoB)?.settlement;
  check('插件 A 结算：gross=100×2=200', Number(stA?.grossAmount) === 200, `gross=${stA?.grossAmount}`);
  check('插件 A 分成（devA 80%）：dev=160 platform=40', Number(stA?.developerAmount) === 160 && Number(stA?.platformAmount) === 40, `dev=${stA?.developerAmount} plat=${stA?.platformAmount}`);
  check('插件 B 结算：gross=50×1=50', Number(stB?.grossAmount) === 50, `gross=${stB?.grossAmount}`);
  check('插件 B 分成（插件级 90%）：dev=45 platform=5', Number(stB?.developerAmount) === 45 && Number(stB?.platformAmount) === 5, `dev=${stB?.developerAmount} plat=${stB?.platformAmount}`);
  const snapStatusA = q(`SELECT status FROM ecology_revenue_snapshots WHERE plugin_id='${ecoA}' AND period='${period}'`);
  const snapStatusB = q(`SELECT status FROM ecology_revenue_snapshots WHERE plugin_id='${ecoB}' AND period='${period}'`);
  check('快照确认 FINALIZED（收入快照确认）', snapStatusA === 'FINALIZED' && snapStatusB === 'FINALIZED', `${snapStatusA}/${snapStatusB}`);
  const detailA = q(`SELECT detail->>'note' FROM ecology_settlements WHERE plugin_id='${ecoA}' AND period='${period}'`);
  check('结算留痕 REGISTERED（未接支付实收 0）', detailA === 'REGISTERED', detailA);
  // 幂等：同周期不覆盖（G4）
  const settle2 = await api('/api/ecosystem/settlements/settle', 'POST', HA, { period });
  const dupA = settle2.data?.settlements?.find(s => s.settlement?.pluginId === ecoA);
  check('同周期重复结算幂等（不覆盖）', dupA?.idempotent === true, 'idempotent');

  // ── G2: 可追溯 ──
  console.log('\nG2: 结算可追溯（settlement → items → license）');
  const detA = await api('/api/ecosystem/settlements/' + stA.id, 'GET', HA, undefined);
  check('结算详情含 items', detA.data?.settlement?.items?.length >= 2, `items=${detA.data?.settlement?.items?.length}`);
  const itemLicenses = detA.data?.settlement?.items?.map(i => i.licenseId).filter(Boolean);
  const licInEvents = itemLicenses?.every(lid => {
    const cnt = q(`SELECT count(*) FROM ecology_license_events WHERE license_id='${lid}' AND event_type IN ('ACTIVATE','RENEW')`);
    return Number(cnt) >= 1;
  });
  check('items.licenseId 全部可追溯至 license_events', licInEvents === true, `licenses=${itemLicenses?.length}`);
  const itemSrc = detA.data?.settlement?.items?.every(i => i.source === 'LICENSE_EVENT');
  check('items 来源标注 LICENSE_EVENT', itemSrc === true, 'source');

  // ── G3: 对账一致性 ──
  console.log('\nG3: 对账一致性（金额闭环）');
  const itemsSum = q(`SELECT COALESCE(SUM(amount),0) FROM ecology_settlement_items WHERE settlement_id='${stA.id}'`);
  check('Σitems.amount = grossAmount（200）', Number(itemsSum) === 200, `sum=${itemsSum}`);
  const g3 = Number(stA.developerAmount) + Number(stA.platformAmount);
  check('developerAmount + platformAmount = grossAmount', g3 === 200, `dev+plat=${g3}`);

  // ── G4: 状态机 ──
  console.log('\nG4: 结算状态机（DRAFT → CONFIRMED → FINALIZED 不可回退）');
  const conf = await api(`/api/ecosystem/settlements/${stA.id}/confirm`, 'POST', HA, undefined);
  check('DRAFT → CONFIRMED', conf.data?.settlement?.status === 'CONFIRMED', conf.data?.settlement?.status);
  const confDup = await api(`/api/ecosystem/settlements/${stA.id}/confirm`, 'POST', HA, undefined);
  check('重复 confirm → 拒绝', confDup.code === 400, `${confDup.errorCode}`);
  const fin = await api(`/api/ecosystem/settlements/${stA.id}/finalize`, 'POST', HA, undefined);
  check('CONFIRMED → FINALIZED', fin.data?.settlement?.status === 'FINALIZED', fin.data?.settlement?.status);
  const finDup = await api(`/api/ecosystem/settlements/${stA.id}/finalize`, 'POST', HA, undefined);
  check('重复 finalize → 拒绝', finDup.code === 400, `${finDup.errorCode}`);
  const finDirect = await api(`/api/ecosystem/settlements/${stB.id}/finalize`, 'POST', HA, undefined);
  check('DRAFT 直接 finalize → 拒绝', finDirect.code === 400, `${finDirect.errorCode}`);

  // ── G5: 平台收入记录 ──
  console.log('\nG5: 平台收入记录（独立可查）');
  const listS = await api('/api/ecosystem/settlements?period=' + period, 'GET', HA, undefined);
  const platTotal = listS.data?.settlements?.reduce((acc, s) => acc + Number(s.platformAmount), 0);
  // API 按开发者隔离（devA 视角）→ 与 DB 中 devA 插件聚合同口径
  const dbPlatTotal = q(`SELECT COALESCE(SUM(platform_amount),0) FROM ecology_settlements WHERE period='${period}' AND developer_id='${devA.id}'`);
  check('平台收入汇总（API 隔离视角 = DB 同口径聚合）', platTotal === Number(dbPlatTotal), `platformTotal=${platTotal} db=${dbPlatTotal}`);
  const stAList = listS.data?.settlements?.find(s => s.pluginId === ecoA);
  check('结算列表含分成与平台收入', Number(stAList?.platformAmount) === 40 && Number(stAList?.developerAmount) === 160, `dev=${stAList?.developerAmount} plat=${stAList?.platformAmount}`);
  const allSettlements = await api('/api/ecosystem/settlements', 'GET', HB, undefined);
  check('组织 B 视角仅见 devB 插件结算（隔离）', allSettlements.data?.settlements?.every(s => s.developer?.developerId === devB.developerId), `count=${allSettlements.data?.settlements?.length}`);

  // ── 回归 ECO-01~06 ──
  console.log('\n回归 ECO-01~06（现有生态不受影响）');
  const ecoTables = q(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_%'`);
  check('ecology 表 18 → 21 张', Number(ecoTables) === 21, `tables=${ecoTables}`);
  const licChk = await api('/api/ecosystem/license/check', 'POST', HA, { pluginId: q(`SELECT plugin_id FROM ecology_plugins WHERE id='${ecoA}'`) });
  check('License 链路正常（ECO-04 回归）', licChk.data?.allowed === true, licChk.data?.reason);
  const mkChk = await api('/api/ecosystem/marketplace/items', 'GET', HA, undefined);
  check('Marketplace 正常（ECO-06 回归）', mkChk.code === 0 && mkChk.data?.items?.length >= 1, `items=${mkChk.data?.items?.length}`);
  const devMine = await api('/api/ecosystem/developer/mine', 'GET', HA, undefined);
  check('Developer 正常（ECO-05 回归）', devMine.code === 0, `code=${devMine.code}`);
  const rt = await api('/api/ecosystem/runtime-health', 'GET', HA, undefined);
  check('runtime-health 正常（ECO-03 回归）', rt?.code === 0, `code=${rt?.code}`);
  const changed = execSync(`cd ${REPO} && git diff --name-only HEAD -- backend/src backend/prisma/schema.prisma`, { encoding: 'utf8' }).split('\n').filter(Boolean);
  const eco7Only = changed.every(f => f.includes('settlement') || f === 'backend/src/index.ts' || f === 'backend/prisma/schema.prisma');
  check('ECO-07 改动仅限生态层新增', eco7Only, changed.join(', ') || '(无残留)');
  const bizFiles = execSync(`cd ${REPO} && git diff --name-only HEAD -- backend/src | grep -iE 'payment|subscription|commerce|wallet|withdraw|bank' || true`, { encoding: 'utf8' }).trim();
  check('Payment/Subscription/Commerce/钱包/提现/银行 零改动', bizFiles === '', bizFiles || '(合规)');

  // ── 回滚验证 ──
  console.log('\n回滚验证（DROP 3 新表 + 还原 price 列 → 重建幂等 → 恢复现场）');
  execSync(`psql "${PG}" -c "DROP TABLE IF EXISTS ecology_settlement_items; DROP TABLE IF EXISTS ecology_settlements; DROP TABLE IF EXISTS ecology_revenue_share_policies;"`, { encoding: 'utf8' });
  execSync(`psql "${PG}" -c "ALTER TABLE ecology_marketplace_items DROP COLUMN IF EXISTS price;"`, { encoding: 'utf8' });
  const afterDrop = q(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_%'`);
  check('DROP 后回到 18 张（无依赖）', Number(afterDrop) === 18, `tables=${afterDrop}`);
  const priceGone = q(`SELECT count(*) FROM information_schema.columns WHERE table_name='ecology_marketplace_items' AND column_name='price'`);
  check('price 列还原', priceGone === '0');
  execSync(`psql "${PG}" -f ${REPO}/backend/prisma/migrations/sprint-eco-07-revenue-settlement-foundation/migration.sql`, { encoding: 'utf8' });
  const afterRe = q(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_%'`);
  check('重建幂等（21 张）', Number(afterRe) === 21, `tables=${afterRe}`);
  const seedDef = q(`SELECT developer_rate FROM ecology_revenue_share_policies WHERE developer_id IS NULL AND plugin_id IS NULL`);
  check('平台默认策略种子重建', seedDef === '0.70', seedDef);
  const uniqIdx = q(`SELECT count(*) FROM pg_indexes WHERE indexname IN ('ecology_settlements_plugin_id_period_key')`);
  check('结算唯一索引保留', Number(uniqIdx) === 1);
  // 恢复现场：重新上架定价 + 安装 + 快照 + 结算
  await api('/api/ecosystem/marketplace/items', 'POST', HA, { pluginId: ecoA, displayName: 'ECO7 A 数据分析', category: 'agent', pricingModel: 'SUBSCRIPTION' });
  await api('/api/ecosystem/marketplace/items', 'POST', HB, { pluginId: ecoB, displayName: 'ECO7 B 内容助手', category: 'agent', pricingModel: 'SUBSCRIPTION' });
  q(`UPDATE ecology_marketplace_items SET price=100.00 WHERE plugin_id='${ecoA}'`);
  q(`UPDATE ecology_marketplace_items SET price=50.00 WHERE plugin_id='${ecoB}'`);
  await api('/api/ecosystem/marketplace/install', 'POST', HA, { pluginId: ecoA });
  await api('/api/ecosystem/marketplace/install', 'POST', HB, { pluginId: ecoA });
  await api('/api/ecosystem/marketplace/install', 'POST', HA, { pluginId: ecoB });
  await api('/api/ecosystem/marketplace/revenue-snapshot', 'POST', HA, { period });
  await api('/api/ecosystem/settlements/policies', 'PUT', HA, { developerId: devA.id, developerRate: 0.80, platformRate: 0.20 });
  await api('/api/ecosystem/settlements/policies', 'PUT', HB, { developerId: devB.id, pluginId: ecoB, developerRate: 0.90, platformRate: 0.10 });
  const reSettle = await api('/api/ecosystem/settlements/settle', 'POST', HA, { period });
  check('恢复现场（重结算成功）', reSettle.code === 0 && reSettle.data?.count >= 2, `count=${reSettle.data?.count}`);

  console.log(`\n══════════════════════════════════════════`);
  console.log(` 结果: ${PASS} PASS / ${FAIL} FAIL`);
  if (failures.length) console.log(` 失败项: ${failures.join(', ')}`);
  console.log(`══════════════════════════════════════════\n`);
  process.exit(FAIL === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
