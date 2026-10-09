'use client'

import { useEffect, useRef } from 'react'

const FEATURES = [
  { n: '01', title: 'Usage bars with reset countdowns', desc: 'Session, weekly, and monthly limits as percentage bars. Exact time until each window resets.' },
  { n: '02', title: 'Cost tracking', desc: "Today's spend, 30-day total, and token counts. Know your burn rate without opening a dashboard." },
  { n: '03', title: 'Clickable provider switcher', desc: 'Five providers in a tile row inside the popup. Click any tile to drill into its detail view.' },
  { n: '04', title: 'Auto-refresh loop', desc: 'Configurable from 1 minute to 5m+. Stale data markers when a fetch is overdue. Each provider isolated.' },
  { n: '05', title: 'Adjustable UI', desc: 'Compact or comfortable density. Popup opacity 35–100%. Adapts to any GNOME desktop theme.' },
  { n: '06', title: 'Per-provider error isolation', desc: 'A failing provider shows an error state without blocking the rest. 5-second timeout per provider.' },
]

export function Features() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { threshold: 0.07, rootMargin: '0px 0px -36px 0px' }
    )
    ref.current?.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <section
      ref={ref}
      id="features"
      className="mx-auto max-w-[1320px] px-[clamp(1.5rem,5vw,4rem)] py-[clamp(5rem,10vw,9rem)]"
    >
      <div
        className="grid grid-cols-1 items-start gap-[clamp(3rem,6vw,7rem)] lg:grid-cols-[280px_1fr]"
      >
        {/* Aside */}
        <div className="reveal lg:sticky top-[calc(52px+2rem)]">
          <p className="mb-5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-amber-dim">
            Features
          </p>
          <h2 className="mb-5 font-display text-[clamp(1.875rem,3.5vw,2.875rem)] font-bold leading-[1.08] tracking-[-0.025em] text-text-0">
            Built around how developers actually work
          </h2>
          <p className="max-w-[54ch] text-base leading-[1.72] text-text-1">
            One glance at the panel tells you where you stand before you start the next refactor.
          </p>
        </div>

        {/* Grid */}
        <div
          className="grid grid-cols-1 overflow-hidden rounded-[6px] border border-bg-3 sm:grid-cols-2"
        >
          {FEATURES.map((f, i) => (
            <div
              key={f.n}
              className="reveal border-bg-3 p-[clamp(1.25rem,2.5vw,1.875rem)]"
              style={{
                borderRight: i % 2 === 0 ? '1px solid var(--bg-3)' : 'none',
                borderBottom: i < 4 ? '1px solid var(--bg-3)' : 'none',
                transitionDelay: `${(i % 3) * 0.06}s`,
              }}
            >
              <p className="mb-4 font-mono text-[0.625rem] font-medium tracking-[0.06em] text-amber-dim">{f.n}</p>
              <h3 className="mb-2 font-display text-[0.9375rem] font-bold leading-[1.25] text-text-0">{f.title}</h3>
              <p className="text-[0.8125rem] leading-[1.62] text-text-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
