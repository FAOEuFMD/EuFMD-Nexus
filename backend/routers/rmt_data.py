from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional, Dict, Any
from models import (
    ResponseModel, DiseaseStatus, DiseaseStatusCreate, 
    MitigationMeasure, MitigationMeasureCreate,
    Connections, ConnectionsCreate
)
from database import db_helper
from auth import get_current_user

router = APIRouter(prefix="/api/rmt-data", tags=["rmt-data"])

def user_can_save_rmt_data(user: Dict[str, Any]) -> bool:
    """Check if user has permission to save RMT data"""
    return user.get('role') in ['admin', 'rmt', 'risp']

def get_user_or_default_disease_status(user_id: Optional[int] = None, country_id: Optional[int] = None):
    """Get user-specific disease status or fall back to default data"""
    
    # Build base query
    query = "SELECT * FROM disease_status"
    params = []
    conditions = []
    
    if user_id and country_id:
        # Try user-specific data for specific country first
        user_query = query + " WHERE user_id = %s AND country_id = %s"
        user_params = [user_id, country_id]
        
        result = db_helper.execute_main_query(user_query, user_params)
        if not result["error"] and result["data"]:
            return result["data"]
    
    elif user_id:
        # Try user-specific data for all countries first
        user_query = query + " WHERE user_id = %s"
        user_params = [user_id]
        
        result = db_helper.execute_main_query(user_query, user_params)
        if not result["error"] and result["data"]:
            return result["data"]
    
    # Fall back to default data (user_id IS NULL)
    if country_id:
        conditions.append("user_id IS NULL AND country_id = %s")
        params.append(country_id)
    else:
        conditions.append("user_id IS NULL")
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    result = db_helper.execute_main_query(query, params)
    return result["data"] if not result["error"] else []

def get_user_or_default_mitigation_measures(user_id: Optional[int] = None, country_id: Optional[int] = None):
    """Get user-specific mitigation measures or fall back to default data"""
    
    # Build base query
    query = "SELECT * FROM mitigation_measures"
    params = []
    conditions = []
    
    if user_id and country_id:
        # Try user-specific data for specific country first
        user_query = query + " WHERE user_id = %s AND country_id = %s"
        user_params = [user_id, country_id]
        
        result = db_helper.execute_main_query(user_query, user_params)
        if not result["error"] and result["data"]:
            return result["data"]
    
    elif user_id:
        # Try user-specific data for all countries first
        user_query = query + " WHERE user_id = %s"
        user_params = [user_id]
        
        result = db_helper.execute_main_query(user_query, user_params)
        if not result["error"] and result["data"]:
            return result["data"]
    
    # Fall back to default data (user_id IS NULL)
    if country_id:
        conditions.append("user_id IS NULL AND country_id = %s")
        params.append(country_id)
    else:
        conditions.append("user_id IS NULL")
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    result = db_helper.execute_main_query(query, params)
    return result["data"] if not result["error"] else []

def get_user_connections(user_id: Optional[int] = None, country_id: Optional[int] = None):
    """Get user-specific connections data"""
    
    query = "SELECT * FROM connections"
    params = []
    conditions = []
    
    if user_id:
        conditions.append("user_id = %s")
        params.append(user_id)
        
        if country_id:
            conditions.append("country_id = %s")
            params.append(country_id)
    
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    
    result = db_helper.execute_main_query(query, params)
    return result["data"] if not result["error"] else []

# Disease Status Endpoints
@router.get("/disease-status")
async def get_disease_status(
    user_id: Optional[int] = None, 
    country_id: Optional[int] = None
):
    """Get disease status data - user-specific or default"""
    try:
        data = get_user_or_default_disease_status(user_id, country_id)
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving disease status: {str(e)}"
        )

@router.post("/disease-status", response_model=ResponseModel)
async def save_disease_status(
    data: List[DiseaseStatusCreate],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Save user's disease status data"""
    try:
        if not user_can_save_rmt_data(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have permission to save RMT data"
            )
        
        # Use INSERT ... ON DUPLICATE KEY UPDATE to handle existing data
        insert_query = """
            INSERT INTO disease_status (country_id, FMD, PPR, LSD, RVF, SPGP, date, user_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                FMD = VALUES(FMD),
                PPR = VALUES(PPR),
                LSD = VALUES(LSD),
                RVF = VALUES(RVF),
                SPGP = VALUES(SPGP),
                date = VALUES(date)
        """
        
        rows_processed = 0
        for item in data:
            params = (
                item.country_id, item.FMD, item.PPR, item.LSD, 
                item.RVF, item.SPGP, item.date, current_user['id']
            )
            
            result = await db_helper.execute_main_query(insert_query, params)
            if result["error"]:
                print(f"Error inserting/updating disease status data: {result['error']}, params: {params}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error saving data: {result['error']}"
                )
            rows_processed += 1
        
        return ResponseModel(
            message=f"Successfully saved {rows_processed} disease status records",
            data={"rows_processed": rows_processed},
            status="success"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in save_disease_status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving disease status: {str(e)}"
        )

# Mitigation Measures Endpoints
@router.get("/mitigation-measures")
async def get_mitigation_measures(
    user_id: Optional[int] = None, 
    country_id: Optional[int] = None
):
    """Get mitigation measures data - user-specific or default"""
    try:
        data = get_user_or_default_mitigation_measures(user_id, country_id)
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving mitigation measures: {str(e)}"
        )

