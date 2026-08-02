-- auth.users.email は nullable だが public.users.display_name は NOT NULL のため、
-- 名前も email も無いユーザー（匿名サインイン・電話番号認証）では COALESCE が NULL になる。
-- on_auth_user_created は AFTER INSERT トリガーなので、この例外は親トランザクションごと
-- ロールバックし、サインアップ自体が失敗する。
-- あわせて COALESCE が空文字を NULL 扱いしない点も NULLIF で潰し、
-- 20260802235701 のバックフィルと表示名の決まり方を揃える。
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'user-' || left(NEW.id::text, 8)
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
