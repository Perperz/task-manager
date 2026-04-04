# Appendix A — Command Cheat Sheet

Quick reference for the most commonly used commands in this project.

---

## Git

```bash
git init                              # Initialize a new repository
git status                            # Show changed/staged/untracked files
git add <file>                        # Stage a file for commit
git add .                             # Stage all changes
git commit -m "message"               # Create a commit with a message
git push origin <branch>              # Push a branch to GitHub
git pull origin <branch>              # Pull latest changes from GitHub
git branch                            # List local branches
git branch <name>                     # Create a new branch
git checkout <branch>                 # Switch to a branch
git checkout -b <branch>              # Create and switch to a new branch
git merge <branch>                    # Merge a branch into the current one
git log --oneline -10                 # Show last 10 commits (short format)
git diff                              # Show unstaged changes
git stash                             # Temporarily save uncommitted changes
git stash pop                         # Restore stashed changes
```

---

## GitHub CLI (gh)

```bash
gh auth login                         # Authenticate with GitHub
gh repo create <name> --public        # Create a new repository
gh pr create --title "..." --body "..." # Create a pull request
gh pr list                            # List open pull requests
gh pr merge <number>                  # Merge a pull request
gh issue list                         # List open issues
gh run list                           # List recent workflow runs
gh run view <id>                      # View a specific workflow run
```

---

## Docker

```bash
# Images
docker build -t <name>:<tag> <path>   # Build an image from a Dockerfile
docker images                         # List all local images
docker rmi <image>                    # Remove an image
docker image prune                    # Remove unused images

# Containers
docker run -d -p 8000:8000 <image>    # Run a container (detached, port mapped)
docker run --rm <image>               # Run and auto-remove when stopped
docker ps                             # List running containers
docker ps -a                          # List all containers (including stopped)
docker stop <container>               # Stop a running container
docker rm <container>                 # Remove a stopped container
docker logs <container>               # View container logs
docker logs -f <container>            # Stream container logs
docker exec -it <container> /bin/sh   # Open a shell inside a container

# Cleanup
docker system prune -a                # Remove all unused images, containers, networks
```

---

## Docker Compose

```bash
docker-compose up -d                  # Start all services (background)
docker-compose up                     # Start all services (foreground, see logs)
docker-compose down                   # Stop and remove all services
docker-compose down -v                # Stop, remove services AND volumes (data loss!)
docker-compose build                  # Rebuild all images
docker-compose up -d --build          # Rebuild and restart
docker-compose ps                     # List running services
docker-compose logs -f <service>      # Stream logs for a specific service
docker-compose exec <service> <cmd>   # Run a command in a running service
docker-compose restart <service>      # Restart a specific service

# With dev overrides:
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

---

## kubectl (Kubernetes)

```bash
# Cluster info
kubectl cluster-info                  # Show cluster details
kubectl get nodes                     # List cluster nodes

# Viewing resources
kubectl get pods -n task-manager      # List pods in namespace
kubectl get all -n task-manager       # List all resources in namespace
kubectl get svc -n task-manager       # List services
kubectl get ingress -n task-manager   # List ingress resources
kubectl get pvc -n task-manager       # List persistent volume claims

# Applying manifests
kubectl apply -f <file.yml>           # Create/update a resource from a YAML file
kubectl apply -f <directory>/ --recursive  # Apply all YAML files in a directory
kubectl delete -f <file.yml>          # Delete a resource defined in a YAML file

# Debugging
kubectl describe pod <name> -n task-manager      # Detailed pod info + events
kubectl logs <pod> -n task-manager               # View pod logs
kubectl logs -f <pod> -n task-manager            # Stream pod logs
kubectl logs deployment/<name> -n task-manager   # Logs from all pods in deployment
kubectl exec -it <pod> -n task-manager -- /bin/sh  # Shell into a pod
kubectl get events -n task-manager --sort-by='.lastTimestamp'  # Recent events

# Port forwarding (access a service locally without Ingress)
kubectl port-forward svc/backend-service 8080:8000 -n task-manager

# Scaling
kubectl scale deployment/backend --replicas=3 -n task-manager

# Rolling updates
kubectl rollout restart deployment/backend -n task-manager
kubectl rollout status deployment/backend -n task-manager
kubectl rollout undo deployment/backend -n task-manager    # Rollback

# Resource monitoring
kubectl top nodes                     # Node CPU/memory usage
kubectl top pods -n task-manager      # Pod CPU/memory usage
```

---

## Minikube

```bash
minikube start --driver=docker --memory=4096 --cpus=2   # Start cluster
minikube stop                         # Stop cluster (preserves state)
minikube delete                       # Delete cluster entirely
minikube status                       # Check cluster status
minikube ip                           # Get cluster IP address
minikube dashboard                    # Open Kubernetes web dashboard
minikube tunnel                       # Create route for LoadBalancer/Ingress access
minikube addons list                  # List available addons
minikube addons enable <addon>        # Enable an addon
minikube ssh                          # SSH into the Minikube VM

# Use Minikube's Docker daemon (so K8s can find locally-built images)
eval $(minikube docker-env)           # Point Docker CLI to Minikube
eval $(minikube docker-env --unset)   # Point back to local Docker
```

---

## Python / Backend

```bash
# Virtual environment (optional but recommended for local dev)
python -m venv .venv                  # Create virtual environment
source .venv/bin/activate             # Activate (Linux/Mac/Git Bash)
.venv\Scripts\activate                # Activate (Windows PowerShell)

# Dependencies
pip install -r requirements.txt       # Install all dependencies
pip freeze > requirements.txt         # Save current dependencies to file

# Run the server
uvicorn app.main:app --reload --port 8000   # Dev server with auto-reload
uvicorn app.main:app --port 8000            # Production server

# Testing
pytest tests/ -v                      # Run all tests
pytest tests/test_auth.py -v          # Run a specific test file
pytest tests/ -v -s                   # Run with print output visible
```

---

## Node.js / Frontend

```bash
npm install                           # Install dependencies from package.json
npm ci                                # Clean install (reproducible, for CI)
npm run dev                           # Start development server (hot reload)
npm run build                         # Create production build
npm run start                         # Start production server
npm run lint                          # Run ESLint
npx tsc --noEmit                      # Type-check without building
```

---

**Next:** [appendix-resources.md](appendix-resources.md) — Learning resources and documentation links.
