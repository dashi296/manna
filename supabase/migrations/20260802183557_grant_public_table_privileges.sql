-- 初期スキーマのテーブルは GRANT を書かず Supabase のデフォルト権限に頼っていた。
-- ローカルでは付与されるがホスト環境では付与されず、authenticated / anon の
-- 全アクセスが permission denied になっていたため、RLS ポリシーに対応する権限を明示する。

-- users: 誰でも閲覧、本人のみ作成・更新
GRANT SELECT ON public.users TO anon, authenticated;
GRANT INSERT, UPDATE ON public.users TO authenticated;

-- posts: 公開投稿は誰でも閲覧、本人のみ作成・更新・削除
GRANT SELECT ON public.posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.posts TO authenticated;

-- likes: ログイン後のみ
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;

-- follows: フォロー関係は公開情報
GRANT SELECT ON public.follows TO anon, authenticated;
GRANT INSERT, DELETE ON public.follows TO authenticated;

-- family_relationships: 当事者のみ
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_relationships TO authenticated;

-- notifications: 本人のみ閲覧と既読更新（作成は SECURITY DEFINER トリガー経由）
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
