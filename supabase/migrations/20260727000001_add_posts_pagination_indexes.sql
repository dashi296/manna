-- 全体タブ: WHERE visibility = 'public' ORDER BY created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS posts_public_created_idx
  ON public.posts (visibility, created_at DESC, id DESC);

-- フォロー中タブとプロフィール投稿一覧:
--   WHERE user_id IN (...) / = ? ORDER BY created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS posts_user_created_idx
  ON public.posts (user_id, created_at DESC, id DESC);

-- 先頭列が同じ posts_user_created_idx が user_id 単独の検索も satisfy するため
DROP INDEX IF EXISTS public.posts_user_id_idx;
