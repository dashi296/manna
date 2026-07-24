import React from 'react'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'

const routerPlugin = {
  name: 'Tanstack Router',
  render: React.createElement(TanStackRouterDevtoolsPanel),
}

type Props = {
  queryClient: QueryClient
}

export function DevTools({ queryClient }: Props) {
  const queryPlugin = {
    name: 'Tanstack Query',
    render: React.createElement(ReactQueryDevtoolsPanel, { client: queryClient }),
  }
  return React.createElement(TanStackDevtools, {
    config: { position: 'bottom-right' },
    plugins: [routerPlugin, queryPlugin],
  })
}
