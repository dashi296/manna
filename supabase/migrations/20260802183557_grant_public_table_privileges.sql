-- 初期スキーマのテーブルは GRANT を書かず Supabase のデフォルト権限に頼っていた。
-- ローカルでは付与されるがホスト環境では付与されず、authenticated / anon の
-- 全アクセスが permission denied になっていたため、RLS ポリシーに対応する権限を明示する。

-- ローカルの postgres ロールは新規テーブルに anon / authenticated への ALL を自動付与する。
-- ホスト環境にこの既定はなく、GRANT 漏れがローカルでは表面化しない原因になっていたため無効化する。
-- （supabase_admin 分は postgres から変更できないが、マイグレーションが作る
--   テーブルの所有者は postgres なのでこちらだけで足りる）
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;

-- 既存テーブルに自動付与された権限も落とし、以降は明示した分だけにする
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- 聖典データ: 誰でも閲覧のみ
GRANT SELECT ON public.scripture_collections TO anon, authenticated;
GRANT SELECT ON public.scripture_books TO anon, authenticated;
GRANT SELECT ON public.scripture_verses TO anon, authenticated;

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
