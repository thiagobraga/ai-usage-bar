export function Footer() {
  return (
    <footer className="border-t border-bg-3">
      <div className="mx-auto flex max-w-[1320px] items-center gap-8 px-[clamp(1.5rem,5vw,4rem)] py-7">
        <span className="font-display text-[0.875rem] font-bold text-text-1">✺ AI Usage Bar</span>
        <div className="flex-1" />
        <ul className="flex list-none gap-6">
          {[
            ['Features', '#features'],
            ['Providers', '#providers'],
            ['Install', '#install'],
            ['Scripts', '/scripts/README.md'],
          ].map(([label, href]) => (
            <li key={label}>
              <a
                href={href}
                className="text-[0.8125rem] text-text-2 no-underline transition-colors duration-120 hover:text-text-1"
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <span className="font-mono text-[0.6875rem] text-text-2">GNOME Shell 46</span>
      </div>
    </footer>
  )
}
