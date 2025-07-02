from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from models import ResponseModel
from auth import get_current_user
from database import db_helper

router = APIRouter(prefix="/api/diagnostic-support", tags=["diagnostic-support"])

@router.get("/")
async def get_diagnostic_support_data(current_user: dict = Depends(get_current_user)):
    """Get diagnostic support data"""
    try:
        result = await db_helper.execute_main_query("SELECT * FROM diagnostic_support ORDER BY created_at DESC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/laboratories")
async def get_laboratories(current_user: dict = Depends(get_current_user)):
    """Get laboratory information"""
    try:
        result = await db_helper.execute_main_query("SELECT * FROM laboratories ORDER BY name ASC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/diagnostic-tests")
async def get_diagnostic_tests(current_user: dict = Depends(get_current_user)):
    """Get available diagnostic tests"""
    try:
        result = await db_helper.execute_main_query("SELECT * FROM diagnostic_tests ORDER BY test_name ASC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/request", response_model=ResponseModel)
async def create_diagnostic_request(
    request_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create new diagnostic support request"""
    try:
        fields = ['user_id', 'sample_type', 'test_requested', 'urgency', 'description', 'created_at']
        values = [
            current_user["id"],
            request_data.get("sample_type"),
            request_data.get("test_requested"),
            request_data.get("urgency", "normal"),
            request_data.get("description"),
            "NOW()"
        ]
        
        placeholders = ["%s"] * (len(values) - 1) + ["NOW()"]
        
        query = f"INSERT INTO diagnostic_requests ({', '.join(fields)}) VALUES ({', '.join(placeholders)})"
        result = await db_helper.execute_main_query(query, tuple(values[:-1]))
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {"message": "Diagnostic request created successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
