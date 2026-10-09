'use client'

import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

export function Nav() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  return (
    <nav
      className="fixed inset-x-0 top-0 z-50 flex h-13 items-center px-[clamp(1.5rem,5vw,4rem)]"
      style={{
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid var(--nav-border)',
        height: '52px',
      }}
    >
      <a
        href="#"
        className="flex items-center gap-2 font-display text-[0.9375rem] font-bold tracking-[-0.01em] text-text-0 no-underline"
      >
        <span className="text-amber">✺</span>
        AI Usage Bar
      </a>

      <div className="flex-1" />

      <ul className="mr-9 hidden items-center gap-9 list-none sm:flex">
        {['Features', 'Providers', 'Privacy', 'Install'].map((item) => (
          <li key={item}>
            <a
              href={`#${item.toLowerCase()}`}
              className="text-sm text-text-2 no-underline transition-colors duration-120 hover:text-text-0"
            >
              {item}
            </a>
          </li>
        ))}
      </ul>

      {mounted && (
        <button
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
          title={resolvedTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="mr-4 flex h-[30px] w-[30px] flex-shrink-0 cursor-pointer items-center justify-center rounded-[3px] border border-bg-3 bg-transparent text-base leading-none text-text-2 transition-colors duration-120 hover:border-bg-4 hover:bg-bg-2 hover:text-text-0"
        >
          {resolvedTheme === 'dark' ? '◐' : '◑'}
        </button>
      )}

      <a
        href="#install"
        className="rounded-[3px] px-[0.9rem] py-[0.375rem] font-mono text-[0.8125rem] font-medium text-bg-0 no-underline transition-[filter] duration-120 hover:brightness-110"
        style={{ background: 'var(--amber)', color: 'var(--bg-0)' }}
      >
        Install
      </a>
    </nav>
  )
}
