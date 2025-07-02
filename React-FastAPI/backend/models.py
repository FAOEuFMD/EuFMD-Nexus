from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# User Models
class UserBase(BaseModel):
    name: str
    email: EmailStr
    country: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: int
    role: Optional[str] = None
    
    class Config:
        from_attributes = True

class UserInDB(User):
    password: str

# Token Models
class Token(BaseModel):
    access_token: str
    token_type: str
    user_id: int
    user_role: Optional[str] = None
    country: Optional[str] = None

class TokenData(BaseModel):
    user_id: Optional[int] = None
    user_role: Optional[str] = None
    country: Optional[str] = None

# RMT Models
class Country(BaseModel):
    id: int
    iso3: str
    name_un: str
    subregion: str

class Region(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

class DiseaseStatus(BaseModel):
    id: Optional[int] = None
    country_id: int
    disease: str
    status: str
    date_reported: Optional[datetime] = None
    score: Optional[float] = None

class DiseaseStatusCreate(BaseModel):
    country_id: int
    disease: str
    status: str
    score: Optional[float] = None

class MitigationMeasure(BaseModel):
    id: Optional[int] = None
    country_id: int
    measure: str
    status: str
    date_implemented: Optional[datetime] = None
    score: Optional[float] = None

class MitigationMeasureCreate(BaseModel):
    country_id: int
    measure: str
    status: str
    score: Optional[float] = None

class RiskScore(BaseModel):
    id: Optional[int] = None
    country_id: int
    risk_type: str
    score: float
    date_calculated: Optional[datetime] = None

# PCP Models
class PCPEntry(BaseModel):
    id: Optional[int] = None
    Country: str
    Year: int
    PCP_Stage: Optional[str] = None
    Last_meeting_attended: Optional[str] = None
    PSO_support: Optional[str] = None

class PCPEntryCreate(BaseModel):
    Country: str
    Year: int
    PCP_Stage: Optional[str] = None
    Last_RMM_held: Optional[str] = None
    psoSupport: Optional[str] = None

class PCPUniqueValues(BaseModel):
    countries: List[str]
    stages: List[str]

# Training Models
class TrainingEntry(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    level: Optional[str] = None

# Fast Report Models
class FastReportEntry(BaseModel):
    id: Optional[int] = None
    Year: Optional[int] = None
    Quarter: Optional[int] = None
    Report_Date: Optional[str] = None
    Region: Optional[str] = None
    Country: Optional[str] = None
    Disease: Optional[str] = None
    Outbreaks: Optional[str] = None
    Cases: Optional[str] = None
    Outbreak_Description: Optional[str] = None
    Epidemiological_Information: Optional[str] = None
    Surveillance: Optional[int] = None
    Vaccination: Optional[int] = None
    Vaccination_Doses: Optional[int] = None
    Vaccination_Description: Optional[str] = None
    Other_Info: Optional[str] = None
    Source: Optional[str] = None

# Generic Response Models
class ResponseModel(BaseModel):
    message: str
    data: Optional[Any] = None
    status: Optional[str] = None

class ErrorModel(BaseModel):
    message: str
    error: Optional[str] = None
