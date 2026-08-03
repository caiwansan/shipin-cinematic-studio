/**
 * SPRINT-ECO-08 — Reality Gate
 * SaaS Affiliate + Partner Revenue Share（掌柜冻结术语）
 *
 * G1 等级配置冻结 — 6 级名称/门槛/比例，配置表驱动（不写死）
 * G2 小区算法 — A 树 B100万/C30万/D20万 → 去最大线 → 小区 = 50万（掌柜示例）
 * G3 收益来源唯一 — performance 只 join ecology_settlements；无 install/download/register/invite 依据
 * G4 等级分红 — 小区业绩 → 命中等级 → accruedReward = 小区 × rate
 * G5 配置驱动 — 改 policy 后等级判定/分红变化（不写死）
 * G6 零污染 — 只新增 ecology_partner* 表；settlements/商业表零改动
 * G7 团队树递归 — 孙辈业绩计入团队，直接下线线正确
 */
import { PrismaClient } from '@prisma/client';
import {
  computeSmallAreaPerformance,
  resolvePartnerLevel,
  computeAccruedReward,
  PartnerRevenueService,
} from '../src/ecosystem/partner-revenue.service.js';

const prisma = new PrismaClient();
const PERIOD = '2026-08';
const SUFFIX = Date.now().toString(36);
let pass = 0, fail = 0;

