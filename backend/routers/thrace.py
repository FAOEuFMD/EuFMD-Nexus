from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from database import DatabaseHelper
from auth import get_current_user

router = APIRouter(prefix="/api/thrace", tags=["thrace"])

@router.get("/inspectors")
async def get_inspectors(current_user: dict = Depends(get_current_user)):
    """
    Get inspectors for the current user's country from thrace_inspectors table
    """
    user_country = current_user.get("country")
    if not user_country:
        raise HTTPException(status_code=400, detail="User country not set")
    
    try:
        query = """
            SELECT id, name, country 
            FROM thrace_inspectors 
            WHERE country = :country
            ORDER BY name
        """
        
        result = await DatabaseHelper.execute_main_query(
            query, 
            {"country": user_country}
        )
        
        inspectors = []
        for row in result:
            inspectors.append({
                "id": row[0],
                "name": row[1],
                "country": row[2]
            })
        
        return {"inspectors": inspectors}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching inspectors: {str(e)}")
