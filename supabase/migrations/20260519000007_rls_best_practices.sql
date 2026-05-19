-- ============================================================
-- 1. SECURITY DEFINER 関数の search_path 固定 + 完全修飾テーブル名
--    search_path インジェクション攻撃を防ぐために必須
-- ============================================================

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

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.notify_on_like()
RETURNS trigger AS $$
DECLARE
  post_owner_id uuid;
BEGIN
  SELECT user_id INTO post_owner_id FROM public.posts WHERE id = NEW.post_id;
  IF NEW.user_id != post_owner_id THEN
    INSERT INTO public.notifications (user_id, type, actor_id, post_id)
    VALUES (post_owner_id, 'liked', NEW.user_id, NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'followed', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.notify_on_family_change()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, actor_id)
    VALUES (NEW.addressee_id, 'family_requested', NEW.requester_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, actor_id)
    VALUES (NEW.requester_id, 'family_accepted', NEW.addressee_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

-- ============================================================
-- 2. UPDATE ポリシーに WITH CHECK を追加
--    USING のみでは変更後の値が検証されず ownership を書き換えられる
-- ============================================================

-- posts: 更新後も user_id が自分であることを保証
DROP POLICY "posts_update_own" ON public.posts;
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- users: 更新後も id が自分であることを保証
DROP POLICY "users_update_self" ON public.users;
CREATE POLICY "users_update_self" ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- family_relationships: addressee のみ更新可、更新後も addressee であることを保証
DROP POLICY "family_update_addressee" ON public.family_relationships;
CREATE POLICY "family_update_addressee" ON public.family_relationships FOR UPDATE
  USING (auth.uid() = addressee_id)
  WITH CHECK (auth.uid() = addressee_id);

-- notifications: 更新後も自分の通知であることを保証
DROP POLICY "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. イミュータブルカラム保護トリガー
--    RLS の WITH CHECK では OLD を参照できないため
--    変更不可フィールドの保護はトリガーで実装する
-- ============================================================

-- family_relationships: requester_id / addressee_id は変更不可
CREATE OR REPLACE FUNCTION public.protect_family_immutable_cols()
RETURNS trigger AS $$
BEGIN
  IF OLD.requester_id IS DISTINCT FROM NEW.requester_id
    OR OLD.addressee_id IS DISTINCT FROM NEW.addressee_id
  THEN
    RAISE EXCEPTION 'requester_id and addressee_id are immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER family_protect_immutable
  BEFORE UPDATE ON public.family_relationships
  FOR EACH ROW EXECUTE FUNCTION public.protect_family_immutable_cols();

-- notifications: read 以外のフィールドは変更不可
CREATE OR REPLACE FUNCTION public.protect_notification_immutable_cols()
RETURNS trigger AS $$
BEGIN
  IF OLD.user_id IS DISTINCT FROM NEW.user_id
    OR OLD.type IS DISTINCT FROM NEW.type
    OR OLD.actor_id IS DISTINCT FROM NEW.actor_id
    OR OLD.post_id IS DISTINCT FROM NEW.post_id
  THEN
    RAISE EXCEPTION 'only the read field may be updated on notifications';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER notification_protect_immutable
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.protect_notification_immutable_cols();

-- ============================================================
-- 4. パフォーマンス: RLS ポリシーで使用するカラムのインデックス追加
-- ============================================================

-- is_family() の逆方向ルックアップ用（addressee_id が先頭の検索）
CREATE INDEX IF NOT EXISTS family_relationships_addressee_idx
  ON public.family_relationships (addressee_id);

-- posts の user_id フィルタ用（PostgreSQL は FK 列を自動インデックスしない）
CREATE INDEX IF NOT EXISTS posts_user_id_idx
  ON public.posts (user_id);
