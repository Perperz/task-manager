# 10 — Kubernetes Resources & Deployment

Now we define the Kubernetes resources that describe **what** our application looks like and let Kubernetes handle **how** to run it. Each resource is defined in a YAML file called a **manifest**.

---

## 10.1 Namespace

A **Namespace** is a virtual partition within a cluster. It isolates our app's resources so they don't clash with system resources or other apps.

Create `k8s/namespace.yml`:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: task-manager
  labels:
    app: task-manager
```

Apply it:
```bash
kubectl apply -f k8s/namespace.yml
kubectl get namespaces
# "task-manager" should appear in the list
```

> From now on, all our resources will be in the `task-manager` namespace. We specify this in each manifest's `metadata.namespace` field.

---

## 10.2 ConfigMap

A **ConfigMap** stores non-sensitive configuration as key-value pairs. Pods read these values as environment variables.

Create `k8s/configmap.yml`:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: task-manager
data:
  DATABASE_NAME: "taskmanager"
  MONGODB_HOST: "mongodb-service"
  MONGODB_PORT: "27017"
  MONGODB_URL: "mongodb://mongodb-service:27017"
  ALLOWED_ORIGINS: "http://taskmanager.local"
  NEXT_PUBLIC_API_URL: "http://taskmanager.local/api"
```

> **Why not hardcode these in the Dockerfile?** ConfigMaps let you change configuration without rebuilding the image. The same image can run in dev, staging, and production with different ConfigMaps.

---

## 10.3 Secrets

A **Secret** stores sensitive data like passwords and API keys. Values are base64-encoded (not encrypted — this is encoding, not security. In production, use tools like Vault or Sealed Secrets).

First, encode your values:
```bash
echo -n "your-super-secret-jwt-key-change-this" | base64
# Output: eW91ci1zdXBlci1zZWNyZXQtand0LWtleS1jaGFuZ2UtdGhpcw==

echo -n "admin" | base64
# Output: YWRtaW4=

echo -n "password123" | base64
# Output: cGFzc3dvcmQxMjM=
```

Create `k8s/secrets.yml`:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: task-manager
type: Opaque
data:
  SECRET_KEY: eW91ci1zdXBlci1zZWNyZXQtand0LWtleS1jaGFuZ2UtdGhpcw==
  MONGO_INITDB_ROOT_USERNAME: YWRtaW4=
  MONGO_INITDB_ROOT_PASSWORD: cGFzc3dvcmQxMjM=
```

> **Warning:** Don't commit real secrets to Git. For this tutorial, these are dummy values. In production, use `kubectl create secret` to create secrets directly, or use a secrets management tool.

---

## 10.4 MongoDB

### PersistentVolumeClaim (PVC)

A **PVC** requests storage from the cluster. Minikube provides a default storage class that creates storage on the node's disk. Without persistent storage, all MongoDB data is lost when the pod restarts.

Create `k8s/mongodb/pvc.yml`:

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mongodb-pvc
  namespace: task-manager
spec:
  accessModes:
    - ReadWriteOnce    # Only one pod can write at a time
  resources:
    requests:
      storage: 1Gi     # Request 1 gigabyte of storage
```

### Deployment

A **Deployment** tells Kubernetes: "run this container image with these settings, and keep N copies (replicas) running at all times." If a pod crashes, the Deployment automatically creates a new one.

Create `k8s/mongodb/deployment.yml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mongodb
  namespace: task-manager
  labels:
    app: mongodb
spec:
  replicas: 1                    # Only 1 replica for a database
  selector:
    matchLabels:
      app: mongodb               # This Deployment manages pods with label app=mongodb
  template:
    metadata:
      labels:
        app: mongodb             # Label applied to pods created by this Deployment
    spec:
      containers:
        - name: mongodb
          image: mongo:7
          ports:
            - containerPort: 27017
          env:
            - name: MONGO_INITDB_DATABASE
              value: "taskmanager"
          envFrom:
            - secretRef:
                name: app-secrets    # Load all keys from the secret as env vars
          volumeMounts:
            - name: mongodb-data
              mountPath: /data/db    # Where MongoDB stores its data files
          resources:
            requests:                # Minimum resources guaranteed
              memory: "256Mi"
              cpu: "250m"            # 250 millicores = 0.25 CPU cores
            limits:                  # Maximum resources allowed
              memory: "512Mi"
              cpu: "500m"
          livenessProbe:             # "Is the container alive?"
            exec:
              command:
                - mongosh
                - --eval
                - "db.adminCommand('ping')"
            initialDelaySeconds: 30  # Wait 30s before first check
            periodSeconds: 10        # Check every 10s
          readinessProbe:            # "Is the container ready to serve traffic?"
            exec:
              command:
                - mongosh
                - --eval
                - "db.adminCommand('ping')"
            initialDelaySeconds: 5
            periodSeconds: 5
      volumes:
        - name: mongodb-data
          persistentVolumeClaim:
            claimName: mongodb-pvc   # Use the PVC we defined above
```

> **Probes explained:**
> - **Liveness probe:** If this fails repeatedly, Kubernetes kills and restarts the container. It answers: "Is the process still running and not stuck?"
> - **Readiness probe:** If this fails, Kubernetes removes the pod from the Service (no traffic is sent to it). It answers: "Is the container ready to handle requests?"

> **Resources explained:**
> - `requests`: The minimum CPU/memory guaranteed. The scheduler uses this to place pods on nodes.
> - `limits`: The maximum. If a container exceeds memory limits, it gets killed (OOMKilled). If it exceeds CPU limits, it gets throttled.

### Service

