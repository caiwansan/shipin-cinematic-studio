const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');
const anchor = '  status    String   @default("active") @db.Text\n  createdAt DateTime @default(now()) @map("created_at")\n  @@map("city_post")\n}';
if (!s.includes('likes     String')) {
  const add = '  likes     String   @default("[]") @db.Text\n' +
             '  comments  String   @default("[]") @db.Text\n';
  const out = s.replace(anchor, '  status    String   @default("active") @db.Text\n' + add + '  createdAt DateTime @default(now()) @map("created_at")\n  @@map("city_post")\n}');
  if (out === s) { console.log('ANCHOR_MISS'); process.exit(1); }
  fs.writeFileSync('prisma/schema.prisma', out);
  console.log('POST_SCHEMA_PATCHED');
} else {
  console.log('already');
}
