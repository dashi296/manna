import { execFileSync } from 'node:child_process'

const DB_URL = process.env.DATABASE_URL
  || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

export function runPsql(sql, opts = {}) {
  return execFileSync('psql', [DB_URL, '-t', '-A'], {
    input: sql,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...opts,
  })
}
