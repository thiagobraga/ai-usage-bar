'use client'

import { useEffect, useRef } from 'react'

const PROVIDERS = [
  { icon: '◎', name: 'Codex / OpenAI', sub: 'Usage and cost from local state', paths: ['~/.codex/', '~/.config/codex/'], auth: 'none', status: 'done' },
  { icon: '✺', name: 'Claude',          sub: 'Anthropic session and usage logs', paths: ['~/.claude/', '~/.config/claude/'], auth: 'none', status: 'done' },
  { icon: '✦', name: 'Gemini',          sub: 'Via gcloud CLI', paths: ['~/.config/gcloud/', '~/.config/gemini/'], auth: 'gcloud', status: 'done' },
  { icon: '⊕', name: 'OpenRouter',      sub: 'Balance and rate limits', paths: ['openrouter.ai/api/v1/auth/key'], auth: 'apikey', status: 'done' },
  { icon: '⊙', name: 'Cursor',          sub: 'Web dashboard', paths: ['Manual cookie (opt-in)'], auth: 'cookie', status: 'stub' },
]

function Tag({ type, label }: { type: 'none' | 'optional' | 'muted'; label: string }) {
  const styles = {
    none:     'text-green     bg-green-bg',
    optional: 'text-amber     bg-amber-bg',
    muted:    'text-text-2    bg-bg-2',
  }
  return (
    <span className={`inline-flex items-center gap-[0.3rem] rounded-[2px] px-2 py-[0.2rem] font-mono text-[0.625rem] font-medium ${styles[type]}`}>
      <span className="h-[4px] w-[4px] flex-shrink-0 rounded-full bg-current" />
      {label}
    </span>
  )
}

export function Providers() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { threshold: 0.07, rootMargin: '0px 0px -36px 0px' }
    )
    ref.current?.querySelectorAll('.reveal').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} className="border-y border-bg-3 bg-bg-1">
      <div
        id="providers"
        className="mx-auto max-w-[1320px] px-[clamp(1.5rem,5vw,4rem)] py-[clamp(5rem,10vw,9rem)]"
      >
        <div className="reveal">
          <p className="mb-5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-amber-dim">
            Providers
          </p>
          <h2 className="mb-3 font-display text-[clamp(1.875rem,3.5vw,2.875rem)] font-bold leading-[1.08] tracking-[-0.025em] text-text-0">
            Five providers. One panel.
          </h2>
          <p className="max-w-[54ch] text-base leading-[1.72] text-text-1">
            Most providers need nothing from you. AI Usage Bar reads the same local files your CLI tools write.
          </p>
        </div>

        <div className="reveal mt-[clamp(2rem,4vw,3.5rem)] overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {['Provider', 'Data source', 'Auth required', 'Status'].map((h) => (
                  <th
                    key={h}
                    className="border-b border-bg-3 pb-[0.625rem] pr-4 pt-[0.625rem] text-left font-mono text-[0.625rem] font-medium uppercase tracking-[0.1em] text-text-2 last:pr-0"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROVIDERS.map((p) => (
                <tr
                  key={p.name}
                  className="border-b border-[oklch(19%_0.015_262)] last:border-0 transition-colors duration-120 hover:bg-[oklch(17%_0.014_262/0.6)]"
                >
                  <td className="py-[1.125rem] pr-4 align-middle">
                    <div className="flex items-center gap-[0.875rem]">
                      <span className="w-7 flex-shrink-0 text-center text-[1.25rem] leading-none">{p.icon}</span>
                      <div>
                        <div className="font-medium text-[0.9375rem] text-text-0">{p.name}</div>
                        <div className="mt-0.5 text-[0.75rem] text-text-2">{p.sub}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-[1.125rem] pr-4 align-middle font-mono text-[0.75rem] leading-[1.6] text-text-1">
                    {p.paths.map((path) => <div key={path}>{path}</div>)}
                  </td>
                  <td className="py-[1.125rem] pr-4 align-middle">
                    {p.auth === 'none'   && <Tag type="none"     label="None" />}
                    {p.auth === 'gcloud' && <Tag type="none"     label="gcloud CLI" />}
                    {p.auth === 'apikey' && <Tag type="optional" label="API key" />}
                    {p.auth === 'cookie' && <Tag type="optional" label="Cookie" />}
                  </td>
                  <td className="py-[1.125rem] align-middle">
                    {p.status === 'done'
                      ? <Tag type="none"  label="Implemented" />
                      : <Tag type="muted" label="Stub" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
