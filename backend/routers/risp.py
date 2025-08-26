from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import json
from datetime import datetime
from auth import get_current_user
import pymysql
from config import settings

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

# Pydantic models for request/response
class OutbreakDiseaseData(BaseModel):
    disease: str
    number_outbreaks: int
    locations: Optional[List[str]] = []
    species: List[str]
    status: List[str]
    serotype: List[str]
    control_measures: List[str]
    comments: str  # This maps to additional_info in the database

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
    geographical_areas: Optional[List[str]] = []
    species: Optional[List[str]] = []
    vaccine_details: Optional[str] = None
    q1: Optional[int] = 0
    q2: Optional[int] = 0
    q3: Optional[int] = 0
    q4: Optional[int] = 0
    total: Optional[int] = 0
    coverage: Optional[int] = 0

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
        SELECT user_id, country, year, quarter, disease_name, number_outbreaks, 
               locations, status, serotype, species, control_measures, additional_info 
        FROM risp_outbreaks 
        WHERE user_id = %s AND year = %s AND quarter = %s
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
    """Save outbreak data"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        # Get user info
        user_id = current_user.get('id')
        country = current_user.get('country')
        
        # If no diseases provided, return success
        if not data.diseases or len(data.diseases) == 0:
            return {"message": "No outbreak data to save"}
        
        # Prepare values for batch insert/update using INSERT ON DUPLICATE KEY UPDATE
        values = []
        for disease_data in data.diseases:
            values.extend([
                user_id,
                country,
                data.year,
                data.quarter,
                disease_data.disease,
                disease_data.number_outbreaks,
                json.dumps(disease_data.locations or []),
                json.dumps(disease_data.status or []),
                json.dumps(disease_data.serotype or []),
                json.dumps(disease_data.species or []),
                json.dumps(disease_data.control_measures or []),
                disease_data.comments or ""
            ])
        
        # Create placeholders for multiple records
        num_diseases = len(data.diseases)
        placeholders = ", ".join(["(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"] * num_diseases)
        
        query = f"""
        INSERT INTO risp_outbreaks 
        (user_id, country, year, quarter, disease_name, number_outbreaks, 
         locations, status, serotype, species, control_measures, additional_info)
        VALUES {placeholders}
        ON DUPLICATE KEY UPDATE
        number_outbreaks = VALUES(number_outbreaks),
        locations = VALUES(locations),
        status = VALUES(status),
        serotype = VALUES(serotype),
        species = VALUES(species),
        control_measures = VALUES(control_measures),
        additional_info = VALUES(additional_info)
        """
        
        cursor.execute(query, values)
        connection.commit()
        cursor.close()
        connection.close()
        
        return {"message": "Outbreak data saved successfully"}
        
    except Exception as e:
        print(f"Error saving outbreak data: {str(e)}")
        print(f"Data received: {data}")
        print(f"Values prepared: {values}")
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
        
        query = "SELECT * FROM risp_vaccination WHERE user_id = %s"
        cursor.execute(query, (current_user.get('id'),))
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
            
            parsed_campaign = {
                **campaign,
                'geographical_areas': safe_json_parse(campaign.get('geographical_areas')),
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
        
        # Prepare the campaign data
        campaign_data = {
            'user_id': user_id,
            'country': country,
            'disease_name': campaign.disease_name,
            'year': campaign.year,
            'status': campaign.status or None,
            'vaccination_type': campaign.vaccination_type,
            'geographical_areas': json.dumps(campaign.geographical_areas or []),
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
        
        # Prepare the update data
        campaign_data = {
            'country': country,
            'disease_name': campaign.disease_name,
            'year': campaign.year,
            'status': campaign.status or None,
            'vaccination_type': campaign.vaccination_type,
            'geographical_areas': json.dumps(campaign.geographical_areas or []),
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

@router.delete("/vaccinations/{campaign_id}")
async def delete_vaccination_campaign(
    campaign_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete a vaccination campaign"""
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        
        user_id = current_user.get('id')
        
        # First verify the user owns this campaign
        verify_query = "SELECT id FROM risp_vaccination WHERE id = %s AND user_id = %s"
        cursor.execute(verify_query, (campaign_id, user_id))
        verify_result = cursor.fetchone()
        
        if not verify_result:
            raise HTTPException(status_code=403, detail="Not authorized to delete this campaign")
        
        # Delete the campaign
        delete_query = "DELETE FROM risp_vaccination WHERE id = %s AND user_id = %s"
        cursor.execute(delete_query, (campaign_id, user_id))
        connection.commit()
        
        cursor.close()
        connection.close()
        
        return {"message": "Vaccination campaign deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting vaccination campaign: {str(e)}")
