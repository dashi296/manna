-- posts は content / visibility 以外を更新できないようにする。
-- GRANT は列を指定せず UPDATE を許しており、RLS は「どの行か」しか制限しない。
-- 聖典参照を後から変えられると、章ページの節バブルから見て投稿が別の節へ移動する。
-- RLS の WITH CHECK では OLD を参照できないためトリガーで守る。
CREATE OR REPLACE FUNCTION public.protect_post_immutable_cols()
RETURNS trigger AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.user_id IS DISTINCT FROM NEW.user_id
    OR OLD.scripture_collection IS DISTINCT FROM NEW.scripture_collection
    OR OLD.scripture_book IS DISTINCT FROM NEW.scripture_book
    OR OLD.scripture_chapter IS DISTINCT FROM NEW.scripture_chapter
    OR OLD.scripture_verses IS DISTINCT FROM NEW.scripture_verses
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'only content and visibility may be updated on posts';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER posts_protect_immutable
  BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.protect_post_immutable_cols();
