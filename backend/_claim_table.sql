
CREATE TABLE IF NOT EXISTS city_room_claim (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  city_id TEXT NOT NULL,
  name TEXT NOT NULL,
  uid TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
