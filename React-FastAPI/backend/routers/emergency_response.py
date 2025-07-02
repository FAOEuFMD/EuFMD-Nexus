from fastapi import APIRouter, HTTPException, Depends, status
from models import ResponseModel
from auth import get_current_user
from database import db_helper

router = APIRouter(prefix="/api/emergency-response", tags=["emergency-response"])

@router.get("/")
async def get_emergency_response_data(current_user: dict = Depends(get_current_user)):
    """Get emergency response data"""
    try:
        result = await db_helper.execute_main_query("SELECT * FROM emergency_responses ORDER BY created_at DESC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/protocols")
async def get_emergency_protocols(current_user: dict = Depends(get_current_user)):
    """Get emergency response protocols"""
    try:
        result = await db_helper.execute_main_query("SELECT * FROM emergency_protocols ORDER BY priority DESC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/contacts")
async def get_emergency_contacts(current_user: dict = Depends(get_current_user)):
    """Get emergency contacts"""
    try:
        result = await db_helper.execute_main_query("SELECT * FROM emergency_contacts ORDER BY priority DESC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/alert", response_model=ResponseModel)
async def create_emergency_alert(
    alert_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Create emergency alert"""
    try:
        fields = ['user_id', 'alert_type', 'severity', 'message', 'location', 'created_at']
        values = [
            current_user["id"],
            alert_data.get("alert_type"),
            alert_data.get("severity", "medium"),
            alert_data.get("message"),
            alert_data.get("location"),
            "NOW()"
        ]
        
        placeholders = ["%s"] * (len(values) - 1) + ["NOW()"]
        
        query = f"INSERT INTO emergency_alerts ({', '.join(fields)}) VALUES ({', '.join(placeholders)})"
        result = await db_helper.execute_main_query(query, tuple(values[:-1]))
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {"message": "Emergency alert created successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
