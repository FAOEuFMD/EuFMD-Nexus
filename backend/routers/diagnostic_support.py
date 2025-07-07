from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Optional
from models import ResponseModel
from auth import get_current_user
from database import db_helper
from datetime import datetime

router = APIRouter(prefix="/api/diagnostic-support", tags=["diagnostic-support"])

def format_date_property(obj: dict, prop: str):
    """Helper function to format date properties"""
    if obj.get(prop):
        try:
            date_object = datetime.fromisoformat(str(obj[prop]).replace('Z', '+00:00'))
            obj[prop] = date_object.strftime('%Y-%m-%d')
        except:
            obj[prop] = None

def format_dates(data: List[dict]):
    """Format expiry_date and delivery_date for all entries"""
    for item in data:
        format_date_property(item, 'expiry_date')
        format_date_property(item, 'delivery_date')

@router.get("/")
async def get_diagnostic_support_data(
    PO: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get diagnostic support data with optional PO filtering"""
    try:
        query = """
        SELECT 
            diagnostic_support.*, 
            countries.name_un, 
            countries.lat, 
            countries.lon
        FROM 
            diagnostic_support
        INNER JOIN 
            countries 
        ON 
            diagnostic_support.country_id = countries.id
        """
        
        params = []
        if PO:
            query += " WHERE diagnostic_support.PO = %s"
            params.append(PO)
            
        result = await db_helper.execute_main_query(query, tuple(params) if params else None)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        data = result["data"]
        format_dates(data)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/countries/")
async def get_countries(current_user: dict = Depends(get_current_user)):
    """Get list of countries"""
    try:
        query = "SELECT * FROM countries ORDER BY name_un ASC"
        result = await db_helper.execute_main_query(query)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add", response_model=ResponseModel)
async def add_diagnostic_support_entry(
    request_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Add new diagnostic support entry"""
    try:
        # Extract data from request
        stock_id = request_data.get("stock_id")
        product = request_data.get("product")
        serotype = request_data.get("serotype")
        quantity = request_data.get("quantity")
        delivery_date = request_data.get("delivery_date")
        country_id = request_data.get("country_id")
        loa_dp = request_data.get("LOA/DP")
        supplier = request_data.get("supplier")
        description = request_data.get("description")
        po = request_data.get("PO")
        expiry_date = request_data.get("expiry_date")
        report_usage = request_data.get("report_usage")
        notes = request_data.get("notes")

        # Format dates
        request_data_copy = [request_data.copy()]
        format_dates(request_data_copy)
        formatted_delivery_date = request_data_copy[0].get("delivery_date")
        formatted_expiry_date = request_data_copy[0].get("expiry_date")

        # Insert into diagnostic_support table
        insert_query = """
        INSERT INTO diagnostic_support (
            stock_id, product, serotype, quantity, delivery_date, country_id,
            `LOA/DP`, supplier, description, PO, expiry_date, report_usage, notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        insert_params = (
            stock_id, product, serotype, quantity, formatted_delivery_date,
            country_id, loa_dp, supplier, description, po, formatted_expiry_date,
            report_usage, notes
        )
        
        result = await db_helper.execute_main_query(insert_query, insert_params)
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])

        # Update stock_entry table
        if stock_id and quantity:
            update_query = "UPDATE stock_entry SET quantity = quantity - %s WHERE id = %s"
            update_result = await db_helper.execute_main_query(update_query, (quantity, stock_id))
            if update_result["error"]:
                raise HTTPException(status_code=400, detail=f"Failed to update stock: {update_result['error']}")

        return {"message": "Diagnostic support entry created", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{entry_id}")
async def delete_diagnostic_support_entry(
    entry_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete diagnostic support entry by ID"""
    try:
        # First, check if entry exists
        search_query = "SELECT * FROM diagnostic_support WHERE id = %s"
        search_result = await db_helper.execute_main_query(search_query, (entry_id,))
        
        if search_result["error"]:
            raise HTTPException(status_code=500, detail=search_result["error"])
            
        if not search_result["data"]:
            raise HTTPException(status_code=404, detail="Diagnostic support entry not found")

        # Delete the entry
        delete_query = "DELETE FROM diagnostic_support WHERE id = %s"
        delete_result = await db_helper.execute_main_query(delete_query, (entry_id,))
        
        if delete_result["error"]:
            raise HTTPException(status_code=400, detail=delete_result["error"])

        return {"message": "Diagnostic support entry deleted", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{entry_id}")
async def get_diagnostic_support_entry(
    entry_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get diagnostic support entry by ID"""
    try:
        query = "SELECT * FROM diagnostic_support WHERE id = %s"
        result = await db_helper.execute_main_query(query, (entry_id,))
        
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
            
        if not result["data"]:
            raise HTTPException(status_code=404, detail=f"Diagnostic support with ID {entry_id} not found")

        data = result["data"]
        format_dates(data)
        return data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
