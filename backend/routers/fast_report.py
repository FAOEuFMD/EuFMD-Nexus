from fastapi import APIRouter, HTTPException, Depends, status
from typing import List, Dict, Any
import httpx
from datetime import datetime
from models import FastReportEntry, ResponseModel
from auth import get_current_user
from database import db_helper

router = APIRouter(prefix="/api/fast-report", tags=["fast-report"])

async def fetch_iso3_coordinates(iso3_codes: List[str]) -> Dict[str, Any]:
    """Fetch country GeoJSON data from UN service"""
    if not iso3_codes:
        return {}
    
    iso3_codes_str = "','".join(iso3_codes)
    url = f"https://geoservices.un.org/arcgis/rest/services/ClearMap_WebTopo/MapServer/109/query?where=ISO3CD%20IN%20('{iso3_codes_str}')&outFields=ISO3CD&returnGeometry=true&f=geojson"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
    except Exception as error:
        print(f"Error fetching ISO3 coordinates: {error}")
        return {}

@router.get("/")
async def get_fast_reports(current_user: dict = Depends(get_current_user)):
    """Get all fast report entries"""
    try:
        result = await db_helper.execute_main_query("SELECT * FROM FAST_Report ORDER BY Year DESC, Quarter DESC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/by-year/{year}")
async def get_fast_reports_by_year(
    year: int,
    current_user: dict = Depends(get_current_user)
):
    """Get fast reports by year"""
    try:
        result = await db_helper.execute_main_query(
            "SELECT * FROM FAST_Report WHERE Year = %s ORDER BY Quarter DESC",
            (year,)
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/by-country/{country}")
async def get_fast_reports_by_country(
    country: str,
    current_user: dict = Depends(get_current_user)
):
    """Get fast reports by country"""
    try:
        result = await db_helper.execute_main_query(
            "SELECT * FROM FAST_Report WHERE Country = %s ORDER BY Year DESC, Quarter DESC",
            (country,)
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/by-region/{region}")
async def get_fast_reports_by_region(
    region: str,
    current_user: dict = Depends(get_current_user)
):
    """Get fast reports by region"""
    try:
        result = await db_helper.execute_main_query(
            "SELECT * FROM FAST_Report WHERE Region = %s ORDER BY Year DESC, Quarter DESC",
            (region,)
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/add", response_model=ResponseModel)
async def add_fast_report(
    report_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Add new fast report entry"""
    try:
        # Build dynamic insert query based on provided fields
        fields = []
        values = []
        placeholders = []
        
        allowed_fields = [
            'Year', 'Quarter', 'Report_Date', 'Region', 'Country', 'Disease',
            'Outbreaks', 'Cases', 'Outbreak_Description', 'Epidemiological_Information',
            'Surveillance', 'Vaccination', 'Vaccination_Doses', 'Vaccination_Description',
            'Other_Info', 'Source'
        ]
        
        for field in allowed_fields:
            if field in report_data and report_data[field] is not None:
                fields.append(f"`{field}`")
                values.append(report_data[field])
                placeholders.append("%s")
        
        if not fields:
            raise HTTPException(status_code=400, detail="No valid fields provided")
        
        query = f"INSERT INTO FAST_Report ({', '.join(fields)}) VALUES ({', '.join(placeholders)})"
        result = await db_helper.execute_main_query(query, tuple(values))
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {"message": "Fast report entry created successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{report_id}", response_model=ResponseModel)
async def update_fast_report(
    report_id: int,
    report_data: dict,
    current_user: dict = Depends(get_current_user)
):
    """Update fast report entry"""
    try:
        # Build dynamic update query
        updates = []
        values = []
        
        allowed_fields = [
            'Year', 'Quarter', 'Report_Date', 'Region', 'Country', 'Disease',
            'Outbreaks', 'Cases', 'Outbreak_Description', 'Epidemiological_Information',
            'Surveillance', 'Vaccination', 'Vaccination_Doses', 'Vaccination_Description',
            'Other_Info', 'Source'
        ]
        
        for field in allowed_fields:
            if field in report_data:
                updates.append(f"`{field}` = %s")
                values.append(report_data[field])
        
        if not updates:
            raise HTTPException(status_code=400, detail="No valid fields to update")
        
        values.append(report_id)  # Add ID for WHERE clause
        
        query = f"UPDATE FAST_Report SET {', '.join(updates)} WHERE id = %s"
        result = await db_helper.execute_main_query(query, tuple(values))
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {"message": "Fast report entry updated successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{report_id}", response_model=ResponseModel)
async def delete_fast_report(
    report_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete fast report entry"""
    try:
        result = await db_helper.execute_main_query(
            "DELETE FROM FAST_Report WHERE id = %s",
            (report_id,)
        )
        
        if result["error"]:
            raise HTTPException(status_code=400, detail=result["error"])
        
        return {"message": "Fast report entry deleted successfully", "status": "success"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/summary")
async def get_fast_report_summary(current_user: dict = Depends(get_current_user)):
    """Get summary statistics for fast reports"""
    try:
        # Get counts by year
        year_counts = await db_helper.execute_main_query(
            "SELECT Year, COUNT(*) as count FROM FAST_Report GROUP BY Year ORDER BY Year DESC"
        )
        
        # Get counts by region
        region_counts = await db_helper.execute_main_query(
            "SELECT Region, COUNT(*) as count FROM FAST_Report GROUP BY Region ORDER BY count DESC"
        )
        
        # Get counts by disease
        disease_counts = await db_helper.execute_main_query(
            "SELECT Disease, COUNT(*) as count FROM FAST_Report GROUP BY Disease ORDER BY count DESC"
        )
        
        return {
            "by_year": year_counts["data"] if not year_counts["error"] else [],
            "by_region": region_counts["data"] if not region_counts["error"] else [],
            "by_disease": disease_counts["data"] if not disease_counts["error"] else []
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/create-dashboard")
async def create_dashboard():
    """Create dashboard data matching Vue implementation"""
    try:
        # Fetch fast report data
        result = await db_helper.execute_main_query("SELECT * FROM FAST_Report ORDER BY Report_Date DESC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        raw_data = result["data"]
        
        # Process data to add calculated fields
        processed_data = []
        iso3_codes = set()
        
        for row in raw_data:
            # Parse date to extract year and quarter
            report_date = row.get('Report_Date', '')
            year = row.get('Year')
            quarter = row.get('Quarter')
            
            # If year/quarter not in data, try to extract from Report_Date
            if not year and report_date:
                try:
                    date_obj = datetime.strptime(str(report_date)[:10], '%Y-%m-%d')
                    year = date_obj.year
                    quarter = (date_obj.month - 1) // 3 + 1
                except:
                    year = None
                    quarter = None
            
            # Add calculated fields
            processed_row = {
                **row,
                'Year': year,
                'Quarter': quarter,
                'ISO3CD': row.get('Country', ''),  # Map country name to ISO3 if needed
                'Vaccination': 'Vaccinated' if row.get('Vaccination') == 1 else 'Not Vaccinated',
                'Outbreaks': row.get('Outbreaks', 0)
            }
            
            processed_data.append(processed_row)
            
            # Collect ISO3 codes for GeoJSON (using country name as fallback)
            if row.get('Country'):
                iso3_codes.add(row.get('Country'))
        
        # Fetch country GeoJSON data
        country_geojson = {}
        if iso3_codes:
            country_geojson = await fetch_iso3_coordinates(list(iso3_codes))
        
        return {
            "data": processed_data,
            "countryGeojson": country_geojson
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
