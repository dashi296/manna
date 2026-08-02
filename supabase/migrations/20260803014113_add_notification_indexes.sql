-- 通知一覧は user_id で絞らず RLS の notifications_select_own に任せているため、
-- インデックスが無いと全ユーザー分をスキャンしてからソートしていた。
-- posts_user_created_idx と同じ形にして、インデックスから直接 50 件取れるようにする。
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC, id DESC);

-- FK 列は自動でインデックスされないため、ON DELETE CASCADE が全表スキャンになる
CREATE INDEX IF NOT EXISTS notifications_post_id_idx
  ON public.notifications (post_id);

CREATE INDEX IF NOT EXISTS notifications_actor_id_idx
  ON public.notifications (actor_id);

-- likes の主キーは (post_id, user_id) で user_id が先頭ではないため、
-- ユーザー削除時のカスケードに効くインデックスが無い
CREATE INDEX IF NOT EXISTS likes_user_id_idx
  ON public.likes (user_id);
