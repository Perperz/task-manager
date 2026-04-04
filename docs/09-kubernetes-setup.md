# 09 — Kubernetes Cluster Setup (Minikube)

**Kubernetes** (often shortened to **K8s**) is a container orchestration platform. While Docker Compose runs containers on a single machine, Kubernetes manages containers across multiple machines — handling scaling, self-healing (restarting crashed containers), rolling updates, networking, and more. It's the industry standard for running production workloads.

**Minikube** runs a single-node Kubernetes cluster on your local machine inside a Docker container. It behaves like a real cluster but costs nothing and requires no cloud account.

---

## 9.1 Start Minikube

```bash
minikube start --driver=docker --memory=4096 --cpus=2
```

> **Flags:**
> - `--driver=docker`: Use Docker as the virtualization layer (recommended on Windows with WSL2)
> - `--memory=4096`: Allocate 4GB RAM to the cluster (our 3 services + Kubernetes system components need this)
> - `--cpus=2`: Allocate 2 CPU cores

**Verify the cluster is running:**
```bash
minikube status
```
Expected output:
```
minikube
type: Control Plane
host: Running
kubelet: Running
apiserver: Running
kubeconfig: Configured
```

**Check that kubectl is connected to Minikube:**
```bash
kubectl cluster-info
kubectl get nodes
# Expected: one node named "minikube" with status "Ready"
```

---

## 9.2 Enable Required Addons

Minikube comes with optional addons. We need three:

```bash
# Nginx Ingress Controller — routes external traffic to our services
minikube addons enable ingress

# Kubernetes Dashboard — web UI for monitoring the cluster
minikube addons enable dashboard

# Metrics Server — provides CPU/memory usage data
minikube addons enable metrics-server
```

**Verify addons:**
```bash
minikube addons list | grep enabled
```

**Try the dashboard** (optional — opens in browser):
```bash
minikube dashboard
# Press Ctrl+C to stop the proxy when done
```

---

## 9.3 Configure Docker to Use Minikube's Docker Daemon

This is a crucial step. Normally, when you run `docker build`, the image is stored in your local Docker Desktop. But Minikube has its own Docker daemon running inside its VM/container. Kubernetes inside Minikube can only see images in **Minikube's** Docker, not your local Docker.

Instead of pushing images to a registry, we point our Docker CLI at Minikube's Docker daemon:

**On Windows (Git Bash / WSL):**
```bash
eval $(minikube docker-env)
```

**On PowerShell:**
```powershell
minikube docker-env --shell powershell | Invoke-Expression
```

> **What this does:** Sets environment variables (`DOCKER_HOST`, `DOCKER_CERT_PATH`, etc.) so that `docker build` and `docker images` now talk to Minikube's Docker instead of Docker Desktop.

**Now rebuild the images inside Minikube's Docker:**
```bash
docker build -t task-manager-backend:latest ./services/backend
docker build -t task-manager-frontend:latest ./services/frontend
```

**Verify images are in Minikube:**
```bash
docker images | grep task-manager
```

> **Important:** Every time you open a new terminal, you need to re-run `eval $(minikube docker-env)` to reconnect to Minikube's Docker. Otherwise, you'll build images in the wrong Docker daemon and Kubernetes won't find them.

> **To switch back to local Docker Desktop:**
> ```bash
> eval $(minikube docker-env --unset)
> ```

---

## 9.4 Understanding Kubernetes Architecture

Before deploying, here's what's happening inside the cluster:

```
┌──────────────────── Minikube Node ────────────────────┐
│                                                        │
│  ┌─── Control Plane ──────────────────────────────┐   │
│  │  API Server    ← kubectl talks to this          │   │
│  │  Scheduler     ← decides which node runs a pod  │   │
│  │  Controller    ← ensures desired state matches  │   │
│  │  etcd          ← stores all cluster data        │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  ┌─── Worker (same node in Minikube) ─────────────┐   │
│  │  kubelet       ← manages pods on this node      │   │
│  │  kube-proxy    ← handles networking             │   │
│  │  Container Runtime (Docker)                      │   │
│  │                                                  │   │
│  │  [Pod: backend]  [Pod: frontend]  [Pod: mongo]  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

The key Kubernetes objects we'll create:

| Object | What it does |
|--------|-------------|
| **Namespace** | Isolates our app's resources from system resources |
| **ConfigMap** | Stores non-sensitive configuration (DB hostname, port) |
| **Secret** | Stores sensitive data (passwords, API keys) — base64 encoded |
| **Deployment** | Defines what container to run, how many replicas, health checks |
| **Service** | Gives pods a stable network address (pods come and go, services don't) |
| **PersistentVolumeClaim** | Requests persistent storage for MongoDB data |
| **Ingress** | Routes external HTTP traffic to the right service |

---

## 9.5 Useful Minikube Commands

```bash
# Check cluster status
minikube status

# Stop the cluster (preserves state)
minikube stop

# Start it again
minikube start

# Delete the cluster entirely (start fresh)
minikube delete

# Get the cluster's IP address
minikube ip

# SSH into the Minikube VM
minikube ssh

# Open Kubernetes dashboard in browser
minikube dashboard

# Create a tunnel for LoadBalancer services
minikube tunnel
```

---

**Next:** [10-kubernetes-deploy.md](10-kubernetes-deploy.md) — Create Kubernetes manifests and deploy the application.
