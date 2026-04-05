# services/backend/app/routers/users.py

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from bson import ObjectId
from app import database

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
    cursor = database.users_collection.find({}, {"hashed_password": 0})
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

    user = await database.users_collection.find_one(
        {"_id": ObjectId(user_id)},
        {"hashed_password": 0},
    )
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return _user_to_profile(user)
