from fastapi import APIRouter, HTTPException
from database import db_helper

router = APIRouter(prefix="/api/tcc", tags=["soi"])


@router.get("/outbreaks")
async def get_outbreaks():
    """Get all outbreak data from TCC database"""
    try:
        result = await db_helper.execute_tcc_query(
            "SELECT "
            "n.country AS Country, "
            "p.province_name AS Province, "
            "d.district_name AS District, "
            "o.epiunit AS Epi_Unit, "
            "o.latit AS Latitude, "
            "o.longi AS Longitude, "
            "dis.description AS Disease, "
            "sp.description AS Species, "
            "se.description AS Serotype, "
            "o.dt_susp AS Date_Suspected, "
            "o.dt_conf AS Date_Confirmed, "
            "o.conf_type AS Confirmation_Type "
            "FROM outbreaks o "
            "LEFT JOIN nations n ON o.nationID = n.nationID "
            "LEFT JOIN districts d ON o.districtID = d.districtID "
            "LEFT JOIN provinces p ON d.provinceID = p.provinceID "
            "LEFT JOIN diseases dis ON o.diseasecod = dis.diseasecod "
            "LEFT JOIN species sp ON o.speID = sp.speID "
            "LEFT JOIN serotypes se ON o.seroID = se.seroID "
            "ORDER BY o.dt_conf DESC, o.dt_susp DESC"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vaccination")
async def get_vaccination():
    """Get all vaccination data from TCC database"""
    try:
        result = await db_helper.execute_tcc_query(
            "SELECT * FROM TCC.vaccinations "
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/marketprice")
async def get_marketprice():
    """Get all market price data from TCC database"""
    try:
        result = await db_helper.execute_tcc_query(
            "SELECT * FROM TCC.marketprice "
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))