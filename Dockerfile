# Unified Dockerfile
# Single container with Node.js (Express) and PocketBase
# Supports both development and production modes via NODE_ENV build arg

ARG NODE_ENV=production

# =============================================================================
# Stage 1: Download PocketBase
# =============================================================================
FROM alpine:3.19 AS pocketbase-downloader

ARG POCKETBASE_VERSION=0.36.5
ARG TARGETARCH

RUN apk add --no-cache wget unzip

# Download appropriate PocketBase binary for architecture
RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pocketbase.zip \
    && unzip /tmp/pocketbase.zip -d /tmp \
    && chmod +x /tmp/pocketbase

# =============================================================================
# Stage 2: Build Node.js dependencies
# =============================================================================
FROM node:20-alpine AS node-builder

ARG NODE_ENV=production

WORKDIR /app/server

# Copy package files and install dependencies
COPY server/package*.json ./
RUN if [ "$NODE_ENV" = "production" ]; then \
        npm ci --only=production; \
    else \
        npm install; \
    fi

# =============================================================================
# Stage 3: Final image
# =============================================================================
FROM node:20-alpine

ARG NODE_ENV=production

# Install wget for health checks
RUN apk add --no-cache wget

# Create app directories
RUN mkdir -p /app/homepage /app/webapp /app/admin /app/server /pb/pb_data /pb/pb_hooks /pb/pb_migrations

# Copy PocketBase binary
COPY --from=pocketbase-downloader /tmp/pocketbase /pb/pocketbase

# Copy Node.js dependencies
COPY --from=node-builder /app/server/node_modules /app/server/node_modules

# Copy server code
COPY server/*.js /app/server/
COPY server/package.json /app/server/

# Copy static files
COPY homepage/ /app/homepage/
COPY webapp/ /app/webapp/
COPY admin/ /app/admin/

# Copy PocketBase hooks and migrations
COPY api/pb_hooks/ /pb/pb_hooks/
COPY api/pb_migrations/ /pb/pb_migrations/

# Copy unified entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Environment defaults (production: single port, path-based routing)
ENV NODE_ENV=${NODE_ENV}
ENV HOMEPAGE_PORT=3000
ENV WEBAPP_PATH=/app
ENV ADMIN_PATH=/admin
ENV API_URL=http://localhost:8090

# Expose ports
EXPOSE 3000 8090

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -q --spider http://localhost:3000/health && \
        wget -q --spider http://localhost:8090/api/health || exit 1

# Run
ENTRYPOINT ["/entrypoint.sh"]
