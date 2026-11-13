FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY package.json package-lock.json turbo.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci
COPY scripts ./scripts
ARG NEXT_PUBLIC_MAPTILER_API_KEY
ENV NEXT_PUBLIC_MAPTILER_API_KEY=$NEXT_PUBLIC_MAPTILER_API_KEY

RUN npx turbo run build --filter=web

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3060
ENV HOSTNAME=0.0.0.0

WORKDIR /app

COPY LICENSE THIRD_PARTY_NOTICES.md ./
COPY docs/licenses ./docs/licenses
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public

USER node

EXPOSE 3060

CMD ["node", "apps/web/server.js"]
