FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Pass a dummy DATABASE_URL during build so prisma.config.ts can load
ARG DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV DATABASE_URL=$DATABASE_URL

# Generate Prisma client
RUN bunx prisma generate

# Unset so runtime value is used
ENV DATABASE_URL=""

EXPOSE 8000
CMD ["sh", "-c", "bunx prisma migrate deploy && bun src/api/server.ts"]
