-- on_auth_user_created は AFTER INSERT トリガーのため、設置前から auth.users にあった行には
-- 遡って発火しない。マイグレーション適用より前にサインアップしたユーザーは public.users に
-- 行が無く、プロフィールが 404 になり、posts.user_id の FK 違反で投稿もできない。
--
-- handle_new_user() と概ね同じ列変換だが、既存行を相手にするため防御を足している:
--   - auth.users.email は nullable、public.users.display_name は NOT NULL のため、
--     名前も email も無い行（匿名サインイン・電話番号認証）でフォールバックが要る
--   - COALESCE は空文字を NULL 扱いしないので NULLIF で潰す
--   - 削除はソフトデリートのため deleted_at で除外する
--   - ON CONFLICT なら実行中に handle_new_user() が行を作っても衝突しない
INSERT INTO public.users (id, display_name, avatar_url)
SELECT
  u.id,
  COALESCE(
    NULLIF(u.raw_user_meta_data->>'full_name', ''),
    NULLIF(split_part(u.email, '@', 1), ''),
    'user-' || left(u.id::text, 8)
  ),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE u.deleted_at IS NULL
ON CONFLICT (id) DO NOTHING;
