const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');
// City 加治理字段
if (!s.includes('pubAllMuted')) {
  const anchor = '  status    String   @default("active") @db.Text\n  createdAt DateTime @default(now()) @map("created_at")\n  @@map("city")\n}';
  const add = '  pubAllMuted   Boolean  @default(false) @map("pub_all_muted")\n' +
              '  pubAllowImage Boolean  @default(true) @map("pub_allow_image")\n' +
              '  pubAllowVideo Boolean  @default(true) @map("pub_allow_video")\n' +
              '  pubAllowFile  Boolean  @default(true) @map("pub_allow_file")\n';
  const out = s.replace(anchor, '  status    String   @default("active") @db.Text\n' + add + '  createdAt DateTime @default(now()) @map("created_at")\n  @@map("city")\n}');
  if (out === s) { console.log('CITY_ANCHOR_MISS'); process.exit(1); }
  s = out;
}
// CityMember 加 muted
if (!s.includes('muted    Boolean')) {
  const anchor2 = '  status       String    @default("pending") @db.Text\n  lastActiveAt DateTime? @map("last_active_at")\n';
  const out2 = s.replace(anchor2, '  status       String    @default("pending") @db.Text\n  muted        Boolean   @default(false)\n  lastActiveAt DateTime? @map("last_active_at")\n');
  if (out2 === s) { console.log('MEM_ANCHOR_MISS'); process.exit(1); }
  s = out2;
}
fs.writeFileSync('prisma/schema.prisma', s);
console.log('GOV_SCHEMA_PATCHED');
