
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.routeConfig.findFirst({ where: { scope: 'tea', key: 'config' } }).then(async r => {
    console.log('raw value:', r.value);
    console.log('type:', typeof r.value);
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
