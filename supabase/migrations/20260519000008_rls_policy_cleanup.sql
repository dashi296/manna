-- ============================================================
-- CLAUDE.md ガイドラインへの準拠
-- 1. auth.uid() → (select auth.uid()) でキャッシュ最適化
-- 2. TO authenticated / TO anon でロールを明示
-- ============================================================

-- users
DROP POLICY "users_select_all" ON public.users;
DROP POLICY "users_insert_self" ON public.users;

CREATE POLICY "users_select_all" ON public.users
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "users_insert_self" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- posts SELECT
DROP POLICY "posts_select_public" ON public.posts;
DROP POLICY "posts_select_own" ON public.posts;
DROP POLICY "posts_select_followers" ON public.posts;
DROP POLICY "posts_select_family" ON public.posts;

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
DROP POLICY "posts_insert_own" ON public.posts;
DROP POLICY "posts_update_own" ON public.posts;
DROP POLICY "posts_delete_own" ON public.posts;

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

-- likes SELECT / INSERT / DELETE
DROP POLICY "likes_select_visible_post" ON public.likes;
DROP POLICY "likes_insert_self_visible_post" ON public.likes;
DROP POLICY "likes_delete_self" ON public.likes;

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

-- follows SELECT / INSERT / DELETE
DROP POLICY "follows_select_all" ON public.follows;
DROP POLICY "follows_insert_self" ON public.follows;
DROP POLICY "follows_delete_self" ON public.follows;

-- フォロー関係は公開情報（公開プロフィールに準ずる）
CREATE POLICY "follows_select_all" ON public.follows
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "follows_insert_self" ON public.follows
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = follower_id);

CREATE POLICY "follows_delete_self" ON public.follows
  FOR DELETE TO authenticated
  USING ((select auth.uid()) = follower_id);

-- family_relationships SELECT / INSERT / UPDATE / DELETE
DROP POLICY "family_select_own" ON public.family_relationships;
DROP POLICY "family_insert_self" ON public.family_relationships;
DROP POLICY "family_update_addressee" ON public.family_relationships;
DROP POLICY "family_delete_own" ON public.family_relationships;

CREATE POLICY "family_select_own" ON public.family_relationships
  FOR SELECT TO authenticated
  USING (
    (select auth.uid()) = requester_id
    OR (select auth.uid()) = addressee_id
  );

CREATE POLICY "family_insert_self" ON public.family_relationships
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = requester_id);

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

-- notifications SELECT / UPDATE
DROP POLICY "notifications_select_own" ON public.notifications;
DROP POLICY "notifications_update_own" ON public.notifications;

CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
