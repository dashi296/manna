ALTER TABLE scripture_verses ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'ja';

ALTER TABLE scripture_verses DROP CONSTRAINT IF EXISTS scripture_verses_pkey;
ALTER TABLE scripture_verses ADD CONSTRAINT scripture_verses_pkey
  PRIMARY KEY (collection_id, book_id, chapter, verse, language);
