'use client'

import { useTheme } from 'next-themes'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const PROVIDERS = [
  { icon: '◎', name: 'Codex',  pct: 3,  color: 'var(--green)' },
  { icon: '✺', name: 'Claude', pct: 8,  color: 'var(--amber)', active: true },
  { icon: '✦', name: 'Gemini', pct: 30, color: 'var(--green)' },
  { icon: '⊙', name: 'Cursor', pct: 0,  color: 'transparent' },
  { icon: '⊕', name: 'Router', pct: 25, color: 'var(--amber)' },
]

const SESSIONS = [
  { label: 'Session', pct: 8,  reset: 'Resets in 3h 53m' },
  { label: 'Weekly',  pct: 3,  reset: 'Resets in 3d 20h' },
  { label: 'Monthly', pct: 2,  reset: 'Resets in 17d' },
]

export function GnomePreview() {
  const { resolvedTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const [animated, setAnimated] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 400)
    return () => clearTimeout(timer)
  }, [])

  const light = mounted && resolvedTheme === 'light'

  // Popup palette - flips with page theme
  const p = light ? {
    screen:    'oklch(91% 0.010 262)',
    topbar:    'oklch(86% 0.012 262)',
    topbarBdr: 'oklch(78% 0.014 262)',
    ext:       'oklch(80% 0.014 262)',
    popup:     'oklch(93% 0.009 262 / 0.97)',
    popupBdr:  'oklch(78% 0.014 262)',
    tile:      'oklch(87% 0.011 262)',
    tileBdr:   'oklch(80% 0.014 262)',
    tileSelBg: 'oklch(82% 0.013 262)',
    tileSelBdr:'oklch(68% 0.018 262)',
    tileText:  'oklch(42% 0.018 262)',
    tileSelTxt:'oklch(14% 0.018 262)',
    tilebar:   'oklch(79% 0.014 262)',
    sep:       'oklch(82% 0.013 262)',
    nameColor: 'oklch(14% 0.018 262)',
    metaColor: 'oklch(48% 0.016 262)',
    slabel:    'oklch(52% 0.016 262)',
    umetaC:    'oklch(52% 0.016 262)',
    bar:       'oklch(84% 0.011 262)',
    costL:     'oklch(50% 0.016 262)',
    costV:     'oklch(14% 0.018 262)',
    tbText:    'oklch(28% 0.018 262)',
    tbExtBg:   'oklch(80% 0.014 262)',
    tbSys:     'oklch(48% 0.016 262)',
    desktopBg: 'oklch(91% 0.010 262)',
    screenShadow: '0 0 0 1px oklch(72% 0.016 262), 0 40px 80px oklch(60% 0.01 262 / 0.2), 0 12px 28px oklch(60% 0.01 262 / 0.12)',
  } : {
    screen:    'oklch(8.5% 0.010 262)',
    topbar:    'oklch(15%  0.014 262)',
    topbarBdr: 'oklch(21%  0.016 262)',
    ext:       'oklch(21%  0.016 262)',
    popup:     'oklch(15.5% 0.014 262 / 0.97)',
    popupBdr:  'oklch(28%  0.018 262)',
    tile:      'oklch(19%  0.016 262)',
    tileBdr:   'oklch(24%  0.017 262)',
    tileSelBg: 'oklch(22.5% 0.017 262)',
    tileSelBdr:'oklch(38%  0.022 262)',
    tileText:  'oklch(48%  0.015 262)',
    tileSelTxt:'oklch(82%  0.008 262)',
    tilebar:   'oklch(25%  0.018 262)',
    sep:       'oklch(23%  0.017 262)',
    nameColor: 'oklch(88%  0.007 262)',
    metaColor: 'oklch(42%  0.014 262)',
    slabel:    'oklch(50%  0.015 262)',
    umetaC:    'oklch(50%  0.015 262)',
    bar:       'oklch(21%  0.016 262)',
    costL:     'oklch(48%  0.015 262)',
    costV:     'oklch(80%  0.008 262)',
    tbText:    'oklch(78%  0.010 262)',
    tbExtBg:   'oklch(21%  0.016 262)',
    tbSys:     'oklch(62%  0.012 262)',
    desktopBg: 'oklch(8.5% 0.010 262)',
    screenShadow: '0 0 0 1px oklch(26% 0.018 262), 0 48px 96px oklch(4% 0.008 262 / 0.75), 0 12px 28px oklch(4% 0.008 262 / 0.4)',
  }

  return (
    <div ref={ref} className="flex w-full justify-end">
      <div
        className="relative w-full overflow-visible rounded-[10px]"
        style={{
          maxWidth: '460px',
          background: p.screen,
          boxShadow: p.screenShadow,
        }}
      >
        {/* Top bar */}
        <div
          className="flex h-[28px] items-center rounded-t-[10px] px-[9px] text-[10.5px]"
          style={{
            background: p.topbar,
            borderBottom: `1px solid ${p.topbarBdr}`,
            color: p.tbText,
          }}
        >
          <span
            className="rounded-[3px] px-[5px] py-[2px] text-[10.5px] font-medium"
            style={{ background: p.tbExtBg }}
          >
            Activities
          </span>
          <div className="flex-1" />
          <span>Wed 14 May, 08:41</span>
          <div className="flex-1" />
          <div className="flex items-center gap-[9px]">
            <div
              className="flex items-center gap-[3px] rounded-[3px] px-[5px] py-[2px] text-[10px]"
              style={{ background: p.tbExtBg }}
            >
              <span>✺</span>
              <span>Claude 8%</span>
              <div
                className="h-[2px] w-[16px] overflow-hidden rounded-[1px]"
                style={{ background: p.tilebar }}
              >
                <div
                  className="h-full rounded-[1px]"
                  style={{
                    width: animated ? '8%' : '0%',
                    background: 'var(--amber)',
                    transition: 'width 1s cubic-bezier(0.16,1,0.3,1)',
                  }}
                />
              </div>
            </div>
            <span className="text-[10px]" style={{ color: p.tbSys }}>↑↓ 100%</span>
          </div>
        </div>

        {/* Desktop + popup */}
        <div
          className="relative min-h-[28px] rounded-b-[10px]"
          style={{ background: p.desktopBg }}
        >
          <div
            className="absolute right-[7px] top-[6px] w-[252px] rounded-[9px] p-[11px]"
            style={{
              background: p.popup,
              border: `1px solid ${p.popupBdr}`,
              boxShadow: light
                ? '0 12px 32px oklch(60% 0.01 262 / 0.18)'
                : '0 20px 48px oklch(3% 0.008 262 / 0.85)',
            }}
          >
            {/* Provider switcher */}
            <div className="mb-[9px] flex gap-[3px]">
              {PROVIDERS.map((prov) => (
                <div
                  key={prov.name}
                  className="flex flex-1 flex-col items-center gap-[2px] rounded-[5px] px-[2px] pb-[4px] pt-[5px] text-[8.5px]"
                  style={{
                    background: prov.active ? p.tileSelBg : p.tile,
                    border: `1px solid ${prov.active ? p.tileSelBdr : p.tileBdr}`,
                    color: prov.active ? p.tileSelTxt : p.tileText,
                  }}
                >
                  <span className="text-[12px] leading-none">{prov.icon}</span>
                  <span>{prov.name}</span>
                  <div
                    className="mt-[1px] h-[2px] w-full overflow-hidden rounded-[1px]"
                    style={{ background: p.tilebar }}
                  >
                    <div
                      className="h-full rounded-[1px]"
                      style={{
                        width: animated ? `${prov.pct}%` : '0%',
                        background: prov.color,
                        transition: 'width 1.1s cubic-bezier(0.16,1,0.3,1)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Separator */}
            <div className="my-[7px] h-px" style={{ background: p.sep }} />

            {/* Provider header */}
            <div className="mb-[3px] flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: p.nameColor }}>Claude</span>
              <span
                className="rounded-[2px] px-[5px] py-[1px] font-mono text-[8px] font-medium"
                style={{ color: 'var(--amber)', background: 'var(--amber-bg)' }}
              >
                Pro
              </span>
            </div>
            <div className="mb-[9px] flex justify-between text-[8.5px]" style={{ color: p.metaColor }}>
              <span>Updated just now</span>
            </div>

            {/* Usage */}
            <p className="mb-[5px] font-mono text-[8px] font-medium uppercase tracking-[0.07em]" style={{ color: p.slabel }}>
              Usage
            </p>
            {SESSIONS.map((s) => (
              <div key={s.label} className="mb-[7px]">
                <div className="mb-[2px] flex justify-between text-[8.5px]" style={{ color: p.umetaC }}>
                  <span>{s.label}</span>
                  <span>{s.pct}% · {s.reset}</span>
                </div>
                <div className="h-[3px] overflow-hidden rounded-[2px]" style={{ background: p.bar }}>
                  <div
                    className="h-full rounded-[2px]"
                    style={{
                      width: animated ? `${s.pct}%` : '0%',
                      background: 'var(--green)',
                      transition: 'width 1.1s cubic-bezier(0.16,1,0.3,1)',
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Separator */}
            <div className="my-[7px] h-px" style={{ background: p.sep }} />

            {/* Cost */}
            <p className="mb-[5px] font-mono text-[8px] font-medium uppercase tracking-[0.07em]" style={{ color: p.slabel }}>
              Cost
            </p>
            {[
              ['Today', '$0.87 · 218M tokens'],
              ['Last 30 days', '$254.24'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-[1.5px] text-[8.5px]">
                <span style={{ color: p.costL }}>{label}</span>
                <span className="font-mono text-[8px]" style={{ color: p.costV }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
