ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ファミリー判定ヘルパー関数
-- SECURITY DEFINER で RLS をバイパスして family_relationships を参照する
-- SET search_path = '' で search_path インジェクション攻撃を防ぐ
CREATE OR REPLACE FUNCTION public.is_family(user_a uuid, user_b uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_relationships
    WHERE status = 'accepted'
    AND (
      (requester_id = user_a AND addressee_id = user_b) OR
      (requester_id = user_b AND addressee_id = user_a)
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';

-- users
CREATE POLICY "users_select_all" ON public.users
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "users_update_self" ON public.users
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

-- posts SELECT（複数の SELECT ポリシーは OR で評価される）
CREATE POLICY "posts_select_public" ON public.posts
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public');

CREATE POLICY "posts_select_own" ON public.posts
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "posts_select_followers" ON public.posts
  FOR SELECT TO authenticated
  USING (
    visibility = 'followers'
    AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = (select auth.uid()) AND following_id = posts.user_id
    )
  );

CREATE POLICY "posts_select_family" ON public.posts
  FOR SELECT TO authenticated
  USING (visibility = 'family' AND public.is_family((select auth.uid()), user_id));

-- posts INSERT / UPDATE / DELETE
CREATE POLICY "posts_insert_own" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "posts_update_own" ON public.posts
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "posts_delete_own" ON public.posts
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- likes SELECT: 閲覧可能な投稿のいいねのみ参照できる
CREATE POLICY "likes_select_visible_post" ON public.likes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = likes.post_id
        AND (
          p.visibility = 'public'
          OR p.user_id = (select auth.uid())
          OR (
            p.visibility = 'followers'
            AND EXISTS (
              SELECT 1 FROM public.follows
              WHERE follower_id = (select auth.uid()) AND following_id = p.user_id
            )
          )
          OR (p.visibility = 'family' AND public.is_family((select auth.uid()), p.user_id))
        )
    )
  );

-- likes INSERT: 閲覧権限のない投稿への like を防ぐ
CREATE POLICY "likes_insert_self_visible_post" ON public.likes
  FOR INSERT TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = likes.post_id
        AND (
          p.visibility = 'public'
          OR p.user_id = (select auth.uid())
          OR (
            p.visibility = 'followers'
            AND EXISTS (
              SELECT 1 FROM public.follows
              WHERE follower_id = (select auth.uid()) AND following_id = p.user_id
            )
          )
          OR (p.visibility = 'family' AND public.is_family((select auth.uid()), p.user_id))
        )
    )
  );

CREATE POLICY "likes_delete_self" ON public.likes
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = user_id);

-- follows（フォロー関係は公開情報）
CREATE POLICY "follows_select_all" ON public.follows
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "follows_insert_self" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = follower_id);

CREATE POLICY "follows_delete_self" ON public.follows
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = follower_id);

-- family_relationships
CREATE POLICY "family_select_own" ON public.family_relationships
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = requester_id
    OR (select auth.uid()) = addressee_id
  );

CREATE POLICY "family_insert_self" ON public.family_relationships
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = requester_id);

-- addressee のみ status を更新可能（承認/拒否）
CREATE POLICY "family_update_addressee" ON public.family_relationships
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = addressee_id)
  WITH CHECK ((select auth.uid()) = addressee_id);

CREATE POLICY "family_delete_own" ON public.family_relationships
  FOR DELETE TO authenticated
  USING (
    (select auth.uid()) = requester_id
    OR (select auth.uid()) = addressee_id
  );

-- notifications
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- read フィールドのみ更新可（他フィールドはトリガーで保護）
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
