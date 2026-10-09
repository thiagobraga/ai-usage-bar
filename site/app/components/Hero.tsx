'use client'

import { useRef } from 'react'
import { GnomePreview } from './GnomePreview'

export function Hero() {
  const cmdRef = useRef<HTMLDivElement>(null)

  const copy = () => {
    navigator.clipboard?.writeText('./scripts/install.sh').then(() => {
      const span = cmdRef.current?.querySelector('span[data-cmd]') as HTMLSpanElement
      if (!span) return
      const orig = span.textContent
      span.textContent = 'copied!'
      span.style.color = 'var(--amber)'
      setTimeout(() => { span.textContent = orig; span.style.color = '' }, 1600)
    })
  }

  return (
    <div className="mx-auto max-w-[1320px] px-[clamp(1.5rem,5vw,4rem)]">
      <div
        className="grid items-center gap-[clamp(3rem,5vw,6rem)]"
        style={{
          minHeight: '100dvh',
          paddingTop: 'calc(52px + clamp(3.5rem,8vw,7rem))',
          paddingBottom: 'clamp(4rem,8vw,7rem)',
          gridTemplateColumns: 'repeat(2, 1fr)',
        }}
      >
        {/* Content */}
        <div>
          <p className="mb-7 inline-flex items-center gap-[0.625rem] font-mono text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-amber">
            <span className="block h-px w-[22px] bg-amber-dim" />
            GNOME Shell 46 Extension
          </p>

          <h1
            className="mb-[1.625rem] font-display text-[clamp(2.75rem,5.5vw,5.125rem)] font-black leading-none tracking-[-0.03em] text-text-0"
          >
            Every token.<br />
            <em className="text-amber not-italic" style={{ fontStyle: 'italic' }}>Always visible.</em>
          </h1>

          <p className="mb-11 max-w-[46ch] text-[clamp(1rem,1.5vw,1.0625rem)] leading-[1.72] text-text-1">
            AI Usage Bar puts Claude, Codex, Gemini, Cursor, and OpenRouter usage, limits, and reset windows straight into the GNOME top panel. No dashboards. No tab-switching. No guessing.
          </p>

          <div className="flex flex-col items-start gap-[0.875rem]">
            <div
              ref={cmdRef}
              onClick={copy}
              className="flex cursor-pointer items-center gap-3 rounded-[4px] border border-bg-3 bg-bg-2 px-[1.125rem] py-3 font-mono text-[0.9375rem] text-text-0 transition-colors duration-150 hover:border-amber-dim hover:bg-bg-1 group"
            >
              <span className="text-amber-dim">$</span>
              <span data-cmd>./scripts/install.sh</span>
              <span className="ml-auto text-[0.625rem] uppercase tracking-[0.08em] text-text-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                copy
              </span>
            </div>
            <p className="font-mono text-[0.6875rem] leading-[1.6] text-text-2">
              Requires GNOME Shell 46 · glib-compile-schemas<br />
              Node.js 20+ for tests only
            </p>
          </div>
        </div>

        {/* Illustration */}
        <GnomePreview />
      </div>
    </div>
  )
}
