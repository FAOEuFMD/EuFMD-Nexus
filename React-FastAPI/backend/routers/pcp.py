from fastapi import APIRouter, HTTPException, Depends, status
from typing import List
from models import PCPEntry, PCPEntryCreate, PCPUniqueValues, ResponseModel
from auth import get_current_user
from database import db_helper

router = APIRouter(prefix="/api/pcp", tags=["pcp"])

@router.get("/", response_model=List[PCPEntry])
async def get_pcp_data(current_user: dict = Depends(get_current_user)):
    """Get all PCP data"""
    try:
        result = await db_helper.execute_pcp_query("SELECT * FROM PCP.PCP_DB")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add", response_model=ResponseModel)
async def add_pcp_entry(
    pcp_entry: PCPEntryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add or update PCP entry"""
    try:
        # Check if record exists
        check_query = "SELECT * FROM PCP.PCP_DB WHERE Country = %s AND Year = %s"
        existing_result = await db_helper.execute_pcp_query(
            check_query, 
            (pcp_entry.Country, pcp_entry.Year)
        )
        
        if existing_result["error"]:
            raise HTTPException(status_code=500, detail=existing_result["error"])
        
        last_meeting_value = pcp_entry.Last_RMM_held
        
        if existing_result["data"]:
            # Update existing record
            update_query = """
                UPDATE PCP.PCP_DB 
                SET PCP_Stage = %s, `Last meeting attended` = %s, `PSO support` = %s
                WHERE Country = %s AND Year = %s
            """
            result = await db_helper.execute_pcp_query(
                update_query,
                (pcp_entry.PCP_Stage, last_meeting_value, pcp_entry.psoSupport, 
                 pcp_entry.Country, pcp_entry.Year)
            )
            
            if result["error"]:
                raise HTTPException(status_code=400, detail=result["error"])
            
            return {
                "status": "updated",
                "message": "PCP entry updated successfully"
            }
        else:
            # Insert new record
            insert_query = """
                INSERT INTO PCP.PCP_DB (Country, Year, PCP_Stage, `Last meeting attended`, `PSO support`)
                VALUES (%s, %s, %s, %s, %s)
            """
            result = await db_helper.execute_pcp_query(
                insert_query,
                (pcp_entry.Country, pcp_entry.Year, pcp_entry.PCP_Stage, 
                 last_meeting_value, pcp_entry.psoSupport)
            )
            
            if result["error"]:
                raise HTTPException(status_code=400, detail=result["error"])
            
            return {
                "status": "created",
                "message": "PCP entry created successfully"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/unique-values", response_model=PCPUniqueValues)
async def get_unique_values(current_user: dict = Depends(get_current_user)):
    """Get unique countries and stages from PCP database"""
    try:
        # Get unique countries
        countries_result = await db_helper.execute_pcp_query(
            "SELECT DISTINCT Country FROM PCP.PCP_DB ORDER BY Country"
        )
        
        # Get unique stages
        stages_result = await db_helper.execute_pcp_query(
            "SELECT DISTINCT PCP_Stage FROM PCP.PCP_DB ORDER BY PCP_Stage"
        )
        
        if countries_result["error"] or stages_result["error"]:
            error_msg = countries_result["error"] or stages_result["error"]
            raise HTTPException(status_code=500, detail=error_msg)
        
        countries = [row["Country"] for row in countries_result["data"] if row["Country"]]
        stages = [row["PCP_Stage"] for row in stages_result["data"] if row["PCP_Stage"]]
        
        return {
            "countries": countries,
            "stages": stages
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching unique values: {str(e)}")

@router.delete("/{entry_id}", response_model=ResponseModel)
async def delete_pcp_entry(
    entry_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete PCP entry by ID"""
    try:
        result = await db_helper.execute_pcp_query(
            "DELETE FROM PCP.PCP_DB WHERE id = %s",
            (entry_id,)
        )
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {
            "status": "deleted",
            "message": "PCP entry deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
