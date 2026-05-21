import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getBook, buildScriptureUrl, getScriptureLabel } from '@/entities/scripture'
import { PostCard, type PostWithUser } from '@/entities/post'
import { createSupabaseServer } from '@/shared/lib/auth'

const POST_SELECT = `
  id, content, visibility, created_at,
  scripture_collection, scripture_book, scripture_chapter,
  scripture_verses, user_id,
  users ( display_name, avatar_url )
`

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

    if (deps.verses?.length) {
      const verseCount = book.verses[chapterNum - 1]
      if (deps.verses.some((v) => v < 1 || v > verseCount)) throw notFound()
      const posts = await fetchVersePosts({
        data: {
          collection: params.collection,
          book: params.book,
          chapter: chapterNum,
          verses: deps.verses,
        },
      })
      return {
        book,
        chapter: chapterNum,
        collection: params.collection,
        mode: 'verse' as const,
        verses: deps.verses,
        posts,
        countByVerse: {} as Record<number, number>,
      }
    }

    const countByVerse = await fetchChapterCounts({
      data: {
        collection: params.collection,
        book: params.book,
        chapter: chapterNum,
      },
    })

    return {
      book,
      chapter: chapterNum,
      collection: params.collection,
      mode: 'chapter' as const,
      verses: [] as number[],
      posts: [] as PostWithUser[],
      countByVerse,
    }
  },
  component: ChapterPage,
})

function ChapterPage() {
  const { book, chapter, collection, mode, verses, posts, countByVerse } = Route.useLoaderData()

  if (mode === 'verse') {
    const scriptureLabel = getScriptureLabel({ collection, book: book.id, chapter, verses })
    const officialUrl = buildScriptureUrl({ collection, book: book.id, chapter, verses })
    return (
      <div>
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold">📖 {scriptureLabel}</h1>
          <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
            公式サイトで読む →
          </a>
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="text-sm text-gray-500">新着順</span>
          <Link
            to="/posts/new"
            search={{ collection, book: book.id, chapter, verses }}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full"
          >
            この節について投稿する
          </Link>
        </div>
        {posts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">この節への投稿はまだありません</div>
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
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">
          {book.name} 第{chapter}章
        </h1>
        <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
          本文を読む →
        </a>
      </div>
      <p className="text-sm text-gray-500 mb-4">節を選んで投稿を見る・書く</p>
      <ul className="divide-y border rounded-lg overflow-hidden">
        {Array.from({ length: book.verses[chapter - 1] }, (_, i) => i + 1).map((verse) => {
          const count = countByVerse[verse] ?? 0
          return (
            <li key={verse}>
              <Link
                to="/scriptures/$collection/$book/$chapter"
                params={{ collection, book: book.id, chapter: String(chapter) }}
                search={{ verses: [verse] }}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <span className="text-sm">第{verse}節</span>
                {count > 0 && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{count}件</span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
