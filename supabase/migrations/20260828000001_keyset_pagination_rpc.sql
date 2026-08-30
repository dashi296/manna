-- #92: keyset ページングを (created_at, id) の行比較にするには PostgREST の .or() では
-- 書けない（行比較を式にできない）ため、SQL 関数に寄せる。security invoker なので
-- 呼び出し側の RLS はそのまま効く。search_path を空にするため、参照は全てスキーマ修飾する。
--
-- カーソル引数は DEFAULT NULL にして、1ページ目の呼び出しでは省略できるようにする
-- （Postgres の制約で DEFAULT 付き引数は末尾に置く必要があるため、page_size /
-- target_user_id を先に置く）。page_size 自体は呼び出し側が常に明示的に渡す。

-- 全体タブ: visibility = 'public' を (created_at, id) の行比較で降順ページング
CREATE OR REPLACE FUNCTION public.posts_feed_public(
  page_size int,
  cursor_created_at timestamptz DEFAULT NULL,
  cursor_id uuid DEFAULT NULL
)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
  FROM public.posts p
  WHERE p.visibility = 'public'
    AND (
      cursor_created_at IS NULL
      OR (p.created_at, p.id) < (cursor_created_at, cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT page_size;
$$;

-- フォロー中タブ: follows を毎ページ引き直して .in() に載せる代わりに、
-- follows と posts を1クエリで結合する。フォロー先ごとに LATERAL で
-- 「カーソルより古い上位 page_size 件」だけを取ってから全体を再ソートするため、
-- スキャン量はフォロー数 × page_size に収まる（コーパスサイズに対してフラット）。
-- 未認証（auth.uid() が null）は follower_id = null が何にも一致せず空になる。
CREATE OR REPLACE FUNCTION public.posts_feed_following(
  page_size int,
  cursor_created_at timestamptz DEFAULT NULL,
  cursor_id uuid DEFAULT NULL
)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT p.*
  FROM public.follows f
  CROSS JOIN LATERAL (
    SELECT *
    FROM public.posts p
    WHERE p.user_id = f.following_id
      AND (
        cursor_created_at IS NULL
        OR (p.created_at, p.id) < (cursor_created_at, cursor_id)
      )
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT page_size
  ) p
  WHERE f.follower_id = (select auth.uid())
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT page_size;
$$;

-- プロフィール投稿一覧: user_id 単一の (created_at, id) 行比較ページング
CREATE OR REPLACE FUNCTION public.posts_by_user(
  target_user_id uuid,
  page_size int,
  cursor_created_at timestamptz DEFAULT NULL,
  cursor_id uuid DEFAULT NULL
)
RETURNS SETOF public.posts
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT *
  FROM public.posts p
  WHERE p.user_id = target_user_id
    AND (
      cursor_created_at IS NULL
      OR (p.created_at, p.id) < (cursor_created_at, cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT page_size;
$$;

-- connections（フォロワー / フォロー中）一覧。tab ごとに絞る列（follower_id /
-- following_id）が入れ替わるだけだが、動的 SQL を避けるため2関数に分ける。
-- 同点を割るのは相手側の id なので、そちらでカーソルを組む。
CREATE OR REPLACE FUNCTION public.connections_followers(
  target_user_id uuid,
  page_size int,
  cursor_created_at timestamptz DEFAULT NULL,
  cursor_other_id uuid DEFAULT NULL
)
RETURNS TABLE (created_at timestamptz, other_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT f.created_at, f.follower_id AS other_id
  FROM public.follows f
  WHERE f.following_id = target_user_id
    AND (
      cursor_created_at IS NULL
      OR (f.created_at, f.follower_id) < (cursor_created_at, cursor_other_id)
    )
  ORDER BY f.created_at DESC, f.follower_id DESC
  LIMIT page_size;
$$;

CREATE OR REPLACE FUNCTION public.connections_following(
  target_user_id uuid,
  page_size int,
  cursor_created_at timestamptz DEFAULT NULL,
  cursor_other_id uuid DEFAULT NULL
)
RETURNS TABLE (created_at timestamptz, other_id uuid)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT f.created_at, f.following_id AS other_id
  FROM public.follows f
  WHERE f.follower_id = target_user_id
    AND (
      cursor_created_at IS NULL
      OR (f.created_at, f.following_id) < (cursor_created_at, cursor_other_id)
    )
  ORDER BY f.created_at DESC, f.following_id DESC
  LIMIT page_size;
$$;

-- テーブルと同じく暗黙付与に頼らず明示する（20260802183557 の方針を踏襲）
GRANT EXECUTE ON FUNCTION public.posts_feed_public(int, timestamptz, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.posts_feed_following(int, timestamptz, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.posts_by_user(uuid, int, timestamptz, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connections_followers(uuid, int, timestamptz, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connections_following(uuid, int, timestamptz, uuid) TO anon, authenticated;
