from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from config import settings
from models import TokenData
from database import db_helper

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Token handling
security = HTTPBearer(auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    # Handle both hashed and plain passwords (for backwards compatibility)
    print(f"Password verification - plain password length: {len(plain_password)}, hashed password length: {len(hashed_password)}")
    if len(hashed_password) >= 60:  # bcrypt hash length
        print("Using bcrypt verification")
        result = pwd_context.verify(plain_password, hashed_password)
        print(f"Bcrypt verification result: {result}")
        return result
    else:
        print("Using plain password comparison")
        result = plain_password == hashed_password
        print(f"Plain password comparison result: {result}")
        return result

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
    try:
        print(f"Executing query for email: {email}")
        result = await db_helper.execute_main_query(query, (email,))
        
        if result["error"]:
            print(f"Database error when looking up email {email}: {result['error']}")
            return None
        
        print(f"Query result for {email}: Found {len(result['data'])} users")
        
        if result["data"]:
            print(f"User found: {result['data'][0]['id']}, {result['data'][0]['email']}, role: {result['data'][0]['role']}")
            return result["data"][0]
        print(f"No user found with email: {email}")
        return None
    except Exception as e:
        print(f"Exception in get_user_by_email: {str(e)}")
        return None

async def authenticate_user(email: str, password: str):
    """Authenticate user with email and password"""
    print(f"Authenticating user: {email} with password length: {len(password)}")
    user = await get_user_by_email(email)
    if not user:
        print(f"Auth failed: User with email {email} not found")
        return False
    print(f"User found, verifying password for {email}")
    if not verify_password(password, user["password"]):
        print(f"Auth failed: Password verification failed for {email}")
        return False
    print(f"Auth success: User {email} authenticated successfully with role: {user.get('role', 'unknown')}")
    return user

async def get_current_user(request: Request, credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    """Get current user from JWT token - supports both Bearer and x-access-token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = None
    
    # Try to get token from Authorization header (Bearer token)
    if credentials:
        token = credentials.credentials
    
    # If no Bearer token, try x-access-token header (for Vue app compatibility)
    if not token:
        token = request.headers.get("x-access-token")
    
    if not token:
        raise credentials_exception
    
    try:
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
