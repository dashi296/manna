import { memo, useEffect, useMemo, useRef, useState } from 'react'
import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
  type HistoryState,
} from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createServerFn } from '@tanstack/react-start'
import { useQuery } from '@tanstack/react-query'
import { getBook, getCollection, buildScriptureUrl, getChapterLabel, getScriptureLabel, getAdjacentChapterRef, getChapterNavLabel, scriptureVerseTextsQuery, chapterHeadingQuery, type ChapterRef, type ChapterHeading } from '@/entities/scripture'
import { PostCard, POST_SELECT, type PostWithUser } from '@/entities/post'
import { createSupabaseServer } from '@/shared/lib/auth'
import { ComposePostButton, EmptyState, PageHeader, SanitizedVerseHtml, ScriptureText } from '@/shared/ui'
import { PostComposerSheet } from '@/widgets/post-composer-sheet'
import { ComposeMenu } from '@/widgets/compose-menu'
import {
  SelectionModeHeader,
  VerseRow,
  parseSelection,
  toggleVerse,
  type SelectionMode,
} from '@/features/select-scripture-verses'
import {
  buildVerseCommentIndex,
  ChapterCommentersRow,
  VerseCommentMarker,
  useSelectedUserId,
  useSelectedUserStore,
} from '@/features/select-verse-view'
import { VerseCommentSheet } from '@/widgets/verse-comment-sheet'
import { ChapterPager, type ChapterTexts } from '@/features/swipe-chapter-navigation'
import { getCircleUserIds } from '@/entities/user'
import type { AvatarStackItem } from '@/shared/ui'
import { useBookmarkStore } from '@/entities/bookmark'
import { BookmarkButton } from '@/features/toggle-bookmark'
import { useBilingualEnabled } from '@/entities/bilingual-display'
import { BilingualToggleButton } from '@/features/toggle-bilingual'
import { PRIMARY_LANGUAGE, SECONDARY_LANGUAGE } from '@/shared/config/scriptureLanguage'

type Book = NonNullable<ReturnType<typeof getBook>>
type SupabaseServer = Awaited<ReturnType<typeof createSupabaseServer>>

async function queryCurrentUserId(supabase: SupabaseServer) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

async function queryUserAndCircle(supabase: SupabaseServer) {
  const userId = await queryCurrentUserId(supabase)
  const circle =
    userId !== null ? await getCircleUserIds(supabase, userId) : null
  return { userId, circle }
}

function useChapterHeading(loc: ChapterRef, language: string, enabled: boolean) {
  const { data } = useQuery({ ...chapterHeadingQuery(loc, language), enabled })
  return enabled ? (data ?? null) : null
}

// 本文は SSR のローダーが同じキーで温めてある。隣章の先読みとも同じキャッシュを共有する
function useVerseTexts(
  loc: ChapterRef,
  language: string,
  verses?: number[],
  enabled = true,
): Map<number, string> {
  const { data } = useQuery({
    ...scriptureVerseTextsQuery(loc, language, verses),
    enabled,
  })
  return useMemo(
    () => (enabled ? new Map((data ?? []).map((r) => [r.verse, r.text_html])) : new Map()),
    [enabled, data],
  )
}

const fetchVerseData = createServerFn({ method: 'POST' })
  .inputValidator((data: ChapterRef & { verses: number[] }) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter, verses } = ctx.data
    const serverSupabase = await createSupabaseServer()
    const [{ data: posts }, userId] = await Promise.all([
      serverSupabase
        .from('posts')
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .overlaps('scripture_verses', verses)
        .order('created_at', { ascending: false }),
      queryCurrentUserId(serverSupabase),
    ])
    return { posts: (posts ?? []) as PostWithUser[], userId }
  })

