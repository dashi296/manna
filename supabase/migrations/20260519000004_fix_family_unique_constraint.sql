-- family_relationships: A→B と B→A の逆順重複レコードを防ぐ
-- 主キー (requester_id, addressee_id) だけでは同一ペアの逆順を許してしまうため
-- LEAST/GREATEST で正規化した一意インデックスを追加する
CREATE UNIQUE INDEX family_relationships_pair_uniq
  ON family_relationships (
    LEAST(requester_id::text, addressee_id::text),
    GREATEST(requester_id::text, addressee_id::text)
  );
