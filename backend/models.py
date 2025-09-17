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
    FMD: int
    PPR: int
    LSD: int
    RVF: int
    SPGP: int
    date: str

class DiseaseStatusCreate(BaseModel):
    country_id: int
    FMD: int
    PPR: int
    LSD: int
    RVF: int
    SPGP: int
    date: str

class MitigationMeasure(BaseModel):
    id: Optional[int] = None
    country_id: int
    FMD: int
    PPR: int
    LSD: int
    RVF: int
    SPGP: int
    date: str

class MitigationMeasureCreate(BaseModel):
    country_id: int
    FMD: int
    PPR: int
    LSD: int
    RVF: int
    SPGP: int
    date: str

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
    Area: Optional[str] = None
    RMM: Optional[str] = None  # Roadmap Region
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
    regions: List[str]
    stages: List[str]
    pso_support: List[str]

# Training Models
class TrainingEntry(BaseModel):
    id: Optional[int] = None
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    level: Optional[str] = None

class NonMoodleCourse(BaseModel):
    id: Optional[int] = None
    shortname: str
    fullname: str
    start_date: str
    language: str
    format: str
    main_topic: str
    level: str
    edition: int
    duration: int

class NonMoodleCourseCreate(BaseModel):
    shortname: str
    fullname: str
    start_date: str
    language: str
    format: str
    main_topic: str
    level: str
    edition: int
    duration: int

class NonMoodleEnrollment(BaseModel):
    id: Optional[int] = None
    course_shortname: str
    user_fullname: str
    email: str
    country: str
    completion_date: str
    progress: int
    status: str

class NonMoodleEnrollmentCreate(BaseModel):
    course_shortname: str
    user_fullname: str
    email: str
    country: str
    completion_date: str
    progress: int
    status: str

class CourseShortname(BaseModel):
    shortname: str

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

# Feedback Models
class FeedbackCreate(BaseModel):
    score: int  # 1 to 10 scale
    comment: Optional[str] = None
    page: Optional[str] = None
    country: Optional[str] = None
    user_id: Optional[int] = None

class Feedback(BaseModel):
    id: int
    score: int
    comment: Optional[str] = None
    page: Optional[str] = None
    country: Optional[str] = None
    user_id: Optional[int] = None
    
    class Config:
        from_attributes = True
