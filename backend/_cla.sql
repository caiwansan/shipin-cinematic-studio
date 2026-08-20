CREATE TABLE IF NOT EXISTS family_clan_apply (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  uid TEXT NOT NULL,
  group_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  note TEXT NOT NULL DEFAULT '',
  created_at BIGINT NOT NULL DEFAULT 0
);
