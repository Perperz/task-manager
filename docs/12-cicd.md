# 12 — CI/CD with GitHub Actions

**CI/CD** stands for Continuous Integration / Continuous Delivery:
- **CI (Continuous Integration):** Automatically run tests and build checks every time code is pushed. Catches bugs before they reach the main branch.
- **CD (Continuous Delivery):** Automatically deploy the application after tests pass. (For our local setup, we automate the build step; deployment to Minikube is manual.)

**GitHub Actions** is GitHub's built-in CI/CD platform. You define **workflows** in YAML files inside `.github/workflows/`. GitHub runs them on cloud servers (called **runners**) for free (with usage limits).

---

## 12.1 CI Workflow

Create `.github/workflows/ci.yml`:

```yaml
name: CI Pipeline

# ─── When to run ──────────────────────────────
on:
  push:
    branches: [main, develop]      # Run on push to main or develop
  pull_request:
    branches: [main]               # Run on PRs targeting main

# ─── Jobs ─────────────────────────────────────
jobs:

  # ═══════════════════════════════════════════
  # Job 1: Test the backend
  # ═══════════════════════════════════════════
  backend-test:
    name: Backend Tests
    runs-on: ubuntu-latest         # Use a Linux runner (free tier)

    # Service containers — spin up alongside the job
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand(\"ping\")'"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      # Step 1: Check out the code
      - name: Checkout code
        uses: actions/checkout@v4

      # Step 2: Set up Python
      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: "pip"                   # Cache pip packages for faster builds
          cache-dependency-path: services/backend/requirements.txt

      # Step 3: Install dependencies
      - name: Install dependencies
        run: |
          cd services/backend
          pip install -r requirements.txt

      # Step 4: Run linting (optional but good practice)
      - name: Lint with ruff
        run: |
          pip install ruff
          cd services/backend
          ruff check app/
        continue-on-error: true          # Don't fail the build on lint warnings (yet)

      # Step 5: Run tests
      - name: Run tests
        run: |
          cd services/backend
          pytest tests/ -v --tb=short
        env:
          MONGODB_URL: mongodb://localhost:27017
          DATABASE_NAME: testdb
          SECRET_KEY: test-secret-key-for-ci
          ALLOWED_ORIGINS: http://localhost:3000

  # ═══════════════════════════════════════════
  # Job 2: Test the frontend
  # ═══════════════════════════════════════════
  frontend-test:
    name: Frontend Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"
          cache-dependency-path: services/frontend/package-lock.json

      - name: Install dependencies
        run: |
          cd services/frontend
          npm ci                         # Clean install from lockfile (reproducible)

      - name: Lint
        run: |
          cd services/frontend
          npm run lint

      - name: Type check
        run: |
          cd services/frontend
          npx tsc --noEmit               # Check types without producing output

      - name: Build
        run: |
          cd services/frontend
          npm run build
        env:
          NEXT_PUBLIC_API_URL: http://localhost:8000

  # ═══════════════════════════════════════════
  # Job 3: Build Docker images
  # ═══════════════════════════════════════════
  docker-build:
    name: Docker Build
    runs-on: ubuntu-latest
    needs: [backend-test, frontend-test]   # Only run if both test jobs pass

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Build backend image
        run: |
          docker build -t task-manager-backend:${{ github.sha }} ./services/backend

      - name: Build frontend image
        run: |
          docker build -t task-manager-frontend:${{ github.sha }} ./services/frontend

      - name: Verify images
        run: |
          docker images | grep task-manager
```

### Workflow breakdown:

| Concept | Explanation |
|---------|-------------|
| `on:` | **Triggers** — when this workflow runs. We run on push to main/develop and on PRs to main. |
| `jobs:` | **Jobs** run in parallel by default. Each job gets a fresh virtual machine. |
| `runs-on: ubuntu-latest` | The job runs on a GitHub-hosted Linux server (free). |
| `services:` | **Service containers** run alongside the job. Our backend tests need MongoDB, so GitHub spins up a MongoDB container automatically. |
| `uses: actions/checkout@v4` | **Actions** are reusable steps. `actions/checkout` clones your repository. `actions/setup-python` installs Python. |
| `needs: [backend-test, frontend-test]` | **Dependencies** — `docker-build` only runs after both test jobs succeed. |
| `${{ github.sha }}` | **Context variables** — GitHub provides metadata. `github.sha` is the commit hash, used to tag images uniquely. |
| `cache: "pip"` / `cache: "npm"` | **Caching** — stores downloaded packages between workflow runs so installs are faster. |

---

## 12.2 Workflow Visualization

```
Push to main or PR to main
         │
         ├──► backend-test (parallel)
         │      ├── Checkout
         │      ├── Setup Python
         │      ├── Install deps
         │      ├── Lint
         │      └── Run pytest
         │
         ├──► frontend-test (parallel)
         │      ├── Checkout
         │      ├── Setup Node.js
         │      ├── Install deps
         │      ├── Lint
         │      ├── Type check
         │      └── Build
         │
         └──► docker-build (after both pass)
                ├── Checkout
                ├── Build backend image
                └── Build frontend image
```

---

## 12.3 Branch Protection Rules

To enforce that tests pass before merging, set up branch protection on GitHub:

1. Go to your repository on GitHub
2. Settings → Branches → Add rule
3. Branch name pattern: `main`
4. Check:
   - "Require a pull request before merging"
   - "Require status checks to pass before merging"
   - Select the checks: `Backend Tests`, `Frontend Tests`, `Docker Build`
   - "Require branches to be up to date before merging"
5. Save changes

Now nobody can push directly to `main` — all changes must go through a PR, and the CI pipeline must pass.

---

## 12.4 Workflow Badges

Add a CI status badge to your README to show whether the pipeline is passing:

```markdown
![CI](https://github.com/<your-username>/task-manager/actions/workflows/ci.yml/badge.svg)
```

This renders as a green "passing" or red "failing" badge.

---

## 12.5 Commit and Push

```bash
git add .github/workflows/ci.yml
git commit -m "Add CI pipeline with GitHub Actions"
git push origin develop
```

Create a PR to `main` to see the workflow run:
```bash
gh pr create --base main --title "Add CI/CD pipeline" --body "Adds automated testing and Docker build workflow"
```

Then visit the PR on GitHub — you'll see the checks running.

---

## 12.6 Production CI/CD Extension (For Reference)

In a real production setup, the workflow would also:
1. **Push images to a container registry** (Docker Hub, GitHub Container Registry, AWS ECR)
2. **Update Kubernetes manifests** with the new image tag
3. **Deploy to the cluster** using `kubectl apply` or a tool like ArgoCD

Example addition (not needed for local deployment):

```yaml
  # This would go after docker-build
  deploy:
    name: Deploy to Production
    needs: docker-build
    if: github.ref == 'refs/heads/main'    # Only deploy from main
    runs-on: ubuntu-latest
    steps:
      - name: Push to registry
        run: |
          docker push ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
          docker push ghcr.io/${{ github.repository }}/frontend:${{ github.sha }}
      - name: Update Kubernetes
        run: |
          kubectl set image deployment/backend backend=ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
```

---

**Next:** [13-testing.md](13-testing.md) — Testing strategy for backend and frontend.
