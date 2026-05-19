-- 新規サインアップ時にusersレコードを自動作成
CREATE OR REPLACE FUNCTION handle_new_user() RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- いいね時に通知を作成
CREATE OR REPLACE FUNCTION notify_on_like() RETURNS trigger AS $$
DECLARE
  post_owner_id uuid;
BEGIN
  SELECT user_id INTO post_owner_id FROM posts WHERE id = NEW.post_id;
  IF NEW.user_id != post_owner_id THEN
    INSERT INTO notifications (user_id, type, actor_id, post_id)
    VALUES (post_owner_id, 'liked', NEW.user_id, NEW.post_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_like_insert
  AFTER INSERT ON likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_like();

-- フォロー時に通知を作成
CREATE OR REPLACE FUNCTION notify_on_follow() RETURNS trigger AS $$
BEGIN
  INSERT INTO notifications (user_id, type, actor_id)
  VALUES (NEW.following_id, 'followed', NEW.follower_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_follow_insert
  AFTER INSERT ON follows
  FOR EACH ROW EXECUTE FUNCTION notify_on_follow();

-- ファミリー招待/承認時に通知を作成
CREATE OR REPLACE FUNCTION notify_on_family_change() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications (user_id, type, actor_id)
    VALUES (NEW.addressee_id, 'family_requested', NEW.requester_id);
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO notifications (user_id, type, actor_id)
    VALUES (NEW.requester_id, 'family_accepted', NEW.addressee_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_family_change
  AFTER INSERT OR UPDATE ON family_relationships
  FOR EACH ROW EXECUTE FUNCTION notify_on_family_change();

-- posts.updated_at を自動更新
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_set_updated_at
  BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
