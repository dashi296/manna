ALTER TABLE scripture_books
  ADD COLUMN IF NOT EXISTS is_front_matter boolean NOT NULL DEFAULT false;
