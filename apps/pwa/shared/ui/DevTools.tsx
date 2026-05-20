import React from 'react'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

const routerPlugin = {
  name: 'Tanstack Router',
  render: React.createElement(TanStackRouterDevtoolsPanel),
}

export function DevTools() {
  return React.createElement(TanStackDevtools, {
    config: { position: 'bottom-right' },
    plugins: [routerPlugin],
  })
}
