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
        
        # Transform field names from database format (with spaces) to model format (with underscores)
        transformed_data = []
        for row in result["data"]:
            transformed_row = {}
            for key, value in row.items():
                if key == "Last meeting attended":
                    transformed_row["Last_meeting_attended"] = value
                elif key == "PSO support":
                    transformed_row["PSO_support"] = value
                else:
                    transformed_row[key] = value
            transformed_data.append(transformed_row)
        
        return transformed_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add", response_model=ResponseModel)
async def add_pcp_entry(
    pcp_entry: PCPEntryCreate,
    current_user: dict = Depends(get_current_user)
):
    """Add or update PCP entry"""
    try:
        print(f"Received PCP entry data: {pcp_entry}")
        
        # Check if record exists
        check_query = "SELECT * FROM PCP.PCP_DB WHERE Country = %s AND Year = %s"
        existing_result = await db_helper.execute_pcp_query(
            check_query, 
            (str(pcp_entry.Country), str(pcp_entry.Year))
        )
        
        if existing_result["error"]:
            print(f"Error checking existing record: {existing_result['error']}")
            raise HTTPException(status_code=500, detail=existing_result["error"])
        
        last_meeting_value = pcp_entry.Last_RMM_held
        print(f"Last meeting value: {last_meeting_value}")
        print(f"PSO Support value: {pcp_entry.psoSupport}")
        
        if existing_result["data"]:
            print("Updating existing record")
            # Update existing record
            update_query = """
                UPDATE PCP.PCP_DB 
                SET PCP_Stage = %s, `Last meeting attended` = %s, `PSO support` = %s
                WHERE Country = %s AND Year = %s
            """
            result = await db_helper.execute_pcp_query(
                update_query,
                (str(pcp_entry.PCP_Stage), str(last_meeting_value), str(pcp_entry.psoSupport), 
                 str(pcp_entry.Country), str(pcp_entry.Year))
            )
            
            if result["error"]:
                print(f"Error updating record: {result['error']}")
                raise HTTPException(status_code=400, detail=result["error"])
            
            return {
                "status": "updated",
                "message": "PCP entry updated successfully"
            }
        else:
            print("Inserting new record")
            # Insert new record
            insert_query = """
                INSERT INTO PCP.PCP_DB (Country, Year, PCP_Stage, `Last meeting attended`, `PSO support`)
                VALUES (%s, %s, %s, %s, %s)
            """
            print(f"Insert query: {insert_query}")
            print(f"Insert values: {(pcp_entry.Country, pcp_entry.Year, pcp_entry.PCP_Stage, last_meeting_value, pcp_entry.psoSupport)}")
            
            result = await db_helper.execute_pcp_query(
                insert_query,
                (str(pcp_entry.Country), str(pcp_entry.Year), str(pcp_entry.PCP_Stage), 
                 str(last_meeting_value), str(pcp_entry.psoSupport))
            )
            
            if result["error"]:
                print(f"Error inserting record: {result['error']}")
                raise HTTPException(status_code=400, detail=result["error"])
            
            return {
                "status": "created",
                "message": "PCP entry created successfully"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Exception in add_pcp_entry: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/unique-values", response_model=PCPUniqueValues)
async def get_unique_values(current_user: dict = Depends(get_current_user)):
    """Get unique countries, regions, and stages from PCP database"""
    try:
        # Get unique countries
        countries_result = await db_helper.execute_pcp_query(
            "SELECT DISTINCT Country FROM PCP.PCP_DB WHERE Country IS NOT NULL ORDER BY Country"
        )
        
        # Get unique regions (RMM)
        regions_result = await db_helper.execute_pcp_query(
            "SELECT DISTINCT RMM FROM PCP.PCP_DB WHERE RMM IS NOT NULL ORDER BY RMM"
        )
        
        # Get unique stages
        stages_result = await db_helper.execute_pcp_query(
            "SELECT DISTINCT PCP_Stage FROM PCP.PCP_DB WHERE PCP_Stage IS NOT NULL ORDER BY PCP_Stage"
        )
        
        # Get unique PSO support values
        pso_result = await db_helper.execute_pcp_query(
            "SELECT DISTINCT `PSO support` FROM PCP.PCP_DB WHERE `PSO support` IS NOT NULL ORDER BY `PSO support`"
        )
        
        if (countries_result["error"] or regions_result["error"] or 
            stages_result["error"] or pso_result["error"]):
            error_msg = (countries_result["error"] or regions_result["error"] or 
                        stages_result["error"] or pso_result["error"])
            raise HTTPException(status_code=500, detail=error_msg)
        
        countries = [row["Country"] for row in countries_result["data"] if row["Country"]]
        regions = [row["RMM"] for row in regions_result["data"] if row["RMM"]]
        stages = [row["PCP_Stage"] for row in stages_result["data"] if row["PCP_Stage"]]
        pso_support = [row["PSO support"] for row in pso_result["data"] if row["PSO support"]]
        
        return {
            "countries": countries,
            "regions": regions,
            "stages": stages,
            "pso_support": pso_support
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
