from __future__ import annotations

from fastapi import APIRouter, HTTPException, Depends, status, Query
from typing import List, Dict, Any, Optional
import ast
import httpx
from datetime import datetime
from models import FastReportEntry, ResponseModel
from auth import get_current_user
from database import db_helper
from services.beacon_client import fetch_beacon_news

router = APIRouter(prefix="/api/fast-report", tags=["fast-report"])

# WAHIS disease labels → FAST short codes used by the map layers
_INFUR_DISEASE_MAP = (
    ("foot and mouth", "FMD"),
    ("lumpy skin", "LSD"),
    ("peste des petits", "PPR"),
    ("rift valley", "RVF"),
    ("sheep pox", "SPGP"),
    ("goat pox", "SPGP"),
)

# INFUR dump may include non-European countries; keep Europe-only for Now map
_INFUR_NON_EUROPE = {
    "israel",
    "mauritania",
    "algeria",
    "lebanon",
    "palestine",
    "mali",
    "sudan",
    "south sudan (rep. of)",
    "south sudan",
}


def _map_infur_disease(raw: Optional[str]) -> Optional[str]:
    name = (raw or "").lower()
    for needle, code in _INFUR_DISEASE_MAP:
        if needle in name:
            return code
    return None


def _parse_wahis_dict_label(raw: Optional[str]) -> Optional[str]:
    """Extract translation/keyValue from WAHIS dict-like strings stored as text."""
    if not raw or not str(raw).strip():
        return None
    text = str(raw).strip()
    try:
        parsed = ast.literal_eval(text)
        if isinstance(parsed, dict):
            return parsed.get("translation") or parsed.get("keyValue") or None
    except (ValueError, SyntaxError):
        pass
    return text if len(text) < 80 else None


def _current_semester_start(now: Optional[datetime] = None) -> str:
    now = now or datetime.utcnow()
    month = 1 if now.month < 7 else 7
    return f"{now.year:04d}-{month:02d}-01"


def _parse_iso_date_prefix(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    s = str(raw).strip()
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        return s[:10]
    return None

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
async def get_fast_reports():
    """Get all fast report entries (public — Fast Report page is unauthenticated)."""
    try:
        result = await db_helper.execute_main_query("SELECT * FROM FAST_Report ORDER BY Year DESC, Quarter DESC")
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        return result["data"]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/by-year/{year}")
async def get_fast_reports_by_year(year: int):
    """Get fast reports by year (public)."""
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
async def get_fast_reports_by_country(country: str):
    """Get fast reports by country (public — used by country click panel)."""
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
async def get_fast_reports_by_region(region: str):
    """Get fast reports by region (public)."""
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
async def get_fast_report_summary():
    """Get summary statistics for fast reports (public)."""
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
                'Vaccination': row.get('Vaccination', 0),
                'Vaccination_Doses': row.get('Vaccination_Doses', 0),
                'Vaccination_Description': row.get('Vaccination_Description', ''),
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


@router.get("/country-boundaries")
async def get_country_boundaries(iso3: Optional[str] = None):
    """
    Proxy UN ClearMap layer 109 country polygons as GeoJSON (WGS84).
    Avoids browser CORS / oversized direct calls. Pass comma-separated ISO3 codes.
    Batches requests so PCP world views (80+ countries) are not truncated.
    """
    codes: List[str] = []
    if iso3:
        codes = [c.strip().upper() for c in iso3.split(",") if c.strip()]
    if not codes:
        raise HTTPException(status_code=400, detail="Provide iso3 query param, e.g. iso3=TUR,EGY")

    # Deduplicate, keep a generous upper bound for PCP world maps
    codes = list(dict.fromkeys(codes))[:150]
    batch_size = 40
    all_features: List[dict] = []

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
            for i in range(0, len(codes), batch_size):
                batch = codes[i : i + batch_size]
                codes_sql = "','".join(batch)
                url = (
                    "https://geoservices.un.org/arcgis/rest/services/ClearMap_WebTopo/MapServer/109/query"
                    f"?where=ISO3CD%20IN%20('{codes_sql}')"
                    "&outFields=ISO3CD,ROMNAM"
                    "&returnGeometry=true"
                    "&outSR=4326"
                    "&f=geojson"
                )
                response = await client.get(url)
                response.raise_for_status()
                data = response.json()
                if not isinstance(data, dict) or data.get("type") != "FeatureCollection":
                    raise HTTPException(
                        status_code=502, detail="UN GeoServices returned invalid GeoJSON"
                    )
                features = data.get("features") or []
                for f in features:
                    if (
                        isinstance(f, dict)
                        and f.get("type") == "Feature"
                        and f.get("geometry")
                        and f.get("properties")
                    ):
                        all_features.append(f)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"UN GeoServices request failed: {e}")

    return {"type": "FeatureCollection", "features": all_features}


def _quarter_date_bounds(year: int, quarter: int) -> tuple[str, str]:
    bounds = {
        1: (f"{year}-01-01", f"{year}-03-31"),
        2: (f"{year}-04-01", f"{year}-06-30"),
        3: (f"{year}-07-01", f"{year}-09-30"),
        4: (f"{year}-10-01", f"{year}-12-31"),
    }
    return bounds[quarter]


