-- is_family を public から private スキーマへ移動する（既適用環境向け）
-- クリーンインストール（db reset）では 000002 が private.is_family を直接作成するため、
-- このマイグレーションは冪等になるよう CREATE OR REPLACE / DROP IF EXISTS で記述する

CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.is_family(user_a uuid, user_b uuid)
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

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_family(uuid, uuid) TO authenticated;

-- public.is_family に依存するポリシーを先に削除してから関数を削除する
-- （先に DROP FUNCTION すると依存関係エラーになるため順序が重要）
DROP POLICY IF EXISTS "posts_select_family" ON public.posts;
DROP POLICY IF EXISTS "likes_select_visible_post" ON public.likes;
DROP POLICY IF EXISTS "likes_insert_self_visible_post" ON public.likes;

DROP FUNCTION IF EXISTS public.is_family(uuid, uuid);

-- private.is_family を使うポリシーを再作成する
CREATE POLICY "posts_select_family" ON public.posts
  FOR SELECT TO authenticated
  USING (visibility = 'family' AND private.is_family((select auth.uid()), user_id));

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
          OR (p.visibility = 'family' AND private.is_family((select auth.uid()), p.user_id))
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
          OR (p.visibility = 'family' AND private.is_family((select auth.uid()), p.user_id))
        )
    )
  );
