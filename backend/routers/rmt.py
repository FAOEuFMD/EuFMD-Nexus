
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional, Any, Dict
from models import Country, DiseaseStatus, MitigationMeasure, DiseaseStatusCreate, MitigationMeasureCreate
from auth import get_current_user, get_current_user_optional
from database import db_helper

router = APIRouter(prefix="/api/rmt", tags=["rmt"])


def _require_admin(user: Dict[str, Any]) -> None:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


async def _find_latest_row_id(table: str, country_id: int, user_id: Optional[int]) -> Optional[int]:
    """Return the id of the latest row for a country/user scope."""
    if user_id is None:
        query = f"""
            SELECT id
            FROM {table}
            WHERE country_id = %s AND user_id IS NULL
            ORDER BY date DESC, id DESC
            LIMIT 1
        """
        params = (country_id,)
    else:
        query = f"""
            SELECT id
            FROM {table}
            WHERE country_id = %s AND user_id = %s
            ORDER BY date DESC, id DESC
            LIMIT 1
        """
        params = (country_id, user_id)

    result = await db_helper.execute_main_query(query, params)
    if result["error"]:
        raise HTTPException(status_code=500, detail=result["error"])
    rows = result["data"] or []
    return rows[0]["id"] if rows else None


async def _upsert_score_row(
    table: str,
    country_id: int,
    scores: Dict[str, Any],
    date: str,
    user_id: Optional[int],
) -> None:
    """Update the latest row for this country/user scope, or insert if none exists."""
    row_id = await _find_latest_row_id(table, country_id, user_id)
    if row_id is not None:
        update_query = f"""
            UPDATE {table}
            SET FMD = %s, PPR = %s, LSD = %s, RVF = %s, SPGP = %s, date = %s
            WHERE id = %s
        """
        params = (
            scores["FMD"],
            scores["PPR"],
            scores["LSD"],
            scores["RVF"],
            scores["SPGP"],
            date,
            row_id,
        )
        result = await db_helper.execute_main_query(update_query, params)
    else:
        insert_query = f"""
            INSERT INTO {table} (country_id, FMD, PPR, LSD, RVF, SPGP, date, user_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = (
            country_id,
            scores["FMD"],
            scores["PPR"],
            scores["LSD"],
            scores["RVF"],
            scores["SPGP"],
            date,
            user_id,
        )
        result = await db_helper.execute_main_query(insert_query, params)

    if result["error"]:
        raise HTTPException(status_code=500, detail=result["error"])


_LATEST_DEFAULT_PER_COUNTRY_SQL = """
    SELECT ds.id, ds.country_id, ds.FMD, ds.PPR, ds.LSD, ds.RVF, ds.SPGP,
           DATE_FORMAT(ds.date, '%Y-%m-%d') as date
    FROM disease_status ds
    INNER JOIN (
        SELECT d1.country_id, MAX(d1.id) AS latest_id
        FROM disease_status d1
        WHERE d1.user_id IS NULL
          AND d1.date = (
              SELECT MAX(d2.date)
              FROM disease_status d2
              WHERE d2.country_id = d1.country_id AND d2.user_id IS NULL
          )
        GROUP BY d1.country_id
    ) latest ON ds.id = latest.latest_id
    ORDER BY ds.country_id
"""

_LATEST_DEFAULT_MITIGATION_PER_COUNTRY_SQL = """
    SELECT mm.id, mm.country_id, mm.FMD, mm.PPR, mm.LSD, mm.RVF, mm.SPGP,
           DATE_FORMAT(mm.date, '%Y-%m-%d') as date
    FROM mitigation_measures mm
    INNER JOIN (
        SELECT m1.country_id, MAX(m1.id) AS latest_id
        FROM mitigation_measures m1
        WHERE m1.user_id IS NULL
          AND m1.date = (
              SELECT MAX(m2.date)
              FROM mitigation_measures m2
              WHERE m2.country_id = m1.country_id AND m2.user_id IS NULL
          )
        GROUP BY m1.country_id
    ) latest ON mm.id = latest.latest_id
    ORDER BY mm.country_id
