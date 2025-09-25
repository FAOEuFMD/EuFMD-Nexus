from fastapi import APIRouter, HTTPException, status
from models import ResponseModel, FeedbackCreate
from database import db_helper
from datetime import datetime

router = APIRouter(prefix="/api/feedback", tags=["feedback"])

@router.post("/", response_model=ResponseModel)
async def create_feedback(feedback: FeedbackCreate):
    """
    Create a new feedback entry
    """
    try:
        # Insert feedback into database using the actual table structure
        query = """
            INSERT INTO feedback (score, comment, page, country, user_id)
            VALUES (%s, %s, %s, %s, %s)
        """
        
        params = (
            feedback.score,
            feedback.comment,
            feedback.page,
            feedback.country,
            feedback.user_id
        )
        
        result = await db_helper.execute_main_query(query, params)
        
        if result["error"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {result['error']}"
            )
        
        return ResponseModel(
            message="Feedback submitted successfully",
            data={"rows_affected": result["data"]},
            status="success"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating feedback: {str(e)}"
        )

@router.get("/")
async def get_feedback(page: str = None, limit: int = 100):
    """
    Get feedback entries (optional filtering by page name)
    """
    try:
        if page:
            query = """
                SELECT id, score, comment, page, country, user_id
                FROM feedback 
                WHERE page = %s
                ORDER BY id DESC
                LIMIT %s
            """
            params = (page, limit)
        else:
            query = """
                SELECT id, score, comment, page, country, user_id
                FROM feedback 
                ORDER BY id DESC
                LIMIT %s
            """
            params = (limit,)
        
        result = await db_helper.execute_main_query(query, params)
        
        if result["error"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {result['error']}"
            )
        
        return result["data"]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving feedback: {str(e)}"
        )

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