@router.post("/mitigation-measures", response_model=ResponseModel)
async def save_mitigation_measures(
    data: List[MitigationMeasureCreate],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Save user's mitigation measures data"""
    try:
        if not user_can_save_rmt_data(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have permission to save RMT data"
            )
        
        # Use INSERT ... ON DUPLICATE KEY UPDATE to handle existing data
        insert_query = """
            INSERT INTO mitigation_measures (country_id, FMD, PPR, LSD, RVF, SPGP, date, user_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                FMD = VALUES(FMD),
                PPR = VALUES(PPR),
                LSD = VALUES(LSD),
                RVF = VALUES(RVF),
                SPGP = VALUES(SPGP),
                date = VALUES(date)
        """
        
        rows_processed = 0
        for item in data:
            params = (
                item.country_id, item.FMD, item.PPR, item.LSD, 
                item.RVF, item.SPGP, item.date, current_user['id']
            )
            
            result = await db_helper.execute_main_query(insert_query, params)
            if result["error"]:
                print(f"Error inserting/updating mitigation measures data: {result['error']}, params: {params}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error saving data: {result['error']}"
                )
            rows_processed += 1
        
        return ResponseModel(
            message=f"Successfully saved {rows_processed} mitigation measures records",
            data={"rows_processed": rows_processed},
            status="success"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in save_mitigation_measures: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving mitigation measures: {str(e)}"
        )

# Connections Endpoints
@router.get("/connections")
async def get_connections(
    user_id: Optional[int] = None, 
    country_id: Optional[int] = None
):
    """Get connections data - user-specific only (no default data)"""
    try:
        data = get_user_connections(user_id, country_id)
        return data
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving connections: {str(e)}"
        )

@router.post("/connections", response_model=ResponseModel)
async def save_connections(
    data: List[ConnectionsCreate],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Save user's connections data"""
    try:
        if not user_can_save_rmt_data(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have permission to save RMT data"
            )
        
        # Use INSERT ... ON DUPLICATE KEY UPDATE to handle existing data
        insert_query = """
            INSERT INTO connections (
                country_id, liveAnimalContact, legalImport, proximity, 
                illegalImport, connection, livestockDensity, user_id
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                liveAnimalContact = VALUES(liveAnimalContact),
                legalImport = VALUES(legalImport),
                proximity = VALUES(proximity),
                illegalImport = VALUES(illegalImport),
                connection = VALUES(connection),
                livestockDensity = VALUES(livestockDensity)
        """
        
        rows_processed = 0
        for item in data:
            params = (
                item.country_id, item.liveAnimalContact, item.legalImport, 
                item.proximity, item.illegalImport, item.connection, 
                item.livestockDensity, current_user['id']
            )
            
            result = await db_helper.execute_main_query(insert_query, params)
            if result["error"]:
                print(f"Error inserting/updating connections data: {result['error']}, params: {params}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error saving data: {result['error']}"
                )
            rows_processed += 1
        
        return ResponseModel(
            message=f"Successfully saved {rows_processed} connections records",
            data={"rows_processed": rows_processed},
            status="success"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Unexpected error in save_connections: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error saving connections: {str(e)}"
        )

# Reset to Default Endpoints
@router.delete("/disease-status", response_model=ResponseModel)
async def reset_disease_status_to_default(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Reset user's disease status data to default (delete user-specific data)"""
    try:
        if not user_can_save_rmt_data(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have permission to modify RMT data"
            )
        
        delete_query = "DELETE FROM disease_status WHERE user_id = %s"
        result = await db_helper.execute_main_query(delete_query, (current_user['id'],))
        
        if result["error"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error resetting data: {result['error']}"
            )
        
        return ResponseModel(
            message="Successfully reset disease status to default",
            data={"rows_deleted": result["data"]},
            status="success"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting disease status: {str(e)}"
        )

@router.delete("/mitigation-measures", response_model=ResponseModel)
async def reset_mitigation_measures_to_default(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Reset user's mitigation measures data to default (delete user-specific data)"""
    try:
        if not user_can_save_rmt_data(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have permission to modify RMT data"
            )
        
        delete_query = "DELETE FROM mitigation_measures WHERE user_id = %s"
        result = await db_helper.execute_main_query(delete_query, (current_user['id'],))
        
        if result["error"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error resetting data: {result['error']}"
            )
        
        return ResponseModel(
            message="Successfully reset mitigation measures to default",
            data={"rows_deleted": result["data"]},
            status="success"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error resetting mitigation measures: {str(e)}"
        )

@router.delete("/connections", response_model=ResponseModel)
async def reset_connections(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """Delete user's connections data"""
    try:
        if not user_can_save_rmt_data(current_user):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User does not have permission to modify RMT data"
            )
        
        delete_query = "DELETE FROM connections WHERE user_id = %s"
        result = await db_helper.execute_main_query(delete_query, (current_user['id'],))
        
        if result["error"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error deleting data: {result['error']}"
            )
        
        return ResponseModel(
            message="Successfully deleted connections data",
            data={"rows_deleted": result["data"]},
            status="success"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting connections: {str(e)}"
        )
