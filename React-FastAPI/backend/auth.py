from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import settings
from models import TokenData
from database import db_helper

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Token handling
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    # Handle both hashed and plain passwords (for backwards compatibility)
    if len(hashed_password) >= 60:  # bcrypt hash length
        return pwd_context.verify(plain_password, hashed_password)
    else:
        return plain_password == hashed_password

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.super_secret, algorithm=settings.algorithm)
    return encoded_jwt

async def get_user_by_email(email: str):
    """Get user by email from database"""
    query = "SELECT * FROM users WHERE email = %s"
    result = await db_helper.execute_main_query(query, (email,))
    
    if result["error"]:
        return None
    
    if result["data"]:
        return result["data"][0]
    return None

async def authenticate_user(email: str, password: str):
    """Authenticate user with email and password"""
    user = await get_user_by_email(email)
    if not user:
        return False
    if not verify_password(password, user["password"]):
        return False
    return user

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current user from JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        token = credentials.credentials
        payload = jwt.decode(token, settings.super_secret, algorithms=[settings.algorithm])
        user_id: int = payload.get("user_id")
        user_role: str = payload.get("user_role")
        country: str = payload.get("country")
        
        if user_id is None:
            raise credentials_exception
            
        token_data = TokenData(user_id=user_id, user_role=user_role, country=country)
    except JWTError:
        raise credentials_exception
    
    # Get user from database
    query = "SELECT id, name, email, role, country FROM users WHERE id = %s"
    result = await db_helper.execute_main_query(query, (user_id,))
    
    if result["error"] or not result["data"]:
        raise credentials_exception
    
    user = result["data"][0]
    user["user_id"] = user["id"]
    user["user_role"] = user["role"]
    
    return user

def require_auth(func):
    """Decorator to require authentication"""
    async def wrapper(*args, **kwargs):
        return await func(*args, **kwargs)
    return wrapper
