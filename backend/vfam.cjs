const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  for (const t of ['family_member', 'family_archive']) {
    try {
      const cols = await p.$queryRawUnsafe("select column_name from information_schema.columns where table_name = $1 order by ordinal_position", t);
      console.log(t + ' cols: ' + cols.map(x => x.column_name).join(','));
    } catch (e) { console.log(t + ' ERR: ' + e.message.slice(0, 90)); }
  }
  process.exit(0);
})().catch(e => { console.log('ER', e.message.slice(0, 100)); process.exit(1); });
