import { useState } from 'react'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getBook, buildScriptureUrl, getScriptureLabel } from '@/entities/scripture'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { createSupabaseServer } from '@/shared/lib/auth'
import { EmptyState, PageHeader, ScriptureText, SanitizedVerseHtml } from '@/shared/ui'
import { Button } from '@/shared/ui/button'
import { PostComposerSheet } from '@/widgets/post-composer-sheet'
import { SelectionBar, VerseCheckbox, parseSelection, toggleVerse } from '@/features/select-scripture-verses'

type VerseText = { verse: number; text_html: string }
type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>
type ChapterRef = { collection: string; book: string; chapter: number }

async function queryVerseTexts(supabase: SupabaseServer, { collection, book, chapter }: ChapterRef, verses?: number[]) {
  let query = supabase
    .from('scripture_verses')
    .select('verse, text_html')
    .eq('collection_id', collection)
    .eq('book_id', book)
    .eq('chapter', chapter)
    .order('verse', { ascending: true })
  if (verses?.length) {
    query = query.in('verse', verses)
  }
  const { data } = await query
  return (data ?? []) as VerseText[]
}

const fetchVerseData = createServerFn({ method: 'POST' })
  .inputValidator((data: ChapterRef & { verses: number[] }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter, verses } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const [{ data: posts }, verseTexts] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .overlaps('scripture_verses', verses)
        .order('created_at', { ascending: false }),
      queryVerseTexts(serverSupabase, ctx.data, verses),
    ])
    return { posts: (posts ?? []) as PostWithUser[], verseTexts }
  })

const fetchChapterData = createServerFn({ method: 'POST' })
  .inputValidator((data: ChapterRef) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const [{ data: posts }, { data: versePosts }, verseTexts] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .is('scripture_verses', null)
        .order('created_at', { ascending: false }),
      serverSupabase
        .from('posts')
        .select('scripture_verses')
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .not('scripture_verses', 'is', null),
      queryVerseTexts(serverSupabase, ctx.data),
    ])

    const countByVerse: Record<number, number> = {}
    versePosts?.forEach((p) => {
      ;(p.scripture_verses as number[] | null)?.forEach((v) => {
        countByVerse[v] = (countByVerse[v] ?? 0) + 1
      })
    })
    return { posts: (posts ?? []) as PostWithUser[], countByVerse, verseTexts }
  })

type ChapterSearch = { verses?: number[]; select?: number[] }

export const Route = createFileRoute('/scriptures/$collection/$book/$chapter')({
  validateSearch: (search: Record<string, unknown>): ChapterSearch => ({
    verses: search.verses !== undefined
      ? (Array.isArray(search.verses) ? search.verses : [search.verses])
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0)
      : undefined,
    select: search.select !== undefined
      ? (Array.isArray(search.select) ? search.select : [search.select])
          .map((v) => Number(v))
          .filter((n) => Number.isInteger(n) && n > 0)
      : undefined,
  }),
  loaderDeps: ({ search }) => ({ verses: search.verses }),
  loader: async ({ params, deps }) => {
    const book = getBook(params.collection, params.book)
    if (!book) throw notFound()
    if (!/^\d+$/.test(params.chapter)) throw notFound()
    const chapterNum = parseInt(params.chapter, 10)
    if (chapterNum < 1 || chapterNum > book.chapters) throw notFound()

    const base = { collection: params.collection, book: params.book, chapter: chapterNum }

    if (deps.verses?.length) {
      const verseCount = book.verses[chapterNum - 1]
      if (deps.verses.some((v) => v < 1 || v > verseCount)) throw notFound()
      const { posts, verseTexts } = await fetchVerseData({ data: { ...base, verses: deps.verses } })
      return {
        book, chapter: chapterNum, collection: params.collection,
        mode: 'verse' as const, verses: deps.verses,
        posts, countByVerse: {} as Record<number, number>, verseTexts,
      }
    }

    const { posts, countByVerse, verseTexts } = await fetchChapterData({ data: base })

    return {
      book, chapter: chapterNum, collection: params.collection,
      mode: 'chapter' as const, verses: [] as number[],
      posts, countByVerse, verseTexts,
    }
  },
  component: ChapterPage,
})