const fetchChapterData = createServerFn({ method: 'POST' })
  .inputValidator((data: ChapterRef) => data)
  .handler(async (ctx) => {
    const { collection, book, chapter } = ctx.data
    const serverSupabase = await createSupabaseServer()

    const [
      { data: posts },
      { data: versePostsData },
      { userId, circle },
    ] = await Promise.all([
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
        .select(POST_SELECT)
        .eq('scripture_collection', collection)
        .eq('scripture_book', book)
        .eq('scripture_chapter', chapter)
        .not('scripture_verses', 'is', null)
        .order('created_at', { ascending: false }),
      queryUserAndCircle(serverSupabase),
    ])

    const versePosts = (versePostsData ?? []) as PostWithUser[]

    let chapterCommenters: AvatarStackItem[] = []
    let circlePosts: PostWithUser[] = []

    if (circle) {
      const userLookup = new Map(
        circle.users.map((u) => [
          u.id,
          {
            userId: u.id,
            name: u.display_name ?? '匿名ユーザー',
            avatarUrl: u.avatar_url,
          } as AvatarStackItem,
        ]),
      )

      circlePosts = versePosts.filter((p) => userLookup.has(p.user_id))

      const latestByUser = new Map<string, string>()
      for (const p of circlePosts) {
        const prev = latestByUser.get(p.user_id) ?? ''
        const cur = p.created_at ?? ''
        if (cur > prev) latestByUser.set(p.user_id, cur)
      }
      chapterCommenters = [...latestByUser.entries()]
        .sort((a, b) => (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0))
        .map(([uid]) => userLookup.get(uid)!)
    }

    return {
      posts: (posts ?? []) as PostWithUser[],
      userId,
      chapterCommenters,
      circlePosts,
    }
  })

type ChapterSearch = {
  verses?: number[]
  select?: number[]
  mode?: SelectionMode
  // 開いているコメントシートの節。戻る操作で閉じられるよう URL に載せる
  comment?: number
}

// PostComposerSheet と同じく、履歴エントリ自身に由来を持たせて back の可否を決める。
// HistoryState は空インターフェースなので、宣言のマージで項目を足す
declare module '@tanstack/react-router' {
  interface HistoryState {
    mannaVerseSheet?: true
  }
}

type VerseSheetHistoryState = { mannaVerseSheet?: true }
const VERSE_SHEET_MARKER: VerseSheetHistoryState = { mannaVerseSheet: true }

// Number() に素通しすると '0x10' が16節、true が1節として通ってしまう。
// パスの章番号と同じく10進数字だけを受け取る
function parseCommentVerse(input: unknown): number | undefined {
  if (typeof input === 'number') {
    return Number.isInteger(input) && input > 0 ? input : undefined
  }
  if (typeof input !== 'string' || !/^\d+$/.test(input)) return undefined
  const verse = Number(input)
  return verse > 0 ? verse : undefined
}

export const Route = createFileRoute('/scriptures/$collection/$book/$chapter')({
  validateSearch: (search: Record<string, unknown>): ChapterSearch => ({
    verses: search.verses !== undefined ? parseSelection(search.verses) : undefined,
    select: search.select !== undefined ? parseSelection(search.select) : undefined,
    mode: search.mode === 'select' ? 'select' : undefined,
    comment: parseCommentVerse(search.comment),
  }),
  loaderDeps: ({ search }) => ({
    verses: search.verses,
  }),
  loader: async ({ params, deps, context }) => {
    const book = getBook(params.collection, params.book)
    if (!book) throw notFound()
    if (!/^\d+$/.test(params.chapter)) throw notFound()
    const chapterNum = parseInt(params.chapter, 10)
    if (chapterNum < 1 || chapterNum > book.chapters) throw notFound()

    const base = { collection: params.collection, book: params.book, chapter: chapterNum }

    if (deps.verses?.length) {
      const verseCount = book.verses[chapterNum - 1]
      if (deps.verses.some((v) => v < 1 || v > verseCount)) throw notFound()
      const [{ posts, userId }] = await Promise.all([
        fetchVerseData({ data: { ...base, verses: deps.verses } }),
        context.queryClient.ensureQueryData(
          scriptureVerseTextsQuery(base, PRIMARY_LANGUAGE, deps.verses),
        ),
      ])
      return {
        book, chapter: chapterNum, collection: params.collection,
        mode: 'verse' as const, verses: deps.verses,
        posts, userId,
        chapterCommenters: [] as AvatarStackItem[],
        circlePosts: [] as PostWithUser[],
      }
    }

    // 本文はキャッシュ側に置く。隣章の先読みと同じキーなので、スワイプで来たときは
    // ここで取り直さない
    const [data] = await Promise.all([
      fetchChapterData({ data: base }),
      context.queryClient.ensureQueryData(scriptureVerseTextsQuery(base, PRIMARY_LANGUAGE)),
      // 見出しは飾りなので、取れなくても本文や投稿まで巻き添えにしない。
      // 前付け文書にはそもそも章のタイトルが無い
      book.isFrontMatter
        ? Promise.resolve(null)
        : context.queryClient
            .ensureQueryData(chapterHeadingQuery(base, PRIMARY_LANGUAGE))
            .catch(() => null),
    ])

    return {
      book, chapter: chapterNum, collection: params.collection,
      mode: 'chapter' as const, verses: [] as number[],
      ...data,
    }
  },
  component: ChapterPage,
})

