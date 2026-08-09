import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    // 各テスト前に全モックの呼び出し履歴を消す。beforeEach で mockClear を
    // 手書きで並べると、モックを足したとき追記を忘れて履歴がテスト間に漏れる。
    // 実装（mockResolvedValue などの戻り値）は消えないので、再スタブは各自で行う
    clearMocks: true,
  },
})
