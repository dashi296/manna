-- フォロワータブ: WHERE following_id = ? ORDER BY created_at DESC, follower_id DESC
CREATE INDEX IF NOT EXISTS follows_following_created_idx
  ON public.follows (following_id, created_at DESC, follower_id DESC);

-- フォロー中タブ: WHERE follower_id = ? ORDER BY created_at DESC, following_id DESC
CREATE INDEX IF NOT EXISTS follows_follower_created_idx
  ON public.follows (follower_id, created_at DESC, following_id DESC);
