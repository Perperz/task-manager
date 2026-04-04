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
