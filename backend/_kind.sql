ALTER TABLE im_group ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'normal';
UPDATE im_group SET kind='clan' WHERE name='蔡氏宗亲';
