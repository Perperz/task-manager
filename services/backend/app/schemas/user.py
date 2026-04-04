from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, EmailStr, ConfigDict


class UserCreate(BaseModel):
    """Schema for creating a new user (registration request body)."""
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100)
    full_name: Optional[str] = None


class UserResponse(BaseModel):
    """Schema for returning user data to clients. Never includes password_hash."""
    id: str = Field(..., alias="_id")
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    role: str = "user"
    is_active: bool = True
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
    )


class UserInDB(UserResponse):
    """Schema for internal use — includes the hashed password."""
    password_hash: str


class Token(BaseModel):
    """Schema for the JWT token response."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Schema for decoded JWT token payload."""
    user_id: Optional[str] = None