def _infur_matches_historical_period(
    outbreak_start: Optional[str],
    year: Optional[int],
    quarter: Optional[int],
) -> bool:
    if not outbreak_start:
        return False
    if year is not None:
        if quarter is not None:
            start, end = _quarter_date_bounds(year, quarter)
            return start <= outbreak_start <= end
        return outbreak_start.startswith(f"{year:04d}-")
    if quarter is not None:
        try:
            month = int(outbreak_start[5:7])
        except (TypeError, ValueError):
            return False
        q = 1 if month <= 3 else 2 if month <= 6 else 3 if month <= 9 else 4
        return q == quarter
    return True


@router.get("/infur")
async def get_infur_outbreaks(
    mode: str = Query("now", description="now = current semester; historical = year/quarter archive"),
    year: Optional[int] = Query(None, ge=1990, le=2100),
    quarter: Optional[int] = Query(None, ge=1, le=4),
):
    """
    WAHIS immediate notifications (INFUR) for the Europe map.
    Now: current semester + ongoing events. Historical: filter by outbreak start year/quarter.
    """
    try:
        historical = mode.strip().lower() == "historical"
        semester_start = _current_semester_start()
        semester_label = f"{semester_start[:4]}-{'H1' if semester_start[5:7] == '01' else 'H2'}"

        result = await db_helper.execute_main_query(
            """
            SELECT
              eventId, reportId, reportType, reportNumber, reportStatus,
              submissionDate, eventStartDate, eventStatus, country, disease, reason,
              outbreakId, outbreakReference, nationalReference,
              adminDivision, location, locationApprox, latitude, longitude,
              outbreakStartDate, outbreakEndDate, epiUnitType, isCluster,
              speciesName, isWild, qtyScope,
              susceptible, cases, deaths, killed, slaughtered, vaccinated
            FROM INFUR
            WHERE latitude IS NOT NULL
              AND longitude IS NOT NULL
              AND latitude <> 0
              AND longitude <> 0
              AND (qtyScope = 'total' OR qtyScope IS NULL OR qtyScope = '')
            ORDER BY outbreakStartDate DESC, outbreakId DESC
            """
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])

        points = []
        seen = set()

        for row in result["data"] or []:
            country = (row.get("country") or "").strip()
            if not country or country.lower() in _INFUR_NON_EUROPE:
                continue

            disease_code = _map_infur_disease(row.get("disease"))
            if not disease_code:
                continue

            try:
                lat = float(row["latitude"])
                lng = float(row["longitude"])
            except (TypeError, ValueError):
                continue

            outbreak_start = _parse_iso_date_prefix(row.get("outbreakStartDate"))
            event_status = (row.get("eventStatus") or "").strip()
            if historical:
                if not _infur_matches_historical_period(outbreak_start, year, quarter):
                    continue
            else:
                in_semester = bool(outbreak_start and outbreak_start >= semester_start)
                ongoing = event_status.lower() in {"on-going", "ongoing", "stable"}
                if not in_semester and not ongoing:
                    continue

            outbreak_id = row.get("outbreakId")
            species = (row.get("speciesName") or "").strip()
            dedupe_key = (outbreak_id, species, round(lat, 5), round(lng, 5))
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            points.append(
                {
                    "eventId": row.get("eventId"),
                    "reportId": row.get("reportId"),
                    "outbreakId": outbreak_id,
                    "outbreakReference": row.get("outbreakReference"),
                    "nationalReference": row.get("nationalReference"),
                    "reportType": row.get("reportType"),
                    "reportStatus": row.get("reportStatus"),
                    "eventStatus": event_status,
                    "country": country,
                    "disease": disease_code,
                    "diseaseLabel": row.get("disease"),
                    "reason": row.get("reason"),
                    "adminDivision": row.get("adminDivision"),
                    "location": row.get("location"),
                    "locationApprox": row.get("locationApprox"),
                    "latitude": lat,
                    "longitude": lng,
                    "outbreakStartDate": outbreak_start,
                    "outbreakEndDate": _parse_iso_date_prefix(row.get("outbreakEndDate")),
                    "submissionDate": _parse_iso_date_prefix(row.get("submissionDate")),
                    "eventStartDate": _parse_iso_date_prefix(row.get("eventStartDate")),
                    "epiUnitType": _parse_wahis_dict_label(row.get("epiUnitType")),
                    "speciesName": species or None,
                    "isWild": row.get("isWild"),
                    "susceptible": row.get("susceptible"),
                    "cases": row.get("cases"),
                    "deaths": row.get("deaths"),
                    "killed": row.get("killed"),
                    "slaughtered": row.get("slaughtered"),
                    "vaccinated": row.get("vaccinated"),
                }
            )

        return {
            "mode": "historical" if historical else "now",
            "semester": semester_label if not historical else None,
            "semesterStart": semester_start if not historical else None,
            "year": year,
            "quarter": quarter,
            "count": len(points),
            "data": points,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/beacon-news")
async def get_beacon_news(
    region: str = Query("all", description="FAST region, Europe, or all"),
    diseases: Optional[str] = Query(
        None, description="Comma-separated disease codes, e.g. FMD,PPR"
    ),
    limit: int = Query(20, ge=1, le=50),
):
    """
    BEACON curated disease news/reports for the Fast Report map filters.
    Scope: EU + EuFMD neighbourhood countries; filter by FAST region and diseases.
    """
    try:
        codes = [c.strip().upper() for c in (diseases or "").split(",") if c.strip()]
        return await fetch_beacon_news(region=region, disease_codes=codes, limit=limit)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
