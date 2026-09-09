const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.routeConfig.findFirst({ where: { scope: 'tea', key: 'config' } }).then(r => {
    const v = JSON.parse(r.value);
    v.apkSha256 = '4FDA1FE7F82055A322DD37703A84BE73F6CA76D37AC5CAA0FEE84AEB2C9CC5ED';
    v.apkSize = 50951704;
    v.apkUrl = 'https://aigc.fushtn.com/releases/desktop/mobile/kunlun-tea-NATIVE-v1.2.5.apk';
    v.latestVersion = '1.2.5';
    v.latestVersionCode = '1205';
    p.routeConfig.update({ where: { id: r.id }, data: { value: JSON.stringify(v) } }).then(() => {
        console.log('routeConfig updated OK');
        process.exit(0);
    }).catch(e => { console.error('update error:', e.message); process.exit(1); });
}).catch(e => { console.error('find error:', e.message); process.exit(1); });
