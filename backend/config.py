from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Database Configuration
    db_host: str
    db_user: str
    db_pass: str
    db_name: str
    db2_name: str
    
    # Security
    secret_key: str
    super_secret: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 43200  # 30 days
    
    # Environment
    node_env: str = "development"
    
    # CORS
    allowed_origins: List[str] = ["http://nexus.eufmd-tom.com:8080", "http://13.49.235.70:8080","http://localhost:3000", "http://127.0.0.1:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = False
        env_file_encoding = 'utf-8'
        # This ensures environment variables take precedence over .env file

settings = Settings()
