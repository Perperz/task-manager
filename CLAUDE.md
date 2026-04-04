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
