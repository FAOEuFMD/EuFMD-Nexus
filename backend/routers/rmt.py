from fastapi import APIRouter, HTTPException
from typing import List
from models import Country, DiseaseStatus, MitigationMeasure
from database import db_helper

router = APIRouter(prefix="/api/rmt", tags=["rmt"])

@router.get("/")
async def rmt_root():
    """RMT root endpoint"""
    return {"title": "Connected!"}

@router.get("/eu-neighbours", response_model=List[Country])
async def get_eu_neighbour_countries():
    """Get EU Neighbour Countries"""
    try:
        # Query matches the Vue app: eufmd_nc = 1 for EU neighbouring countries
        # Use main database since countries table is in main DB
        result = await db_helper.execute_main_query(
            "SELECT id, iso3, name_un, subregion, eufmd_nc FROM countries WHERE eufmd_nc = 1 ORDER BY name_un ASC"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# COUNTRIES
@router.get("/countries", response_model=List[Country])
async def get_countries():
    """Get all countries"""
    try:
        result = await db_helper.execute_main_query(
            "SELECT id, iso3, name_un, subregion FROM countries ORDER BY name_un ASC"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# DISEASE STATUS
@router.get("/disease-status-date")
async def get_disease_status_date():
    """Get disease status date information"""
    try:
        # Match Vue app: use 'date' column name
        result = await db_helper.execute_main_query(
            "SELECT MAX(date) as lastUpdate FROM disease_status"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/disease-status", response_model=List[DiseaseStatus])
async def get_disease_status():
    """Get all disease status records"""
    try:
        # Get only the most recent disease status record for each country
        query = """
        SELECT ds.id, ds.country_id, ds.FMD, ds.PPR, ds.LSD, ds.RVF, ds.SPGP,
               DATE_FORMAT(ds.date, '%Y-%m-%d %H:%i:%s') as date
        FROM disease_status ds
        WHERE ds.date = (
            SELECT MAX(ds2.date) 
            FROM disease_status ds2 
            WHERE ds2.country_id = ds.country_id
        )
        ORDER BY ds.country_id
        """
        result = await db_helper.execute_main_query(query)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/disease-status-rmt")
async def get_disease_status_for_rmt():
    """Get disease status for RMT data"""
    try:
        # Use a CTE (Common Table Expression) to get the most recent date for each country
        query = """
        WITH LatestDiseaseStatus AS (
            SELECT country_id, MAX(date) as latest_date
            FROM disease_status
            GROUP BY country_id
        )
        SELECT ds.*, countries.name_un AS country_name
        FROM disease_status ds
        INNER JOIN LatestDiseaseStatus lds 
            ON ds.country_id = lds.country_id 
            AND ds.date = lds.latest_date
        LEFT JOIN countries ON ds.country_id = countries.id
        ORDER BY ds.date DESC, countries.name_un ASC
        """
        result = await db_helper.execute_main_query(query)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/disease-status/{country_id}")
async def get_disease_status_by_country(country_id: int):
    """Get disease status by country"""
    try:
        # Use a simpler query that works with SQLAlchemy parameter binding
        query = """
        SELECT 
            id,
            country_id, 
            FMD, PPR, LSD, RVF, SPGP,
            date
        FROM disease_status ds
        WHERE ds.country_id = :country_id
        AND ds.date = (
            SELECT MAX(date) 
            FROM disease_status 
            WHERE country_id = :country_id
        )
        """
        params = {"country_id": country_id}
        result = await db_helper.execute_main_query(query, params)
        
        if result["error"]:
            raise HTTPException(status_code=500, detail=f"Database error: {result['error']}")
        
        # Return the actual data as array
        if isinstance(result["data"], list) and len(result["data"]) > 0:
            return {"scores": result["data"]}
        else:
            return {"scores": []}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# MITIGATION MEASURES
@router.get("/mitigation-measures-date")
async def get_mitigation_measures_date():
    """Get mitigation measures date information"""
    try:
        # Match Vue app: use 'date' column name
        result = await db_helper.execute_main_query(
            "SELECT MAX(date) as lastUpdate FROM mitigation_measures"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mitigation-measures", response_model=List[MitigationMeasure])
async def get_mitigation_measures():
    """Get all mitigation measures"""
    try:
        # Get only the most recent mitigation measures record for each country
        query = """
        SELECT mm.id, mm.country_id, mm.FMD, mm.PPR, mm.LSD, mm.RVF, mm.SPGP,
               DATE_FORMAT(mm.date, '%Y-%m-%d %H:%i:%s') as date
        FROM mitigation_measures mm
        WHERE mm.date = (
            SELECT MAX(mm2.date) 
            FROM mitigation_measures mm2 
            WHERE mm2.country_id = mm.country_id
        )
        ORDER BY mm.country_id
        """
        result = await db_helper.execute_main_query(query)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mitigation-measures-rmt")
async def get_mitigation_measures_for_rmt():
    """Get mitigation measures for RMT data"""
    try:
        # Use a CTE to get the most recent mitigation measures for each country
        query = """
        WITH LatestMitigationMeasures AS (
            SELECT country_id, MAX(date) as latest_date
            FROM mitigation_measures
            GROUP BY country_id
        )
        SELECT mm.*, countries.name_un AS country_name
        FROM mitigation_measures mm
        INNER JOIN LatestMitigationMeasures lmm 
            ON mm.country_id = lmm.country_id 
            AND mm.date = lmm.latest_date
        LEFT JOIN countries ON mm.country_id = countries.id
        ORDER BY mm.date DESC, countries.name_un ASC
        """
        result = await db_helper.execute_main_query(query)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mitigation-measures/{country_id}")
async def get_mitigation_measures_by_country(country_id: int):
    """Get mitigation measures by country"""
    try:
        # Use a simpler query that works with SQLAlchemy parameter binding
        query = """
        SELECT 
            id,
            country_id,
            FMD, PPR, LSD, RVF, SPGP,
            date
        FROM mitigation_measures mm
        WHERE mm.country_id = :country_id
        AND mm.date = (
            SELECT MAX(date) 
            FROM mitigation_measures 
            WHERE country_id = :country_id
        )
        """
        params = {"country_id": country_id}
        result = await db_helper.execute_main_query(query, params)
        
        if result["error"]:
            raise HTTPException(status_code=500, detail=f"Database error: {result['error']}")
        
        # Return the actual data as array
        if isinstance(result["data"], list) and len(result["data"]) > 0:
            return {"scores": result["data"]}
        else:
            return {"scores": []}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error: {str(e)}")

# Risk scores calculation is handled on the frontend based on disease status and mitigation measures

# POST ENDPOINTS FOR DISEASE STATUS
@router.post("/disease-status")
async def create_disease_status(disease_status: DiseaseStatus):
    """Create new disease status record"""
    try:
        query = """
        INSERT INTO disease_status (country_id, FMD, PPR, LSD, RVF, SPGP, date)
        VALUES (:country_id, :FMD, :PPR, :LSD, :RVF, :SPGP, :date)
        """
        params = {
            "country_id": disease_status.country_id,
            "FMD": disease_status.FMD,
            "PPR": disease_status.PPR,
            "LSD": disease_status.LSD,
            "RVF": disease_status.RVF,
            "SPGP": disease_status.SPGP,
            "date": disease_status.date
        }
        result = await db_helper.execute_main_query(query, params)
        
        if result["error"]:
            raise HTTPException(status_code=500, detail=f"Database error: {result['error']}")
        
        return {"message": "Disease status created successfully", "success": True}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating disease status: {str(e)}")

# POST ENDPOINTS FOR MITIGATION MEASURES
@router.post("/mitigation-measures")
async def create_mitigation_measures(mitigation_measure: MitigationMeasure):
    """Create new mitigation measures record"""
    try:
        query = """
        INSERT INTO mitigation_measures (country_id, FMD, PPR, LSD, RVF, SPGP, date)
        VALUES (:country_id, :FMD, :PPR, :LSD, :RVF, :SPGP, :date)
        """
        params = {
            "country_id": mitigation_measure.country_id,
            "FMD": mitigation_measure.FMD,
            "PPR": mitigation_measure.PPR,
            "LSD": mitigation_measure.LSD,
            "RVF": mitigation_measure.RVF,
            "SPGP": mitigation_measure.SPGP,
            "date": mitigation_measure.date
        }
        result = await db_helper.execute_main_query(query, params)
        
        if result["error"]:
            raise HTTPException(status_code=500, detail=f"Database error: {result['error']}")
        
        return {"message": "Mitigation measures created successfully", "success": True}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating mitigation measures: {str(e)}")
