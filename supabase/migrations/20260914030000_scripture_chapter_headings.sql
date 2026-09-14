-- 章のタイトルと概要文。取得元のレスポンスには元から含まれていたが、
-- これまで節本文だけを取り込んでいた。
-- 概要があるのは回復された聖典だけで、旧約・新約には段落自体が無いため
-- summary は NULL を許す（タイトルは全章にある）
CREATE TABLE IF NOT EXISTS scripture_chapter_headings (
  collection_id text NOT NULL,
  book_id text NOT NULL,
  chapter integer NOT NULL,
  -- キー列に既定値を置かない。言語を指定し忘れた行が黙って入るのを防ぐ
  language text NOT NULL,
  title text NOT NULL,
  summary text,
  summary_html text,
  PRIMARY KEY (collection_id, book_id, chapter, language),
  FOREIGN KEY (collection_id, book_id)
    REFERENCES scripture_books(collection_id, id) ON DELETE CASCADE
);

ALTER TABLE scripture_chapter_headings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON scripture_chapter_headings TO anon, authenticated;

CREATE POLICY "scripture_chapter_headings_select_all"
  ON scripture_chapter_headings FOR SELECT
  TO anon, authenticated
  USING (true);
