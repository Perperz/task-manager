# services/backend/app/services/task_service.py

from datetime import datetime, timezone
from bson import ObjectId
from fastapi import HTTPException, status
from app import database


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
    result = await database.tasks_collection.insert_one(task_doc)
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

    total = await database.tasks_collection.count_documents(query)
    skip = (page - 1) * limit

    cursor = database.tasks_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    tasks = [_task_to_dict(doc) async for doc in cursor]

    return {"tasks": tasks, "total": total, "page": page, "limit": limit}


async def get_task_by_id(task_id: str) -> dict:
    """Return a single task or raise 404."""
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid task ID")

    task = await database.tasks_collection.find_one({"_id": ObjectId(task_id)})
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return _task_to_dict(task)


async def update_task(task_id: str, update_data: dict, user: dict) -> dict:
    """Update a task. Only the owner or an admin may update."""
    task = await get_task_by_id(task_id)

    if task["created_by"] != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    update_data["updated_at"] = datetime.now(timezone.utc)

    await database.tasks_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": update_data},
    )

    updated = await database.tasks_collection.find_one({"_id": ObjectId(task_id)})
    return _task_to_dict(updated)


async def delete_task(task_id: str, user: dict) -> dict:
    """Delete a task. Only the owner or an admin may delete."""
    task = await get_task_by_id(task_id)

    if task["created_by"] != user["_id"] and user.get("role") != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    await database.tasks_collection.delete_one({"_id": ObjectId(task_id)})
    return {"message": "Task deleted successfully"}
