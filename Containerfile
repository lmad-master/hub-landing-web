# ---------- Build: compile the site with Vite ----------
FROM docker.io/library/node:22-alpine AS build
WORKDIR /app
RUN corepack enable

# Dependencies first, so they're cached when only the code changes
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ---------- Serve: static files with Caddy ----------
FROM docker.io/library/caddy:2-alpine
COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80
