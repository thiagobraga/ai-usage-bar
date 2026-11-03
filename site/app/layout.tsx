import type { Metadata } from 'next'
import { Red_Hat_Display, Red_Hat_Text, Red_Hat_Mono } from 'next/font/google'
import { ThemeProvider } from './components/ThemeProvider'
import './globals.css'

const redHatDisplay = Red_Hat_Display({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-red-hat-display',
})

const redHatText = Red_Hat_Text({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-red-hat-text',
})

const redHatMono = Red_Hat_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-red-hat-mono',
})

export const metadata: Metadata = {
  title: 'AI Usage Bar - AI provider usage in the panel',
  description:
    'GNOME Shell 46 extension. Claude, Codex, Gemini, Cursor, OpenRouter usage, limits, reset windows, and cost. Always in the top panel.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${redHatDisplay.variable} ${redHatText.variable} ${redHatMono.variable}`}
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