function ChapterPage() {
  const { book, chapter, collection, mode, verses, posts, countByVerse, verseTexts } = Route.useLoaderData()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  const onComposerClose = (open: boolean) => {
    setSheetOpen(open)
    if (!open) router.invalidate()
  }

  if (mode === 'verse') {
    const scriptureLabel = getScriptureLabel({ collection, book: book.id, chapter, verses })
    const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter, verses })
    return (
      <div>
        <PageHeader
          title={`📖 ${scriptureLabel}`}
          backTo="/scriptures/$collection/$book/$chapter"
          backLabel={`第${chapter}章`}
          action={
            <Button
              size="sm"
              onClick={() => setSheetOpen(true)}
              className="text-xs px-3 py-1.5 rounded-full font-semibold"
              style={{ background: 'var(--lagoon)', color: '#fff' }}
            >
              投稿する
            </Button>
          }
        />
        <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--line)' }}>
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm underline"
            style={{ color: 'var(--lagoon-deep)' }}
          >
            公式サイトで読む →
          </a>
          <span className="text-xs ml-3" style={{ color: 'var(--sea-ink-soft)' }}>新着順</span>
        </div>
        {verseTexts.length > 0 && (
          <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            {verseTexts.map((vt) => (
              <ScriptureText key={vt.verse} verse={vt.verse} textHtml={vt.text_html} />
            ))}
          </div>
        )}
        {posts.length === 0 ? (
          <EmptyState>この節への投稿はまだありません</EmptyState>
        ) : (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
        <PostComposerSheet
          open={sheetOpen}
          onOpenChange={onComposerClose}
          initialScripture={{ collection, book: book.id, chapter, verses }}
        />
      </div>
    )
  }

  return <ChapterView
    book={book}
    chapter={chapter}
    collection={collection}
    posts={posts}
    countByVerse={countByVerse}
    verseTexts={verseTexts}
    sheetOpen={sheetOpen}
    setSheetOpen={setSheetOpen}
    onComposerClose={onComposerClose}
  />
}

type ChapterViewProps = {
  book: ReturnType<typeof getBook> & object
  chapter: number
  collection: string
  posts: PostWithUser[]
  countByVerse: Record<number, number>
  verseTexts: VerseText[]
  sheetOpen: boolean
  setSheetOpen: (v: boolean) => void
  onComposerClose: (open: boolean) => void
}

function ChapterView({
  book, chapter, collection, posts, countByVerse, verseTexts,
  sheetOpen, setSheetOpen, onComposerClose,
}: ChapterViewProps) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter })
  const verseTextMap = new Map(verseTexts.map((vt) => [vt.verse, vt]))
  const maxVerse = book.verses[chapter - 1]

  const selection = parseSelection(search.select, maxVerse)

  const setSelection = (next: number[]) => {
    navigate({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection, book: book.id, chapter: String(chapter) },
      search: (prev) => ({ ...prev, select: next.length ? next : undefined }),
      replace: true,
    })
  }

  const initialScripture = {
    collection,
    book: book.id,
    chapter,
    verses: selection.length ? selection : undefined,
  }

  return (
    <div>
      <PageHeader
        title={`${book.name} 第${chapter}章`}
        backTo="/scriptures/$collection/$book"
        backLabel={book.name}
        action={
          <div className="flex items-center gap-2">
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline"
              style={{ color: 'var(--lagoon-deep)' }}
            >
              本文
            </a>
            <Button
              size="sm"
              onClick={() => setSheetOpen(true)}
              className="text-xs px-3 py-1.5 rounded-full font-semibold"
              style={{ background: 'var(--lagoon)', color: '#fff' }}
            >
              章に投稿
            </Button>
          </div>
        }
      />
      {posts.length > 0 && (
        <div className="border-b" style={{ borderColor: 'var(--line)' }}>
          <p className="px-4 pt-3 pb-1 text-xs font-medium" style={{ color: 'var(--sea-ink-soft)' }}>
            この章への投稿
          </p>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      <div className="p-4 pb-24">
        <p className="text-xs mb-4" style={{ color: 'var(--sea-ink-soft)' }}>
          節をタップして詳細を見る・チェックで複数選択して投稿できます
        </p>
        <ul className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--line)' }}>
          {Array.from({ length: maxVerse }, (_, i) => i + 1).map((verse) => {
            const count = countByVerse[verse] ?? 0
            const vt = verseTextMap.get(verse)
            const isSelected = selection.includes(verse)
            return (
              <li
                key={verse}
                className="border-b last:border-b-0"
                style={{
                  borderColor: 'var(--line)',
                  background: isSelected ? 'var(--chip-bg)' : 'transparent',
                }}
              >
                <div className="flex items-start gap-2 px-4 py-3">
                  <VerseCheckbox
                    verse={verse}
                    checked={isSelected}
                    onToggle={(v) => setSelection(toggleVerse(selection, v))}
                  />
                  <Link
                    to="/scriptures/$collection/$book/$chapter"
                    params={{ collection, book: book.id, chapter: String(chapter) }}
                    search={{ verses: [verse] }}
                    className="flex-1 min-w-0 flex items-start justify-between gap-2"
                    style={{ color: 'var(--sea-ink)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium" style={{ color: 'var(--sea-ink-soft)' }}>
                        {verse}
                      </span>
                      {vt && (
                        <SanitizedVerseHtml
                          html={vt.text_html}
                          className="ml-2 text-sm"
                          style={{ color: 'var(--sea-ink)' }}
                        />
                      )}
                    </div>
                    {count > 0 && (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{
                          background: 'var(--chip-bg)',
                          border: '1px solid var(--chip-line)',
                          color: 'var(--palm)',
                        }}
                      >
                        {count}件
                      </span>
                    )}
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <SelectionBar
        selection={selection}
        onClear={() => setSelection([])}
        onOpenComposer={() => setSheetOpen(true)}
      />
      <PostComposerSheet
        open={sheetOpen}
        onOpenChange={onComposerClose}
        initialScripture={initialScripture}
      />
    </div>
  )
}
