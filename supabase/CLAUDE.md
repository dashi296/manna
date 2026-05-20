# Supabase マイグレーション ガイドライン

参考: [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) / [RLS Performance Best Practices](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)

---

## マイグレーションファイルの基本ルール

- **production ブランチ**では既存のマイグレーションファイルを編集しない。修正は必ず新しいファイルで行う
- 開発ブランチでは未適用のマイグレーションファイルを直接編集してよい
- ファイル名は `YYYYMMDDHHmmss_説明.sql` の形式
- 各ファイルは冪等（再実行可能）に書く。`CREATE OR REPLACE`・`IF NOT EXISTS`・`DROP ... IF EXISTS` を使う

---

## RLS 必須ルール

### 1. 公開スキーマの全テーブルで RLS を有効化する

```sql
ALTER TABLE public.table_name ENABLE ROW LEVEL SECURITY;
```

RLS を有効化しただけではポリシーがない場合「全行拒否」になる（デフォルト deny）。
意図的に全公開にする場合も明示的にポリシーを書くこと。

### 2. ロールに適切な権限を付与する

```sql
GRANT SELECT ON public.table_name TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.table_name TO authenticated;
```

RLS とは別に、テーブルへのアクセス権限（GRANT）も必要。

---

## ポリシーの書き方

### USING と WITH CHECK の使い分け

| 句 | 役割 | 必須な操作 |
|---|---|---|
| `USING` | 操作対象の既存行を絞り込む | SELECT / UPDATE / DELETE |
| `WITH CHECK` | 書き込み後の値を検証する | INSERT / UPDATE |

**UPDATE には必ず両方を指定する**（`USING` のみだと変更後の値が検証されない）:

```sql
-- NG: WITH CHECK がなく user_id を書き換えられる
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE
  USING (auth.uid() = user_id);

-- OK
CREATE POLICY "posts_update_own" ON public.posts FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
```

### ロールを TO 句で明示する

未認証ユーザーに不要なポリシー評価をさせない。`auth.uid()` は未認証時に `null` を返すため、`TO authenticated` を付けるだけで大幅に効率化できる。

```sql
-- NG: 全ロールに評価される
CREATE POLICY "select_own" ON public.posts FOR SELECT
  USING (auth.uid() = user_id);

-- OK
CREATE POLICY "select_own" ON public.posts FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- 匿名公開の場合
CREATE POLICY "select_public" ON public.posts FOR SELECT
  TO anon, authenticated
  USING (visibility = 'public');
```

---

## パフォーマンス ベストプラクティス

### 1. `auth.uid()` を `(select auth.uid())` でラップする

PostgreSQL がサブクエリとして実行結果をキャッシュするため、行ごとの再評価を防げる。
**全ての RLS ポリシーで必ず使うこと**。改善効果: 約 95%。

```sql
-- NG
USING (auth.uid() = user_id)

-- OK
USING ((select auth.uid()) = user_id)
```

### 2. RLS ポリシーで参照するカラムに必ずインデックスを貼る

PostgreSQL は FK 列を自動インデックスしない。改善効果: 約 99.9%。

```sql
-- user_id でフィルタするなら必須
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON public.posts (user_id);

-- is_family() の逆方向ルックアップ用
CREATE INDEX IF NOT EXISTS family_relationships_addressee_idx
  ON public.family_relationships (addressee_id);
```

### 3. JOIN を避け、サブクエリはフィルタを先に適用する

テーブル間の JOIN はクロス積を生成するため極めて遅くなる。
「ユーザーIDで絞り込んでから team_id を取得」の順番にする。改善効果: 約 99.8%。

```sql
-- NG: ソーステーブルと結合が発生
USING (
  (select auth.uid()) IN (
    SELECT user_id FROM team_user
    WHERE team_user.team_id = test_table.team_id  -- JOIN
  )
)

-- OK: auth.uid() でフィルタしてからセットを取得
USING (
  team_id IN (
    SELECT team_id FROM team_user
    WHERE user_id = (select auth.uid())  -- filter-first
  )
)
```

### 4. 複雑な判定は SECURITY DEFINER 関数にまとめる

複数のポリシーで同じ判定を繰り返す場合は関数化してキャッシュさせる。
改善効果: 最大 99.99%。

```sql
CREATE OR REPLACE FUNCTION public.is_family(user_a uuid, user_b uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_relationships  -- 完全修飾名
    WHERE status = 'accepted'
    AND (
      (requester_id = user_a AND addressee_id = user_b) OR
      (requester_id = user_b AND addressee_id = user_a)
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '';
--                               ^^^^^^  ^^^^^^^^^^^^^^^^^^^
--                               読み取り専用関数は STABLE   search_path 固定必須
```

---

## SECURITY DEFINER 関数の必須ルール

`SECURITY DEFINER` 関数は作成者（通常 superuser）の権限で実行されるため、
**search_path インジェクション攻撃**を防ぐために以下を必ず守る:

```sql
-- 必須: SET search_path = '' + 全テーブルを完全修飾名で記述
CREATE OR REPLACE FUNCTION public.my_function()
RETURNS void AS $$
BEGIN
  -- public.table_name のように必ずスキーマを明示する
  SELECT * FROM public.my_table;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';
--                                    ^^^^^^^^^^^^^^^^^^^
--                                    これがないと攻撃者が search_path を
--                                    上書きして悪意ある関数を呼び出せる
```

チェックリスト:
- [ ] `SET search_path = ''` が付いているか
- [ ] 関数内の全テーブル参照が `public.table_name` 形式か
- [ ] 読み取り専用なら `STABLE` または `IMMUTABLE` を付けているか

---

## イミュータブルカラムの保護

`WITH CHECK` では `OLD` を参照できないため、変更不可フィールドの保護は **BEFORE UPDATE トリガー** で実装する:

```sql
CREATE OR REPLACE FUNCTION public.protect_immutable_cols()
RETURNS trigger AS $$
BEGIN
  IF OLD.owner_id IS DISTINCT FROM NEW.owner_id THEN
    RAISE EXCEPTION 'owner_id is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';

CREATE TRIGGER protect_immutable
  BEFORE UPDATE ON public.my_table
  FOR EACH ROW EXECUTE FUNCTION public.protect_immutable_cols();
```

---

## ポリシー設計チェックリスト

新しいテーブルにポリシーを追加するときに確認すること:

**必須**
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` が付いているか
- [ ] 書き込みロールに `GRANT` しているか
- [ ] `auth.uid()` を `(select auth.uid())` でラップしているか
- [ ] UPDATE ポリシーに `USING` と `WITH CHECK` の両方があるか
- [ ] `TO authenticated` / `TO anon` でロールを明示しているか
- [ ] SECURITY DEFINER 関数に `SET search_path = ''` があるか
- [ ] 完全修飾テーブル名（`public.table_name`）を使っているか

**パフォーマンス**
- [ ] ポリシーで参照するカラムにインデックスがあるか
- [ ] JOIN を使っている場合、filter-first のサブクエリに書き換えられないか
- [ ] 複数ポリシーで同じ判定を繰り返している場合、SECURITY DEFINER 関数に切り出せないか

**データ整合性**
- [ ] 変更不可にすべきカラムを BEFORE UPDATE トリガーで保護しているか
- [ ] INSERT した本人だけが DELETE できるポリシーになっているか
- [ ] 未認証ユーザーに意図せず書き込み権限が与わっていないか
