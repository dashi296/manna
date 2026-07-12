CREATE TABLE IF NOT EXISTS scripture_collections (
  id text PRIMARY KEY,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scripture_books (
  id text NOT NULL,
  collection_id text NOT NULL REFERENCES scripture_collections(id) ON DELETE CASCADE,
  name text NOT NULL,
  chapters integer NOT NULL,
  verses integer[] NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, id)
);

CREATE INDEX IF NOT EXISTS scripture_books_id_idx ON scripture_books (id);

ALTER TABLE scripture_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE scripture_books ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON scripture_collections TO anon, authenticated;
GRANT SELECT ON scripture_books TO anon, authenticated;

CREATE POLICY "scripture_collections_select_all"
  ON scripture_collections FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "scripture_books_select_all"
  ON scripture_books FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS scripture_verses (
  collection_id text NOT NULL,
  book_id text NOT NULL,
  chapter integer NOT NULL,
  verse integer NOT NULL,
  text text NOT NULL,
  text_html text NOT NULL,
  PRIMARY KEY (collection_id, book_id, chapter, verse),
  FOREIGN KEY (collection_id, book_id)
    REFERENCES scripture_books(collection_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS scripture_verses_text_gin
  ON scripture_verses USING GIN (to_tsvector('simple', text));

ALTER TABLE scripture_verses ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON scripture_verses TO anon, authenticated;

CREATE POLICY "scripture_verses_select_all"
  ON scripture_verses FOR SELECT
  TO anon, authenticated
  USING (true);
