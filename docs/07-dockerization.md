# 07 — Dockerization

**Docker** packages your application and all its dependencies into a **container** — a lightweight, portable unit that runs the same way everywhere. An **image** is the blueprint (like a recipe); a **container** is a running instance of that image (like a dish made from the recipe).

We'll create **Dockerfiles** for both services using **multi-stage builds** — a technique that separates the build environment from the production environment, resulting in much smaller and more secure images.

---

## 7.1 Backend Dockerfile

Create `services/backend/Dockerfile`:

```dockerfile
# ============================================
# Stage 1: Install dependencies
# ============================================
# We use a separate stage for dependencies so that if our code changes
# but requirements.txt doesn't, Docker reuses the cached dependency layer.
FROM python:3.12-slim AS builder

WORKDIR /app

# Copy only requirements first (Docker caches this layer)
COPY requirements.txt .

# Install dependencies into a separate directory
# --no-cache-dir: don't cache pip downloads (smaller image)
# --prefix=/install: install to a custom location so we can copy just the packages
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ============================================
# Stage 2: Production image
# ============================================
# Start fresh from a clean slim image — no build tools, no cache, just the runtime
FROM python:3.12-slim

WORKDIR /app

# Copy installed packages from the builder stage
COPY --from=builder /install /usr/local

# Copy application code
COPY ./app ./app

# Create a non-root user for security
# (if the container is compromised, the attacker has limited permissions)
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser
USER appuser

# Document which port the app listens on
EXPOSE 8000

# Health check: Kubernetes also does this, but Docker Compose benefits from it
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Start the FastAPI application
# --host 0.0.0.0: listen on all network interfaces (required inside containers)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Why multi-stage?
Without multi-stage, the image would include pip's cache, build tools, and intermediate files — often doubling the image size. With multi-stage, we only copy what the production app actually needs.

---

## 7.2 Backend .dockerignore

Create `services/backend/.dockerignore`:

```
__pycache__
*.pyc
*.pyo
.venv
venv
env
.env
.env.*
.git
.gitignore
tests
*.md
.mypy_cache
.pytest_cache
.coverage
htmlcov
```

> **What is .dockerignore?** Like `.gitignore` but for Docker. Files listed here are excluded from the build context — they won't be sent to the Docker daemon or copied into the image. This speeds up builds and keeps secrets out of images.

---

## 7.3 Frontend Dockerfile

Create `services/frontend/Dockerfile`:

```dockerfile
# ============================================
# Stage 1: Install dependencies
# ============================================
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies
# --frozen-lockfile: fail if lockfile is out of date (reproducible builds)
RUN npm ci

# ============================================
# Stage 2: Build the application
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies from the previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source code
COPY . .

# Disable Next.js telemetry during build
ENV NEXT_TELEMETRY_DISABLED=1

# Build the Next.js application
# This compiles React, generates static pages, and creates the production bundle
RUN npm run build

# ============================================
# Stage 3: Production image
# ============================================
# Start fresh again — only include what's needed to run
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the standalone build output
# Next.js "standalone" mode creates a self-contained server with only the needed node_modules
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the standalone Next.js server
CMD ["node", "server.js"]
```

### Why 3 stages for the frontend?
1. **deps**: Install node_modules (cached separately — only re-runs when package.json changes)
2. **builder**: Compile TypeScript, bundle React, generate static assets
3. **runner**: Only the compiled output + a minimal Node.js runtime. No source code, no devDependencies, no build tools

### Next.js standalone mode
In `next.config.js`, we set `output: "standalone"`. This tells Next.js to trace which `node_modules` are actually used and bundle only those, creating a self-contained `server.js` that doesn't need the full `node_modules` folder. This can reduce image size from ~1GB to ~100MB.

---

## 7.4 Frontend .dockerignore

Create `services/frontend/.dockerignore`:

```
node_modules
.next
out
.env
.env.*
.git
.gitignore
*.md
.turbo
coverage
.nyc_output
```

---

## 7.5 Build the Images

```bash
# Build backend image
docker build -t task-manager-backend:latest ./services/backend

# Build frontend image
docker build -t task-manager-frontend:latest ./services/frontend
```

> **What happens when you run `docker build`?**
> 1. Docker reads the Dockerfile
> 2. Executes each instruction (FROM, COPY, RUN, etc.) in order, creating a layer for each
> 3. Layers are cached — if a layer hasn't changed, Docker reuses it (fast rebuilds)
> 4. The final result is an **image** tagged with the name you specified (`-t`)

**Verify images exist:**
```bash
docker images | grep task-manager
# Expected:
# task-manager-backend    latest    ...    ~150MB
# task-manager-frontend   latest    ...    ~100MB
```

---

## 7.6 Test Images Individually

**Test backend** (needs MongoDB running):
```bash
# Start a temporary MongoDB container
docker run -d --name test-mongo -p 27017:27017 mongo:7

# Run backend, linking to MongoDB
docker run --rm -p 8000:8000 \
  -e MONGODB_URL=mongodb://host.docker.internal:27017 \
  -e DATABASE_NAME=taskmanager \
  -e SECRET_KEY=test-secret \
  task-manager-backend:latest

# Visit http://localhost:8000/health — should return {"status": "healthy"}
# Visit http://localhost:8000/docs — should show Swagger UI

# Clean up
docker stop test-mongo && docker rm test-mongo
```

**Test frontend:**
```bash
docker run --rm -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000 \
  task-manager-frontend:latest

# Visit http://localhost:3000 — should show the login page
```

> **Flag reference:**
> - `--rm`: automatically remove the container when it stops
> - `-p 8000:8000`: map port 8000 on your machine to port 8000 in the container
> - `-e KEY=VALUE`: set an environment variable inside the container
> - `-d`: run in the background (detached mode)

---

## 7.7 Image Size Comparison

| Approach | Backend Size | Frontend Size |
|----------|-------------|---------------|
| No multi-stage | ~800MB | ~1.2GB |
| Multi-stage (what we did) | ~150MB | ~100MB |

Multi-stage builds are an enterprise best practice — smaller images mean faster deployments, less storage, and a reduced attack surface.

---

**Next:** [08-docker-compose.md](08-docker-compose.md) — Run all services together with Docker Compose.
