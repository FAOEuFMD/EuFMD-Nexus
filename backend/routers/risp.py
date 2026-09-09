from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import json
from datetime import datetime
from auth import get_current_user
import pymysql
from config import settings
from routers import risp_templates, risp_upload

router = APIRouter(prefix="/api/risp", tags=["risp"])

# Database connection function
def get_db_connection():
    """Get database connection for RISP data"""
    try:
        connection = pymysql.connect(
            host=settings.db_host,
            user=settings.db_user,
            password=settings.db_pass,
            database=settings.db_name,  # Use main database for RISP
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        return connection
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {str(e)}")


def _resolve_is_soi(country: Optional[str]) -> bool:
    if not country:
        return False
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT soi FROM countries
            WHERE name_un = %s OR name_moodle = %s
               OR (%s LIKE '%%Iraq%%' AND iso3 = 'IRQ')
               OR (%s LIKE '%%rkiye%%' AND iso3 = 'TUR')
               OR (%s = 'Turkey' AND iso3 = 'TUR')
            LIMIT 1
            """,
            (country, country, country, country, country),
        )
        row = cursor.fetchone()
        cursor.close()
        connection.close()
        if row and row.get("soi") == 1:
            return True
    except Exception:
        pass
    c = country.lower()
    hints = (
        "armenia", "azerbaijan", "bulgaria", "georgia", "greece",
        "iran", "iraq", "pakistan", "russia", "turkey", "türkiye", "turkiye",
    )
    return any(h in c for h in hints)


@router.get("/program-context")
async def program_context(current_user: dict = Depends(get_current_user)):
    """Whether the logged-in user's country is flagged SOI (same UI, different welcome text)."""
    country = current_user.get("country")
    is_soi = _resolve_is_soi(country)
    return {
        "country": country,
        "is_soi": is_soi,
        "program": "soi" if is_soi else "risp",
    }


@router.get("/templates/{category}")
async def download_risp_template(
    category: str,
    year: Optional[str] = Query(None),
    quarter: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Generate an Excel template tailored to SOI (per-district rows) or RISP (location presets)."""
    country = current_user.get("country")
    is_soi = _resolve_is_soi(country)
    districts: List[Dict[str, Any]] = []
    admin_regions: List[str] = []

    if is_soi:
        try:
            connection = get_db_connection()
            cursor = connection.cursor()
            country_id = risp_templates._resolve_country_id(cursor, country)
            if country_id:
                districts = risp_templates._fetch_soi_districts(cursor, country_id)
            cursor.close()
            connection.close()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not load district list: {e}")
    else:
        admin_regions = risp_templates._fetch_risp_admin_regions(country)

    return risp_templates.generate_template_response(
        category,
        is_soi=is_soi,
        districts=districts,
        admin_regions=admin_regions,
        year=year,
        quarter=quarter,
        country=country,
    )


@router.post("/upload/{category}")
async def upload_risp_bulk(
    category: str,
    file: UploadFile = File(...),
    year: Optional[str] = Query(None),
    quarter: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Import a filled Excel template for outbreaks, vaccination, or market prices."""
    country = current_user.get("country")
    is_soi = _resolve_is_soi(country)
    return await risp_upload.process_upload(
        category,
        file,
        current_user=current_user,
        is_soi=is_soi,
        get_db_connection=get_db_connection,
        default_year=year,
        default_quarter=quarter,
    )


@router.get("/geo/districts")
async def get_country_districts(current_user: dict = Depends(get_current_user)):
    """Districts for the logged-in user's country (SOI geo from db_manager)."""
    country = current_user.get("country")
    if not _resolve_is_soi(country):
        return []

    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        country_id = risp_templates._resolve_country_id(cursor, country)
        if not country_id:
            cursor.close()
            connection.close()
            return []
        districts = risp_templates._fetch_soi_districts(cursor, country_id)
        cursor.close()
        connection.close()
        return districts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading districts: {e}")

# Pydantic models for request/response
class OutbreakDiseaseData(BaseModel):
    id: Optional[int] = None  # existing risp_outbreaks.id when editing a line
    disease: str
    number_outbreaks: int
    locations: Optional[List[str]] = []
    location: Optional[str] = None
    species: List[str]
    status: List[str]
    serotype: List[str]
    control_measures: List[str]
    comments: str  # This maps to additional_info in the database
    date_suspected: Optional[str] = None
    date_confirmed: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    district_id: Optional[int] = None
    province_id: Optional[int] = None
    program: Optional[str] = "risp"
    visibility: Optional[str] = "public"

class OutbreakData(BaseModel):
    type: str
    year: int
    quarter: str
    userId: Optional[int] = None
    country: Optional[str] = None
    diseases: List[OutbreakDiseaseData]

class SurveillanceDiseaseData(BaseModel):
    disease: str
    passive_surveillance: bool
    active_surveillance: List[str]
    details: str

class SurveillanceData(BaseModel):
    type: str
    year: int
    quarter: str
    userId: Optional[int] = None
    country: Optional[str] = None
    diseases: List[SurveillanceDiseaseData]

class VaccinationCampaign(BaseModel):
    id: Optional[int] = None
    disease_name: str
    year: str
    country: Optional[str] = None
    status: Optional[str] = None
    vaccination_type: Optional[str] = None
    # One location per row: National / one region / one district name.
    # geographical_areas kept for compat (store 0–1 item); prefer `location`.
    location: Optional[str] = None
    geographical_areas: Optional[List[str]] = []
    province_id: Optional[int] = None
    district_id: Optional[int] = None
    program: Optional[str] = "risp"
    visibility: Optional[str] = "public"
    species: Optional[List[str]] = []
    vaccine_details: Optional[str] = None
    q1: Optional[int] = 0
    q2: Optional[int] = 0
    q3: Optional[int] = 0
    q4: Optional[int] = 0
    total: Optional[int] = 0
    coverage: Optional[int] = 0


def _normalize_vaccination_location(campaign: VaccinationCampaign) -> tuple[Optional[str], list]:
    """Enforce single location per vaccination row."""
    loc = (campaign.location or "").strip() or None
    areas = [str(a).strip() for a in (campaign.geographical_areas or []) if a and str(a).strip()]
    if not loc and areas:
        loc = areas[0]
    if loc:
        areas = [loc]
    else:
        areas = []
    return loc, areas

# Outbreak endpoints
@router.get("/outbreaks")
async def get_outbreak_data(
    year: int = Query(...),
    quarter: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get outbreak data for a specific year and quarter"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        query = """
        SELECT id, user_id, country, year, quarter, disease_name, number_outbreaks,
               location, locations, status, serotype, species, control_measures, additional_info,
               date_suspected, date_confirmed, latitude, longitude,
               province_id, district_id, program, visibility
        FROM risp_outbreaks 
        WHERE user_id = %s AND year = %s AND quarter = %s
        ORDER BY disease_name, id
        """
        
        cursor.execute(query, (current_user.get('id'), year, quarter))
        results = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching outbreak data: {str(e)}")

@router.post("/outbreaks")
async def save_outbreak_data(
    data: OutbreakData,
    current_user: dict = Depends(get_current_user)
):
    """Save outbreak data — one DB row per location line.

    RISP may submit several lines for the same disease (different locations).
    Uses UPDATE/INSERT only (no DELETE): db_manager_user lacks DELETE privilege.
    Rows for this period that are not in the payload are soft-cleared.
    """
    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        user_id = current_user.get('id')
        country = current_user.get('country')
        is_soi = _resolve_is_soi(country)
        default_program = 'soi' if is_soi else 'risp'

        if not data.diseases or len(data.diseases) == 0:
            return {"message": "No outbreak data to save"}

        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        year_s = str(data.year)
        quarter = data.quarter
        touched_ids: List[int] = []

        for disease_data in data.diseases:
            loc = (disease_data.location or "").strip() or None
            areas = [str(a).strip() for a in (disease_data.locations or []) if a and str(a).strip()]
            if not loc and areas:
                loc = areas[0]
            if loc:
                areas = [loc]
            else:
                areas = []

            program = disease_data.program if disease_data.program in ('risp', 'soi') else default_program
            visibility = disease_data.visibility if disease_data.visibility in ('private', 'public') else 'public'

            clear_only = disease_data.number_outbreaks <= 0 and not areas
            data_values = (
                disease_data.number_outbreaks if not clear_only else 0,
                json.dumps(areas if not clear_only else []),
                loc if not clear_only else None,
                json.dumps(disease_data.status or []),
                json.dumps(disease_data.serotype or []),
                json.dumps(disease_data.species or []),
                json.dumps(disease_data.control_measures or []),
                disease_data.comments or "",
                disease_data.date_suspected,
                disease_data.date_confirmed,
                disease_data.latitude,
                disease_data.longitude,
                disease_data.province_id,
                disease_data.district_id,
                program,
                visibility,
            )

            row_id = None

            # Prefer explicit id when the client is editing an existing line
            if disease_data.id:
                cursor.execute(
                    """
                    SELECT id FROM risp_outbreaks
                    WHERE id = %s AND user_id = %s AND year = %s AND quarter = %s
                    LIMIT 1
                    """,
                    (disease_data.id, user_id, year_s, quarter),
                )
                found = cursor.fetchone()
                if found:
                    row_id = found["id"] if isinstance(found, dict) else found[0]

            if row_id is None:
                match_sql = """
                    SELECT id FROM risp_outbreaks
                    WHERE user_id = %s AND year = %s AND quarter = %s AND disease_name = %s
                """
                match_params: list = [user_id, year_s, quarter, disease_data.disease]
                if disease_data.district_id is not None:
                    match_sql += " AND district_id = %s"
                    match_params.append(disease_data.district_id)
                elif loc:
                    match_sql += " AND location = %s"
                    match_params.append(loc)
                else:
                    match_sql += (
                        " AND (district_id IS NULL OR district_id = 0)"
                        " AND (location IS NULL OR location = '')"
                    )
                match_sql += " ORDER BY id LIMIT 1"
                cursor.execute(match_sql, tuple(match_params))
                found = cursor.fetchone()
                if found:
                    row_id = found["id"] if isinstance(found, dict) else found[0]

            if row_id is not None:
                cursor.execute(
                    """
                    UPDATE risp_outbreaks SET
                      number_outbreaks = %s,
                      locations = %s,
                      location = %s,
                      status = %s,
                      serotype = %s,
                      species = %s,
                      control_measures = %s,
                      additional_info = %s,
                      date_suspected = %s,
                      date_confirmed = %s,
                      latitude = %s,
                      longitude = %s,
                      province_id = %s,
                      district_id = %s,
                      program = %s,
                      visibility = %s,
                      created_at = COALESCE(created_at, %s),
                      updated_at = %s
                    WHERE id = %s AND user_id = %s
                    """,
                    data_values + (now, now, row_id, user_id),
                )
                touched_ids.append(int(row_id))
            elif not clear_only:
                cursor.execute(
                    """
                    INSERT INTO risp_outbreaks
                      (user_id, country, year, quarter, disease_name, number_outbreaks,
                       locations, location, status, serotype, species, control_measures, additional_info,
                       date_suspected, date_confirmed, latitude, longitude,
                       province_id, district_id, program, visibility, created_at, updated_at)
                    VALUES
                      (%s, %s, %s, %s, %s, %s,
                       %s, %s, %s, %s, %s, %s, %s,
                       %s, %s, %s, %s,
                       %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id,
                        country,
                        year_s,
                        quarter,
                        disease_data.disease,
                    )
                    + data_values
                    + (now, now),
                )
                new_id = cursor.lastrowid
                if new_id:
                    touched_ids.append(int(new_id))

        # Soft-clear any other rows for this period that were not in the payload
        cursor.execute(
            """
            SELECT id FROM risp_outbreaks
            WHERE user_id = %s AND year = %s AND quarter = %s
            """,
            (user_id, year_s, quarter),
        )
        all_ids = [
            int(row["id"] if isinstance(row, dict) else row[0])
            for row in (cursor.fetchall() or [])
        ]
        orphan_ids = [i for i in all_ids if i not in set(touched_ids)]
        if orphan_ids:
            placeholders = ", ".join(["%s"] * len(orphan_ids))
            cursor.execute(
                f"""
                UPDATE risp_outbreaks SET
                  number_outbreaks = 0,
                  locations = %s,
                  location = NULL,
                  district_id = NULL,
                  province_id = NULL,
                  updated_at = %s
                WHERE user_id = %s AND id IN ({placeholders})
                """,
                (json.dumps([]), now, user_id, *orphan_ids),
            )

        connection.commit()
        cursor.close()
        connection.close()

        return {"message": "Outbreak data saved successfully"}

    except Exception as e:
        print(f"Error saving outbreak data: {str(e)}")
        print(f"Data received: {data}")
        raise HTTPException(status_code=500, detail=f"Error saving outbreak data: {str(e)}")

# Surveillance endpoints
@router.get("/surveillance")
async def get_surveillance_data(
    year: int = Query(...),
    quarter: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get surveillance data for a specific year and quarter"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        query = """
        SELECT user_id, country, year, quarter, disease_name, 
               CAST(passive_surveillance AS UNSIGNED) as passive_surveillance, 
               active_surveillance, details, created_at 
        FROM risp_surveillance 
        WHERE user_id = %s AND year = %s AND quarter = %s
        """
        
        cursor.execute(query, (current_user.get('id'), year, quarter))
        results = cursor.fetchall()
        
        cursor.close()
        connection.close()
        
        return results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching surveillance data: {str(e)}")

@router.post("/surveillance")
async def save_surveillance_data(
    data: SurveillanceData,
    current_user: dict = Depends(get_current_user)
):
    """Save surveillance data"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Get user info
        user_id = current_user.get('id')
        country = current_user.get('country')
        
        # If no diseases provided, return success
        if not data.diseases or len(data.diseases) == 0:
            return {"message": "No surveillance data to save"}
        
        # Prepare values for batch insert/update using INSERT ON DUPLICATE KEY UPDATE
        values = []
        current_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        for disease_data in data.diseases:
            values.extend([
                user_id,
                country,
                data.year,
                data.quarter,
                disease_data.disease,
                1 if disease_data.passive_surveillance else 0,
                json.dumps(disease_data.active_surveillance),
                disease_data.details or None,
                current_timestamp
            ])
        
        # Create placeholders for multiple records
        num_diseases = len(data.diseases)
        placeholders = ", ".join(["(%s, %s, %s, %s, %s, %s, %s, %s, %s)"] * num_diseases)
        
        query = f"""
        INSERT INTO risp_surveillance 
        (user_id, country, year, quarter, disease_name, passive_surveillance, 
         active_surveillance, details, created_at)
        VALUES {placeholders}
        ON DUPLICATE KEY UPDATE
        passive_surveillance = VALUES(passive_surveillance),
        active_surveillance = VALUES(active_surveillance),
        details = VALUES(details),
        created_at = VALUES(created_at)
        """
        
        cursor.execute(query, values)
        connection.commit()
        cursor.close()
        connection.close()
        
        return {"message": "Surveillance data saved successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving surveillance data: {str(e)}")

# Vaccination endpoints
@router.get("/vaccinations")
async def get_vaccination_campaigns(
    year: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Get vaccination campaigns for a specific year"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        query = """
            SELECT * FROM risp_vaccination
            WHERE user_id = %s
              AND (location IS NULL OR location <> %s)
        """
        cursor.execute(query, (current_user.get('id'), "__deleted__"))
        results = cursor.fetchall()
        
        # Parse JSON strings back into arrays/objects
        parsed_results = []
        for campaign in results:
            # Safe JSON parsing function
            def safe_json_parse(json_str, default_value=None):
                if default_value is None:
                    default_value = []
                if not json_str:
                    return default_value
                try:
                    return json.loads(json_str)
                except (json.JSONDecodeError, TypeError):
                    return default_value
            
            areas = safe_json_parse(campaign.get('geographical_areas'))
            location = campaign.get('location') or (areas[0] if areas else None)
            parsed_campaign = {
                **campaign,
                'location': location,
                'geographical_areas': areas[:1] if areas else ([] if not location else [location]),
                'species': safe_json_parse(campaign.get('species'))
            }
            parsed_results.append(parsed_campaign)
        
        cursor.close()
        connection.close()
        
        return parsed_results
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching vaccination campaigns: {str(e)}")

@router.post("/vaccinations")
async def add_vaccination_campaign(
    campaign: VaccinationCampaign,
    current_user: dict = Depends(get_current_user)
):
    """Add a new vaccination campaign"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Get user info
        user_id = current_user.get('id')
        country = current_user.get('country')
        
        # Basic validation
        if not country or not campaign.disease_name or not campaign.year:
            raise HTTPException(status_code=400, detail="Country, disease name and year are required")
        
        # Get current timestamp in MySQL format
        current_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        location, areas = _normalize_vaccination_location(campaign)
        program = campaign.program if campaign.program in ('risp', 'soi') else 'risp'
        visibility = campaign.visibility if campaign.visibility in ('private', 'public') else 'public'
        
        # Prepare the campaign data
        campaign_data = {
            'user_id': user_id,
            'country': country,
            'disease_name': campaign.disease_name,
            'year': campaign.year,
            'status': campaign.status or None,
            'vaccination_type': campaign.vaccination_type,
            'geographical_areas': json.dumps(areas),
            'location': location,
            'province_id': campaign.province_id,
            'district_id': campaign.district_id,
            'program': program,
            'visibility': visibility,
            'species': json.dumps(campaign.species or []),
            'vaccine_details': campaign.vaccine_details or None,
            'q1': campaign.q1 or 0,
            'q2': campaign.q2 or 0,
            'q3': campaign.q3 or 0,
            'q4': campaign.q4 or 0,
            'total': campaign.total or 0,
            'coverage': campaign.coverage or 0,
            'created_at': current_timestamp
        }
        
        # Create placeholders for SQL query
        columns = ', '.join(campaign_data.keys())
        placeholders = ', '.join(['%s'] * len(campaign_data))
        
        query = f"INSERT INTO risp_vaccination ({columns}) VALUES ({placeholders})"
        cursor.execute(query, list(campaign_data.values()))
        
        campaign_id = cursor.lastrowid
        connection.commit()
        
        # Fetch the newly created record to confirm data
        cursor.execute("SELECT * FROM risp_vaccination WHERE id = %s", (campaign_id,))
        new_record = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return {
            "message": "Vaccination campaign saved successfully",
            "id": campaign_id,
            "data": new_record
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error adding vaccination campaign: {str(e)}")

@router.put("/vaccinations/{campaign_id}")
async def update_vaccination_campaign(
    campaign_id: int,
    campaign: VaccinationCampaign,
    current_user: dict = Depends(get_current_user)
):
    """Update an existing vaccination campaign"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Get user info
        user_id = current_user.get('id')
        country = current_user.get('country')
        
        # Basic validation
        if not country or not campaign.disease_name or not campaign.year:
            raise HTTPException(status_code=400, detail="Country, disease name and year are required")
        
        # First verify the user owns this campaign and get existing data
        verify_query = "SELECT id, user_id, created_at FROM risp_vaccination WHERE id = %s AND user_id = %s"
        cursor.execute(verify_query, (campaign_id, user_id))
        verify_result = cursor.fetchone()
        
        if not verify_result:
            raise HTTPException(status_code=403, detail="Not authorized to update this campaign")
        
        existing_created_at = verify_result.get('created_at')
        location, areas = _normalize_vaccination_location(campaign)
        program = campaign.program if campaign.program in ('risp', 'soi') else 'risp'
        visibility = campaign.visibility if campaign.visibility in ('private', 'public') else 'public'
        
        # Prepare the update data
        campaign_data = {
            'country': country,
            'disease_name': campaign.disease_name,
            'year': campaign.year,
            'status': campaign.status or None,
            'vaccination_type': campaign.vaccination_type,
            'geographical_areas': json.dumps(areas),
            'location': location,
            'province_id': campaign.province_id,
            'district_id': campaign.district_id,
            'program': program,
            'visibility': visibility,
            'species': json.dumps(campaign.species or []),
            'vaccine_details': campaign.vaccine_details or None,
            'q1': campaign.q1 or 0,
            'q2': campaign.q2 or 0,
            'q3': campaign.q3 or 0,
            'q4': campaign.q4 or 0,
            'total': campaign.total or 0,
            'coverage': campaign.coverage or 0,
            'created_at': existing_created_at or datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
        
        # Create SET clause for UPDATE query
        set_clause = ', '.join([f"{key} = %s" for key in campaign_data.keys()])
        query = f"UPDATE risp_vaccination SET {set_clause} WHERE id = %s AND user_id = %s"
        
        values = list(campaign_data.values()) + [campaign_id, user_id]
        cursor.execute(query, values)
        connection.commit()
        
        # Verify the update
        cursor.execute("SELECT * FROM risp_vaccination WHERE id = %s", (campaign_id,))
        updated_record = cursor.fetchone()
        
        cursor.close()
        connection.close()
        
        return {
            "message": "Vaccination campaign updated successfully",
            "data": updated_record
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating vaccination campaign: {str(e)}")

@router.put("/vaccinations/{campaign_id}/remove")
async def remove_vaccination_campaign(
    campaign_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Mark a vaccination campaign as removed via UPDATE only (no SQL DELETE)."""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        user_id = current_user.get('id')
        
        # First verify the user owns this campaign
        verify_query = "SELECT id FROM risp_vaccination WHERE id = %s AND user_id = %s"
        cursor.execute(verify_query, (campaign_id, user_id))
        verify_result = cursor.fetchone()
        
        if not verify_result:
            raise HTTPException(status_code=403, detail="Not authorized to remove this campaign")
        
        cursor.execute(
            """
            UPDATE risp_vaccination
            SET location = %s, geographical_areas = %s, q1 = 0, q2 = 0, q3 = 0, q4 = 0, total = 0
            WHERE id = %s AND user_id = %s
            """,
            ("__deleted__", json.dumps([]), campaign_id, user_id),
        )
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return {"message": "Vaccination campaign removed"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing vaccination campaign: {str(e)}")


@router.get("/dashboard")
async def get_risp_dashboard():
    """Get RISP dashboard data from all three tables (outbreaks, surveillance, vaccination)"""
    try:
        # Disease name normalization function
        def normalize_disease_name(disease_name):
            """Normalize disease names to a common short format"""
            if not disease_name:
                return None
            
            disease_upper = disease_name.upper()
            
            # Map to short codes
            if 'FOOT' in disease_upper or 'FMD' in disease_upper:
                return 'FMD'
            elif 'LUMPY' in disease_upper or 'LSD' in disease_upper:
                return 'LSD'
            elif 'PPR' in disease_upper or 'PESTE' in disease_upper:
                return 'PPR'
            elif 'RIFT' in disease_upper or 'RVF' in disease_upper:
                return 'RVF'
            elif 'SHEEP' in disease_upper and 'POX' in disease_upper or 'SPGP' in disease_upper or 'SGP' in disease_upper:
                return 'SPGP'
            
            return disease_name  # Return original if no match
        
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Fetch all outbreak data
        outbreaks_query = """
        SELECT id, user_id, country, year, quarter, disease_name as Disease, 
               number_outbreaks as Outbreaks, locations, status, serotype, species, 
               control_measures, additional_info, created_at 
        FROM risp_outbreaks 
        ORDER BY year DESC, quarter DESC
        """
        cursor.execute(outbreaks_query)
        outbreaks = cursor.fetchall()
        
        # Process outbreak data - convert quarter format from 'Q1' to just '1' for consistency
        processed_data = []
        for outbreak in outbreaks:
            # Extract quarter number from 'Q1' format
            quarter_str = outbreak.get('quarter', 'Q1')
            quarter_num = int(quarter_str.replace('Q', '')) if quarter_str and 'Q' in quarter_str else 1
            
            processed_row = {
                'id': outbreak.get('id'),
                'Year': int(outbreak.get('year')) if outbreak.get('year') else None,
                'Quarter': quarter_num,
                'Country': outbreak.get('country'),
                'Disease': outbreak.get('Disease'),
                'Outbreaks': outbreak.get('Outbreaks', 0),
                'Region': '',  # Will be determined from country mapping
                'Surveillance': 0,  # Will be updated from surveillance table
                'Vaccination': 0,  # Will be updated from vaccination table
                'locations': outbreak.get('locations'),
                'status': outbreak.get('status'),
                'serotype': outbreak.get('serotype'),
                'species': outbreak.get('species'),
                'control_measures': outbreak.get('control_measures'),
                'Outbreak_Description': outbreak.get('additional_info', ''),
                'Cases': '',
                'Epidemiological_information': '',
                'Vaccination_doses': 0,
                'Vaccination_Description': '',
                'Source': 'RISP'
            }
            processed_data.append(processed_row)
        
        # Fetch surveillance data
        surveillance_query = """
        SELECT country, year, quarter, disease_name 
        FROM risp_surveillance 
        WHERE passive_surveillance IS NOT NULL OR active_surveillance IS NOT NULL
        """
        cursor.execute(surveillance_query)
        surveillances = cursor.fetchall()
        
        # Create surveillance lookup: {country-year-quarter-disease: True}
        surveillance_lookup = {}
        for surv in surveillances:
            quarter_str = surv.get('quarter', 'Q1')
            quarter_num = int(quarter_str.replace('Q', '')) if quarter_str and 'Q' in quarter_str else 1
            year_num = int(surv.get('year')) if surv.get('year') else None
            disease_normalized = normalize_disease_name(surv.get('disease_name'))
            key = f"{surv.get('country')}-{year_num}-{quarter_num}-{disease_normalized}"
            surveillance_lookup[key] = True
        
        print(f"DEBUG: Surveillance lookup keys (normalized): {list(surveillance_lookup.keys())[:10]}")  # Show first 10
        
        # Fetch vaccination data - get ALL records, not just Active
        vaccination_query = """
        SELECT country, year, disease_name, q1, q2, q3, q4, status
        FROM risp_vaccination
        """
        cursor.execute(vaccination_query)
        vaccinations = cursor.fetchall()
        
        # Create vaccination lookup: {country-year-quarter-disease: doses}
        vaccination_lookup = {}
        for vacc in vaccinations:
            year_num = int(vacc.get('year')) if vacc.get('year') else None
            country = vacc.get('country')
            disease_normalized = normalize_disease_name(vacc.get('disease_name'))
            
            # Check each quarter
            for q in [1, 2, 3, 4]:
                doses = vacc.get(f'q{q}', 0)
                if doses and doses > 0:
                    key = f"{country}-{year_num}-{q}-{disease_normalized}"
                    vaccination_lookup[key] = doses
        
        print(f"DEBUG: Vaccination lookup keys (normalized): {list(vaccination_lookup.keys())[:10]}")  # Show first 10
        
        # Update processed data with surveillance and vaccination flags
        matched_vaccination = 0
        matched_surveillance = 0
        
        for row in processed_data:
            disease_normalized = normalize_disease_name(row['Disease'])
            key = f"{row['Country']}-{row['Year']}-{row['Quarter']}-{disease_normalized}"
            
            # Check if surveillance exists
            if key in surveillance_lookup:
                row['Surveillance'] = 1
                matched_surveillance += 1
                if matched_surveillance <= 3:
                    print(f"DEBUG: MATCHED surveillance for: {key}")
            
            # Check if vaccination exists
            if key in vaccination_lookup:
                row['Vaccination'] = 1
                row['Vaccination_doses'] = vaccination_lookup[key]
                matched_vaccination += 1
                if matched_vaccination <= 3:
                    print(f"DEBUG: MATCHED vaccination for: {key}")
        
        print(f"DEBUG: Total vaccination matches: {matched_vaccination}, Total surveillance matches: {matched_surveillance}")
        
        cursor.close()
        connection.close()
        
        # Return data with separate counts for surveillance and vaccination
        return {
            "data": processed_data,
            "countryGeojson": {},
            "surveillance_summary": surveillance_lookup,  # Pass the lookup for frontend to count
            "vaccination_summary": vaccination_lookup     # Pass the lookup for frontend to count
        }
        
    except Exception as e:
        print(f"Error fetching RISP dashboard data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching RISP dashboard data: {str(e)}")

# --- Market prices (normalized risp_marketprice) ---

class MarketPriceRow(BaseModel):
    id: Optional[int] = None
    species: str
    market_level: str
    product: str
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    price_avg: Optional[float] = None
    reference: Optional[str] = None


class MarketPriceBatch(BaseModel):
    year: str
    quarter: str
    rows: List[MarketPriceRow]


# Soft-delete marker — DB user has no DELETE privilege on risp_* tables.
# Stored in `reference` (district/location columns removed from the model).
_MARKETPRICE_DELETED = "__deleted__"


@router.get("/marketprice")
async def get_market_prices(
    year: str = Query(...),
    quarter: str = Query(...),
    current_user: dict = Depends(get_current_user),
):
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT * FROM risp_marketprice
            WHERE user_id = %s AND year = %s AND quarter = %s
              AND (reference IS NULL OR reference <> %s)
            ORDER BY id
            """,
            (current_user.get("id"), year, quarter, _MARKETPRICE_DELETED),
        )
        rows = cursor.fetchall()
        cursor.close()
        connection.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching market prices: {str(e)}")


@router.post("/marketprice")
async def save_market_prices(
    data: MarketPriceBatch,
    current_user: dict = Depends(get_current_user),
):
    """Upsert market price lines for year/quarter (UPDATE/INSERT; no DELETE privilege)."""
    try:
        user_id = current_user.get("id")
        country = current_user.get("country")
        is_soi = _resolve_is_soi(country)
        program = "soi" if is_soi else "risp"

        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT id FROM risp_marketprice
            WHERE user_id = %s AND year = %s AND quarter = %s
              AND (reference IS NULL OR reference <> %s)
            """,
            (user_id, data.year, data.quarter, _MARKETPRICE_DELETED),
        )
        existing_ids = {
            (row["id"] if isinstance(row, dict) else row[0])
            for row in (cursor.fetchall() or [])
        }
        kept_ids = set()
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        for row in data.rows:
            if row.species not in ("cattle", "sheep", "pig"):
                continue
            if row.market_level not in ("district", "capital"):
                continue
            if row.product not in ("live", "meat"):
                continue

            if row.id and row.id in existing_ids:
                cursor.execute(
                    """
                    UPDATE risp_marketprice SET
                      species = %s, market_level = %s, product = %s,
                      price_min = %s, price_max = %s, price_avg = %s,
                      reference = %s,
                      program = %s, visibility = 'public',
                      created_at = COALESCE(created_at, %s),
                      updated_at = %s
                    WHERE id = %s AND user_id = %s
                    """,
                    (
                        row.species,
                        row.market_level,
                        row.product,
                        row.price_min,
                        row.price_max,
                        row.price_avg,
                        row.reference,
                        program,
                        now,
                        now,
                        row.id,
                        user_id,
                    ),
                )
                kept_ids.add(row.id)
            else:
                cursor.execute(
                    """
                    INSERT INTO risp_marketprice
                      (user_id, country, year, quarter, species, market_level, product,
                       price_min, price_max, price_avg, reference,
                       program, visibility, created_at, updated_at)
                    VALUES
                      (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'public', %s, %s)
                    """,
                    (
                        user_id,
                        country,
                        data.year,
                        data.quarter,
                        row.species,
                        row.market_level,
                        row.product,
                        row.price_min,
                        row.price_max,
                        row.price_avg,
                        row.reference,
                        program,
                        now,
                        now,
                    ),
                )

        # Soft-remove rows dropped from the form
        for orphan_id in existing_ids - kept_ids:
            cursor.execute(
                """
                UPDATE risp_marketprice
                SET reference = %s, price_min = NULL, price_max = NULL, price_avg = NULL
                WHERE id = %s AND user_id = %s
                """,
                (_MARKETPRICE_DELETED, orphan_id, user_id),
            )

        connection.commit()
        cursor.execute(
            """
            SELECT * FROM risp_marketprice
            WHERE user_id = %s AND year = %s AND quarter = %s
              AND (reference IS NULL OR reference <> %s)
            ORDER BY id
            """,
            (user_id, data.year, data.quarter, _MARKETPRICE_DELETED),
        )
        saved = cursor.fetchall()
        cursor.close()
        connection.close()
        return {"message": "Market prices saved", "data": saved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error saving market prices: {str(e)}")


@router.put("/marketprice/{row_id}/remove")
async def remove_market_price(
    row_id: int,
    current_user: dict = Depends(get_current_user),
):
    """Mark a market-price row as removed via UPDATE only (no SQL DELETE)."""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            UPDATE risp_marketprice
            SET reference = %s, price_min = NULL, price_max = NULL, price_avg = NULL
            WHERE id = %s AND user_id = %s
            """,
            (_MARKETPRICE_DELETED, row_id, current_user.get("id")),
        )
        connection.commit()
        cursor.close()
        connection.close()
        return {"message": "Removed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error removing market price: {str(e)}")
