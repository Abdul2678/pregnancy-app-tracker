# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

# Install production deps only in a separate layer for cache efficiency
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Development image (includes devDeps for hot-reload)
FROM base AS development
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NODE_ENV=development
EXPOSE 4000
CMD ["node", "--watch", "src/server.js"]

# Production image — minimal footprint
FROM base AS production
# Run as non-root
RUN addgroup -g 1001 -S bloom && adduser -u 1001 -S bloom -G bloom

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Remove test/dev files not needed at runtime
RUN rm -rf tests jest.config.js .env* scripts

RUN chown -R bloom:bloom /app
USER bloom

ENV NODE_ENV=production
EXPOSE 4000

# Healthcheck so Docker / Railway knows when we're ready
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/server.js"]