function ChapterPage() {
  const data = Route.useLoaderData()
  const setReadingPosition = useBookmarkStore((s) => s.setReadingPosition)

  useEffect(() => {
    setReadingPosition({ collection: data.collection, book: data.book.id, chapter: data.chapter })
  }, [data.collection, data.book.id, data.chapter, setReadingPosition])

  if (data.mode === 'verse') {
    return <VerseView
      book={data.book}
      chapter={data.chapter}
      collection={data.collection}
      verses={data.verses}
      posts={data.posts}
      canCompose={Boolean(data.userId)}
    />
  }
  return <ChapterView
    book={data.book}
    chapter={data.chapter}
    collection={data.collection}
    posts={data.posts}
    canCompose={Boolean(data.userId)}
    chapterCommenters={data.chapterCommenters}
    circlePosts={data.circlePosts}
  />
}

type VerseViewProps = {
  book: Book
  chapter: number
  collection: string
  verses: number[]
  posts: PostWithUser[]
  canCompose: boolean
}

function VerseView({ book, chapter, collection, verses, posts, canCompose }: VerseViewProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const loc = { collection, book: book.id, chapter }
  const scriptureLabel = getScriptureLabel({ ...loc, verses }, book)
  const officialUrl = buildScriptureUrl({ ...loc, verses }, book)
  const bilingual = useBilingualEnabled()
  const verseTexts = useVerseTexts(loc, PRIMARY_LANGUAGE, verses)
  const secondaryTexts = useVerseTexts(loc, SECONDARY_LANGUAGE, verses, bilingual)

  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) router.invalidate()
  }

  return (
    <div>
      <PageHeader
        title={scriptureLabel}
        backTo="/scriptures/$collection/$book/$chapter"
        backLabel={getChapterLabel(book, chapter)}
        action={
          <div className="flex items-center gap-2">
            {canCompose && (
              <ComposePostButton
                label="投稿する"
                className="hidden lg:inline-flex"
                onClick={() => setSheetOpen(true)}
                aria-haspopup="dialog"
              />
            )}
            <BilingualToggleButton />
            <BookmarkButton loc={loc} />
          </div>
        }
      />
      {canCompose && (
        <ComposePostButton
          layout="fab"
          label="投稿する"
          className="lg:hidden"
          onClick={() => setSheetOpen(true)}
          aria-haspopup="dialog"
        />
      )}
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
      {verseTexts.size > 0 && (
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
          {[...verseTexts].map(([verse, textHtml]) => (
            <ScriptureText
              key={verse}
              verse={verse}
              textHtml={textHtml}
              textHtmlSecondary={secondaryTexts.get(verse)}
              secondaryLang={SECONDARY_LANGUAGE}
              showNumber={!book.isFrontMatter}
            />
          ))}
        </div>
      )}
      {posts.length === 0 ? (
        <EmptyState>この節への投稿はまだありません</EmptyState>
      ) : (
        <div className="pb-[var(--fab-clearance)]">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
      {canCompose && (
        <PostComposerSheet
          open={sheetOpen}
          onOpenChange={onSheetOpenChange}
          initialScripture={{ collection, book: book.id, chapter, verses }}
          lockScripture
        />
      )}
    </div>
  )
}

type ChapterViewProps = {
  book: Book
  chapter: number
  collection: string
  posts: PostWithUser[]
  canCompose: boolean
  chapterCommenters: AvatarStackItem[]
  circlePosts: PostWithUser[]
}

// 同じ書の中では書名が自明なうえ、狭い画面で「第1ニーファイ書 第21章」が折り返す
// 読み終えた位置に置く。前付け文書は移動先から外れ、コレクションの端では片側だけになる
function ChapterNav({ collection, book, chapter }: ChapterRef) {
  const prev = getAdjacentChapterRef({ collection, book, chapter }, 'prev')
  const next = getAdjacentChapterRef({ collection, book, chapter }, 'next')
  if (!prev && !next) return null

  const linkClass =
    'flex items-center gap-1 px-3 py-2 text-sm rounded-md transition-colors hover:bg-[var(--chip-bg)]'

  return (
    <nav
      data-testid="chapter-nav"
      aria-label="章の移動"
      className="flex items-center gap-2 px-4 py-4 border-t"
      style={{ borderColor: 'var(--line)', color: 'var(--lagoon-deep)' }}
    >
      {prev && (
        <Link
          to="/scriptures/$collection/$book/$chapter"
          params={refToParams(prev)}
          // 矢印は読み上げから外れるため、名前に方向が残らないと行き先しか伝わらない
          aria-label={`前の章: ${getChapterNavLabel(prev, book)}`}
          className={linkClass}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          {getChapterNavLabel(prev, book)}
        </Link>
      )}
      {next && (
        <Link
          to="/scriptures/$collection/$book/$chapter"
          params={refToParams(next)}
          aria-label={`次の章: ${getChapterNavLabel(next, book)}`}
          className={`${linkClass} ml-auto`}
        >
          {getChapterNavLabel(next, book)}
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}
    </nav>
  )
}

// 章の先頭に置くタイトルと概要。概要があるのは回復された聖典だけで、
// 旧約・新約はタイトルだけになる
function ChapterHeadingBlock({
  heading,
  secondary,
}: {
  heading: ChapterHeading | null
  secondary?: ChapterHeading | null
}) {
  if (!heading) return null
  return (
    <div className="px-4 pt-6 pb-4">
      {/* 同じ文字列が貼り付くヘッダーの h1 にもある。ここも見出しにすると
          読み上げの見出し一覧に「第n章」が続けて二度並び、区別できない */}
      <p
        data-testid="chapter-heading"
        className="text-center text-base font-display"
        style={{ color: 'var(--sea-ink)' }}
      >
        {heading.title}
      </p>
      {heading.summaryHtml && (
        <SanitizedVerseHtml
          html={heading.summaryHtml}
          className="mt-2 block pl-[3px] text-sm leading-relaxed"
          style={{ color: 'var(--sea-ink-soft)' }}
        />
      )}
      {secondary?.summaryHtml && (
        <SanitizedVerseHtml
          html={secondary.summaryHtml}
          // 節の行は選択表示用に左へ 3px の境界を持つ（VerseRow の borderLeft）。
          // 同じ分だけ空けないと節番号と左端がずれる。タイトルは画面の中央に
          // 合わせたいので、この調整は概要だけに入れる
          className="mt-2 block pl-[3px] text-sm leading-relaxed"
          style={{ color: 'var(--sea-ink-soft)' }}
          lang={SECONDARY_LANGUAGE}
        />
      )}
    </div>
  )
}

// スワイプ中に見える移動先の冒頭。見えるのは画面1つぶんなので、それを超える節は描かない。
// 指を置いた時点で前後ぶんまとめてマウントし、節ごとにサニタイズが走るため、
// 画面に入る見込みより大きく取ると入力の応答が鈍る
const PREVIEW_VERSE_LIMIT = 20

// 余白・区切り線・節の組みは verseList と揃える。ここがずれると、指を離した瞬間に
// 本文が横や縦に飛ぶ。
//
// memo で包むのは、ドラッグ中にページャの状態（行先・プレビューの縦位置）が
// 変わるたびに前後20節ぶんの再調整が走るため。実測で1ドラッグあたり16回→4回
const ChapterPreview = memo(function ChapterPreview({ texts }: { texts: ChapterTexts }) {
  const target = getBook(texts.ref.collection, texts.ref.book)
  const all = [...texts.primary.keys()]
  const verses = all.slice(0, PREVIEW_VERSE_LIMIT)

  return (
    <div>
      <ChapterHeadingBlock heading={texts.heading} secondary={texts.secondaryHeading} />
      {/* 折り返しが本体とずれないよう、余白は verseList と同じにする */}
      <div className="pb-4 pr-1">
        <ul>
          {verses.map((verse, i) => {
            const isLast = i === verses.length - 1 && verses.length === all.length
            return (
              <li
                key={verse}
                className={`flex items-stretch ${isLast ? '' : 'border-b'}`}
                style={{ borderColor: 'var(--line)' }}
              >
                <div className="flex-1 min-w-0">
                  <VerseRow
                    verse={verse}
                    textHtml={texts.primary.get(verse)}
                    textHtmlSecondary={texts.secondary.get(verse)}
                    secondaryLang={SECONDARY_LANGUAGE}
                    mode="read"
                    selected={false}
                    onSelect={() => {}}
                    onOpen={() => {}}
                    showNumber={!target?.isFrontMatter}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
})

function refToParams(ref: ChapterRef) {
  return { collection: ref.collection, book: ref.book, chapter: String(ref.chapter) }
}

function ChapterView({
  book, chapter, collection, posts, canCompose,
  chapterCommenters, circlePosts,
}: ChapterViewProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [composerVerses, setComposerVerses] = useState<number[] | undefined>()
  const [sheetHighlight, setSheetHighlight] = useState<number[] | null>(null)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const maxVerse = book.verses[chapter - 1]
  const loc = { collection, book: book.id, chapter }
  const bilingual = useBilingualEnabled()
  const verseTextMap = useVerseTexts(loc, PRIMARY_LANGUAGE)
  const secondaryTexts = useVerseTexts(loc, SECONDARY_LANGUAGE, undefined, bilingual)
  const heading = useChapterHeading(loc, PRIMARY_LANGUAGE, !book.isFrontMatter)
  const secondaryHeading = useChapterHeading(loc, SECONDARY_LANGUAGE, !book.isFrontMatter && bilingual)

  const storedUserId = useSelectedUserId()
  const selectUser = useSelectedUserStore((s) => s.select)
  const clearUser = useSelectedUserStore((s) => s.clear)
  const selectedUser =
    chapterCommenters.find((c) => c.userId === storedUserId) ?? null
  // ユーザー未選択なら身内全員分を出す。選択は絞り込みであってゲートではない
  const visiblePosts = useMemo(
    () =>
      selectedUser
        ? circlePosts.filter((p) => p.user_id === selectedUser.userId)
        : circlePosts,
    [circlePosts, selectedUser],
  )
  // 身内全員分。シートの中身と、印の列の幅を取るかの判定に使う
  const allCommentIndex = useMemo(
    () => buildVerseCommentIndex(maxVerse, circlePosts),
    [maxVerse, circlePosts],
  )
  // 節の横の印は絞り込みに従う
  const commentIndex = useMemo(
    () =>
      selectedUser ? buildVerseCommentIndex(maxVerse, visiblePosts) : allCommentIndex,
    [selectedUser, maxVerse, visiblePosts, allCommentIndex],
  )
  // シートの中身は絞り込みを無視する。共有された ?comment= を開いた側が別のユーザーで
  // 絞り込んでいると、送った側が見せたいコメントが無言で開かなくなるため
  const sheetIndex = allCommentIndex

  const verseNumbers = Array.from({ length: maxVerse }, (_, i) => i + 1)
  const selection = useMemo(
    () => parseSelection(search.select, maxVerse),
    [search.select, maxVerse],
  )
  const mode: SelectionMode = canCompose && search.mode === 'select' ? 'select' : 'read'

  // インデックスは章の範囲外の節を持たないが、コメントが無い節でも開ける。
  // 節の行からもこのシートを開くため
  const requestedComment = search.comment
  const commentVerseForScroll =
    mode !== 'select' &&
    requestedComment !== undefined &&
    requestedComment >= 1 &&
    requestedComment <= maxVerse
      ? requestedComment
      : undefined
  // シートが開いている間だけ塗る。カードに触れていないときは、シートに出ている
  // 全コメントが指す節をまとめて塗る
  const highlightedVerses = useMemo(() => {
    if (commentVerseForScroll === undefined) return null
    if (sheetHighlight) return new Set(sheetHighlight)
    const covered = sheetIndex.get(commentVerseForScroll)?.covered ?? []
    const verses = covered.flatMap((p) => p.scripture_verses ?? [])
    return new Set(verses.length ? verses : [commentVerseForScroll])
  }, [commentVerseForScroll, sheetHighlight, sheetIndex])

  const scrolledVerse = useRef<number | undefined>(undefined)
  const isMounted = useRef(false)
  // 併記表示の英文はクライアント側で後から届き、全節の高さが増える。secondaryTexts を
  // 依存に含めて、届いた後にもう一度位置を合わせ直す（含めないと 300px 以上ずれる）
  useEffect(() => {
    if (commentVerseForScroll === undefined) {
      scrolledVerse.current = undefined
      return
    }
    const target = document.querySelector(`li[data-verse="${commentVerseForScroll}"]`)
    if (!target) return

    // 節の行を押して別の節に移ったときだけスムーズに動かす（視差効果を減らす設定なら
    // それも行わない）。直リンクで開いた初回の位置決めと、
    // 英文が届いた後の再調整は即時にする。どちらも動く様子に意味がないうえ、'smooth' は
    // 開始時点の座標を目標に据えるため、移動中に高さが変わるとずれた位置で止まる
    const isNewSelection = scrolledVerse.current !== commentVerseForScroll
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior =
      !reduceMotion && isMounted.current && isNewSelection ? 'smooth' : 'auto'
    scrolledVerse.current = commentVerseForScroll

    target.scrollIntoView({ behavior, block: 'start' })
  }, [commentVerseForScroll, secondaryTexts])

  // 上のスクロール effect より後に置く。effect は宣言順に走るため、マウント時の
  // 1回目（= 直リンクでの位置決め）では isMounted がまだ false になる
  useEffect(() => {
    isMounted.current = true
  }, [])

  const chapterNav = <ChapterNav collection={collection} book={book.id} chapter={chapter} />

  const patchSearch = (
    patch: Partial<ChapterSearch>,
    replace = true,
    state?: (prev: HistoryState) => HistoryState,
  ) => {
    navigate({
      to: '/scriptures/$collection/$book/$chapter',
      params: { collection, book: book.id, chapter: String(chapter) },
      search: (prev) => ({ ...prev, ...patch }),
      replace,
      // 同じ章に留まる検索パラメータの更新なので、既定の「先頭へ戻す」は邪魔になる。
      // これがないと下の方の節を選ぶたびに最上部へ飛ばされる
      resetScroll: false,
      ...(state ? { state } : {}),
    })
  }

  const setSelection = (next: number[]) =>
    patchSearch({ select: next.length ? next : undefined })
  // mode=select と同じく push する。戻る操作でシートを閉じられるようにするため。
  // ただしシートは非モーダルなので、開いたまま別の節の行を押せる。そのたびに push すると
  // 閉じる操作が前の節のシートに戻ってしまうため、開いている間は差し替える。
  // マーカーも足さない（直リンクで開いたエントリに付けると、閉じたときに章から離脱する）
  const openVerseSheet = (verse: number) => {
    const alreadyOpen = commentVerseForScroll !== undefined
    patchSearch({ comment: verse }, alreadyOpen, (prev) =>
      alreadyOpen ? prev : { ...prev, ...VERSE_SHEET_MARKER },
    )
  }
  const closeVerseSheet = () => {
    // 自分が push したエントリのときだけ戻す。replace で消すと同じ章 URL が
    // 履歴に2件残り、戻るを押しても画面が変わらなくなる。
    // canGoBack だけで判定すると、?comment= の直リンクを閉じたときに前のページへ
    // 離脱してしまう（そのエントリはシートを開いたものではない）。
    // 印を判別する状態を ref に持つとブラウザ履歴と同期せず、進む操作やリロードの
    // 後に取り違えるため、履歴エントリ自身に持たせる
    const pushedByUs = (window.history.state as VerseSheetHistoryState | null)
      ?.mannaVerseSheet
    if (pushedByUs && router.history.canGoBack()) router.history.back()
    else patchSearch({ comment: undefined })
  }
  const enterSelectMode = () => patchSearch({ mode: 'select' }, false)
  const exitSelectMode = () => patchSearch({ mode: undefined, select: undefined })

  const composeForVerse = (verse: number) => {
    closeVerseSheet()
    setComposerVerses([verse])
    setSheetOpen(true)
  }

  const openComposerForChapter = () => {
    setComposerVerses(undefined)
    setSheetOpen(true)
  }
  const openComposerForSelection = () => {
    setComposerVerses(selection)
    setSheetOpen(true)
  }
  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open)
    if (!open) router.invalidate()
  }
  const onComposerClosed = () => {
    if (mode === 'select') exitSelectMode()
  }

  const showCommenters = canCompose && mode !== 'select'
  // 投稿の有無ではなく、印が出るかで判定する。範囲外の節だけを持つ投稿があると、
  // 印ゼロのまま本文が狭くなる。絞り込み後ではなく全員分で見るのは、絞り込みの
  // 切り替えで幅を揺らさないため
  const hasAnchorInChapter = useMemo(
    () => [...allCommentIndex.values()].some((entry) => entry.anchored.length > 0),
    [allCommentIndex],
  )
  const showMarker = mode !== 'select' && hasAnchorInChapter

  const composeMenuProps = {
    onSelectChapter: openComposerForChapter,
    onSelectVerses: enterSelectMode,
  }

  const headerAction = (
    <div className="flex items-center gap-2">
      {canCompose && <ComposeMenu {...composeMenuProps} className="hidden lg:inline-flex" />}
      <BilingualToggleButton />
      <BookmarkButton loc={loc} />
    </div>
  )

  const composeFab =
    canCompose && mode !== 'select' ? (
      <ComposeMenu {...composeMenuProps} layout="fab" className="lg:hidden" />
    ) : null

  const collectionName = book.isFrontMatter ? getCollection(collection)?.name : undefined

  const chapterHeader = (
    <>
      <PageHeader
        title={getChapterLabel(book, chapter)}
        backTo={book.isFrontMatter ? '/scriptures/$collection' : '/scriptures/$collection/$book'}
        backLabel={collectionName ?? book.name}
        action={headerAction}
      />
      {showCommenters && (
        <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--line)' }}>
          <ChapterCommentersRow
            commenters={chapterCommenters}
            selectedUserId={selectedUser?.userId ?? null}
            onSelect={selectUser}
            onClear={clearUser}
          />
        </div>
      )}
    </>
  )

  const selectionHeader = (
    <SelectionModeHeader
      count={selection.length}
      onCancel={exitSelectMode}
      onSubmit={openComposerForSelection}
    />
  )

  const verseList = (
    // 右の 4px は印のバッジ（-right-1）の逃げ場。無いとページャに切られる
    <div className="pb-4 pr-1">
      <ul>
        {verseNumbers.map((verse, i) => {
          const textHtml = verseTextMap.get(verse)
          const isSelected = mode === 'select' && selection.includes(verse)
          const entry = commentIndex.get(verse)
          const isLast = i === verseNumbers.length - 1
          return (
            <li
              key={verse}
              data-verse={verse}
              // sticky ヘッダーの下に潜り込まないよう、スクロール先に余白を取る
              className={`flex items-stretch scroll-mt-16 ${isLast ? '' : 'border-b'}`}
              style={{ borderColor: 'var(--line)' }}
            >
              <div className="flex-1 min-w-0">
                <VerseRow
                  verse={verse}
                  textHtml={textHtml}
                  textHtmlSecondary={secondaryTexts.get(verse)}
                  secondaryLang={SECONDARY_LANGUAGE}
                  mode={mode}
                  selected={isSelected}
                  onSelect={(v) => setSelection(toggleVerse(selection, v))}
                  onOpen={openVerseSheet}
                  commentCount={entry?.anchored.length ?? 0}
                  highlighted={highlightedVerses?.has(verse) ?? false}
                  showNumber={!book.isFrontMatter}
                />
              </div>
              {showMarker && (
                <VerseCommentMarker
                  entry={
                    entry && {
                      anchoredCount: entry.anchored.length,
                      commenters: entry.commenters,
                    }
                  }
                />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )

  // 投稿シートはモーダルなので、開いている間は非モーダルの節シートを描かない。
  // composeForVerse は closeVerseSheet() の後に setSheetOpen(true) を呼ぶが、
  // closeVerseSheet 側のナビゲーション（search.comment のクリア）は非同期なため、
  // この条件が無いと一瞬だけ両方が描画される。FAB から投稿シートを開いたときに
  // 裏へ節シートが残るのも同じ理由で防げる
  const activeVerseSheet =
    commentVerseForScroll !== undefined && !sheetOpen ? (
      <VerseCommentSheet
        open
        verse={commentVerseForScroll}
        label={getScriptureLabel({ ...loc, verses: [commentVerseForScroll] }, book)}
        officialUrl={buildScriptureUrl({ ...loc, verses: [commentVerseForScroll] }, book)}
        textHtml={verseTextMap.get(commentVerseForScroll)}
        textHtmlSecondary={secondaryTexts.get(commentVerseForScroll)}
        secondaryLang={SECONDARY_LANGUAGE}
        posts={sheetIndex.get(commentVerseForScroll)?.covered ?? []}
        onOpenChange={(open) => {
          if (!open) closeVerseSheet()
        }}
        onHighlight={setSheetHighlight}
        canCompose={canCompose}
        onCompose={composeForVerse}
      />
    ) : null

  return (
    <div>
      {mode === 'select' ? selectionHeader : chapterHeader}
      {composeFab}
      {/* 章が変わったら中央のパネルから始め直すため、章参照で作り直す */}
      <ChapterPager
        key={`${collection}/${book.id}/${chapter}`}
        loc={{ collection, book: book.id, chapter }}
        // シートは背面を覆わないので、開いたままスワイプできてしまう
        disabled={mode === 'select' || sheetOpen || commentVerseForScroll !== undefined}
        renderPreview={(texts) => <ChapterPreview texts={texts} />}
      >
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
        {/* 末尾が節一覧か章移動かで変わるため、FAB のぶんの余白はまとめて外側で確保する。
            FAB が出ない場面（未ログイン・選択モード・lg 以上）では余らせない */}
        <div className={composeFab ? 'pb-[var(--fab-clearance)] lg:pb-0' : undefined}>
          <ChapterHeadingBlock heading={heading} secondary={secondaryHeading} />
          {verseList}
          {mode !== 'select' && chapterNav}
        </div>
      </ChapterPager>
      {canCompose && (
        <PostComposerSheet
          open={sheetOpen}
          onOpenChange={onSheetOpenChange}
          onClosed={onComposerClosed}
          initialScripture={{
            collection,
            book: book.id,
            chapter,
            verses: composerVerses,
          }}
          lockScripture
        />
      )}
      {activeVerseSheet}
    </div>
  )
}
