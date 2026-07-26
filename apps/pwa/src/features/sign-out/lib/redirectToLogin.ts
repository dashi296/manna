// signOut が消すのはクライアント側のセッションだけで、SSR は cookie を読んで認証を
// 判定する（__root.tsx の beforeLoad）。クライアントルーティングだとサーバー側が
// 古い cookie を見る可能性があるため、全体リロードで確実にやり直す。
export function redirectToLogin() {
  window.location.href = '/login'
}
