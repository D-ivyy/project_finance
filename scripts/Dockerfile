# ═══════════════════════════════════════════════════════════════════════════════
# Stage 1: Build Next.js standalone output
# ═══════════════════════════════════════════════════════════════════════════════
FROM node:22-slim AS frontend-build

WORKDIR /build

COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci --prefer-offline

COPY dashboard/ ./
RUN npm run build

# ═══════════════════════════════════════════════════════════════════════════════
# Stage 2: Runtime — Python + Next.js standalone + Nginx
# ═══════════════════════════════════════════════════════════════════════════════
FROM python:3.12-slim

# Install Nginx
RUN apt-get update && \
    apt-get install -y --no-install-recommends nginx curl && \
    rm -rf /var/lib/apt/lists/*

# Install Node.js 22 (needed to run Next.js standalone server)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Python API ─────────────────────────────────────────────────────────────────
COPY api/requirements.txt /app/api/requirements.txt
RUN pip install --no-cache-dir -r /app/api/requirements.txt

COPY api/ /app/api/

# ── Next.js standalone ─────────────────────────────────────────────────────────
# The standalone output includes a minimal Node server + all needed deps
COPY --from=frontend-build /build/.next/standalone /app/frontend/
COPY --from=frontend-build /build/.next/static /app/frontend/.next/static
COPY --from=frontend-build /build/public /app/frontend/public/

# ── Nginx config ───────────────────────────────────────────────────────────────
COPY nginx.conf /etc/nginx/nginx.conf

# ── Entrypoint ─────────────────────────────────────────────────────────────────
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

EXPOSE 8080

CMD ["/app/start.sh"]
