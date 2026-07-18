# サイドバー Base UI 化 + 標準構成化 設計メモ

Issue: dashi296/manna#38（全体移行の親 issue: #39）

## 決定事項

- shadcn/ui Sidebar を **Base UI 版**（`@base-ui/react`）に置き換える。依存プリミティブ（sheet / tooltip / separator / button）も同時に Base UI 版へ差し替える
- **モバイルは BottomNav を維持**。サイドバーはデスクトップ（lg 以上）専用のまま。Sheet ベースのモバイルサイドバーは採用しない（ナビ項目が 5 個を超えたら再検討）
- デスクトップの折りたたみは **`collapsible="icon"`**（アイコンレール残存 + Tooltip でラベル補完）
- `SidebarTrigger` を配置し、開閉状態の cookie 永続化・`⌘/Ctrl+B` ショートカットを有効にする
- 幅・色のインラインスタイルを廃止し、`--sidebar-*` CSS 変数でテーマ設定する
- `NAV_ITEMS` を AppSidebar / BottomNav で共通化する（`shared/config/navigation.ts`）
- フッターのユーザー表示は `SidebarFooter` + `SidebarMenuButton size="lg"` パターンに寄せ、折りたたみ時はアバターのみ表示

## スコープ外

- sidebar が依存しない Radix コンポーネント（dialog / select / toggle / toggle-group）の移行は #39 で対応
- BottomNav の機能変更
