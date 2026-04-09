# Use the official Bun image as base
FROM oven/bun:1.3.5-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
FROM base AS deps
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS builder
COPY . .
RUN bun install --frozen-lockfile
RUN bun run build

# Production stage
FROM oven/bun:1.3.5-alpine AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy custom WebSocket server (starts standalone server.js internally on port 3001,
# handles WS upgrades itself, and proxies HTTP to the internal Next.js server)
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts

# Copy ws package from builder (required by server.ts for WebSocket client/server)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/ws ./node_modules/ws

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ARG VALIDATE_API_KEY_WITH_PROXY=true
ENV VALIDATE_API_KEY_WITH_PROXY=${VALIDATE_API_KEY_WITH_PROXY}

# Use custom server.ts instead of standalone server.js to enable WebSocket proxy
CMD ["bun", "server.ts"]