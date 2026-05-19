-- likes INSERT ポリシーを修正: 閲覧権限のない投稿への like を防ぐ
-- user_id チェックだけでは private/family 投稿への干渉（通知トリガー含む）を防げないため
-- posts の可視性判定と連動させる
DROP POLICY "likes_insert_self" ON likes;

CREATE POLICY "likes_insert_self_visible_post" ON likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM posts p
      WHERE p.id = likes.post_id
        AND (
          p.visibility = 'public'
          OR p.user_id = auth.uid()
          OR (
            p.visibility = 'followers'
            AND EXISTS (
              SELECT 1 FROM follows
              WHERE follower_id = auth.uid() AND following_id = p.user_id
            )
          )
          OR (p.visibility = 'family' AND is_family(auth.uid(), p.user_id))
        )
    )
  );
