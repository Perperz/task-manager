# 03 — Project Initialization & Repository Structure

In this section we'll initialize a Git repository and create the complete directory structure for our mono-repo.

---

## 3.1 Initialize Git Repository

**Git** tracks every change you make to files. A **repository** (repo) is a project folder that Git is tracking. A **commit** is a snapshot of your project at a point in time.

```bash
cd /c/Users/orper/OneDrive/Desktop/WebApplication

# Initialize a new Git repository in this folder
git init
```

You should see: `Initialized empty Git repository in ...`

---

## 3.2 Create .gitignore

A `.gitignore` file tells Git which files to **not** track. We exclude things like installed dependencies (huge, reproducible), secrets, and build artifacts.

Create `.gitignore` in the project root:

```gitignore
# ===== Python =====
__pycache__/
*.py[cod]
*$py.class
*.so
.venv/
venv/
env/
*.egg-info/
dist/
build/

# ===== Node.js =====
node_modules/
.next/
out/
.turbo/

# ===== Environment & Secrets =====
.env
.env.local
.env.*.local
*.pem
credentials.json

# ===== Docker =====
# Don't ignore Dockerfiles, but ignore local Docker data
docker-compose.override.yml

# ===== IDE =====
.vscode/
.idea/
*.swp
*.swo
*~

# ===== OS =====
.DS_Store
Thumbs.db
desktop.ini

# ===== Claude Code =====
.claude/

# ===== Misc =====
*.log
coverage/
.nyc_output/
```

---

## 3.3 Create Directory Structure

> **Windows users:** The commands below use Unix syntax (`mkdir -p`, `touch`). Run them in **Git Bash** (installed with Git for Windows). Open it by right-clicking your project folder in File Explorer and selecting **"Open Git Bash here"**, or search for **Git Bash** in the Start menu.

Run these commands to create the full project skeleton:

```bash
# Backend service structure
mkdir -p services/backend/app/models
mkdir -p services/backend/app/schemas
mkdir -p services/backend/app/routers
mkdir -p services/backend/app/services
mkdir -p services/backend/app/middleware
mkdir -p services/backend/app/utils
mkdir -p services/backend/tests

# Frontend service structure (we'll scaffold with Next.js later, but create the base)
mkdir -p services/frontend

# Kubernetes manifests
mkdir -p k8s/frontend
mkdir -p k8s/backend
mkdir -p k8s/mongodb

# CI/CD
mkdir -p .github/workflows

# Scripts
mkdir -p scripts

# Documentation
mkdir -p docs
```

---

## 3.4 Create Python Package Init Files

Python uses `__init__.py` files to mark directories as packages (importable modules). Create empty ones:

```bash
touch services/backend/app/__init__.py
touch services/backend/app/models/__init__.py
touch services/backend/app/schemas/__init__.py
touch services/backend/app/routers/__init__.py
touch services/backend/app/services/__init__.py
touch services/backend/app/middleware/__init__.py
touch services/backend/app/utils/__init__.py
touch services/backend/tests/__init__.py
```

---

## 3.5 Create CLAUDE.md

Copy the CLAUDE.md content from [02-claude-code-setup.md](02-claude-code-setup.md#22-create-claudemd) and save it at the project root.

---

## 3.6 Create a Minimal README

A `README.md` is the first thing people see when they visit your repository on GitHub. Create the file `README.md` in the project root with the following content:

````markdown
# Task Manager

Enterprise-level Task Manager web application built with microservices architecture.

## Tech Stack

- **Frontend:** Next.js + React + Tailwind CSS
- **Backend:** Python + FastAPI
- **Database:** MongoDB
- **Infrastructure:** Docker, Kubernetes (Minikube), Nginx Ingress
- **CI/CD:** GitHub Actions

## Quick Start

### Prerequisites
See [docs/01-prerequisites.md](docs/01-prerequisites.md)

### Run with Docker Compose
```bash
docker-compose up -d
```
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Run on Kubernetes (Minikube)
```bash
minikube start --driver=docker
./scripts/deploy-local.sh
```
- App: http://taskmanager.local

## Documentation
See the [docs/](docs/) directory for the full step-by-step manual.
````

> **How to create this file:** Open your code editor (e.g., VS Code), create a new file called `README.md` in the project root, paste the content above, and save.

---

## 3.7 First Commit

Now let's save everything we've created so far into Git. A **commit** is a snapshot of your project at a point in time. The `-m` flag adds a message describing what changed.

First, check what Git sees:

```bash
git status
```

You should see all the files we created in sections 3.2–3.6 listed as **untracked files**: `.gitignore`, the `services/` and `k8s/` directories, the `__init__.py` files, `CLAUDE.md`, and `README.md`.

> **Note:** `git add .` stages all new and modified files, but it respects the `.gitignore` we created in section 3.2 — so directories like `node_modules/`, `.venv/`, and `.claude/` will **not** be included.

```bash
# Stage all new files (tell Git to include them in the next commit)
git add .

# Create the commit
git commit -m "Initial project structure with directory skeleton"
```

You should see output listing the files that were committed. To verify:

```bash
git log --oneline
```

This shows your commit history — you should see one commit with the message above.

---

## 3.8 Create GitHub Repository and Push

```bash
# Create a new repo on GitHub (the CLI will prompt for options)
gh repo create task-manager --public --source=. --remote=origin

# Push your code to GitHub
git push -u origin main
```

> **What just happened:**
> - `gh repo create` created a new repository on GitHub
> - `--source=.` told it to use the current directory
> - `--remote=origin` added GitHub as the remote called "origin"
> - `git push -u origin main` uploaded your code. The `-u` flag sets "origin/main" as the default remote branch, so future pushes only need `git push`

**Verify:** Visit `https://github.com/<your-username>/task-manager` — you should see your files.

---

## 3.9 Branch Strategy

We'll use a simple branching model:

```
main          ← production-ready code (protected)
  └── develop ← integration branch
       ├── feature/backend-auth
       ├── feature/backend-tasks
       ├── feature/frontend-ui
       └── ...
```

Create the develop branch:

```bash
git checkout -b develop
git push -u origin develop
```

For each feature, create a branch off develop:

```bash
# Example: when starting work on backend auth
git checkout develop
git checkout -b feature/backend-auth

# When done, push and create a Pull Request on GitHub
git push -u origin feature/backend-auth
gh pr create --base develop --title "Add authentication routes" --body "Implements register, login, and JWT middleware"
```

> **A Pull Request (PR)** is a request to merge your feature branch into another branch. It lets you (or teammates) review the code before merging. GitHub Actions will run tests on every PR automatically (we'll set that up in section 12).

---

**Next:** [04-data-model.md](04-data-model.md) — Design the MongoDB data model.
