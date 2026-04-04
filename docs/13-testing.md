# 13 — Testing Strategy

Testing ensures your code works as expected and doesn't break when you make changes. We'll cover three levels: **unit/integration tests** for the backend, **manual API testing** with Swagger UI, and a brief overview of frontend testing.

---

## 13.1 Backend Testing with pytest

**pytest** is Python's most popular testing framework. It discovers test files automatically (files named `test_*.py`), runs them, and reports results. We use **httpx** (an async HTTP client) to send real HTTP requests to our FastAPI app during tests.

### Test Configuration (conftest.py)

Create `services/backend/tests/conftest.py`:

```python
"""
Shared test fixtures.

A "fixture" in pytest is a reusable setup function. Tests that need a database
connection or an authenticated client just declare the fixture as a parameter —
pytest injects it automatically.
"""

import asyncio
from datetime import datetime

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

from app.config import settings
from app.main import app
from app.utils.security import hash_password, create_access_token


# Use a separate test database so tests don't affect real data
TEST_DB_NAME = "taskmanager_test"


@pytest.fixture(scope="session")
def event_loop():
    """Create an event loop for the entire test session."""
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def mongo_client():
    """Connect to MongoDB once for all tests."""
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    yield client
    # Clean up: drop the test database after all tests
    await client.drop_database(TEST_DB_NAME)
    client.close()


@pytest_asyncio.fixture(autouse=True)
async def clean_db(mongo_client):
    """Clean all collections before each test."""
    db = mongo_client[TEST_DB_NAME]
    await db.users.delete_many({})
    await db.tasks.delete_many({})


@pytest_asyncio.fixture
async def client():
    """Create an async HTTP client that talks to our FastAPI app."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def test_user(mongo_client):
    """Create a test user in the database and return their data + token."""
    db = mongo_client[TEST_DB_NAME]
    user_data = {
        "username": "testuser",
        "email": "test@example.com",
        "password_hash": hash_password("password123"),
        "full_name": "Test User",
        "role": "user",
        "is_active": True,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(user_data)
    user_data["_id"] = result.inserted_id
    token = create_access_token(data={"sub": str(result.inserted_id)})
    return {"user": user_data, "token": token}


@pytest_asyncio.fixture
async def auth_headers(test_user):
    """Return Authorization headers for authenticated requests."""
    return {"Authorization": f"Bearer {test_user['token']}"}
```

### Auth Tests

Create `services/backend/tests/test_auth.py`:

```python
"""Tests for authentication endpoints."""

import pytest


@pytest.mark.asyncio
async def test_register_user(client):
    """Test user registration with valid data."""
    response = await client.post("/api/auth/register", json={
        "username": "newuser",
        "email": "new@example.com",
        "password": "securepassword",
        "full_name": "New User",
    })
    assert response.status_code == 201
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client, test_user):
    """Test that registering with an existing email fails."""
    response = await client.post("/api/auth/register", json={
        "username": "different",
        "email": "test@example.com",      # Already exists from test_user fixture
        "password": "password123",
    })
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_login_success(client, test_user):
    """Test login with valid credentials."""
    response = await client.post("/api/auth/login", data={
        "username": "test@example.com",    # OAuth2 form uses "username" field for email
        "password": "password123",
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client, test_user):
    """Test login with wrong password returns 401."""
    response = await client.post("/api/auth/login", data={
        "username": "test@example.com",
        "password": "wrongpassword",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user(client, auth_headers):
    """Test getting the current user profile with a valid token."""
    response = await client.get("/api/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "password_hash" not in data     # Should never expose password hash


@pytest.mark.asyncio
async def test_get_current_user_no_token(client):
    """Test that accessing /me without a token returns 401."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 401
```

### Task Tests

Create `services/backend/tests/test_tasks.py`:

