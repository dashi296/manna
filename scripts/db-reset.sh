#!/bin/bash
set -e

DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

echo "Resetting database..."
npx supabase db reset

if [ -f supabase/seed-verses.sql ]; then
  echo "Importing verse data..."
  psql "$DB_URL" -f supabase/seed-verses.sql -q
  echo "Verse data imported."
else
  echo "No seed-verses.sql found. Run 'node scripts/fetch-scriptures.mjs' to fetch verse data."
fi
