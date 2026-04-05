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