function ok(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}${extra ? ' — ' + extra : ''}`); }
  else { fail++; console.log(`  ❌ ${name}${extra ? ' — ' + extra : ''}`); }
}
const dec = (v) => Number(v);

// ── G1: 等级配置冻结 ─────────────────────────────────────
console.log('\nG1: 等级配置冻结（配置表驱动）');
const svc = new PartnerRevenueService(prisma);
const policies = await svc.getActivePolicies();
ok('6 级配置存在', policies.length === 6, `levels=${policies.length}`);
const EXPECTED = [
  [1, '普通推广伙伴', 0, 0.02],
  [2, '生态推广伙伴', 100000, 0.025],
  [3, '区域生态伙伴', 300000, 0.03],
  [4, '城市生态伙伴', 600000, 0.035],
  [5, '省级生态伙伴', 1200000, 0.04],
  [6, '平台生态合伙人', 3000000, 0.05],
];
for (const [level, name, minP, rate] of EXPECTED) {
  const p = policies.find((x) => x.level === level);
  ok(`等级 ${level} ${name}`, p && p.levelName === name && dec(p.minPerformance) === minP && dec(p.rewardRate) === rate,
    `min=${dec(p?.minPerformance)} rate=${dec(p?.rewardRate)}`);
}

// ── G2: 小区算法纯函数（掌柜示例） ───────────────────────
console.log('\nG2: 小区算法（团队总业绩 - 最大业绩线 = 小区业绩）');
const r2 = computeSmallAreaPerformance(1500000, [1000000, 300000, 200000]);
ok('A 树 B100万/C30万/D20万 → 小区 50万', dec(r2.maxLine) === 1000000 && dec(r2.smallArea) === 500000,
  `maxLine=${dec(r2.maxLine)} smallArea=${dec(r2.smallArea)}`);
const r2b = computeSmallAreaPerformance(800000, []);
ok('无下线 → 小区 = 团队', dec(r2b.maxLine) === 0 && dec(r2b.smallArea) === 800000);

// ── G3+G4: 收益来源唯一 + 等级分红（构造真实 settlement 数据） ──
console.log('\nG3: 收益来源唯一（ecology_settlements） + G4: 等级分红');
// 构造：A(orgA) 无业绩；B(orgB)=100万 C(orgC)=30万 D(orgD)=20万，B/C/D sponsor=A
const orgs = ['orgA', 'orgB', 'orgC', 'orgD'].map((o) => `${o}_${SUFFIX}`);
const [orgA, orgB, orgC, orgD] = orgs;
const partnerIds = {};
for (const [key, org, sponsor] of [['A', orgA, null], ['B', orgB, orgA], ['C', orgC, orgA], ['D', orgD, orgA]]) {
  const p = await prisma.ecologyPartner.create({
    data: { partnerId: `eco08_${key}_${SUFFIX}`, userId: `u_${key}_${SUFFIX}`, organizationId: org, partnerName: `Eco08-${key}`, sponsorPartnerId: sponsor ? partnerIds[sponsor.slice(0, -1 - SUFFIX.length)] : undefined },
  });
  partnerIds[key] = p.id;
  partnerIds[`${key}Org`] = org;
}
// 修正 sponsor 指向（sponsor 参数传的是 org id，需换成 partner id）
await prisma.ecologyPartner.update({ where: { id: partnerIds.B }, data: { sponsorPartnerId: partnerIds.A } });
await prisma.ecologyPartner.update({ where: { id: partnerIds.C }, data: { sponsorPartnerId: partnerIds.A } });
await prisma.ecologyPartner.update({ where: { id: partnerIds.D }, data: { sponsorPartnerId: partnerIds.A } });

// 每个 org 建 developer + plugin + settlement
const settlements = [
  ['B', 1000000], ['C', 300000], ['D', 200000],
];
for (const [key, gross] of settlements) {
  const dev = await prisma.ecologyDeveloper.create({
    data: { developerId: `dev_${key}_${SUFFIX}`, userId: `du_${key}_${SUFFIX}`, organizationId: partnerIds[`${key}Org`], developerName: `Dev-${key}-${SUFFIX}` },
  });
  const plugin = await prisma.ecologyPlugin.create({
    data: { pluginId: `eco08-plug-${key}-${SUFFIX}`, name: `Eco08 Plugin ${key}`, type: 'agent', author: dev.developerId },
  });
  await prisma.ecologySettlement.create({
    data: { period: PERIOD, pluginId: plugin.id, developerId: dev.id, grossAmount: gross, developerAmount: 0, platformAmount: 0, status: 'FINALIZED', detail: { source: 'eco08-gate' } },
  });
}

// 计算 A 的业绩
const perfA = await svc.computePerformance(partnerIds.A, PERIOD);
ok('A 团队总业绩 = 150万（B100+C30+D20）', dec(perfA.performance.teamPerformance) === 1500000,
  `team=${dec(perfA.performance.teamPerformance)}`);
ok('A 最大业绩线 = B 100万', dec(perfA.performance.maxLinePerformance) === 1000000);
ok('A 小区业绩 = 50万（掌柜示例复现）', dec(perfA.performance.smallAreaPerformance) === 500000,
  `smallArea=${dec(perfA.performance.smallAreaPerformance)}`);
ok('A 命中等级 3 区域生态伙伴（50万 ≥ 30万）', perfA.performance.level === 3, `level=${perfA.performance.level} rate=${dec(perfA.performance.rewardRate)}`);
ok('A 应计分红 = 50万 × 3% = 15000', dec(perfA.performance.accruedReward) === 15000,
  `accrued=${dec(perfA.performance.accruedReward)}`);
ok('应计分红记录 ACCRUED（不发放）', perfA.reward.status === 'ACCRUED' && dec(perfA.reward.rewardAmount) === 15000);

// 收益来源唯一代码审计：服务代码无 install/download/register/invite 作为收益依据
// （剥除注释后再查，避免命中「禁止清单」注释本身——自指误报）
const svcSrc = await (await import('node:fs')).promises.readFile(new URL('../src/ecosystem/partner-revenue.service.ts', import.meta.url), 'utf8');
const noComment = svcSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');
const banned = ['install', 'download', 'invite'];
const bannedHits = banned.filter((b) => new RegExp(`(?<!re)${b}`, 'i').test(noComment));
ok('收益依据代码审计：无 install/download/invite 收益逻辑', bannedHits.length === 0, bannedHits.length ? `命中: ${bannedHits}` : '');
// register 仅允许作为 REGISTERED 登记标注（未接支付实收 0 的诚实标注，ECO-07 沿用）
const regHits = [...noComment.matchAll(/(?<!re)register/gi)];
const regOk = regHits.every((h) => noComment.slice(Math.max(0, h.index - 12), h.index + 14).toUpperCase().includes('REGISTERED'));
ok('register 仅作为 REGISTERED 登记标注（非收益依据）', regOk, `hits=${regHits.length}`);
// SQL 审计：聚合只来自 ecology_settlements
ok('聚合 SQL 仅来自 ecology_settlements', svcSrc.includes('FROM ecology_settlements') && !svcSrc.includes('FROM ecology_installs') && !svcSrc.includes('FROM ecology_plugin_installations'));

// 计算 B 直接下线业绩（B 无下线 → 小区 = 团队 = 100万 → 等级 4 城市生态伙伴 3.5%）
const perfB = await svc.computePerformance(partnerIds.B, PERIOD);
ok('B 小区 = 100万 → 等级 4（城市生态伙伴 3.5%）', perfB.performance.level === 4 && dec(perfB.performance.accruedReward) === 35000,
  `level=${perfB.performance.level} accrued=${dec(perfB.performance.accruedReward)}`);

// ── G5: 配置驱动（改 policy → 判定变化） ─────────────────
console.log('\nG5: 分红规则配置驱动（不写死）');
const lvl2 = policies.find((p) => p.level === 2);
// 把 level 2 门槛从 10万 改到 5万 → A 小区 50万仍 level 3；再把 level 3 比例改 4% → 分红变 20000
const lvl3Before = dec(perfA.performance.rewardRate);
await prisma.ecologyPartnerLevelPolicy.update({ where: { level: 3 }, data: { rewardRate: 0.04 } });
const perfA2 = await svc.computePerformance(partnerIds.A, PERIOD);
ok('改 level3 rate 0.03→0.04 后 A 分红 = 20000', dec(perfA2.performance.accruedReward) === 20000,
  `accrued=${dec(perfA2.performance.accruedReward)}`);
await prisma.ecologyPartnerLevelPolicy.update({ where: { level: 3 }, data: { rewardRate: lvl3Before } });
const perfA3 = await svc.computePerformance(partnerIds.A, PERIOD);
ok('还原 rate 后分红回到 15000', dec(perfA3.performance.accruedReward) === 15000);
void lvl2;

// ── G7: 团队树递归（孙辈计入团队） ───────────────────────
console.log('\nG7: 团队树递归（孙辈业绩计入）');
const pE = await prisma.ecologyPartner.create({
  data: { partnerId: `eco08_E_${SUFFIX}`, userId: `u_E_${SUFFIX}`, organizationId: `orgE_${SUFFIX}`, partnerName: 'Eco08-E', sponsorPartnerId: partnerIds.D },
});
const devE = await prisma.ecologyDeveloper.create({
  data: { developerId: `dev_E_${SUFFIX}`, userId: `du_E_${SUFFIX}`, organizationId: `orgE_${SUFFIX}`, developerName: 'Dev-E' },
});
const pluginE = await prisma.ecologyPlugin.create({
  data: { pluginId: `eco08-plug-E-${SUFFIX}`, name: 'Eco08 Plugin E', type: 'tool', author: devE.developerId },
});
await prisma.ecologySettlement.create({
  data: { period: PERIOD, pluginId: pluginE.id, developerId: devE.id, grossAmount: 100000, developerAmount: 0, platformAmount: 0, status: 'FINALIZED', detail: { source: 'eco08-gate' } },
});
const perfA4 = await svc.computePerformance(partnerIds.A, PERIOD);
ok('孙辈 E(10万) 计入 → A 团队 160万', dec(perfA4.performance.teamPerformance) === 1600000,
  `team=${dec(perfA4.performance.teamPerformance)}`);
ok('最大线仍 B 100万 → 小区 60万', dec(perfA4.performance.smallAreaPerformance) === 600000,
  `smallArea=${dec(perfA4.performance.smallAreaPerformance)}`);
const perfD = await svc.computePerformance(partnerIds.D, PERIOD);
ok('D 线 = 自身20万 + 孙辈E10万 = 30万', dec(perfD.performance.teamPerformance) === 300000,
  `team=${dec(perfD.performance.teamPerformance)}`);

// ── G6: 零污染 ───────────────────────────────────────────
console.log('\nG6: 零污染（只新增 ecology_partner* 表 + 生态服务文件）');
const tables = await prisma.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'ecology_partner%' ORDER BY table_name`);
ok('ecology_partner* 表恰 4 张', tables.length === 4, tables.map((t) => t.table_name).join(','));
const partnerTables = new Set(tables.map((t) => t.table_name));
for (const t of ['ecology_partner_level_policies', 'ecology_partners', 'ecology_partner_performances', 'ecology_partner_rewards']) {
  ok(`表 ${t} 存在`, partnerTables.has(t));
}
// settlements 结构未变（列集合与 ECO-07 一致）
const settlementCols = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='ecology_settlements' ORDER BY ordinal_position`);
ok('ecology_settlements 结构未变（12 列原样）', settlementCols.length === 12, `cols=${settlementCols.length}`);
// 商业表零新增
const bizTables = await prisma.$queryRawUnsafe(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE '%payment%' OR table_name LIKE '%subscription%' OR table_name LIKE '%wallet%' OR table_name LIKE '%order%') AND table_name LIKE 'ecology%'`);
ok('ecology 下无 payment/subscription/wallet/order 表', bizTables.length === 0);

// ── 清理测试数据（精确匹配本 gate 前缀，绝不碰其他 sprint 数据） ──
await prisma.ecologyPartner.deleteMany({ where: { partnerId: { startsWith: `eco08_` } } });
await prisma.ecologyPlugin.deleteMany({ where: { pluginId: { startsWith: 'eco08-plug-' } } });
await prisma.ecologyDeveloper.deleteMany({ where: { developerId: { in: [`dev_B_${SUFFIX}`, `dev_C_${SUFFIX}`, `dev_D_${SUFFIX}`, `dev_E_${SUFFIX}`] } } });

console.log(`\n════════ ECO-08 Reality Gate: ${pass} PASS / ${fail} FAIL ════════`);
process.exit(fail > 0 ? 1 : 0);
