# -*- coding: utf-8 -*-
raw=open('/root/shipin-cinematic-studio/backend/prisma/schema.bak-20260818.prisma',encoding='utf-8').read()
claim=
model CityRoomClaim {
  id        String   @id @default(dbgenerated("gen_random_uuid()::text")) @db.Text
  cityId    String   @map("city_id") @db.Text
  name      String   @db.Text
  uid       String   @db.Text
  status    String   @default("pending") @db.Text
  createdAt DateTime @default(now()) @map("created_at")

  @@map("city_room_claim")
}


assert 'model CityPost {' in raw
s=raw.replace('model CityPost {', claim+'model CityPost {', 1)
open('/root/shipin-cinematic-studio/backend/prisma/schema.prisma','w',encoding='utf-8').write(s)
print('OK len', len(s))
