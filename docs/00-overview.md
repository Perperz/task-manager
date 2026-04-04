# 00 — Overview

## What We're Building

A **Task Manager** web application — a full-stack CRUD app where users can register, log in, and manage tasks (create, read, update, delete). Each task has a title, description, status, priority, assignee, and due date.

While the app itself is simple, the **infrastructure around it is enterprise-grade**: microservices in Docker containers, orchestrated by Kubernetes, with CI/CD automation via GitHub Actions.

---

## Architecture Diagram

```
                         ┌─────────────────────────────────┐
                         │        Minikube Cluster          │
                         │                                  │
  Browser ──► http://taskmanager.local                      │
                         │                                  │
                         │   ┌──────────────────────────┐   │
                         │   │   Nginx Ingress (port 80) │   │
                         │   └──────┬───────────┬───────┘   │
                         │          │           │           │
                         │    /api/*│           │/*         │
                         │          ▼           ▼           │
                         │   ┌───────────┐ ┌───────────┐   │
                         │   │  Backend  │ │ Frontend  │   │
                         │   │  FastAPI  │ │  Next.js  │   │
                         │   │ (2 pods)  │ │ (2 pods)  │   │
                         │   │ port 8000 │ │ port 3000 │   │
                         │   └─────┬─────┘ └───────────┘   │
                         │         │                        │
                         │         ▼                        │
                         │   ┌───────────┐                  │
                         │   │  MongoDB  │                  │
                         │   │  (1 pod)  │                  │
                         │   │ port 27017│                  │
                         │   └───────────┘                  │
                         │                                  │
                         └─────────────────────────────────┘
```

**How it works:**
1. The user visits `http://taskmanager.local` in their browser
2. **Nginx Ingress** receives the request and routes it:
   - Requests starting with `/api/` go to the **Backend** (FastAPI)
   - All other requests go to the **Frontend** (Next.js)
3. The **Frontend** renders the UI and makes API calls to `/api/...`
4. The **Backend** processes API requests, authenticates users via JWT tokens, and reads/writes data to **MongoDB**
5. **MongoDB** stores all persistent data (users, tasks)

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Next.js 15 + React 19 + Tailwind CSS | Modern React framework with SSR, file-based routing, and utility-first CSS |
| **Backend** | Python 3.12 + FastAPI | Fast, async Python API framework with auto-generated docs |
| **Database** | MongoDB 7 | Flexible document database, great for JSON-like data |
| **Containerization** | Docker | Packages each service into a portable, reproducible container |
| **Orchestration** | Kubernetes (Minikube) | Manages containers: scaling, health checks, networking, rolling updates |
| **Reverse Proxy** | Nginx Ingress Controller | Routes external traffic to the correct internal service |
| **CI/CD** | GitHub Actions | Automates testing and building on every code push |
| **Version Control** | Git + GitHub | Track code changes and collaborate |

---

## Repository Structure (Mono-repo)

We use a **mono-repo** — a single Git repository containing all services. This is simpler for small teams because you can make changes across services in a single commit and share CI/CD configuration.

```
WebApplication/
├── CLAUDE.md                    # Instructions for Claude Code AI assistant
├── .gitignore                   # Files Git should ignore
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions CI/CD pipeline
├── docker-compose.yml           # Run all services locally with one command
├── docker-compose.dev.yml       # Dev overrides (live reload)
├── services/
│   ├── frontend/                # Next.js application
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── package.json
│   │   ├── next.config.js
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   ├── public/
│   │   └── src/
│   │       ├── app/             # Next.js App Router pages
│   │       ├── components/      # Reusable React components
│   │       ├── lib/             # API client, utilities
│   │       ├── context/         # React Context providers
│   │       └── types/           # TypeScript type definitions
│   └── backend/                 # FastAPI application
│       ├── Dockerfile
│       ├── .dockerignore
│       ├── requirements.txt
│       └── app/
│           ├── main.py          # Application entry point
│           ├── config.py        # Environment configuration
│           ├── database.py      # MongoDB connection
│           ├── models/          # Database models
│           ├── schemas/         # Request/response schemas
│           ├── routers/         # API route handlers
│           ├── services/        # Business logic
│           ├── middleware/      # Auth middleware
│           └── utils/           # Helpers (password hashing, etc.)
├── k8s/                         # Kubernetes manifest files
│   ├── namespace.yml
│   ├── configmap.yml
│   ├── secrets.yml
│   ├── frontend/
│   │   ├── deployment.yml
│   │   └── service.yml
│   ├── backend/
│   │   ├── deployment.yml
│   │   └── service.yml
│   ├── mongodb/
│   │   ├── deployment.yml
│   │   ├── service.yml
│   │   └── pvc.yml
│   └── ingress.yml
└── scripts/
    ├── setup.sh                 # One-time project setup
    ├── deploy-local.sh          # Deploy to Minikube
    └── seed-data.sh             # Populate DB with sample data
```

---

## How to Use This Manual

This manual is split into numbered files (`00` through `14`, plus appendices). Follow them **in order** — each section builds on the previous one.

**Phases:**

| Phase | Sections | What You'll Have Working |
|-------|----------|------------------------|
| 1. Foundation | 00–03 | Project repo with structure, Git initialized |
| 2. Backend | 04–05 | Working REST API, testable via Swagger UI |
| 3. Frontend | 06 | React UI connected to the API |
| 4. Containerize | 07–08 | All services running in Docker containers |
| 5. Orchestrate | 09–11 | App deployed on local Kubernetes cluster |
| 6. Automate | 12 | CI/CD pipeline running on every push |
| 7. Harden | 13–14 | Tests, health checks, monitoring |

Each phase produces something you can see and test before moving on.

---

**Next:** [01-prerequisites.md](01-prerequisites.md) — Install the tools you'll need.
