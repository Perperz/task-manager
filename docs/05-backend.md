# 05 — Backend Service (FastAPI)

FastAPI is a modern, high-performance Python web framework for building APIs. It automatically generates interactive API documentation (Swagger UI) at `/docs` and uses Python type hints for request/response validation. In this chapter we build the entire backend: configuration, database layer, authentication, and all REST API routes. We use **Motor** as the async MongoDB driver so that database calls never block the server.

> **REST API** is an architectural style where each URL represents a resource (e.g. `/api/tasks`), and HTTP methods (GET, POST, PUT, DELETE) represent actions on that resource.

---

## 5.1 Install Dependencies

Create the file `services/backend/requirements.txt`:

```text
fastapi==0.115.0
uvicorn[standard]==0.30.0
motor==3.5.0
pydantic[email]==2.8.0
pydantic-settings==2.5.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.9
python-dotenv==1.0.1
pytest==8.3.0
httpx==0.27.0
```

What each package does:

| Package | Purpose |
|---------|---------|
| `fastapi` | The web framework itself — routing, validation, docs generation. |
| `uvicorn[standard]` | ASGI server that runs the FastAPI application. |
| `motor` | Async MongoDB driver built on top of PyMongo. |
| `pydantic[email]` | Data validation library; the `email` extra adds email-address validation. |
| `pydantic-settings` | Reads configuration from environment variables and `.env` files. |
| `python-jose[cryptography]` | Creates and verifies JWT tokens. |
| `passlib[bcrypt]` | Hashes and verifies passwords with the bcrypt algorithm. |
| `python-multipart` | Required by FastAPI to parse form data (used by the login form). |
| `python-dotenv` | Loads `.env` files into environment variables. |
| `pytest` | Test runner for unit and integration tests. |
| `httpx` | Async HTTP client used by pytest to test FastAPI endpoints. |

Install everything:

```bash
cd services/backend && pip install -r requirements.txt
```

---

## 5.2 Configuration (`app/config.py`)

> **pydantic-settings** lets you declare configuration fields as a typed Python class. Values are loaded automatically from environment variables or a `.env` file, with defaults for local development.

```python
# services/backend/app/config.py

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables / .env file."""

    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "taskmanager"
    SECRET_KEY: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    model_config = {
        "env_file": ".env",
    }


settings = Settings()
```

In production you will override these via real environment variables or a Kubernetes Secret — never commit real secrets to source control.

---

## 5.3 Database Connection (`app/database.py`)

> **async/await** is Python's way of writing non-blocking code. While the server waits for a database query to return, it can handle other incoming requests instead of sitting idle.

```python
# services/backend/app/database.py

from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient = None
db = None

# Collection references
users_collection = None
tasks_collection = None


async def connect_db():
    """Open the MongoDB connection and set up collection references."""
    global client, db, users_collection, tasks_collection

    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    users_collection = db["users"]
    tasks_collection = db["tasks"]

    # Create indexes for common queries
    await users_collection.create_index("email", unique=True)
    await users_collection.create_index("username", unique=True)
    await tasks_collection.create_index("created_by")
    await tasks_collection.create_index("status")

    print(f"Connected to MongoDB: {settings.DATABASE_NAME}")


async def close_db():
    """Close the MongoDB connection."""
    global client
    if client:
        client.close()
        print("MongoDB connection closed.")
```

---

## 5.4 Security Utilities (`app/utils/security.py`)

> **JWT (JSON Web Token)** is a compact, cryptographically signed token that proves a user's identity. The server creates it at login and the client sends it back with every request — no server-side session storage needed.

```python
# services/backend/app/utils/security.py

from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import JWTError, jwt
from app.config import settings

# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Return a bcrypt hash of the plain-text password."""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check a plain-text password against the stored hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT containing *data* with an expiration claim."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")


def verify_token(token: str) -> dict | None:
    """Decode and verify a JWT. Returns the payload dict or None."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        return payload
    except JWTError:
        return None
```

---

## 5.5 Auth Middleware (`app/middleware/auth.py`)

