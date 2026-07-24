import React from 'react'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

const CONFIG = { position: 'bottom-right' } as const

const routerPlugin = {
  name: 'Tanstack Router',
  render: React.createElement(TanStackRouterDevtoolsPanel),
}

const queryPlugin = {
  name: 'Tanstack Query',
  // client を省略すると QueryClientProvider の React context から自動解決される
  // （TanStackRouterDevtoolsPanel が router を context から解決するのと同じ挙動）。
  render: React.createElement(ReactQueryDevtoolsPanel),
}

const plugins = [routerPlugin, queryPlugin]

export function DevTools() {
  // config/plugins をモジュールスコープの安定した参照にしているのは、
  // TanStackDevtools がこれらの参照が変わるたびにパネルを再マウントするため
  // （ナビゲーションのたびに開いていたタブやフィルタ状態が失われるのを防ぐ）。
  return React.createElement(TanStackDevtools, { config: CONFIG, plugins })
}
