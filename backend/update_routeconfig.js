
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.routeConfig.findFirst({ where: { scope: 'tea', key: 'config' } }).then(async r => {
    const v = typeof r.value === 'string' ? JSON.parse(r.value) : r.value;
    v.apkSha256 = '414c728d324d23e66e59853d087141bc323eb6a7bf48f4834de9436d116df978';
    v.apkSize = 50951704;
    v.updatedAt = new Date().toISOString();
    await p.routeConfig.update({ where: { id: r.id }, data: { value: JSON.stringify(v) } });
    console.log('routeConfig updated:', JSON.stringify(v, null, 2));
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
