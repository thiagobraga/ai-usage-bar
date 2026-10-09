'use client'

import { useEffect, useRef } from 'react'

const SOURCES = [
  { code: '~/.claude/',                   desc: 'Session logs and usage data' },
  { code: '~/.codex/',                    desc: 'Codex state JSON' },
  { code: '~/.config/gcloud/',            desc: 'Gemini via gcloud' },
  { code: 'openrouter.ai/api/v1/auth/key', desc: 'Balance check, API key only if configured' },
]

export function Privacy() {
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
      id="privacy"
      className="mx-auto max-w-[1320px] px-[clamp(1.5rem,5vw,4rem)] py-[clamp(5rem,10vw,9rem)]"
    >
      <div
        className="grid grid-cols-1 items-start gap-[clamp(3rem,6vw,7rem)] lg:grid-cols-2"
      >
        <div className="reveal">
          <p className="mb-5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-amber-dim">
            Privacy
          </p>
          <h2
            className="font-display font-black leading-none tracking-[-0.03em] text-text-0"
            style={{ fontSize: 'clamp(2.5rem,5vw,4.5rem)' }}
          >
            Local first.<br />
            <span className="text-amber">No surprises.</span>
          </h2>
        </div>

        <div className="reveal" style={{ transitionDelay: '0.1s' }}>
          <p className="mb-8 text-base leading-[1.72] text-text-1">
            Most providers need nothing from you. AI Usage Bar reads the same local files your CLI tools already write. Every file path and API endpoint the extension can touch is listed in Settings under the Privacy panel.
          </p>
          <ul className="flex flex-col gap-[0.625rem] list-none">
            {SOURCES.map((s) => (
              <li key={s.code} className="flex items-start gap-[0.875rem] text-[0.875rem] leading-[1.5] text-text-1">
                <code className="flex-shrink-0 whitespace-nowrap rounded-[2px] border border-bg-3 bg-bg-2 px-[0.4375rem] py-[0.125rem] font-mono text-[0.75rem] text-text-0">
                  {s.code}
                </code>
                {s.desc}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
