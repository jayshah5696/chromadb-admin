import { Inter, JetBrains_Mono } from 'next/font/google'
import '@mantine/notifications/styles.css'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import { MantineProvider, ColorSchemeScript, createTheme } from '@mantine/core'

import ReactQueryProvider from '@/app/ReactQueryProvider'

import type { ReactNode } from 'react'
import type { Metadata } from 'next'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

const theme = createTheme({
  fontFamily: 'var(--font-inter), -apple-system, BlinkMacSystemFont, sans-serif',
  fontFamilyMonospace: 'var(--font-mono), monospace',
  primaryColor: 'blue',
  colors: {
    dark: [
      '#C1C2C5',
      '#A6A7AB',
      '#909296',
      '#5c5f66',
      '#373A40',
      '#2C2E33',
      '#252526',
      '#1e1e1e',
      '#191919',
      '#141414',
    ],
  },
})

export const metadata: Metadata = {
  title: 'ChromaDB Admin',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <head suppressHydrationWarning>
        <ColorSchemeScript forceColorScheme="dark" />
        <style>{`
          body {
            margin: 0;
            background: #1e1e1e;
            overflow: hidden;
          }
        `}</style>
      </head>
      <body>
        <ReactQueryProvider>
          <MantineProvider theme={theme} forceColorScheme="dark">
            <Notifications />
            {children}
          </MantineProvider>
        </ReactQueryProvider>
      </body>
    </html>
  )
}
