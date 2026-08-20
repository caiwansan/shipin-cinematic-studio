const fs = require('fs');
let s = fs.readFileSync('prisma/schema.prisma', 'utf8');
const roomAnchor = '  @@map("city_room")\n}';
if (!s.includes('allowImage')) {
  const add = '  allowImage Boolean  @default(true) @map("allow_image")\n' +
             '  allowVideo Boolean  @default(true) @map("allow_video")\n' +
             '  allowFile  Boolean  @default(true) @map("allow_file")\n' +
             '  allMuted   Boolean  @default(false) @map("all_muted")\n';
  s = s.replace(roomAnchor, add + roomAnchor);
}
const memAnchor = '  @@map("city_room_member")\n}';
if (!s.includes('muted    Boolean')) {
  s = s.replace(memAnchor, '  muted    Boolean  @default(false)\n' + memAnchor);
}
fs.writeFileSync('prisma/schema.prisma', s);
console.log('SCHEMA_PATCHED');