```python
"""Tests for task CRUD endpoints."""

import pytest


@pytest.mark.asyncio
async def test_create_task(client, auth_headers):
    """Test creating a new task."""
    response = await client.post("/api/tasks", json={
        "title": "Write unit tests",
        "description": "Add pytest tests for all endpoints",
        "priority": "high",
        "status": "todo",
    }, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Write unit tests"
    assert data["priority"] == "high"
    assert data["status"] == "todo"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_task_unauthenticated(client):
    """Test that creating a task without auth fails."""
    response = await client.post("/api/tasks", json={
        "title": "Should fail",
    })
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_tasks(client, auth_headers):
    """Test listing tasks."""
    # Create two tasks
    await client.post("/api/tasks", json={"title": "Task 1"}, headers=auth_headers)
    await client.post("/api/tasks", json={"title": "Task 2"}, headers=auth_headers)

    response = await client.get("/api/tasks", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_list_tasks_filter_by_status(client, auth_headers):
    """Test filtering tasks by status."""
    await client.post("/api/tasks", json={"title": "Todo task", "status": "todo"}, headers=auth_headers)
    await client.post("/api/tasks", json={"title": "Done task", "status": "done"}, headers=auth_headers)

    response = await client.get("/api/tasks?status=done", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert all(task["status"] == "done" for task in data)


@pytest.mark.asyncio
async def test_get_task(client, auth_headers):
    """Test getting a single task by ID."""
    # Create a task
    create_resp = await client.post("/api/tasks", json={"title": "Get me"}, headers=auth_headers)
    task_id = create_resp.json()["id"]

    # Get it
    response = await client.get(f"/api/tasks/{task_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["title"] == "Get me"


@pytest.mark.asyncio
async def test_update_task(client, auth_headers):
    """Test updating a task."""
    # Create a task
    create_resp = await client.post("/api/tasks", json={"title": "Old title"}, headers=auth_headers)
    task_id = create_resp.json()["id"]

    # Update it
    response = await client.put(f"/api/tasks/{task_id}", json={
        "title": "New title",
        "status": "in_progress",
    }, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["title"] == "New title"
    assert response.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_delete_task(client, auth_headers):
    """Test deleting a task."""
    # Create a task
    create_resp = await client.post("/api/tasks", json={"title": "Delete me"}, headers=auth_headers)
    task_id = create_resp.json()["id"]

    # Delete it
    response = await client.delete(f"/api/tasks/{task_id}", headers=auth_headers)
    assert response.status_code == 200

    # Verify it's gone
    get_resp = await client.get(f"/api/tasks/{task_id}", headers=auth_headers)
    assert get_resp.status_code == 404
```

### Run the Tests

```bash
cd services/backend

# Run all tests with verbose output
pytest tests/ -v

# Run a specific test file
pytest tests/test_auth.py -v

# Run a specific test function
pytest tests/test_tasks.py::test_create_task -v

# Show print statements and logs
pytest tests/ -v -s
```

Expected output:
```
tests/test_auth.py::test_register_user PASSED
tests/test_auth.py::test_register_duplicate_email PASSED
tests/test_auth.py::test_login_success PASSED
tests/test_auth.py::test_login_wrong_password PASSED
tests/test_auth.py::test_get_current_user PASSED
tests/test_auth.py::test_get_current_user_no_token PASSED
tests/test_tasks.py::test_create_task PASSED
tests/test_tasks.py::test_create_task_unauthenticated PASSED
tests/test_tasks.py::test_list_tasks PASSED
tests/test_tasks.py::test_list_tasks_filter_by_status PASSED
tests/test_tasks.py::test_get_task PASSED
tests/test_tasks.py::test_update_task PASSED
tests/test_tasks.py::test_delete_task PASSED

============= 13 passed in 2.45s =============
```

> **Note:** These tests need a running MongoDB instance. Locally, start MongoDB first (`docker run -d -p 27017:27017 mongo:7`). In CI (GitHub Actions), the service container handles this automatically (see section 12).

---

## 13.2 Manual API Testing with Swagger UI

FastAPI auto-generates interactive API documentation at `http://localhost:8000/docs`.

### How to use Swagger UI:

1. **Start the backend:** `uvicorn app.main:app --reload --port 8000`
2. **Open** http://localhost:8000/docs in your browser
3. **Register a user:**
   - Click `POST /api/auth/register`
   - Click "Try it out"
   - Fill in the JSON body and click "Execute"
   - Copy the `access_token` from the response
4. **Authenticate:**
   - Click the "Authorize" button (lock icon at the top)
   - Paste the token in the "Value" field (just the token, no "Bearer" prefix)
   - Click "Authorize"
5. **Test endpoints:**
   - Now all requests include your token automatically
   - Try creating, listing, updating, and deleting tasks

Swagger UI is invaluable for quick testing during development — you don't need Postman or curl for simple checks.

---

## 13.3 Frontend Testing (Brief Overview)

For a production app, you'd add component tests using **Jest** and **React Testing Library**. Here's the approach (implementation is optional for this tutorial):

### Setup
```bash
cd services/frontend
npm install -D jest @testing-library/react @testing-library/jest-dom jest-environment-jsdom @types/jest
```

### Example component test
```typescript
// src/components/ui/__tests__/Button.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../Button";

describe("Button", () => {
  it("renders with text", () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText("Click me")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    fireEvent.click(screen.getByText("Click me"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("shows spinner when loading", () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
```

### Run
```bash
npm test
```

> **Resource:** [React Testing Library Docs](https://testing-library.com/docs/react-testing-library/intro/)

---

## 13.4 Testing Checklist

| What to test | How | Automated? |
|-------------|-----|-----------|
| API endpoints return correct status codes | pytest | Yes (CI) |
| Auth rejects invalid tokens | pytest | Yes (CI) |
| CRUD operations work end-to-end | pytest + Swagger | Yes + Manual |
| Frontend builds without errors | `npm run build` | Yes (CI) |
| Frontend linting passes | `npm run lint` | Yes (CI) |
| UI renders correctly | Browser manual testing | Manual |
| Docker images build successfully | `docker build` | Yes (CI) |
| Services communicate in Docker Compose | Manual smoke test | Manual |
| K8s deployment works | Manual deploy + check | Manual |

---

**Next:** [14-monitoring.md](14-monitoring.md) — Health checks, logging, and monitoring.
