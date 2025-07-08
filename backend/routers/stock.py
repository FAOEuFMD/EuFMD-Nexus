from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from models import ResponseModel
from auth import get_current_user
from database import db_helper

router = APIRouter(prefix="/api/stock", tags=["stock"])

@router.get("/")
async def get_stocks(current_user: dict = Depends(get_current_user)):
    """Get all stock entries"""
    try:
        query = "SELECT * FROM stock_entry"
        result = await db_helper.execute_main_query(query)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add", response_model=ResponseModel)
async def add_stock_entry(
    request_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Add new stock entry"""
    try:
        loa_dp = request_data.get("LOA_DP")
        supplier = request_data.get("supplier")
        po = request_data.get("PO")
        product = request_data.get("product")
        serotype = request_data.get("serotype")
        quantity = request_data.get("quantity")
        purchase_date = request_data.get("purchase_date")
        expiry_date = request_data.get("expiry_date")
        notes = request_data.get("notes")

        insert_query = """
        INSERT INTO stock_entry (
            `LOA/DP`, supplier, PO, product, serotype, quantity,
            purchase_date, expiry_date, notes
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        params = (loa_dp, supplier, po, product, serotype, quantity, purchase_date, expiry_date, notes)
        result = await db_helper.execute_main_query(insert_query, params)
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return {"message": "Stock entry created successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/update/{stock_id}")
async def update_stock_entry(
    stock_id: int,
    changes: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update stock entry by ID"""
    try:
        # Build update query dynamically based on provided changes
        set_clauses = []
        params = []
        
        for key, value in changes.items():
            if key in ['quantity', 'LOA_DP', 'supplier', 'PO', 'product', 'serotype', 'purchase_date', 'expiry_date', 'notes']:
                if key == 'quantity':
                    # For quantity updates, we typically want to add to existing quantity
                    set_clauses.append("quantity = quantity + %s")
                elif key == 'LOA_DP':
                    # Handle the special column name with slash
                    set_clauses.append("`LOA/DP` = %s")
                else:
                    set_clauses.append(f"{key} = %s")
                params.append(value)
        
        if not set_clauses:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        params.append(stock_id)
        update_query = f"UPDATE stock_entry SET {', '.join(set_clauses)} WHERE id = %s"
        
        result = await db_helper.execute_main_query(update_query, tuple(params))
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return {"message": "Stock entry updated successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{stock_id}")
async def delete_stock_entry(
    stock_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete stock entry by ID"""
    try:
        # Check if entry exists
        search_query = "SELECT * FROM stock_entry WHERE id = %s"
        search_result = await db_helper.execute_main_query(search_query, (stock_id,))
        
        if search_result["error"]:
            raise HTTPException(status_code=500, detail=search_result["error"])
            
        if not search_result["data"]:
            raise HTTPException(status_code=404, detail="Stock entry not found")

        # Delete the entry
        delete_query = "DELETE FROM stock_entry WHERE id = %s"
        delete_result = await db_helper.execute_main_query(delete_query, (stock_id,))
        
        if delete_result["error"]:
            raise HTTPException(status_code=400, detail=delete_result["error"])

        return {"message": "Stock entry deleted successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{stock_id}")
async def get_stock_entry(
    stock_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get stock entry by ID"""
    try:
        query = "SELECT * FROM stock_entry WHERE id = %s"
        result = await db_helper.execute_main_query(query, (stock_id,))
        
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
            
        if not result["data"]:
            raise HTTPException(status_code=404, detail=f"Stock entry with ID {stock_id} not found")

        return result["data"][0]
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
