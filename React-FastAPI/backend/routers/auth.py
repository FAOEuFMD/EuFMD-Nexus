from fastapi import APIRouter, HTTPException, Depends, status
from models import UserLogin, Token, User, ResponseModel
from auth import authenticate_user, create_access_token, get_current_user
from database import db_helper
from datetime import timedelta
from config import settings

router = APIRouter(prefix="/api/auth", tags=["authentication"])

@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin):
    """Login endpoint - authenticates user and returns JWT token"""
    user = await authenticate_user(user_credentials.email, user_credentials.password)
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "user_id": user["id"],
            "user_role": user.get("role"),
            "country": user.get("country")
        },
        expires_delta=access_token_expires
    )
    
    # Update last login (optional, similar to Vue backend)
    # await db_helper.execute_main_query(
    #     "UPDATE users SET last_login=NOW() WHERE id=%s", (user["id"],)
    # )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user["id"],
        "user_role": user.get("role"),
        "country": user.get("country")
    }

@router.get("/profile", response_model=User)
async def get_profile(current_user: dict = Depends(get_current_user)):
    """Get current user profile"""
    return {
        "id": current_user["id"],
        "name": current_user["name"],
        "email": current_user["email"],
        "role": current_user.get("role"),
        "country": current_user.get("country")
    }

@router.put("/logout", response_model=ResponseModel)
async def logout(current_user: dict = Depends(get_current_user)):
    """Logout endpoint - updates logout time in database"""
    try:
        await db_helper.execute_main_query(
            "UPDATE users SET last_logout=NOW() WHERE id=%s", 
            (current_user["id"],)
        )
        return {"message": "Logout time stored.", "status": "success"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
