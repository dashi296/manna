-- 新規サインアップ時に users レコードを自動作成
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- いいね時に通知を作成
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

CREATE TRIGGER on_like_insert
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_like();

-- フォロー時に通知を作成
CREATE OR REPLACE FUNCTION public.notify_on_follow()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'followed', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

CREATE TRIGGER on_follow_insert
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_follow();

-- ファミリー招待/承認時に通知を作成
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

CREATE TRIGGER on_family_change
  AFTER INSERT OR UPDATE ON family_relationships
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_family_change();

-- posts.updated_at を自動更新
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- family_relationships: requester_id / addressee_id は変更不可
-- RLS の WITH CHECK では OLD を参照できないためトリガーで保護する
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
  IF OLD.id IS DISTINCT FROM NEW.id
    OR OLD.user_id IS DISTINCT FROM NEW.user_id
    OR OLD.type IS DISTINCT FROM NEW.type
    OR OLD.actor_id IS DISTINCT FROM NEW.actor_id
    OR OLD.post_id IS DISTINCT FROM NEW.post_id
    OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'only the read field may be updated on notifications';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER notification_protect_immutable
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.protect_notification_immutable_cols();
