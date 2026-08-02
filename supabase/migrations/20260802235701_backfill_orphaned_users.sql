-- on_auth_user_created は AFTER INSERT トリガーのため、設置前から auth.users にあった行には
-- 遡って発火しない。マイグレーション適用より前にサインアップしたユーザーは public.users に
-- 行が無く、プロフィールが 404 になり、posts.user_id の FK 違反で投稿もできない。
-- 列の対応は handle_new_user() と揃えてある。
INSERT INTO public.users (id, display_name, avatar_url)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.users p WHERE p.id = u.id
);
