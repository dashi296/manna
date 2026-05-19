ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ファミリー判定ヘルパー関数
CREATE OR REPLACE FUNCTION is_family(user_a uuid, user_b uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM family_relationships
    WHERE status = 'accepted'
    AND (
      (requester_id = user_a AND addressee_id = user_b) OR
      (requester_id = user_b AND addressee_id = user_a)
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- users
CREATE POLICY "users_select_all" ON users FOR SELECT USING (true);
CREATE POLICY "users_insert_self" ON users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_self" ON users FOR UPDATE USING (auth.uid() = id);

-- posts（複数のSELECTポリシーはORで評価される）
CREATE POLICY "posts_select_public" ON posts FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "posts_select_own" ON posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "posts_select_followers" ON posts FOR SELECT
  USING (
    visibility = 'followers'
    AND EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = auth.uid() AND following_id = posts.user_id
    )
  );

CREATE POLICY "posts_select_family" ON posts FOR SELECT
  USING (visibility = 'family' AND is_family(auth.uid(), user_id));

CREATE POLICY "posts_insert_own" ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "posts_update_own" ON posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "posts_delete_own" ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- likes
CREATE POLICY "likes_select_all" ON likes FOR SELECT USING (true);
CREATE POLICY "likes_insert_self" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete_self" ON likes FOR DELETE USING (auth.uid() = user_id);

-- follows
CREATE POLICY "follows_select_all" ON follows FOR SELECT USING (true);
CREATE POLICY "follows_insert_self" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follows_delete_self" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- family_relationships
CREATE POLICY "family_select_own" ON family_relationships FOR SELECT
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "family_insert_self" ON family_relationships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "family_update_addressee" ON family_relationships FOR UPDATE
  USING (auth.uid() = addressee_id);
CREATE POLICY "family_delete_own" ON family_relationships FOR DELETE
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- notifications
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  USING (auth.uid() = user_id);
