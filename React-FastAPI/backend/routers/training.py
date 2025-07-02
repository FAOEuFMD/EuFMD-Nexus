from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from models import TrainingEntry, ResponseModel
from auth import get_current_user
from database import db_helper

router = APIRouter(prefix="/api/training", tags=["training"])

@router.get("/", response_model=List[TrainingEntry])
async def get_training_data(current_user: dict = Depends(get_current_user)):
    """Get all training data"""
    try:
        result = await db_helper.execute_training_query("SELECT * FROM training_data ORDER BY name ASC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/competencies")
async def get_competencies(current_user: dict = Depends(get_current_user)):
    """Get training competencies"""
    try:
        result = await db_helper.execute_training_query(
            "SELECT * FROM competencies ORDER BY category, level"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/courses")
async def get_courses(current_user: dict = Depends(get_current_user)):
    """Get available courses"""
    try:
        result = await db_helper.execute_training_query(
            "SELECT * FROM courses ORDER BY title"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user-progress/{user_id}")
async def get_user_progress(
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get training progress for a specific user"""
    try:
        result = await db_helper.execute_training_query(
            "SELECT * FROM user_progress WHERE user_id = %s",
            (user_id,)
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/enroll", response_model=ResponseModel)
async def enroll_in_course(
    course_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Enroll user in a course"""
    try:
        course_id = course_data.get("course_id")
        user_id = current_user["id"]
        
        # Check if already enrolled
        check_result = await db_helper.execute_training_query(
            "SELECT * FROM enrollments WHERE user_id = %s AND course_id = %s",
            (user_id, course_id)
        )
        
        if check_result["data"]:
            return {"message": "Already enrolled in this course", "status": "existing"}
        
        # Enroll user
        result = await db_helper.execute_training_query(
            "INSERT INTO enrollments (user_id, course_id, enrollment_date) VALUES (%s, %s, NOW())",
            (user_id, course_id)
        )
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {"message": "Successfully enrolled in course", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/progress", response_model=ResponseModel)
async def update_progress(
    progress_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update training progress"""
    try:
        user_id = current_user["id"]
        course_id = progress_data.get("course_id")
        progress_percentage = progress_data.get("progress", 0)
        
        # Update or insert progress
        result = await db_helper.execute_training_query(
            """INSERT INTO user_progress (user_id, course_id, progress_percentage, last_updated)
               VALUES (%s, %s, %s, NOW())
               ON DUPLICATE KEY UPDATE 
               progress_percentage = %s, last_updated = NOW()""",
            (user_id, course_id, progress_percentage, progress_percentage)
        )
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {"message": "Progress updated successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/certificates/{user_id}")
async def get_user_certificates(
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get certificates for a user"""
    try:
        result = await db_helper.execute_training_query(
            """SELECT c.*, cr.course_title, cr.completion_date 
               FROM certificates c
               JOIN course_completions cr ON c.completion_id = cr.id
               WHERE c.user_id = %s
               ORDER BY cr.completion_date DESC""",
            (user_id,)
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
