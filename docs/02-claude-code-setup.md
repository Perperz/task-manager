# 02 — Claude Code Setup (Essentials)

Claude Code is an AI coding assistant that runs in your terminal (or as a VS Code extension). It can read your files, run commands, edit code, and interact with GitHub — making it a powerful companion for building this project.

> **Resource:** [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)

---

## 2.1 Install Claude Code

**Option A — VS Code Extension (recommended for this project):**
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "Claude Code"
4. Click Install
5. Sign in with your Anthropic account

**Option B — CLI:**
```bash
npm install -g @anthropic-ai/claude-code
```

Then start it in your project directory:
```bash
cd /c/Users/orper/OneDrive/Desktop/WebApplication
claude
```

---

## 2.2 Create CLAUDE.md

`CLAUDE.md` is a special file that Claude Code reads automatically when it opens your project. It gives Claude context about your project — think of it as a briefing document.

Create this file at the **root** of your project:

```markdown
# Task Manager — Project Context

## Overview
Enterprise-level Task Manager web application using microservices architecture.

## Tech Stack
- **Frontend:** Next.js 15 + React 19 + TypeScript + Tailwind CSS
- **Backend:** Python 3.12 + FastAPI + Motor (async MongoDB driver)
- **Database:** MongoDB 7
- **Containerization:** Docker (multi-stage builds)
- **Orchestration:** Kubernetes (Minikube for local deployment)
- **CI/CD:** GitHub Actions
- **Reverse Proxy:** Nginx Ingress Controller

## Project Structure
- `services/frontend/` — Next.js application
- `services/backend/` — FastAPI application
- `k8s/` — Kubernetes manifest files
- `docs/` — Project documentation / manual
- `scripts/` — Helper shell scripts

## Coding Conventions
- **Python:** Follow PEP 8, use type hints, async/await for database operations
- **TypeScript/React:** Functional components only, use hooks, strict TypeScript
- **CSS:** Tailwind utility classes, no custom CSS unless absolutely necessary
- **API:** RESTful, all endpoints prefixed with `/api/`

## Common Commands
```bash
# Backend
cd services/backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd services/frontend && npm install
npm run dev

# Docker
docker-compose up -d
docker-compose down

# Kubernetes
minikube start --driver=docker
kubectl apply -f k8s/
kubectl get pods -n task-manager

# Tests
cd services/backend && pytest tests/ -v
cd services/frontend && npm run lint && npm run build
```

## Environment Variables

### Backend (`services/backend/.env`)
- `MONGODB_URL` — MongoDB connection string (default: `mongodb://localhost:27017`)
- `DATABASE_NAME` — Database name (default: `taskmanager`)
- `SECRET_KEY` — JWT signing secret (default: `change-me-in-production` — **must change in production**)
- `ACCESS_TOKEN_EXPIRE_MINUTES` — JWT token lifetime in minutes (default: `60`)
- `ALLOWED_ORIGINS` — CORS allowed origins, comma-separated (default: `http://localhost:3000`)

### Frontend (`services/frontend/.env.local`)
- `NEXT_PUBLIC_API_URL` — Backend API base URL (default: `http://localhost:8000`)
```

---

## 2.3 MCP Servers

**What is MCP?** MCP (Model Context Protocol) lets Claude Code connect to external tools and services. MCP "servers" are plugins that give Claude extra capabilities.

For this project, the most useful MCP server is the **GitHub MCP server**, which lets Claude interact with your GitHub repository directly (create PRs, read issues, manage branches).

### Setting up GitHub MCP

Claude Code settings are stored in `.claude/settings.json` in your project root. You can configure MCP servers there:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "<your-github-token>"
      }
    }
  }
}
```

**To get a GitHub token:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Select scopes: `repo`, `workflow`
4. Copy the token and paste it into the config above

> **Note:** Never commit tokens to Git. Add `.claude/` to your `.gitignore`.

> **Resource:** [MCP Servers Documentation](https://modelcontextprotocol.io/introduction)

---

## 2.4 Productivity Tips

### Choose the Right Model
- Use **Opus** for complex tasks: architecture decisions, debugging tricky issues, writing large features
- Use **Sonnet** for routine tasks: writing individual components, running commands, simple edits

You can switch models mid-conversation with `/model`.

### Use Slash Commands
- `/plan` — Enter plan mode to design your approach before coding
- `/compact` — Compress conversation history to free up context window
- `/clear` — Start a fresh conversation

### Break Tasks into Phases
Instead of asking Claude to "build the entire backend," break it up:
1. "Set up the FastAPI project structure and entry point"
2. "Create the MongoDB connection module"
3. "Build the auth routes (register, login)"
4. "Build the task CRUD routes"

This gives Claude focused context and produces better results.

### Provide Error Context
When debugging, paste the full error message. Claude can read stack traces and often pinpoint the issue immediately.

### Let Claude Run Commands
Claude Code can run shell commands for you (with your approval). Use this for:
- Installing dependencies
- Running tests
- Building Docker images
- Applying Kubernetes manifests

---

**Next:** [03-project-init.md](03-project-init.md) — Initialize the repository and project structure.
