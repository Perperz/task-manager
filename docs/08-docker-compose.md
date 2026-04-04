# 08 — Docker Compose Dev Environment

**Docker Compose** is a tool for running multi-container applications. Instead of starting each container manually with `docker run`, you define all your services in a YAML file and start everything with one command. It handles networking between containers automatically.

---

## 8.1 Main docker-compose.yml

Create `docker-compose.yml` in the project root:

```yaml
version: "3.8"

services:
  # ─── MongoDB ────────────────────────────────
  mongodb:
    image: mongo:7
    container_name: taskmanager-mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db    # Persist data across container restarts
    environment:
      MONGO_INITDB_DATABASE: taskmanager
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s
    networks:
      - app-network

  # ─── Backend (FastAPI) ──────────────────────
  backend:
    build:
      context: ./services/backend
      dockerfile: Dockerfile
    container_name: taskmanager-backend
    ports:
      - "8000:8000"
    environment:
      MONGODB_URL: mongodb://mongodb:27017    # "mongodb" = the service name above
      DATABASE_NAME: taskmanager
      SECRET_KEY: ${SECRET_KEY:-local-dev-secret-change-in-prod}
      ALLOWED_ORIGINS: http://localhost:3000,http://frontend:3000
    depends_on:
      mongodb:
        condition: service_healthy    # Wait for MongoDB to be ready
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 15s
    networks:
      - app-network

  # ─── Frontend (Next.js) ─────────────────────
  frontend:
    build:
      context: ./services/frontend
      dockerfile: Dockerfile
    container_name: taskmanager-frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
    depends_on:
      backend:
        condition: service_healthy    # Wait for backend to be ready
    networks:
      - app-network

# ─── Named Volume ─────────────────────────────
# Docker manages this volume. Data persists even if the container is deleted.
volumes:
  mongodb_data:

# ─── Network ──────────────────────────────────
# All services on the same network can reach each other by service name.
# "mongodb" resolves to the MongoDB container's IP, "backend" to the backend's, etc.
networks:
  app-network:
    driver: bridge
```

### Key concepts explained in this file:

**Services:** Each entry under `services:` becomes a container. We have three: mongodb, backend, frontend.

**Networking:** Containers on the same Docker network can talk to each other using service names as hostnames. That's why the backend uses `mongodb://mongodb:27017` — `mongodb` resolves to the MongoDB container.

**Volumes:** `mongodb_data:/data/db` means Docker creates a named volume called `mongodb_data` and mounts it at `/data/db` inside the container. This is where MongoDB stores its data files. Without this, all data would be lost when the container stops.

**depends_on + condition:** `depends_on` controls startup order. `condition: service_healthy` means "wait until the dependency's health check passes before starting this service."

**Environment variables:** `${SECRET_KEY:-local-dev-secret-change-in-prod}` reads from a `.env` file or shell environment, falling back to the default value after `:-`.

---

## 8.2 Development Overrides (docker-compose.dev.yml)

For development, we want **live reload** — code changes should appear immediately without rebuilding the Docker image. We achieve this by **mounting our source code** into the container.

Create `docker-compose.dev.yml`:

```yaml
version: "3.8"

services:
  backend:
    build:
      context: ./services/backend
      dockerfile: Dockerfile
    # Override the command to enable auto-reload
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      # Mount source code — changes on your machine appear instantly in the container
      - ./services/backend/app:/app/app
    environment:
      MONGODB_URL: mongodb://mongodb:27017
      DATABASE_NAME: taskmanager
      SECRET_KEY: dev-secret-key
      ALLOWED_ORIGINS: http://localhost:3000

  frontend:
    build:
      context: ./services/frontend
      dockerfile: Dockerfile
    # Override with dev server (has hot-reload built in)
    command: npm run dev
    volumes:
      - ./services/frontend/src:/app/src
      - ./services/frontend/public:/app/public
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8000
```

> **Volume mounts for dev:** `./services/backend/app:/app/app` maps your local `app/` folder into the container. When you edit a file on your machine, the container sees the change immediately. Combined with `--reload` (uvicorn) or `npm run dev` (Next.js), the server restarts automatically.

---

## 8.3 Environment File

Create `.env` in the project root (this file is in `.gitignore` — never commit it):

```env
# MongoDB
MONGODB_URL=mongodb://mongodb:27017
DATABASE_NAME=taskmanager

# Backend
SECRET_KEY=change-this-to-a-random-string-in-production
ALLOWED_ORIGINS=http://localhost:3000

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 8.4 Commands

### Start all services (production mode)
```bash
docker-compose up -d
```
> `-d` = detached mode (runs in background). Without it, logs stream to your terminal.

### Start with dev overrides (live reload)
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```
> The second `-f` file overrides values from the first. We omit `-d` here so we can see logs in real-time during development.

### View logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
```

### Stop all services
```bash
docker-compose down
```

### Stop and remove all data (including MongoDB volume)
```bash
docker-compose down -v
```
> **Caution:** The `-v` flag deletes the MongoDB data volume. All your data will be lost.

### Rebuild images (after changing Dockerfile or dependencies)
```bash
docker-compose build
# Or rebuild and start:
docker-compose up -d --build
```

### Check running containers
```bash
docker-compose ps
```

---

## 8.5 Verify Everything Works

1. Start the services:
   ```bash
   docker-compose up -d
   ```

2. Wait for health checks to pass:
   ```bash
   docker-compose ps
   # All services should show "healthy" status after ~30 seconds
   ```

3. Test each service:
   - **MongoDB:** `docker exec -it taskmanager-mongodb mongosh --eval "db.stats()"`
   - **Backend:** Visit http://localhost:8000/docs (Swagger UI)
   - **Frontend:** Visit http://localhost:3000 (App UI)

4. Test the full flow:
   - Register a user at http://localhost:3000/register
   - Log in
   - Create a task
   - Verify it appears in the task list

5. Check MongoDB data:
   - Open MongoDB Compass
   - Connect to `mongodb://localhost:27017`
   - Browse the `taskmanager` database — you should see `users` and `tasks` collections with your data

---

## 8.6 Common Issues

| Problem | Cause | Fix |
|---------|-------|-----|
| Backend can't connect to MongoDB | MongoDB not ready yet | `depends_on` with `service_healthy` handles this. If persists, increase `start_period` |
| Frontend shows network errors | Backend CORS not configured | Check `ALLOWED_ORIGINS` includes `http://localhost:3000` |
| Changes not reflecting | Volume mount not working | On Windows, ensure Docker Desktop has file sharing enabled for your drive |
| Port already in use | Another process on 3000/8000/27017 | Stop the other process or change the port mapping in docker-compose.yml |

---

**Next:** [09-kubernetes-setup.md](09-kubernetes-setup.md) — Set up a local Kubernetes cluster with Minikube.