> **Dependency Injection (FastAPI's `Depends`)** is a way to share reusable logic — like authentication checks — across routes without repeating code. You declare a dependency once and FastAPI calls it automatically before each request that needs it.

```python
# services/backend/app/middleware/auth.py

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.utils.security import verify_token
from app.database import users_collection
from bson import ObjectId

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    FastAPI dependency that:
    1. Extracts the JWT from the Authorization: Bearer <token> header.
    2. Verifies the token signature and expiration.
    3. Looks up the user in MongoDB.
    4. Returns the user dict (with _id converted to string).
    Raises 401 if anything fails.
    """
    token = credentials.credentials

    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject claim",
        )

    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    # Convert ObjectId to string for downstream convenience
    user["_id"] = str(user["_id"])
    return user
```

---

## 5.6 Auth Service (`app/services/auth_service.py`)

```python
# services/backend/app/services/auth_service.py

from datetime import datetime, timezone
from fastapi import HTTPException, status
from app.database import users_collection
from app.utils.security import hash_password, verify_password, create_access_token


async def register_user(user_data: dict) -> dict:
    """
    Register a new user.
    1. Check that the email and username are not already taken.
    2. Hash the password.
    3. Insert into MongoDB.
    4. Return an access token.
    """
    # Check for existing email
    if await users_collection.find_one({"email": user_data["email"]}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check for existing username
    if await users_collection.find_one({"username": user_data["username"]}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Prepare the user document
    user_doc = {
        "username": user_data["username"],
        "email": user_data["email"],
        "hashed_password": hash_password(user_data["password"]),
        "full_name": user_data.get("full_name", ""),
        "role": "user",
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }

    result = await users_collection.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_access_token(data={"sub": user_id, "username": user_doc["username"]})
    return {"access_token": token, "token_type": "bearer"}


async def authenticate_user(email: str, password: str) -> dict:
    """
    Authenticate a user by email and password.
    Returns an access token on success, raises 401 on failure.
    """
    user = await users_collection.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not verify_password(password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    user_id = str(user["_id"])
    token = create_access_token(data={"sub": user_id, "username": user["username"]})
    return {"access_token": token, "token_type": "bearer"}
```

---

## 5.7 Task Service (`app/services/task_service.py`)

```python
# services/backend/app/services/task_service.py

from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, status
from app.database import tasks_collection


def _task_to_dict(task: dict) -> dict:
    """Convert a MongoDB task document to a JSON-safe dict."""
    task["_id"] = str(task["_id"])
    if "created_by" in task and isinstance(task["created_by"], ObjectId):
        task["created_by"] = str(task["created_by"])
    if "assigned_to" in task and isinstance(task["assigned_to"], ObjectId):
        task["assigned_to"] = str(task["assigned_to"])
    return task


async def create_task(task_data: dict, user_id: str) -> dict:
    """Insert a new task into MongoDB and return it."""
    task_doc = {
        "title": task_data["title"],
        "description": task_data.get("description", ""),
        "status": task_data.get("status", "todo"),
        "priority": task_data.get("priority", "medium"),
        "assigned_to": task_data.get("assigned_to"),
        "due_date": task_data.get("due_date"),
        "created_by": ObjectId(user_id),
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc),
    }
    result = await tasks_collection.insert_one(task_doc)
    task_doc["_id"] = result.inserted_id
    return _task_to_dict(task_doc)


async def get_tasks(
    status_filter: str | None = None,
    priority: str | None = None,
    page: int = 1,
    limit: int = 10,
) -> dict:
    """
    Return a paginated, optionally filtered list of tasks.
    Returns {"tasks": [...], "total": int, "page": int, "limit": int}.
    """
    query: dict = {}
    if status_filter:
        query["status"] = status_filter
    if priority:
        query["priority"] = priority

    total = await tasks_collection.count_documents(query)
    skip = (page - 1) * limit

    cursor = tasks_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    tasks = [_task_to_dict(doc) async for doc in cursor]

    return {"tasks": tasks, "total": total, "page": page, "limit": limit}


async def get_task_by_id(task_id: str) -> dict:
    """Return a single task or raise 404."""
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid task ID")

    task = await tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _task_to_dict(task)


async def update_task(task_id: str, update_data: dict, user: dict) -> dict:
    """Update a task. Only the owner or an admin may update."""
    task = await get_task_by_id(task_id)

    if task["created_by"] != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    update_data["updated_at"] = datetime.now(timezone.utc)

    await tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data},
    )

    updated = await tasks_collection.find_one({"_id": ObjectId(task_id)})
    return _task_to_dict(updated)


async def delete_task(task_id: str, user: dict) -> dict:
    """Delete a task. Only the owner or an admin may delete."""
    task = await get_task_by_id(task_id)

    if task["created_by"] != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    await tasks_collection.delete_one({"_id": ObjectId(task_id)})
    return {"message": "Task deleted successfully"}
```

---

## 5.8 Auth Routes (`app/routers/auth.py`)

```python
# services/backend/app/routers/auth.py

from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from app.services.auth_service import register_user, authenticate_user
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ---- Schemas ----

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: str = ""


class Token(BaseModel):
    access_token: str
    token_type: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    role: str


# ---- Routes ----

@router.post("/register", response_model=Token)
async def register(user_data: UserCreate):
    """Register a new user and return a JWT token."""
    return await register_user(user_data.model_dump())


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    """
    Authenticate with email (passed as 'username' per OAuth2 spec) and password.
    Returns a JWT token.
    """
    return await authenticate_user(form_data.username, form_data.password)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the profile of the currently authenticated user."""
    return UserResponse(
        id=current_user["_id"],
        username=current_user["username"],
        email=current_user["email"],
        full_name=current_user.get("full_name", ""),
        role=current_user.get("role", "user"),
    )
```

---

## 5.9 Task Routes (`app/routers/tasks.py`)

```python
# services/backend/app/routers/tasks.py

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from datetime import datetime
from app.middleware.auth import get_current_user
from app.services.task_service import (
    create_task,
    get_tasks,
    get_task_by_id,
    update_task,
    delete_task,
)

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


# ---- Schemas ----

class TaskCreate(BaseModel):
    title: str
    description: str = ""
    status: str = "todo"
    priority: str = "medium"
    assigned_to: str | None = None
    due_date: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    priority: str | None = None
    assigned_to: str | None = None
    due_date: datetime | None = None


class TaskResponse(BaseModel):
    id: str
    title: str
    description: str
    status: str
    priority: str
    assigned_to: str | None = None
    due_date: datetime | None = None
    created_by: str
    created_at: datetime
    updated_at: datetime


def _to_response(task: dict) -> TaskResponse:
    return TaskResponse(
        id=task["_id"],
        title=task["title"],
        description=task.get("description", ""),
        status=task["status"],
        priority=task["priority"],
        assigned_to=task.get("assigned_to"),
        due_date=task.get("due_date"),
        created_by=task["created_by"],
        created_at=task["created_at"],
        updated_at=task["updated_at"],
    )


# ---- Routes ----

@router.get("/")
async def list_tasks(
    status: str | None = Query(None, description="Filter by status (todo, in_progress, done)"),
    priority: str | None = Query(None, description="Filter by priority (low, medium, high)"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(10, ge=1, le=100, description="Items per page"),
):
    """Return a paginated list of tasks, optionally filtered by status or priority."""
    result = await get_tasks(
        status_filter=status, priority=priority, page=page, limit=limit
    )
    result["tasks"] = [_to_response(t) for t in result["tasks"]]
    return result


@router.get("/{task_id}", response_model=TaskResponse)
async def read_task(task_id: str):
    """Get a single task by its ID."""
    task = await get_task_by_id(task_id)
    return _to_response(task)


@router.post("/", response_model=TaskResponse, status_code=201)
async def create_new_task(
    task_data: TaskCreate,
    current_user: dict = Depends(get_current_user),
):
    """Create a new task. Requires authentication."""
    task = await create_task(task_data.model_dump(), current_user["_id"])
    return _to_response(task)


@router.put("/{task_id}", response_model=TaskResponse)
async def update_existing_task(
    task_id: str,
    task_data: TaskUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Update a task. Only the owner or an admin may update."""
    update_fields = task_data.model_dump(exclude_unset=True)
    task = await update_task(task_id, update_fields, current_user)
    return _to_response(task)


@router.delete("/{task_id}")
async def remove_task(
    task_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Delete a task. Only the owner or an admin may delete."""
    return await delete_task(task_id, current_user)
```

---

## 5.10 User Routes (`app/routers/users.py`)

```python
# services/backend/app/routers/users.py

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from bson import ObjectId
from app.database import users_collection

router = APIRouter(prefix="/api/users", tags=["users"])


# ---- Schemas ----

class UserProfile(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    role: str


def _user_to_profile(user: dict) -> UserProfile:
    return UserProfile(
        id=str(user["_id"]),
        username=user["username"],
        email=user["email"],
        full_name=user.get("full_name", ""),
        role=user.get("role", "user"),
    )


# ---- Routes ----

@router.get("/", response_model=list[UserProfile])
async def list_users():
    """
    Return all users (id, username, full_name).
    Useful for populating the task-assignment dropdown in the frontend.
    """
    cursor = users_collection.find({}, {"hashed_password": 0})
    users = [_user_to_profile(doc) async for doc in cursor]
    return users


@router.get("/{user_id}", response_model=UserProfile)
async def get_user(user_id: str):
    """Get a single user's public profile."""
    if not ObjectId.is_valid(user_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID",
        )

    user = await users_collection.find_one(
        {"_id": ObjectId(user_id)},
        {"hashed_password": 0},
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return _user_to_profile(user)
```

---

## 5.11 Application Entry Point (`app/main.py`)

> **CORS (Cross-Origin Resource Sharing)** — browsers block requests from one domain (e.g. `localhost:3000`) to another (e.g. `localhost:8000`) by default. Adding CORS middleware tells the browser those cross-origin requests are allowed.

```python
# services/backend/app/main.py

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import connect_db, close_db
from app.routers import auth, tasks, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown events."""
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="Task Manager API",
    description="A full-featured task management REST API built with FastAPI and MongoDB.",
    version="1.0.0",
    lifespan=lifespan,
)

# ---- CORS ----
origins = [origin.strip() for origin in settings.ALLOWED_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Routers ----
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(users.router)


# ---- Health & Info ----

@app.get("/health", tags=["system"])
async def health_check():
    """Health check endpoint for container orchestration probes."""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/", tags=["system"])
async def root():
    """API information and quick links."""
    return {
        "name": "Task Manager API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
    }
```

---

## 5.12 Run and Test

### Start the server

```bash
cd services/backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

You should see output like:

```
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
Connected to MongoDB: taskmanager
```

### Swagger UI

Open **http://localhost:8000/docs** in your browser. Swagger UI lets you test every endpoint interactively — click an endpoint to expand it, fill in the parameters, and click **Execute** to send a real request. For authenticated endpoints, click the **Authorize** button at the top of the page and paste a JWT token (obtained from the login endpoint) to attach it to all subsequent requests.

### Example curl commands

**1. Register a user:**

```bash
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "alice",
    "email": "alice@example.com",
    "password": "SecurePass123",
    "full_name": "Alice Johnson"
  }'
```

Response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer"
}
```

**2. Login (get a token):**

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=alice@example.com&password=SecurePass123"
```

Save the `access_token` value for the next commands:

```bash
TOKEN="eyJhbGciOiJIUzI1NiIs..."
```

**3. Create a task (with token):**

```bash
curl -X POST http://localhost:8000/api/tasks/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "Set up CI/CD pipeline",
    "description": "Configure GitHub Actions for automated testing and deployment",
    "priority": "high",
    "status": "todo"
  }'
```

**4. List tasks:**

```bash
curl http://localhost:8000/api/tasks/?status=todo&priority=high&page=1&limit=10
```

Response:

```json
{
  "tasks": [
    {
      "id": "6620f1a...",
      "title": "Set up CI/CD pipeline",
      "description": "Configure GitHub Actions for automated testing and deployment",
      "status": "todo",
      "priority": "high",
      "assigned_to": null,
      "due_date": null,
      "created_by": "6620f19...",
      "created_at": "2026-04-02T10:30:00Z",
      "updated_at": "2026-04-02T10:30:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 10
}
```

---

**Next:** [06-frontend.md](06-frontend.md) — Build the Next.js frontend.