"""

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
async def get_disease_status(user=Depends(get_current_user_optional)):
    """Get all disease status records, user-specific if logged in, else default (user_id IS NULL)"""
    try:
        if user is None:
            # Not logged in: only return default data (user_id IS NULL)
            query = """
            SELECT ds.id, ds.country_id, ds.FMD, ds.PPR, ds.LSD, ds.RVF, ds.SPGP,
                   DATE_FORMAT(ds.date, '%Y-%m-%d %H:%i:%s') as date
            FROM disease_status ds
            WHERE ds.user_id IS NULL
              AND ds.date = (
                SELECT MAX(ds2.date) 
                FROM disease_status ds2 
                WHERE ds2.country_id = ds.country_id AND ds2.user_id IS NULL
            )
            ORDER BY ds.country_id
            """
            result = await db_helper.execute_main_query(query)
            if result["error"]:
                raise HTTPException(status_code=500, detail=result["error"])
            return result["data"]
        else:
            # Logged in: merge user data with default data, prioritizing user data per country
            query = """
            SELECT 
                COALESCE(user_ds.id, default_ds.id) as id,
                COALESCE(user_ds.country_id, default_ds.country_id) as country_id,
                COALESCE(user_ds.FMD, default_ds.FMD) as FMD,
                COALESCE(user_ds.PPR, default_ds.PPR) as PPR,
                COALESCE(user_ds.LSD, default_ds.LSD) as LSD,
                COALESCE(user_ds.RVF, default_ds.RVF) as RVF,
                COALESCE(user_ds.SPGP, default_ds.SPGP) as SPGP,
                DATE_FORMAT(COALESCE(user_ds.date, default_ds.date), '%Y-%m-%d %H:%i:%s') as date
            FROM 
                (SELECT ds.id, ds.country_id, ds.FMD, ds.PPR, ds.LSD, ds.RVF, ds.SPGP, ds.date
                 FROM disease_status ds
                 WHERE ds.user_id IS NULL
                   AND ds.date = (
                     SELECT MAX(ds2.date) 
                     FROM disease_status ds2 
                     WHERE ds2.country_id = ds.country_id AND ds2.user_id IS NULL
                   )) default_ds
            LEFT JOIN 
                (SELECT ds.id, ds.country_id, ds.FMD, ds.PPR, ds.LSD, ds.RVF, ds.SPGP, ds.date
                 FROM disease_status ds
                 WHERE ds.user_id = :user_id
                   AND ds.date = (
                     SELECT MAX(ds2.date) 
                     FROM disease_status ds2 
                     WHERE ds2.country_id = ds.country_id AND ds2.user_id = :user_id
                   )) user_ds
            ON default_ds.country_id = user_ds.country_id
            ORDER BY default_ds.country_id
            """
            params = {"user_id": user["id"]}
            result = await db_helper.execute_main_query(query, params)
            if result["error"]:
                raise HTTPException(status_code=500, detail=result["error"])
            return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/disease-status-rmt")
async def get_disease_status_for_rmt(user=Depends(get_current_user_optional)):
    """Get disease status for RMT data, user-specific if logged in, else default"""
    try:
        if user is None:
            # Not logged in: only default data
            query = """
            WITH LatestDiseaseStatus AS (
                SELECT country_id, MAX(date) as latest_date
                FROM disease_status
                WHERE user_id IS NULL
                GROUP BY country_id
            )
            SELECT ds.*, countries.name_un AS country_name
            FROM disease_status ds
            INNER JOIN LatestDiseaseStatus lds 
                ON ds.country_id = lds.country_id 
                AND ds.date = lds.latest_date
            LEFT JOIN countries ON ds.country_id = countries.id
            WHERE ds.user_id IS NULL
            ORDER BY ds.date DESC, countries.name_un ASC
            """
            result = await db_helper.execute_main_query(query)
            if result["error"]:
                raise HTTPException(status_code=500, detail=result["error"])
            return result["data"]
        else:
            # Logged in: merge user and default data, prioritizing user per country
            query = """
            WITH MergedData AS (
                SELECT 
                    COALESCE(user_ds.id, default_ds.id) as id,
                    COALESCE(user_ds.country_id, default_ds.country_id) as country_id,
                    COALESCE(user_ds.FMD, default_ds.FMD) as FMD,
                    COALESCE(user_ds.PPR, default_ds.PPR) as PPR,
                    COALESCE(user_ds.LSD, default_ds.LSD) as LSD,
                    COALESCE(user_ds.RVF, default_ds.RVF) as RVF,
                    COALESCE(user_ds.SPGP, default_ds.SPGP) as SPGP,
                    COALESCE(user_ds.date, default_ds.date) as date
                FROM 
                    (SELECT ds.id, ds.country_id, ds.FMD, ds.PPR, ds.LSD, ds.RVF, ds.SPGP, ds.date
                     FROM disease_status ds
                     WHERE ds.user_id IS NULL
                       AND ds.date = (
                         SELECT MAX(ds2.date) 
                         FROM disease_status ds2 
                         WHERE ds2.country_id = ds.country_id AND ds2.user_id IS NULL
                       )) default_ds
                LEFT JOIN 
                    (SELECT ds.id, ds.country_id, ds.FMD, ds.PPR, ds.LSD, ds.RVF, ds.SPGP, ds.date
                     FROM disease_status ds
                     WHERE ds.user_id = :user_id
                       AND ds.date = (
                         SELECT MAX(ds2.date) 
                         FROM disease_status ds2 
                         WHERE ds2.country_id = ds.country_id AND ds2.user_id = :user_id
                       )) user_ds
                ON default_ds.country_id = user_ds.country_id
            )
            SELECT md.*, countries.name_un AS country_name
            FROM MergedData md
            LEFT JOIN countries ON md.country_id = countries.id
            ORDER BY md.date DESC, countries.name_un ASC
            """
            params = {"user_id": user["id"]}
            result = await db_helper.execute_main_query(query, params)
            if result["error"]:
                raise HTTPException(status_code=500, detail=result["error"])
            return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/disease-status/{country_id}")
async def get_disease_status_by_country(country_id: int, user=Depends(get_current_user_optional)):
    """Get disease status by country, user-specific if logged in, else default"""
    try:
        if user is None:
            # Not logged in: only default
            query = """
            SELECT 
                id,
                country_id, 
                FMD, PPR, LSD, RVF, SPGP,
                date
            FROM disease_status ds
            WHERE ds.country_id = :country_id
            AND ds.user_id IS NULL
            AND ds.date = (
                SELECT MAX(date) 
                FROM disease_status 
                WHERE country_id = :country_id AND user_id IS NULL
            )
            """
        else:
            # Logged in: try user data first, fall back to default
            user_query = """
            SELECT 
                id,
                country_id, 
                FMD, PPR, LSD, RVF, SPGP,
                date
            FROM disease_status ds
            WHERE ds.country_id = :country_id
            AND ds.user_id = :user_id
            AND ds.date = (
                SELECT MAX(date) 
                FROM disease_status 
                WHERE country_id = :country_id AND user_id = :user_id
            )
            """
            params = {"country_id": country_id, "user_id": user["id"]}
            user_result = await db_helper.execute_main_query(user_query, params)
            if user_result["error"]:
                raise HTTPException(status_code=500, detail=f"Database error: {user_result['error']}")
            if user_result["data"]:
                return {"scores": user_result["data"]}
            # Fall back to default
            query = """
            SELECT 
                id,
                country_id, 
                FMD, PPR, LSD, RVF, SPGP,
                date
            FROM disease_status ds
            WHERE ds.country_id = :country_id
            AND ds.user_id IS NULL
            AND ds.date = (
                SELECT MAX(date) 
                FROM disease_status 
                WHERE country_id = :country_id AND user_id IS NULL
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
async def get_mitigation_measures(user=Depends(get_current_user_optional)):
    """Get all mitigation measures, user-specific if logged in, else default (user_id IS NULL)"""
    try:
        if user is None:
            # Not logged in: only return default data (user_id IS NULL)
            query = """
            SELECT mm.id, mm.country_id, mm.FMD, mm.PPR, mm.LSD, mm.RVF, mm.SPGP,
                   DATE_FORMAT(mm.date, '%Y-%m-%d %H:%i:%s') as date
            FROM mitigation_measures mm
            WHERE mm.user_id IS NULL
              AND mm.date = (
                SELECT MAX(mm2.date) 
                FROM mitigation_measures mm2 
                WHERE mm2.country_id = mm.country_id AND mm2.user_id IS NULL
            )
            ORDER BY mm.country_id
            """
            result = await db_helper.execute_main_query(query)
            if result["error"]:
                raise HTTPException(status_code=500, detail=result["error"])
            return result["data"]
        else:
            # Logged in: merge user data with default data, prioritizing user data per country
            query = """
            SELECT 
                COALESCE(user_mm.id, default_mm.id) as id,
                COALESCE(user_mm.country_id, default_mm.country_id) as country_id,
                COALESCE(user_mm.FMD, default_mm.FMD) as FMD,
                COALESCE(user_mm.PPR, default_mm.PPR) as PPR,
                COALESCE(user_mm.LSD, default_mm.LSD) as LSD,
                COALESCE(user_mm.RVF, default_mm.RVF) as RVF,
                COALESCE(user_mm.SPGP, default_mm.SPGP) as SPGP,
                DATE_FORMAT(COALESCE(user_mm.date, default_mm.date), '%Y-%m-%d %H:%i:%s') as date
            FROM 
                (SELECT mm.id, mm.country_id, mm.FMD, mm.PPR, mm.LSD, mm.RVF, mm.SPGP, mm.date
                 FROM mitigation_measures mm
                 WHERE mm.user_id IS NULL
                   AND mm.date = (
                     SELECT MAX(mm2.date) 
                     FROM mitigation_measures mm2 
                     WHERE mm2.country_id = mm.country_id AND mm2.user_id IS NULL
                   )) default_mm
            LEFT JOIN 
                (SELECT mm.id, mm.country_id, mm.FMD, mm.PPR, mm.LSD, mm.RVF, mm.SPGP, mm.date
                 FROM mitigation_measures mm
                 WHERE mm.user_id = :user_id
                   AND mm.date = (
                     SELECT MAX(mm2.date) 
                     FROM mitigation_measures mm2 
                     WHERE mm2.country_id = mm.country_id AND mm2.user_id = :user_id
                   )) user_mm
            ON default_mm.country_id = user_mm.country_id
            ORDER BY default_mm.country_id
            """
            params = {"user_id": user["id"]}
            result = await db_helper.execute_main_query(query, params)
            if result["error"]:
                raise HTTPException(status_code=500, detail=result["error"])
            return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mitigation-measures-rmt")
async def get_mitigation_measures_for_rmt(user=Depends(get_current_user_optional)):
    """Get mitigation measures for RMT data, user-specific if logged in, else default"""
    try:
        if user is None:
            # Not logged in: only default data
            query = """
            WITH LatestMitigationMeasures AS (
                SELECT country_id, MAX(date) as latest_date
                FROM mitigation_measures
                WHERE user_id IS NULL
                GROUP BY country_id
            )
            SELECT mm.*, countries.name_un AS country_name
            FROM mitigation_measures mm
            INNER JOIN LatestMitigationMeasures lmm 
                ON mm.country_id = lmm.country_id 
                AND mm.date = lmm.latest_date
            LEFT JOIN countries ON mm.country_id = countries.id
            WHERE mm.user_id IS NULL
            ORDER BY mm.date DESC, countries.name_un ASC
            """
            result = await db_helper.execute_main_query(query)
            if result["error"]:
                raise HTTPException(status_code=500, detail=result["error"])
            return result["data"]
        else:
            # Logged in: merge user and default data, prioritizing user per country
            query = """
            WITH MergedData AS (
                SELECT 
                    COALESCE(user_mm.id, default_mm.id) as id,
                    COALESCE(user_mm.country_id, default_mm.country_id) as country_id,
                    COALESCE(user_mm.FMD, default_mm.FMD) as FMD,
                    COALESCE(user_mm.PPR, default_mm.PPR) as PPR,
                    COALESCE(user_mm.LSD, default_mm.LSD) as LSD,
                    COALESCE(user_mm.RVF, default_mm.RVF) as RVF,
                    COALESCE(user_mm.SPGP, default_mm.SPGP) as SPGP,
                    COALESCE(user_mm.date, default_mm.date) as date
                FROM 
                    (SELECT mm.id, mm.country_id, mm.FMD, mm.PPR, mm.LSD, mm.RVF, mm.SPGP, mm.date
                     FROM mitigation_measures mm
                     WHERE mm.user_id IS NULL
                       AND mm.date = (
                         SELECT MAX(mm2.date) 
                         FROM mitigation_measures mm2 
                         WHERE mm2.country_id = mm.country_id AND mm2.user_id IS NULL
                       )) default_mm
                LEFT JOIN 
                    (SELECT mm.id, mm.country_id, mm.FMD, mm.PPR, mm.LSD, mm.RVF, mm.SPGP, mm.date
                     FROM mitigation_measures mm
                     WHERE mm.user_id = :user_id
                       AND mm.date = (
                         SELECT MAX(mm2.date) 
                         FROM mitigation_measures mm2 
                         WHERE mm2.country_id = mm.country_id AND mm2.user_id = :user_id
                       )) user_mm
                ON default_mm.country_id = user_mm.country_id
            )
            SELECT md.*, countries.name_un AS country_name
            FROM MergedData md
            LEFT JOIN countries ON md.country_id = countries.id
            ORDER BY md.date DESC, countries.name_un ASC
            """
            params = {"user_id": user["id"]}
            result = await db_helper.execute_main_query(query, params)
            if result["error"]:
                raise HTTPException(status_code=500, detail=result["error"])
            return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/mitigation-measures/{country_id}")
async def get_mitigation_measures_by_country(country_id: int, user=Depends(get_current_user_optional)):
    """Get mitigation measures by country, user-specific if logged in, else default"""
    try:
        if user is None:
            # Not logged in: only default
            query = """
            SELECT 
                id,
                country_id,
                FMD, PPR, LSD, RVF, SPGP,
                date
            FROM mitigation_measures mm
            WHERE mm.country_id = :country_id
            AND mm.user_id IS NULL
            AND mm.date = (
                SELECT MAX(date) 
                FROM mitigation_measures 
                WHERE country_id = :country_id AND user_id IS NULL
            )
            """
        else:
            # Logged in: try user data first, fall back to default
            user_query = """
            SELECT 
                id,
                country_id,
                FMD, PPR, LSD, RVF, SPGP,
                date
            FROM mitigation_measures mm
            WHERE mm.country_id = :country_id
            AND mm.user_id = :user_id
            AND mm.date = (
                SELECT MAX(date) 
                FROM mitigation_measures 
                WHERE country_id = :country_id AND user_id = :user_id
            )
            """
            params = {"country_id": country_id, "user_id": user["id"]}
            user_result = await db_helper.execute_main_query(user_query, params)
            if user_result["error"]:
                raise HTTPException(status_code=500, detail=f"Database error: {user_result['error']}")
            if user_result["data"]:
                return {"scores": user_result["data"]}
            # Fall back to default
            query = """
            SELECT 
                id,
                country_id,
                FMD, PPR, LSD, RVF, SPGP,
                date
            FROM mitigation_measures mm
            WHERE mm.country_id = :country_id
            AND mm.user_id IS NULL
            AND mm.date = (
                SELECT MAX(date) 
                FROM mitigation_measures 
                WHERE country_id = :country_id AND user_id IS NULL
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

@router.get("/admin/disease-status")
async def get_admin_disease_status(user=Depends(get_current_user)):
    """Latest default (system) disease status — one row per country for admin data entry."""
    _require_admin(user)
    try:
        result = await db_helper.execute_main_query(_LATEST_DEFAULT_PER_COUNTRY_SQL)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/mitigation-measures")
async def get_admin_mitigation_measures(user=Depends(get_current_user)):
    """Latest default (system) mitigation measures — one row per country for admin data entry."""
    _require_admin(user)
    try:
        result = await db_helper.execute_main_query(_LATEST_DEFAULT_MITIGATION_PER_COUNTRY_SQL)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/disease-status")
async def save_admin_disease_status(
    records: List[DiseaseStatusCreate],
    user=Depends(get_current_user),
):
    """Upsert default disease status for each country (no duplicate rows per save)."""
    _require_admin(user)
    try:
        for item in records:
            await _upsert_score_row(
                "disease_status",
                item.country_id,
                {
                    "FMD": item.FMD,
                    "PPR": item.PPR,
                    "LSD": item.LSD,
                    "RVF": item.RVF,
                    "SPGP": item.SPGP,
                },
                item.date,
                None,
            )
        return {"message": f"Saved {len(records)} disease status records", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/mitigation-measures")
async def save_admin_mitigation_measures(
    records: List[MitigationMeasureCreate],
    user=Depends(get_current_user),
):
    """Upsert default mitigation measures for each country (no duplicate rows per save)."""
    _require_admin(user)
    try:
        for item in records:
            await _upsert_score_row(
                "mitigation_measures",
                item.country_id,
                {
                    "FMD": item.FMD,
                    "PPR": item.PPR,
                    "LSD": item.LSD,
                    "RVF": item.RVF,
                    "SPGP": item.SPGP,
                },
                item.date,
                None,
            )
        return {"message": f"Saved {len(records)} mitigation measure records", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# POST ENDPOINTS FOR DISEASE STATUS
@router.post("/disease-status")
async def create_disease_status(disease_status: DiseaseStatus, user=Depends(get_current_user)):
    """Upsert disease status for the current user (or system default for admin)."""
    try:
        user_id = None if user.get("role") == "admin" else user["id"]
        await _upsert_score_row(
            "disease_status",
            disease_status.country_id,
            {
                "FMD": disease_status.FMD,
                "PPR": disease_status.PPR,
                "LSD": disease_status.LSD,
                "RVF": disease_status.RVF,
                "SPGP": disease_status.SPGP,
            },
            disease_status.date,
            user_id,
        )
        return {"message": "Disease status saved successfully", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving disease status: {str(e)}")

# POST ENDPOINTS FOR MITIGATION MEASURES
@router.post("/mitigation-measures")
async def create_mitigation_measures(mitigation_measure: MitigationMeasure, user=Depends(get_current_user)):
    """Upsert mitigation measures for the current user (or system default for admin)."""
    try:
        user_id = None if user.get("role") == "admin" else user["id"]
        await _upsert_score_row(
            "mitigation_measures",
            mitigation_measure.country_id,
            {
                "FMD": mitigation_measure.FMD,
                "PPR": mitigation_measure.PPR,
                "LSD": mitigation_measure.LSD,
                "RVF": mitigation_measure.RVF,
                "SPGP": mitigation_measure.SPGP,
            },
            mitigation_measure.date,
            user_id,
        )
        return {"message": "Mitigation measures saved successfully", "success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving mitigation measures: {str(e)}")
