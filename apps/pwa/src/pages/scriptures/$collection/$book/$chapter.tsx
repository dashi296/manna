import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getBook, buildScriptureUrl, getScriptureLabel } from '@/entities/scripture'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { createSupabaseServer } from '@/shared/lib/auth'
import { PageHeader, ScriptureText, SanitizedVerseHtml } from '@/shared/ui'

const fetchVersePosts = createServerFn({ method: 'POST' })
  .inputValidator((data: { collection: string; book: string; chapter: number; verses: number[] }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter, verses } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const { data: posts } = await serverSupabase
      .from('posts')
      .select(POST_SELECT)
      .eq('scripture_collection', collection)
      .eq('scripture_book', book)
      .eq('scripture_chapter', chapter)
      .overlaps('scripture_verses', verses)
      .order('created_at', { ascending: false })
    return (posts ?? []) as PostWithUser[]
  })

type VerseText = { verse: number; text_html: string }

const fetchVerseTexts = createServerFn({ method: 'POST' })
  .inputValidator((data: { collection: string; book: string; chapter: number; verses?: number[] }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter, verses } = ctx.data
    const serverSupabase = await createSupabaseServer()
    let query = serverSupabase
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
  })

const fetchChapterPosts = createServerFn({ method: 'POST' })
  .inputValidator((data: { collection: string; book: string; chapter: number }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const { data: posts } = await serverSupabase
      .from('posts')
      .select(POST_SELECT)
      .eq('scripture_collection', collection)
      .eq('scripture_book', book)
      .eq('scripture_chapter', chapter)
      .is('scripture_verses', null)
      .order('created_at', { ascending: false })
    return (posts ?? []) as PostWithUser[]
  })

const fetchChapterCounts = createServerFn({ method: 'POST' })
  .inputValidator((data: { collection: string; book: string; chapter: number }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const { data: allPosts } = await serverSupabase
      .from('posts')
      .select('scripture_verses')
      .eq('scripture_collection', collection)
      .eq('scripture_book', book)
      .eq('scripture_chapter', chapter)
      .not('scripture_verses', 'is', null)

    const countByVerse: Record<number, number> = {}
    allPosts?.forEach((p) => {
      ;(p.scripture_verses as number[] | null)?.forEach((v) => {
        countByVerse[v] = (countByVerse[v] ?? 0) + 1
      })
    })
    return countByVerse
  })

export const Route = createFileRoute('/scriptures/$collection/$book/$chapter')({
  validateSearch: (search: Record<string, unknown>): { verses?: number[] } => ({
    verses: search.verses !== undefined
      ? (Array.isArray(search.verses) ? search.verses : [search.verses])
          .map(Number)
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
      const [posts, verseTexts] = await Promise.all([
        fetchVersePosts({ data: { ...base, verses: deps.verses } }),
        fetchVerseTexts({ data: { ...base, verses: deps.verses } }),
      ])
      return {
        book, chapter: chapterNum, collection: params.collection,
        mode: 'verse' as const, verses: deps.verses,
        posts, countByVerse: {} as Record<number, number>, verseTexts,
      }
    }

    const [countByVerse, verseTexts, posts] = await Promise.all([
      fetchChapterCounts({ data: base }),
      fetchVerseTexts({ data: base }),
      fetchChapterPosts({ data: base }),
    ])

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
            <Link
              to="/posts/new"
              search={{ collection, book: book.id, chapter: String(chapter), verses: verses.join(',') }}
              className="text-xs px-3 py-1.5 rounded-full font-semibold"
              style={{ background: 'var(--lagoon)', color: '#fff' }}
            >
              投稿する
            </Link>
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
          <div className="p-8 text-center text-sm" style={{ color: 'var(--sea-ink-soft)' }}>
            この節への投稿はまだありません
          </div>
        ) : (
          <div>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    )
  }

  const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter })
  const verseTextMap = new Map(verseTexts.map((vt) => [vt.verse, vt]))
  return (
    <div>
      <PageHeader
        title={`${book.name} 第${chapter}章`}
        backTo="/scriptures/$collection/$book"
        backLabel={book.name}
        action={
          <a
            href={officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs underline"
            style={{ color: 'var(--lagoon-deep)' }}
          >
            本文を読む
          </a>
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
      <div className="p-4">
        <p className="text-xs mb-4" style={{ color: 'var(--sea-ink-soft)' }}>節を選んで投稿を見る・書く</p>
        <ul className="overflow-hidden rounded-xl" style={{ border: '1px solid var(--line)' }}>
          {Array.from({ length: book.verses[chapter - 1] }, (_, i) => i + 1).map((verse) => {
            const count = countByVerse[verse] ?? 0
            const vt = verseTextMap.get(verse)
            return (
              <li key={verse} className="border-b last:border-b-0" style={{ borderColor: 'var(--line)' }}>
                <Link
                  to="/scriptures/$collection/$book/$chapter"
                  params={{ collection, book: book.id, chapter: String(chapter) }}
                  search={{ verses: [verse] }}
                  className="flex items-start justify-between gap-2 px-4 py-3 transition-colors"
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
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
