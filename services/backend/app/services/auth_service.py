# services/backend/app/services/auth_service.py

from datetime import datetime, timezone
from fastapi import HTTPException, status
from app import database
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
    if await database.users_collection.find_one({"email": user_data["email"]}):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check for existing username
    if await database.users_collection.find_one({"username": user_data["username"]}):
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

    result = await database.users_collection.insert_one(user_doc)
    user_id = str(result.inserted_id)

    token = create_access_token(data={"sub": user_id, "username": user_doc["username"]})
    return {"access_token": token, "token_type": "bearer"}


async def authenticate_user(email: str, password: str) -> dict:
    """
    Authenticate a user by email and password.
    Returns an access token on success, raises 401 on failure.
    """
    user = await database.users_collection.find_one({"email": email})
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
