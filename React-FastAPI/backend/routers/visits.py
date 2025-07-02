from fastapi import APIRouter, HTTPException, Depends, status
from models import ResponseModel
from auth import get_current_user
from database import db_helper

router = APIRouter(prefix="/api/visits", tags=["visits"])

@router.get("/")
async def get_visits(current_user: dict = Depends(get_current_user)):
    """Get all visits"""
    try:
        result = await db_helper.execute_main_query("SELECT * FROM visits ORDER BY visit_date DESC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/user/{user_id}")
async def get_user_visits(
    user_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get visits for a specific user"""
    try:
        result = await db_helper.execute_main_query(
            "SELECT * FROM visits WHERE user_id = %s ORDER BY visit_date DESC",
            (user_id,)
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/schedule", response_model=ResponseModel)
async def schedule_visit(
    visit_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Schedule a new visit"""
    try:
        fields = [
            'user_id', 'visit_type', 'location', 'visit_date', 
            'purpose', 'status', 'created_at'
        ]
        values = [
            current_user["id"],
            visit_data.get("visit_type"),
            visit_data.get("location"),
            visit_data.get("visit_date"),
            visit_data.get("purpose"),
            visit_data.get("status", "scheduled"),
            "NOW()"
        ]
        
        placeholders = ["%s"] * (len(values) - 1) + ["NOW()"]
        
        query = f"INSERT INTO visits ({', '.join(fields)}) VALUES ({', '.join(placeholders)})"
        result = await db_helper.execute_main_query(query, tuple(values[:-1]))
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {"message": "Visit scheduled successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{visit_id}/status", response_model=ResponseModel)
async def update_visit_status(
    visit_id: int,
    status_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update visit status"""
    try:
        new_status = status_data.get("status")
        
        result = await db_helper.execute_main_query(
            "UPDATE visits SET status = %s, updated_at = NOW() WHERE id = %s",
            (new_status, visit_id)
        )
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {"message": "Visit status updated successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
