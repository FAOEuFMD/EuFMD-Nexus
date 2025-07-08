from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from models import ResponseModel
from auth import get_current_user
from database import db_helper

router = APIRouter(prefix="/api/LOA", tags=["LOA"])

@router.get("/")
async def get_loas(current_user: dict = Depends(get_current_user)):
    """Get all LOAs"""
    try:
        # First, try to create the table if it doesn't exist (matching Vue structure)
        create_table_query = """
        CREATE TABLE IF NOT EXISTS LOAs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            `group` VARCHAR(255),
            responsible VARCHAR(255),
            supplier VARCHAR(255),
            start_date DATE,
            end_date DATE,
            description TEXT,
            PO VARCHAR(255),
            FO VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        await db_helper.execute_main_query(create_table_query)
        
        # Then get all LOAs
        result = await db_helper.execute_main_query("SELECT * FROM LOAs ORDER BY id DESC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        # Format dates for frontend
        data = result["data"]
        for item in data:
            if item.get('start_date'):
                item['start_date'] = item['start_date'].strftime('%Y-%m-%d') if hasattr(item['start_date'], 'strftime') else str(item['start_date'])
            if item.get('end_date'):
                item['end_date'] = item['end_date'].strftime('%Y-%m-%d') if hasattr(item['end_date'], 'strftime') else str(item['end_date'])
        
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add", response_model=ResponseModel)
async def add_loa(
    loa_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Add new LOA"""
    try:
        # Ensure the table exists
        create_table_query = """
        CREATE TABLE IF NOT EXISTS LOAs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            `group` VARCHAR(255),
            responsible VARCHAR(255),
            supplier VARCHAR(255),
            start_date DATE,
            end_date DATE,
            description TEXT,
            PO VARCHAR(255),
            FO VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        await db_helper.execute_main_query(create_table_query)
        
        required_fields = ['group', 'responsible', 'supplier', 'start_date', 'end_date', 'description', 'PO', 'FO']
        
        # Validate required fields
        for field in required_fields:
            if field not in loa_data:
                raise HTTPException(status_code=400, detail=f"Missing required field: {field}")
        
        # Insert new LOA using the correct table name and structure
        query = """
            INSERT INTO LOAs (`group`, responsible, supplier, start_date, end_date, description, PO, FO)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        values = [
            loa_data['group'],
            loa_data['responsible'],
            loa_data['supplier'],
            loa_data['start_date'],
            loa_data['end_date'],
            loa_data['description'],
            loa_data['PO'],
            loa_data['FO']
        ]
        
        result = await db_helper.execute_main_query(query, values)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return ResponseModel(
            message="LOA added successfully",
            data={"id": result.get("lastrowid")}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/update/{loa_id}", response_model=ResponseModel)
async def update_loa(
    loa_id: int,
    changes: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update existing LOA"""
    try:
        if not changes:
            raise HTTPException(status_code=400, detail="No changes provided")
        
        # Build dynamic update query
        set_clauses = []
        values = []
        
        allowed_fields = ['group', 'responsible', 'supplier', 'start_date', 'end_date', 'description', 'PO', 'FO']
        
        for field, value in changes.items():
            if field in allowed_fields:
                if field == 'group':
                    set_clauses.append("`group` = %s")
                else:
                    set_clauses.append(f"{field} = %s")
                values.append(value)
        
        if not set_clauses:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        query = f"UPDATE LOAs SET {', '.join(set_clauses)} WHERE id = %s"
        values.append(loa_id)
        
        result = await db_helper.execute_main_query(query, values)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return ResponseModel(
            message="LOA updated successfully",
            data={"id": loa_id}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{loa_id}", response_model=ResponseModel)
async def delete_loa(
    loa_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete LOA"""
    try:
        result = await db_helper.execute_main_query(
            "DELETE FROM LOAs WHERE id = %s", [loa_id]
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return ResponseModel(
            message="LOA deleted successfully",
            data={"id": loa_id}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))
