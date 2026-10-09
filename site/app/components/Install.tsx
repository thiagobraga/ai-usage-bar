'use client'

import { useEffect, useRef } from 'react'

const STEPS = [
  {
    n: 'Step 01',
    title: 'Clone and install',
    desc: 'One command. Compiles schemas and enables the extension via the GNOME extensions CLI.',
    code: [
      { prompt: true,  text: 'git clone github.com/local/ai-usage-bar' },
      { prompt: true,  text: './scripts/install.sh' },
    ],
  },
  {
    n: 'Step 02',
    title: 'Reload GNOME Shell',
    desc: 'X11: Alt+F2 then r. Wayland: log out and back in, or use the nested dev session.',
    code: [
      { prompt: false, text: '# Wayland: watch + nested session' },
      { prompt: true,  text: './scripts/install.sh -w -n' },
    ],
  },
  {
    n: 'Step 03',
    title: 'Configure providers',
    desc: 'Enable providers and enter optional API keys in the extension preferences panel.',
    code: [
      { prompt: true, text: 'gnome-extensions prefs ai-usage-bar@local' },
    ],
  },
]

export function Install() {
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
      id="install"
      className="mx-auto max-w-[1320px] px-[clamp(1.5rem,5vw,4rem)] py-[clamp(5rem,10vw,9rem)]"
    >
      <div className="reveal">
        <p className="mb-5 font-mono text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-amber-dim">
          Install
        </p>
        <h2 className="font-display text-[clamp(1.875rem,3.5vw,2.875rem)] font-bold leading-[1.08] tracking-[-0.025em] text-text-0">
          Up in 30 seconds
        </h2>
      </div>

      <div
        className="mt-[clamp(2.5rem,5vw,4rem)] grid grid-cols-1 gap-[clamp(1.5rem,3vw,3rem)] lg:grid-cols-3"
      >
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            className="reveal"
            style={{ transitionDelay: `${i * 0.09}s` }}
          >
            <p className="mb-4 font-mono text-[0.625rem] font-medium tracking-[0.07em] text-amber-dim">{s.n}</p>
            <h3 className="mb-2 font-display text-[1.0625rem] font-bold leading-[1.2] text-text-0">{s.title}</h3>
            <p className="mb-4 text-[0.875rem] leading-[1.65] text-text-1">{s.desc}</p>
            <div className="overflow-x-auto rounded-[4px] border border-bg-3 bg-bg-2 px-4 py-[0.875rem] font-mono text-[0.8125rem] leading-[1.65] text-text-0">
              {s.code.map((line, j) => (
                <div key={j}>
                  {!line.prompt && <span className="text-text-2">{line.text}</span>}
                  {line.prompt && (
                    <>
                      <span className="select-none text-amber-dim">$ </span>
                      {line.text}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div
        className="reveal mt-[clamp(2rem,4vw,3.5rem)] rounded-[5px] border border-bg-3 bg-bg-1 px-[1.625rem] py-[1.375rem]"
      >
        <p className="mb-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.1em] text-text-2">
          Requirements
        </p>
        <p className="text-[0.875rem] leading-[1.7] text-text-1">
          GNOME Shell 46 ·{' '}
          <code className="rounded-[2px] bg-bg-2 px-[0.35em] py-[0.1em] font-mono text-[0.85em] text-text-0">glib-compile-schemas</code>
          {' '}·{' '}
          <code className="rounded-[2px] bg-bg-2 px-[0.35em] py-[0.1em] font-mono text-[0.85em] text-text-0">gnome-extensions</code>
          {' '}· Node.js 20+ (tests only)
        </p>
        <p className="mt-1.5 font-mono text-[0.75rem] text-text-2">
          sudo apt install gnome-shell-extension-prefs glib2.0-bin
        </p>
      </div>
    </section>
  )
}
