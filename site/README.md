# AI Usage Bar Site

This is the Next.js website for the AI Usage Bar extension.

## Development

```bash
npm --prefix site run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

From inside this directory, the equivalent command is:

```bash
npm run dev
```

Edit `site/app/page.tsx` and components under `site/app/components/`.

## Build

```bash
npm --prefix site run build
```

## Lint

```bash
npm --prefix site run lint
```

## Deployment

Deploy from the `site/` directory. The GNOME extension package is built separately from the repository root with `npm run ext:package`.
