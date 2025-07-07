from fastapi import APIRouter, HTTPException, Depends, status
from models import ResponseModel
from auth import get_current_user
from database import db_helper

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

@router.get("/")
async def get_feedback(current_user: dict = Depends(get_current_user)):
    """Get all feedback entries"""
    try:
        result = await db_helper.execute_main_query("SELECT * FROM feedback ORDER BY created_at DESC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/submit", response_model=ResponseModel)
async def submit_feedback(
    feedback_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Submit new feedback"""
    try:
        fields = ['user_id', 'subject', 'message', 'category', 'rating', 'created_at']
        values = [
            current_user["id"],
            feedback_data.get("subject"),
            feedback_data.get("message"),
            feedback_data.get("category", "general"),
            feedback_data.get("rating"),
            "NOW()"
        ]
        
        placeholders = ["%s"] * (len(values) - 1) + ["NOW()"]
        
        query = f"INSERT INTO feedback ({', '.join(fields)}) VALUES ({', '.join(placeholders)})"
        result = await db_helper.execute_main_query(query, tuple(values[:-1]))
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {"message": "Feedback submitted successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/categories")
async def get_feedback_categories():
    """Get feedback categories"""
    return {
        "categories": [
            "general",
            "bug_report",
            "feature_request",
            "training",
            "rmt",
            "pcp",
            "diagnostic_support",
            "emergency_response"
        ]
    }
