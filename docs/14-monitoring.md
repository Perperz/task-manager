# 14 — Monitoring, Health Checks & Logging

In production, you can't watch the terminal all day. Monitoring, health checks, and logging are how you know your application is working — and how you diagnose problems when it isn't.

---

## 14.1 Health Check Endpoints

A **health check** is a simple endpoint that returns "I'm alive and working." Other systems (Kubernetes, load balancers, Docker) call this endpoint periodically to monitor your app.

### Backend Health Check

This is defined in `app/main.py`:

```python
from datetime import datetime

@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint.
    Returns the service status and whether the database is reachable.
    """
    try:
        # Ping MongoDB to verify the connection
        await db.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "task-manager-backend",
        "database": db_status,
        "timestamp": datetime.utcnow().isoformat(),
    }
```

**Test it:**
```bash
curl http://localhost:8000/health
# {"status": "healthy", "service": "task-manager-backend", "database": "connected", "timestamp": "2026-04-02T12:00:00"}
```

A health check should:
- Be **fast** (no heavy computation)
- Check **dependencies** (database, cache, external APIs)
- Return **structured data** (easy to parse programmatically)

### Frontend Health Check

Next.js responds to `GET /` with a 200 status code when running. For a more explicit check, you can add an API route:

Create `services/frontend/src/app/api/health/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "healthy",
    service: "task-manager-frontend",
    timestamp: new Date().toISOString(),
  });
}
```

**Test it:**
```bash
curl http://localhost:3000/api/health
```

---

## 14.2 Kubernetes Probes

Kubernetes uses three types of probes to monitor pods. We configured liveness and readiness probes in section 10. Here's what they do:

| Probe | Question it answers | If it fails... |
|-------|-------------------|----------------|
| **Liveness** | "Is the process stuck or deadlocked?" | Kubernetes **kills and restarts** the container |
| **Readiness** | "Can it handle requests right now?" | Kubernetes **stops sending traffic** to the pod (but doesn't restart it) |
| **Startup** | "Has it finished starting up?" | Other probes are **paused** until startup succeeds |

### Our probe configuration (from the Deployment manifests):

```yaml
# Backend
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 15    # Wait 15s before first check (app needs to start)
  periodSeconds: 10          # Check every 10 seconds
  failureThreshold: 3        # Kill after 3 consecutive failures

readinessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 5     # Start checking sooner than liveness
  periodSeconds: 5           # Check more frequently
  failureThreshold: 3
```

### Check probe status:
```bash
# See events including probe results
kubectl describe pod <pod-name> -n task-manager

# Look for lines like:
#   Liveness probe succeeded
#   Readiness probe succeeded
# Or:
#   Liveness probe failed: HTTP probe failed with statuscode: 500
```

---

## 14.3 Structured Logging

**Structured logging** outputs logs in a consistent format (usually JSON), making them easy to search and filter.

### Backend Logging Setup

Create or update `services/backend/app/utils/logging.py`:

```python
import logging
import sys
import json
from datetime import datetime


class JSONFormatter(logging.Formatter):
    """Formats log records as JSON for easy parsing."""

    def format(self, record):
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_logging(level: str = "INFO"):
    """Configure application logging."""
    logger = logging.getLogger("app")
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    logger.addHandler(handler)

    return logger
```

### Using the logger in your code:

```python
import logging

logger = logging.getLogger("app")

# In a route handler:
logger.info("Task created", extra={"task_id": str(task_id), "user_id": str(user_id)})
logger.warning("Failed login attempt", extra={"email": email})
logger.error("Database connection lost", exc_info=True)
```

### Add request logging middleware

In `app/main.py`, add middleware that logs every request:

```python
import time
import logging

logger = logging.getLogger("app")

@app.middleware("http")
async def log_requests(request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time

    logger.info(
        f"{request.method} {request.url.path} → {response.status_code} ({duration:.3f}s)"
    )
    return response
```

Output:
```json
{"timestamp": "2026-04-02T12:00:00", "level": "INFO", "message": "GET /api/tasks → 200 (0.045s)", "module": "main", "function": "log_requests"}
```

---

## 14.4 Viewing Logs in Kubernetes

```bash
# View logs for a specific pod
kubectl logs <pod-name> -n task-manager

# Stream logs in real-time (like tail -f)
kubectl logs -f <pod-name> -n task-manager

# View logs from all pods in a deployment
kubectl logs -f deployment/backend -n task-manager

# View logs from the last 5 minutes
kubectl logs --since=5m deployment/backend -n task-manager

# View logs from a crashed container (previous instance)
kubectl logs <pod-name> --previous -n task-manager
```

---

## 14.5 Minikube Dashboard

The Kubernetes Dashboard is a web UI for visualizing your cluster:

```bash
minikube dashboard
```

This opens a browser where you can:
- See all pods, deployments, services, and their statuses
- View CPU and memory usage (requires metrics-server addon)
- Read pod logs
- Scale deployments up/down
- Inspect events and errors

---

## 14.6 Resource Monitoring

Check resource usage (requires the metrics-server addon from section 09):

```bash
# Node-level resource usage
kubectl top nodes

# Pod-level resource usage
kubectl top pods -n task-manager
```

Example output:
```
NAME                        CPU(cores)   MEMORY(bytes)
backend-5d4f6b7c8d-abc12   45m          120Mi
backend-5d4f6b7c8d-def34   38m          115Mi
frontend-7f8e9a1b2c-ghi56  22m          95Mi
frontend-7f8e9a1b2c-jkl78  20m          90Mi
mongodb-3a4b5c6d7e-mno90   85m          310Mi
```

> **Reading the values:**
> - `45m` = 45 millicores = 0.045 CPU cores (out of our 200m limit)
> - `120Mi` = 120 MiB of memory (out of our 256Mi limit)

---

## 14.7 Useful Debugging Commands

```bash
# Get events sorted by time (great for debugging startup issues)
kubectl get events -n task-manager --sort-by='.lastTimestamp'

# Exec into a running pod (like SSH into a container)
kubectl exec -it <pod-name> -n task-manager -- /bin/sh

# Check environment variables in a pod
kubectl exec <pod-name> -n task-manager -- env | sort

# Test network connectivity between pods
kubectl exec <backend-pod> -n task-manager -- \
  python -c "import urllib.request; print(urllib.request.urlopen('http://mongodb-service:27017').status)"

# Restart a deployment (rolls out new pods)
kubectl rollout restart deployment/backend -n task-manager

# Check rollout status
kubectl rollout status deployment/backend -n task-manager
```

---

## 14.8 Summary

| What | Where to check |
|------|---------------|
| Is the app running? | `kubectl get pods -n task-manager` |
| Is it healthy? | `curl http://taskmanager.local/health` |
| What went wrong? | `kubectl logs -f deployment/backend -n task-manager` |
| What happened recently? | `kubectl get events -n task-manager` |
| How much resources is it using? | `kubectl top pods -n task-manager` |
| Visual overview | `minikube dashboard` |

---

**Next:** [appendix-commands.md](appendix-commands.md) — Quick-reference command cheat sheet.