A **Service** gives pods a stable network address. Pods are temporary — they get new IPs when they restart. A Service provides a fixed hostname (`mongodb-service`) that always routes to the correct pod(s).

Create `k8s/mongodb/service.yml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mongodb-service
  namespace: task-manager
spec:
  selector:
    app: mongodb                 # Route traffic to pods with label app=mongodb
  ports:
    - port: 27017                # Port the Service listens on
      targetPort: 27017          # Port on the pod to forward to
  type: ClusterIP                # Only accessible within the cluster
```

> **ClusterIP** (default): Only reachable from within the cluster. Perfect for internal services like databases — you don't want the database exposed to the internet.

---

## 10.5 Backend

Create `k8s/backend/deployment.yml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: task-manager
  labels:
    app: backend
spec:
  replicas: 2                    # Run 2 copies for redundancy
  selector:
    matchLabels:
      app: backend
  strategy:
    type: RollingUpdate          # Update pods one at a time (zero downtime)
    rollingUpdate:
      maxSurge: 1                # Create at most 1 extra pod during update
      maxUnavailable: 0          # Always keep all existing pods running
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: task-manager-backend:latest
          imagePullPolicy: Never     # Use local image (don't try to pull from registry)
          ports:
            - containerPort: 8000
          envFrom:
            - configMapRef:
                name: app-config     # Load config as env vars
            - secretRef:
                name: app-secrets    # Load secrets as env vars
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "200m"
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 5
            periodSeconds: 5
```

> **imagePullPolicy: Never** — Tells Kubernetes not to try pulling the image from Docker Hub or another registry. Since we built the image directly in Minikube's Docker daemon (section 09), it's already available locally.

> **Rolling update strategy:** When you deploy a new version, Kubernetes creates a new pod, waits for it to become healthy, then terminates an old pod. This ensures zero downtime — at least one pod is always serving traffic.

Create `k8s/backend/service.yml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: task-manager
spec:
  selector:
    app: backend
  ports:
    - port: 8000
      targetPort: 8000
  type: ClusterIP
```

---

## 10.6 Frontend

Create `k8s/frontend/deployment.yml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: task-manager
  labels:
    app: frontend
spec:
  replicas: 2
  selector:
    matchLabels:
      app: frontend
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: task-manager-frontend:latest
          imagePullPolicy: Never
          ports:
            - containerPort: 3000
          env:
            - name: NEXT_PUBLIC_API_URL
              value: "http://taskmanager.local/api"
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "200m"
          livenessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
```

Create `k8s/frontend/service.yml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: task-manager
spec:
  selector:
    app: frontend
  ports:
    - port: 3000
      targetPort: 3000
  type: ClusterIP
```

---

## 10.7 Deploy Everything

Apply resources in dependency order:

```bash
# 1. Namespace first (everything else goes into it)
kubectl apply -f k8s/namespace.yml

# 2. Configuration (pods reference these)
kubectl apply -f k8s/configmap.yml
kubectl apply -f k8s/secrets.yml

# 3. Database (backend depends on it)
kubectl apply -f k8s/mongodb/

# 4. Backend (frontend depends on it)
kubectl apply -f k8s/backend/

# 5. Frontend
kubectl apply -f k8s/frontend/
```

Or apply everything at once (Kubernetes handles ordering):
```bash
kubectl apply -f k8s/ --recursive
```

---

## 10.8 Verify the Deployment

**Watch pods come up:**
```bash
kubectl get pods -n task-manager -w
# Wait until all pods show STATUS=Running and READY=1/1
# Press Ctrl+C to stop watching
```

Expected output:
```
NAME                        READY   STATUS    RESTARTS   AGE
backend-xxxxx-yyyyy         1/1     Running   0          30s
backend-xxxxx-zzzzz         1/1     Running   0          30s
frontend-xxxxx-yyyyy        1/1     Running   0          20s
frontend-xxxxx-zzzzz        1/1     Running   0          20s
mongodb-xxxxx-yyyyy         1/1     Running   0          45s
```

**Check all resources:**
```bash
kubectl get all -n task-manager
```

**View pod logs:**
```bash
kubectl logs -f deployment/backend -n task-manager
kubectl logs -f deployment/frontend -n task-manager
```

**Describe a pod** (useful for debugging):
```bash
kubectl describe pod <pod-name> -n task-manager
```

**Quick test with port-forward** (before setting up Ingress):
```bash
# Forward local port 8080 to the backend service
kubectl port-forward svc/backend-service 8080:8000 -n task-manager

# In another terminal, test it:
curl http://localhost:8080/health
# Expected: {"status": "healthy", ...}
```

---

## 10.9 Deploy Helper Script

Create `scripts/deploy-local.sh` to automate the deployment:

```bash
#!/bin/bash
set -e

echo "=== Configuring Docker for Minikube ==="
eval $(minikube docker-env)

echo "=== Building Docker images ==="
docker build -t task-manager-backend:latest ./services/backend
docker build -t task-manager-frontend:latest ./services/frontend

echo "=== Applying Kubernetes manifests ==="
kubectl apply -f k8s/ --recursive

echo "=== Waiting for pods to be ready ==="
kubectl wait --for=condition=ready pod --all -n task-manager --timeout=120s

echo "=== Deployment complete! ==="
kubectl get pods -n task-manager
echo ""
echo "Run 'minikube tunnel' in a separate terminal to access http://taskmanager.local"
```

Make it executable:
```bash
chmod +x scripts/deploy-local.sh
```

---

**Next:** [11-ingress.md](11-ingress.md) — Configure Nginx Ingress to route traffic.
