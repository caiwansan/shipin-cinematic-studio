
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.routeConfig.findFirst({ where: { scope: 'tea', key: 'config' } }).then(async r => {
    console.log('raw value:', r.value);
    console.log('type:', typeof r.value);
    try {
        const v = JSON.parse(r.value);
        console.log('parsed OK:', JSON.stringify(v, null, 2));
    } catch(e) {
        console.log('parse error:', e.message);
    }
    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
