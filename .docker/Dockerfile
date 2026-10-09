FROM node:22-alpine AS deps
WORKDIR /repo/site

COPY site/package.json site/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /repo/site

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /repo/site/node_modules ./node_modules
COPY site ./
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder --chown=nextjs:nextjs /repo/site/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /repo/site/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /repo/site/public ./public

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
