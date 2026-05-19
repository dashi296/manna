-- likes SELECT ポリシーを修正: 閲覧可能な投稿のいいねのみ参照できるようにする
-- USING (true) では family/private 投稿のいいねが漏洩するため、posts の可視性判定と連動させる
DROP POLICY "likes_select_all" ON likes;

CREATE POLICY "likes_select_visible_post" ON likes FOR SELECT
  USING (
    EXISTS (
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
