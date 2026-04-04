# 11 — Nginx Ingress Configuration

An **Ingress** is a Kubernetes resource that manages external HTTP access to services inside the cluster. It acts as a **reverse proxy** — it receives all incoming requests and forwards them to the correct backend based on the URL path.

Without Ingress, each service would need its own external IP or port. With Ingress, everything goes through a single entry point (port 80) and gets routed internally.

We use the **Nginx Ingress Controller** — Minikube's built-in addon that runs Nginx as the proxy.

---

## 11.1 Ingress Resource

Create `k8s/ingress.yml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: task-manager-ingress
  namespace: task-manager
  annotations:
    # Rewrite /api/tasks to /api/tasks (pass through as-is for /api)
    nginx.ingress.kubernetes.io/use-regex: "true"
    # Maximum upload size (for any future file uploads)
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
    # Timeout settings
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "30"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "30"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "30"
spec:
  ingressClassName: nginx
  rules:
    - host: taskmanager.local        # The domain name we'll use locally
      http:
        paths:
          # API requests → Backend service
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 8000
          # Health check endpoint → Backend service
          - path: /health
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 8000
          # Swagger docs → Backend service
          - path: /docs
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 8000
          - path: /openapi.json
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 8000
          # Everything else → Frontend service
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 3000
```

### How routing works:

```
http://taskmanager.local/api/tasks    → backend-service:8000/api/tasks
http://taskmanager.local/api/auth/me  → backend-service:8000/api/auth/me
http://taskmanager.local/health       → backend-service:8000/health
http://taskmanager.local/docs         → backend-service:8000/docs
http://taskmanager.local/             → frontend-service:3000/
http://taskmanager.local/dashboard    → frontend-service:3000/dashboard
http://taskmanager.local/tasks        → frontend-service:3000/tasks
```

Nginx matches paths **in order of specificity** — more specific paths (like `/api`) match before less specific ones (like `/`).

**Apply it:**
```bash
kubectl apply -f k8s/ingress.yml
```

**Verify:**
```bash
kubectl get ingress -n task-manager
# Expected: Shows the ingress with host "taskmanager.local" and an ADDRESS
```

---

## 11.2 Local DNS Setup

Browsers resolve domain names using DNS. `taskmanager.local` doesn't exist in public DNS, so we need to map it manually to the Minikube cluster's IP address.

### Step 1: Get Minikube's IP
```bash
minikube ip
# Example output: 192.168.49.2
```

### Step 2: Edit the Windows hosts file

The **hosts file** overrides DNS lookups. When you add an entry, your browser will resolve that hostname to the IP you specify — no DNS server needed.

Open the hosts file **as Administrator**:
```powershell
# Run PowerShell as Administrator, then:
notepad C:\Windows\System32\drivers\etc\hosts
```

Add this line at the end (replace with your actual Minikube IP):
```
192.168.49.2  taskmanager.local
```

Save and close.

### Step 3: Verify DNS works
```bash
ping taskmanager.local
# Should resolve to the Minikube IP
```

---

## 11.3 Alternative: Minikube Tunnel

If editing the hosts file doesn't work (common on some Windows setups), use `minikube tunnel` instead:

```bash
# Run in a separate terminal (keep it running)
minikube tunnel
```

This creates a network route from your machine to the Minikube cluster. The Ingress gets assigned `127.0.0.1` as its external IP.

Then update your hosts file to:
```
127.0.0.1  taskmanager.local
```

> **Note:** `minikube tunnel` requires Administrator privileges and must stay running. If you close the terminal, the route disappears.

---

## 11.4 Test the Full Application

With Ingress configured and DNS set up:

1. **Health check:**
   ```bash
   curl http://taskmanager.local/health
   # Expected: {"status": "healthy", "timestamp": "..."}
   ```

2. **API docs:**
   Open http://taskmanager.local/docs in your browser — you should see the Swagger UI.

3. **Frontend:**
   Open http://taskmanager.local in your browser — you should see the login page.

4. **Full flow:**
   - Register a new user
   - Log in
   - Create tasks
   - View, edit, and delete tasks
   - All traffic goes through the single `taskmanager.local` domain

---

## 11.5 Debugging Ingress Issues

```bash
# Check Ingress controller pods are running
kubectl get pods -n ingress-nginx

# Check Ingress resource details
kubectl describe ingress task-manager-ingress -n task-manager

# Check Nginx config generated by the controller
kubectl exec -it -n ingress-nginx deploy/ingress-nginx-controller -- cat /etc/nginx/nginx.conf | grep taskmanager

# View Ingress controller logs
kubectl logs -n ingress-nginx deploy/ingress-nginx-controller
```

---

**Next:** [12-cicd.md](12-cicd.md) — Automate testing and building with GitHub Actions.
