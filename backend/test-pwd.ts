import bcrypt from 'bcrypt'
const hash = '$2a$10$hlFKBKomQg1P7oWj9pt4Oe2qMKVP5I9WvLrDhEvZDiF0ZhEkyy/iu'
const passwords = ['admin', 'admin123', '123456', 'password', 'kunlun', 'kunlunjing', 'fushtn', '12345678']
async function test() {
  for (const p of passwords) {
    const ok = await bcrypt.compare(p, hash)
    if (ok) console.log('FOUND:', p)
  }
}
test()
