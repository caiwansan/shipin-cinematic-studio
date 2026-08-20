import fs from 'fs'
let s = fs.readFileSync('prisma/schema.prisma', 'utf8')
if (!s.includes('model FamilyPost')) {
  const model = `
model FamilyPost {
  id        String   @id @default(dbgenerated("gen_random_uuid()::text")) @db.Text
  groupId   String   @map("group_id") @db.Text
  uid       String   @db.Text
  content   String   @db.Text
  images    String   @default("[]") @db.Text
  likes     String   @default("[]") @db.Text
  comments  String   @default("[]") @db.Text
  gifts     Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  @@map("family_post")
}
`
  // 插到 TeaPost model 后
  const anchor = 'model City {'
  if (!s.includes(anchor)) { console.log('ANCHOR MISS'); process.exit(1) }
  s = s.replace(anchor, model + '
' + anchor, 1)
  fs.writeFileSync('prisma/schema.prisma', s)
  console.log('FAMILY_MODEL_ADDED')
} else { console.log('MODEL_EXISTS') }
