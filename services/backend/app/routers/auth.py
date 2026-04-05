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
