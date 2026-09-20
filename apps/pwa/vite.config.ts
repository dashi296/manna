import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const config = defineConfig({
  // Vite 8 の既定 'baseline-widely-available'（Chrome 111+ / Edge 111+ /
  // Firefox 114+ / Safari 16.4+）は Firefox だけ Array#toSorted（FF115+）に
  // 届かない。esbuild は構文しか変換せずメソッドは polyfill しないため、
  // 実際に必要な下限を明示する
  build: {
    target: ['chrome111', 'edge111', 'firefox115', 'safari16.4'],
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart({
      router: {
        routesDirectory: './pages',
      },
    }),
    viteReact(),
    devtools(),
  ],
})

export default config
