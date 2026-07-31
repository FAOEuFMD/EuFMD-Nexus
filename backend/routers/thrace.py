from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from typing import List, Dict, Any, Optional
from database import DatabaseHelper, thrace_engine
from auth import get_current_user
from datetime import datetime, date
from pathlib import Path
import openpyxl
from io import BytesIO
import json
from .thrace_calculator import ThraceCalculator

router = APIRouter(prefix="/api/thrace", tags=["thrace"])

# Global cache for epiunits mapping - loaded once at startup
# Keys are uppercased strings: epiunitcountrycode, str(epiunitID), and unique villagenames.
_epiunits_cache: Dict[str, int] = {}
_epiunit_ids: set = set()
_cache_loaded = False

_EXCEL_ERROR_TOKENS = {
    "#N/A", "#NA", "#REF!", "#VALUE!", "#NAME?", "#DIV/0!", "#NULL!", "#NUM!", "#GETTING_DATA"
}


def _normalize_excel_value(value) -> Any:
    """Turn Excel empty / error / whitespace values into None."""
    if value is None:
        return None
    # openpyxl may return error codes as strings when data_only=True
    text = str(value).strip()
    if text == "" or text.upper() in _EXCEL_ERROR_TOKENS:
        return None
    return value


def is_blank_value(value) -> bool:
    return _normalize_excel_value(value) is None


async def load_epiunits_cache():
    """Load epiunits mapping cache at startup (called once)."""
    global _epiunits_cache, _epiunit_ids, _cache_loaded
    if _cache_loaded:
        return

    print("Loading epiunits cache at startup...")
    epiunits_query = (
        "SELECT epiunitID, epiunitcountrycode, villagename FROM thrace.epiunits"
    )
    epiunits_result = await DatabaseHelper.execute_thrace_query(epiunits_query)

    code_map: Dict[str, int] = {}
    name_counts: Dict[str, int] = {}
    name_to_id: Dict[str, int] = {}
    ids: set = set()

    if epiunits_result.get("data"):
        for row in epiunits_result["data"]:
            uid = row.get("epiunitID")
            if uid is None:
                continue
            uid = int(uid)
            ids.add(uid)
            code_map[str(uid)] = uid

            code = row.get("epiunitcountrycode")
            if code is not None and str(code).strip() != "":
                code_map[str(code).strip().upper()] = uid

            name = row.get("villagename")
            if name is not None and str(name).strip() != "":
                key = str(name).strip().upper()
                name_counts[key] = name_counts.get(key, 0) + 1
                name_to_id[key] = uid

        # Only index names that map to a single epiunit (ambiguous villages excluded)
        for key, count in name_counts.items():
            if count == 1:
                code_map[key] = name_to_id[key]

    _epiunits_cache = code_map
    _epiunit_ids = ids
    _cache_loaded = True
    print(
        f"Epiunits cache loaded with {len(_epiunits_cache)} keys "
        f"({len(_epiunit_ids)} epiunit IDs)"
    )


def resolve_epiunit_id(farm_id_value, village_code_value) -> int:
    """Resolve an epiunitID from Farm ID and/or Village/Epiunit code cells.

    Templates VLOOKUP into Farm ID the numeric epiunitID. Village/Epiunit code is what
    the user typed (country code for GR/TR, village name for some BG templates).
    """
    candidates = []
    for raw in (farm_id_value, village_code_value):
        normalized = _normalize_excel_value(raw)
        if normalized is None:
            continue
        candidates.append(normalized)

    for candidate in candidates:
        # Prefer direct numeric epiunitID (Farm ID after Excel calculation)
        if is_numeric(candidate):
            uid = int(float(candidate))
            if uid in _epiunit_ids:
                return uid
        key = str(candidate).strip().upper()
        if key in _epiunits_cache:
            return _epiunits_cache[key]

    return 0


def is_numeric(value) -> bool:
    try:
        if value is None:
            return False
        float(value)
        return True
    except (TypeError, ValueError):
        return False

@router.get("/inspectors")
async def get_inspectors(current_user: dict = Depends(get_current_user)):
    """
    Get inspectors for the current user's country from thrace_inspectors table
    """
    user_country = current_user.get("country")
    if not user_country:
        raise HTTPException(status_code=400, detail="User country not set")
    
    try:
        query = """
            SELECT id, name, country 
            FROM thrace_inspectors 
            WHERE country = :country
            ORDER BY name
        """
        
        result = await DatabaseHelper.execute_main_query(
            query, 
            {"country": user_country}
        )
        
        if result.get("error"):
            raise HTTPException(status_code=500, detail=f"Database error: {result['error']}")
        
        inspectors = []
        for row in result.get("data", []):
            inspectors.append({
                "id": row.get("id"),
                "name": row.get("name"),
                "country": row.get("country")
            })
        
        return {"inspectors": inspectors}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching inspectors: {str(e)}")

@router.post("/upload-data")
async def upload_thrace_data(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Upload Excel file with THRACE surveillance data.
    Validates every row; if all rows are clean they are imported directly into the
    production factivities table (no staging / manual approval step). If any row fails
    validation, nothing is imported and an error report is returned for correction.
    """
    try:
        print(f"Upload endpoint called - file: {file.filename}, user_id: {current_user.get('user_id')}")
        
        # Ensure epiunits cache is loaded
        await load_epiunits_cache()
        
        # Validate file exists
        if not file:
            raise HTTPException(status_code=400, detail="No file provided")
        
        # Validate file type
        if not file.filename.endswith('.xlsx'):
            raise HTTPException(status_code=400, detail="Only .xlsx files are allowed")
        
        print(f"File validation passed: {file.filename}")
        
        # Read Excel file with calculated values (data_only=True reads formula results, not formulas)
        contents = await file.read()
        workbook = openpyxl.load_workbook(BytesIO(contents), data_only=True)
        worksheet = workbook.active
        
        # Read header row (row 1) to map Excel columns to database fields
        header_row = worksheet[1]
        column_map = {}
        
        # Map Excel column headers to database field names
        header_to_field = {
            'Farm ID': 'farmID',
            'InspectorID': 'inspectorID',
            'Village/Epiunit code': 'epiunitcountrycode',
            'Year': 'year',
            'Month': 'month',
            'Day': 'day',
            'Cattle': 'cattle',
            'Sheep': 'sheep',
            'Goats': 'goat',
            'Pigs': 'pig',
            'W Buffalo': 'buffalo',
            'Cattle clin exam': 'cattleexam',
            'Cattle tested': 'cattletested',
            'Cattle clin pos FMD': 'cattlecliposFMD',
            'Cattle clin pos LSD': 'cattlecliposLSD',
            'Sheep clin exam': 'sheepexam',
            'Sheep clin pos FMD': 'sheepposFMD',
            'Sheep clin pos SGP': 'sheepposSGP',
            'Sheep clin pos PPR': 'sheepposPPR',
            'Goats clin exam': 'goatsexam',
            'Goats clin pos FMD': 'goatsposFMD',
            'Goats clin pos SGP': 'goatsposSGP',
            'Goats clin pos PPR': 'goatsposPPR',
            'Buffalo clin exam': 'buffaloesexam',
            'Buffalo clin pos FMD': 'buffaloesposFMD',
            'Buffalo clin pos LSD': 'buffaloesposLSD',
            'Cattle smpl': 'cattlesample',
            'Cattle sero pos FMD': 'cattleseroposFMD',
            'Cattle pos LSD': 'cattleseroposLSD',
            'Sheep tested': 'sheeptested',
            'Sheep smpl': 'sheepsample',
            'Sheep sero pos FMD': 'sheepseroposFMD',
            'Sheep test pos SGP': 'sheepseroposSGP',
            'Sheep sero pos PPR': 'sheepseroposPPR',
            'Goats tested': 'goattested',
            'Goats smpl': 'goatsample',
            'Goats sero pos FMD': 'goatsseroposFMD',
            'Goats test pos SGP': 'goatsseroposSGP',
            'Goat sero pos PPR': 'goatsseroposPPR',
            'Pigs tested': 'pigtested',
            'Pigs smpl': 'pigssample',
            'Pigs sero pos FMD': 'pigsserosposFMD',
            'Buffalo tested': 'buffalotested',
            'Buffalo smpl': 'buffaloessample',
            'Buffalo sero pos FMD': 'buffaloesseroposFMD',
            'Buffalo test pos LSD': 'buffaloesseroposLSD',
            'Wild tested': 'wildtested',
            'Wild smpl': 'wildsample',
            'Wild sero pos FMD': 'wildserosposFMD'
        }
        
        # Build column index map
        for col_idx, cell in enumerate(header_row):
            header_value = str(cell.value).strip() if cell.value else None
            if header_value and header_value in header_to_field:
                column_map[header_to_field[header_value]] = col_idx
        
        print(f"Mapped {len(column_map)} columns from Excel header")

        # Fail fast if required date columns are missing from the header
        required_headers = {
            'year': 'Year',
            'month': 'Month',
            'day': 'Day',
            'epiunitcountrycode': 'Village/Epiunit code',
            'inspectorID': 'InspectorID',
        }
        missing_headers = [
            label for field, label in required_headers.items() if field not in column_map
        ]
        if missing_headers:
            return {
                "success": False,
                "has_errors": True,
                "message": (
                    "Required column(s) not found in the Excel header: "
                    + ", ".join(missing_headers)
                    + ". Use the official THRACE template without renaming header cells."
                ),
                "total_rows": 0,
                "clean_rows": 0,
                "error_rows": len(missing_headers),
                "error_count": len(missing_headers),
                "error_rows_detail": [
                    {
                        "rowId": 1,
                        "village": "",
                        "country": "",
                        "date": None,
                        "error": f"Missing required header column: {label}",
                    }
                    for label in missing_headers
                ],
                "inserted_count": 0,
            }
        
        user_id = current_user.get('user_id')
        
        # Clear previous upload for this user - each upload is fresh
        print(f"Clearing previous staging data for user {user_id}...")
        clear_query = "DELETE FROM thrace.factivities_tmp WHERE userID = %s"
        await DatabaseHelper.execute_thrace_query(clear_query, (user_id,))
        print(f"Staging table cleared for user {user_id}")
        
        # Use cached epiunits mapping
        epiunits_map = _epiunits_cache
        print(f"Using cached epiunits mapping with {len(epiunits_map)} keys / {len(_epiunit_ids)} IDs")
        
        clean_rows = 0
        error_rows = 0
        total_rows = 0
        inserted_data = []
        error_messages = []
        error_details = []

        def is_row_blank(row_cells) -> bool:
            return all(is_blank_value(cell.value) for cell in row_cells)
        
        # Process rows 2 to 401 (400 data rows max, row 1 is header).
        # Stop at the first blank row (end of data) — do not keep scanning the rest
        # of the template's empty formatted rows.
        for row_idx in range(2, min(402, worksheet.max_row + 1)):
            row = worksheet[row_idx]
            
            # Helper function to get cell value by field name
            def get_value(field_name):
                if field_name in column_map:
                    return _normalize_excel_value(row[column_map[field_name]].value)
                return None
            
            # Entirely empty/whitespace/#N/A row => end of data, stop reading
            if is_row_blank(row):
                print(f"Row {row_idx}: blank row — stopping upload parse")
                break

            # Empty Year normally means end of the data block (legacy PHP behaviour).
            # Only treat it as a validation error when the row already has identity data
            # (village / epiunit / inspector / farm id) — i.e. the user started a row but forgot Year.
            year_value = get_value('year')
            if is_blank_value(year_value):
                village_hint = str(row[1].value).strip() if not is_blank_value(row[1].value) else ""
                if village_hint.upper() in _EXCEL_ERROR_TOKENS:
                    village_hint = ""
                country_hint = str(get_value('epiunitcountrycode') or get_value('farmID') or "").strip().upper()
                inspector_hint = get_value('inspectorID')
                farm_hint = get_value('farmID')
                row_started = bool(
                    village_hint
                    or country_hint
                    or not is_blank_value(inspector_hint)
                    or not is_blank_value(farm_hint)
                )
                if row_started:
                    total_rows += 1
                    error_rows += 1
                    error_msg = "Year is empty or missing"
                    error_messages.append(f"Row {row_idx}: {error_msg}")
                    error_details.append({
                        "rowId": row_idx,
                        "village": village_hint,
                        "country": country_hint,
                        "date": None,
                        "error": error_msg,
                    })
                    print(f"Row {row_idx}: {error_msg} — stopping upload parse")
                else:
                    print(f"Row {row_idx}: Year empty with no identity data — end of data, stopping")
                break
            
            total_rows += 1
            if row_idx <= 6:
                print(f"Row {row_idx} ACCEPTED: total_rows={total_rows}")
            
            # Extract core data using column mapping
            try:
                farm_id_value = get_value('farmID')
                # Column B (index 1) is the village/farm name (VLOOKUP result in the template)
                villagename = (
                    str(row[1].value).strip()
                    if not is_blank_value(row[1].value)
                    else ""
                )
                if villagename.upper() in _EXCEL_ERROR_TOKENS:
                    villagename = ""

                inspectorID = int(float(get_value('inspectorID'))) if is_numeric(get_value('inspectorID')) else 0
                epiunitcountrycode_from_excel = (
                    str(get_value('epiunitcountrycode')).strip().upper()
                    if get_value('epiunitcountrycode') is not None
                    else ""
                )

                # Resolve epiunitID from Farm ID (preferred) and/or Village/Epiunit code
                epiunitID = resolve_epiunit_id(farm_id_value, get_value('epiunitcountrycode'))
                display_code = (
                    str(farm_id_value).strip()
                    if farm_id_value is not None
                    else epiunitcountrycode_from_excel
                )
                
                # Build date from year/month/day columns
                year = int(float(get_value('year'))) if is_numeric(get_value('year')) else None
                month = int(float(get_value('month'))) if is_numeric(get_value('month')) else None
                day = int(float(get_value('day'))) if is_numeric(get_value('day')) else None
                
                dt_insp = None
                if year and month and day:
                    try:
                        dt_insp = f"{year:04d}-{month:02d}-{day:02d}"
                    except:
                        pass
                
                # Validate required fields and build error message
                error_msg = None
                
                # Foreign key / identity validation
                if not epiunitID or epiunitID == 0:
                    typed = display_code or epiunitcountrycode_from_excel or villagename or "(empty)"
                    error_msg = (
                        f"Invalid Farm ID / Village/Epiunit code ({typed}) - "
                        f"not found in epiunits table; "
                    )
                if not inspectorID or inspectorID == 0:
                    error_msg = (error_msg or "") + "Missing InspectorID; "
                if not dt_insp:
                    error_msg = (error_msg or "") + "The format of the date is not correct; "
                
                # Helper to convert to int or 0
                def to_int(val):
                    if val is None:
                        return 0
                    if is_numeric(val):
                        num = int(float(val))
                        return num if num >= 1 else 0
                    return 0
                
                # Species-specific validation using column mapping
                # Cattle clinical and serology
                cattle = to_int(get_value('cattle'))
                cattleexam = to_int(get_value('cattleexam'))
                cattletested = to_int(get_value('cattletested'))
                cattlecliposFMD = to_int(get_value('cattlecliposFMD'))
                cattlecliposLSD = to_int(get_value('cattlecliposLSD'))
                if cattlecliposFMD > cattleexam:
                    error_msg = (error_msg or "") + f"Cattle clin. FMD ({cattlecliposFMD}) > exams ({cattleexam}); "
                if cattlecliposLSD > cattleexam:
                    error_msg = (error_msg or "") + f"Cattle clin. LSD ({cattlecliposLSD}) > exams ({cattleexam}); "
                
                # Sheep clinical and serology
                sheep = to_int(get_value('sheep'))
                sheepexam = to_int(get_value('sheepexam'))
                sheeptested = to_int(get_value('sheeptested'))
                sheepposFMD = to_int(get_value('sheepposFMD'))
                sheepposSGP = to_int(get_value('sheepposSGP'))
                sheepposPPR = to_int(get_value('sheepposPPR'))
                if sheepposFMD > sheepexam:
                    error_msg = (error_msg or "") + f"Sheep clin. FMD ({sheepposFMD}) > exams ({sheepexam}); "
                if sheepposSGP > sheepexam:
                    error_msg = (error_msg or "") + f"Sheep clin. SGP ({sheepposSGP}) > exams ({sheepexam}); "
                if sheepposPPR > sheepexam:
                    error_msg = (error_msg or "") + f"Sheep clin. PPR ({sheepposPPR}) > exams ({sheepexam}); "
                
                # Goat clinical and serology
                goat = to_int(get_value('goat'))
                goatsexam = to_int(get_value('goatsexam'))
                goattested = to_int(get_value('goattested'))
                goatsposFMD = to_int(get_value('goatsposFMD'))
                goatsposSGP = to_int(get_value('goatsposSGP'))
                goatsposPPR = to_int(get_value('goatsposPPR'))
                if goatsposFMD > goatsexam:
                    error_msg = (error_msg or "") + f"Goat clin. FMD ({goatsposFMD}) > exams ({goatsexam}); "
                if goatsposSGP > goatsexam:
                    error_msg = (error_msg or "") + f"Goat clin. SGP ({goatsposSGP}) > exams ({goatsexam}); "
                if goatsposPPR > goatsexam:
                    error_msg = (error_msg or "") + f"Goat clin. PPR ({goatsposPPR}) > exams ({goatsexam}); "
                
                # Buffalo clinical and serology
                buffalo = to_int(get_value('buffalo'))
                buffaloesexam = to_int(get_value('buffaloesexam'))
                buffalotested = to_int(get_value('buffalotested'))
                buffaloesposFMD = to_int(get_value('buffaloesposFMD'))
                buffaloesposLSD = to_int(get_value('buffaloesposLSD'))
                if buffaloesposFMD > buffaloesexam:
                    error_msg = (error_msg or "") + f"Buffalo clin. FMD ({buffaloesposFMD}) > exams ({buffaloesexam}); "
                if buffaloesposLSD > buffaloesexam:
                    error_msg = (error_msg or "") + f"Buffalo clin. LSD ({buffaloesposLSD}) > exams ({buffaloesexam}); "
                
                # Cattle serology
                cattlesample = to_int(get_value('cattlesample'))
                cattleseroposFMD = to_int(get_value('cattleseroposFMD'))
                cattleseroposLSD = to_int(get_value('cattleseroposLSD'))
                if cattleseroposFMD > cattlesample:
                    error_msg = (error_msg or "") + f"Cattle sero. FMD ({cattleseroposFMD}) > samples ({cattlesample}); "
                if cattleseroposLSD > cattlesample:
                    error_msg = (error_msg or "") + f"Cattle sero. LSD ({cattleseroposLSD}) > samples ({cattlesample}); "
                
                # Sheep serology
                sheepsample = to_int(get_value('sheepsample'))
                sheepseroposFMD = to_int(get_value('sheepseroposFMD'))
                sheepseroposSGP = to_int(get_value('sheepseroposSGP'))
                sheepseroposPPR = to_int(get_value('sheepseroposPPR'))
                if sheepseroposFMD > sheepsample:
                    error_msg = (error_msg or "") + f"Sheep sero. FMD ({sheepseroposFMD}) > samples ({sheepsample}); "
                if sheepseroposSGP > sheepsample:
                    error_msg = (error_msg or "") + f"Sheep sero. SGP ({sheepseroposSGP}) > samples ({sheepsample}); "
                if sheepseroposPPR > sheepsample:
                    error_msg = (error_msg or "") + f"Sheep sero. PPR ({sheepseroposPPR}) > samples ({sheepsample}); "
                
                # Goat serology
                goatsample = to_int(get_value('goatsample'))
                goatsseroposFMD = to_int(get_value('goatsseroposFMD'))
                goatsseroposSGP = to_int(get_value('goatsseroposSGP'))
                goatsseroposPPR = to_int(get_value('goatsseroposPPR'))
                if goatsseroposFMD > goatsample:
                    error_msg = (error_msg or "") + f"Goat sero. FMD ({goatsseroposFMD}) > samples ({goatsample}); "
                if goatsseroposSGP > goatsample:
                    error_msg = (error_msg or "") + f"Goat sero. SGP ({goatsseroposSGP}) > samples ({goatsample}); "
                if goatsseroposPPR > goatsample:
                    error_msg = (error_msg or "") + f"Goat sero. PPR ({goatsseroposPPR}) > samples ({goatsample}); "
                
                # Pig
                pig = to_int(get_value('pig'))
                pigtested = to_int(get_value('pigtested'))
                pigssample = to_int(get_value('pigssample'))
                pigsserosposFMD = to_int(get_value('pigsserosposFMD'))
                if pigsserosposFMD > pigssample:
                    error_msg = (error_msg or "") + f"Pig sero. FMD ({pigsserosposFMD}) > samples ({pigssample}); "
                
                # Buffalo serology
                buffaloessample = to_int(get_value('buffaloessample'))
                buffaloesseroposFMD = to_int(get_value('buffaloesseroposFMD'))
                buffaloesseroposLSD = to_int(get_value('buffaloesseroposLSD'))
                if buffaloesseroposFMD > buffaloessample:
                    error_msg = (error_msg or "") + f"Buffalo sero. FMD ({buffaloesseroposFMD}) > samples ({buffaloessample}); "
                if buffaloesseroposLSD > buffaloessample:
                    error_msg = (error_msg or "") + f"Buffalo sero. LSD ({buffaloesseroposLSD}) > samples ({buffaloessample}); "
                
                # Wild
                wildtested = to_int(get_value('wildtested'))
                wildsample = to_int(get_value('wildsample'))
                wildserosposFMD = to_int(get_value('wildserosposFMD'))
                if wildserosposFMD > wildsample:
                    error_msg = (error_msg or "") + f"Wild sero. FMD ({wildserosposFMD}) > samples ({wildsample}); "
                
                # Production row tuple for direct insert into factivities (no staging).
                # Order matches the INSERT column list below.
                row_data = (
                    inspectorID,            # int
                    epiunitID,              # int
                    dt_insp,                # date
                    cattle or None,
                    sheep or None,
                    goat or None,
                    pig or None,
                    buffalo or None,
                    cattleexam or None,
                    cattlecliposFMD or None,
                    cattlecliposLSD or None,
                    sheepexam or None,
                    sheepposFMD or None,
                    sheepposSGP or None,
                    sheepposPPR or None,
                    goatsexam or None,
                    goatsposFMD or None,
                    goatsposSGP or None,
                    goatsposPPR or None,
                    buffaloesexam or None,
                    buffaloesposFMD or None,
                    buffaloesposLSD or None,
                    cattlesample or None,
                    cattleseroposFMD or None,
                    cattleseroposLSD or None,
                    sheepsample or None,
                    sheepseroposFMD or None,
                    sheepseroposSGP or None,
                    sheepseroposPPR or None,
                    goatsample or None,
                    goatsseroposFMD or None,
                    goatsseroposSGP or None,
                    goatsseroposPPR or None,
                    pigssample or None,
                    pigsserosposFMD or None,
                    buffaloessample or None,
                    buffaloesseroposFMD or None,
                    buffaloesseroposLSD or None,
                    wildsample or None,
                    wildserosposFMD or None,
                    cattletested or None,
                    sheeptested or None,
                    goattested or None,
                    buffalotested or None,
                    pigtested or None,
                    wildtested or None,
                    datetime.now().date(),  # dt_inival
                    user_id,                # userID
                )

                if error_msg:
                    error_rows += 1
                    error_messages.append(f"Row {row_idx}: {error_msg}")
                    error_details.append({
                        "rowId": row_idx,
                        "village": villagename,
                        "country": display_code or epiunitcountrycode_from_excel,
                        "date": str(dt_insp) if dt_insp else None,
                        "error": error_msg,
                    })
                else:
                    clean_rows += 1
                    inserted_data.append(row_data)

            except Exception as e:
                error_rows += 1
                error_messages.append(f"Row {row_idx}: Error parsing - {str(e)}")
                error_details.append({
                    "rowId": row_idx,
                    "village": "",
                    "country": "",
                    "date": "",
                    "error": f"Error parsing - {str(e)}",
                })
        
        # Validation is the quality gate: if ANY row has errors, reject the whole file
        # (nothing is imported) and return the error report so the user can fix & re-upload.
        if error_rows > 0:
            return {
                "success": False,
                "has_errors": True,
                "message": f"{error_rows} of {total_rows} rows have validation errors. Fix them and re-upload.",
                "total_rows": total_rows,
                "clean_rows": clean_rows,
                "error_rows": error_rows,
                "error_count": error_rows,
                "error_rows_detail": error_details,
                "inserted_count": 0,
            }

        if not inserted_data:
            return {
                "success": False,
                "has_errors": False,
                "message": "No valid data rows found in file",
                "total_rows": total_rows,
                "clean_rows": clean_rows,
                "error_rows": error_rows,
                "inserted_count": 0,
            }

        # All rows clean -> insert directly into the production factivities table.
        try:
            print(f"Inserting {len(inserted_data)} clean rows directly into factivities...")
            insert_query = """
                INSERT INTO thrace.factivities (
                    inspectorID, epiunitID, dt_insp, cattle, sheep, goat, pig, buffalo,
                    cattleexam, cattlecliposFMD, cattlecliposLSD,
                    sheepexam, sheepposFMD, sheepposSGP, sheepposPPR,
                    goatsexam, goatsposFMD, goatsposSGP, goatsposPPR,
                    buffaloesexam, buffaloesposFMD, buffaloesposLSD,
                    cattlesample, cattleseroposFMD, cattleseroposLSD,
                    sheepsample, sheepseroposFMD, sheepseroposSGP, sheepseroposPPR,
                    goatsample, goatsseroposFMD, goatsseroposSGP, goatsseroposPPR,
                    pigssample, pigsserosposFMD,
                    buffaloessample, buffaloesseroposFMD, buffaloesseroposLSD,
                    wildsample, wildserosposFMD,
                    cattletested, sheeptested, goattested, buffalotested, pigtested, wildtested,
                    dt_inival, userID
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s,
                    %s, %s, %s,
                    %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s
                )
            """

            successful_inserts = 0
            for idx, row_data in enumerate(inserted_data):
                insert_result = await DatabaseHelper.execute_thrace_query(insert_query, row_data)
                if insert_result.get("error"):
                    print(f"Insert error for row {idx}: {insert_result['error']}")
                    raise HTTPException(status_code=500, detail=f"Insert error on row {idx}: {insert_result['error']}")
                successful_inserts += 1

            print(f"Successfully inserted {successful_inserts} rows into factivities")

            return {
                "success": True,
                "has_errors": False,
                "message": f"Imported {successful_inserts} rows into surveillance data.",
                "total_rows": total_rows,
                "clean_rows": clean_rows,
                "error_rows": 0,
                "inserted_count": successful_inserts,
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database insert error: {str(e)}")
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@router.get("/cycle-report")
async def generate_cycle_report(
    country_id: int,
    year: int,
    quarter: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Generate cycle report for given country, year, and quarter.
    Returns aggregated data matching the old PHP app's CycleReport.xlsx format.
    
    Three sections:
    1. Animal Population - by province/district
    2. Clinical Examination - sum of clinical exams and positive cases
    3. Serological Examination - sum of serology samples and positive cases
    """
    try:
        # Validate parameters
        if not (1 <= quarter <= 4):
            raise HTTPException(status_code=400, detail="Quarter must be between 1 and 4")
        
        # Determine grouping level based on country (792 = Turkey uses province, others use district)
        if country_id == 792:
            group_field = "provinceID"  # Join on ID column
            display_field = "province_name"  # Display name in results
        else:
            group_field = "districtID"  # Join on ID column
            display_field = "district_name"  # Display name in results
        
        print(f"Generating cycle report for country {country_id}, year {year}, quarter {quarter}")
        
        # Section 1: Animal Population
        population_query = f"""
            SELECT 
                e.country, 
                e.{display_field} as district_province,
                QUARTER(f.dt_insp) as quarter,
                YEAR(f.dt_insp) as year,
                i.cattle as cattle_pop,
                i.sheep as sheep_pop,
                i.goat as goat_pop,
                i.buffalo as buffalo_pop,
                i.pig as pig_pop,
                COUNT(DISTINCT e.epiunitID) as distinct_epiunits,
                COUNT(e.epiunitID) as total_visits,
                AVG(f.cattle) as avg_cattle,
                AVG(f.sheep) as avg_sheep,
                AVG(f.goat) as avg_goat,
                AVG(f.pig) as avg_pig,
                AVG(f.buffalo) as avg_buffalo
            FROM thrace.epiunits_view AS e
            INNER JOIN thrace.factivities AS f ON e.epiunitID = f.epiunitID
            LEFT OUTER JOIN thrace.inventory AS i 
                ON e.{group_field} = i.{group_field}
                AND YEAR(f.dt_insp) = i.anno
            WHERE QUARTER(f.dt_insp) = %s
                AND e.nationID = %s
                AND YEAR(f.dt_insp) = %s
            GROUP BY e.country, e.{display_field}
            ORDER BY e.{display_field}
        """
        
        # Section 2: Clinical Examination
        clinical_query = f"""
            SELECT 
                e.country,
                e.{display_field} as district_province,
                QUARTER(f.dt_insp) as quarter,
                YEAR(f.dt_insp) as year,
                COUNT(DISTINCT e.epiunitID) as distinct_epiunits,
                COUNT(e.epiunitID) as total_visits,
                SUM(f.cattleexam) as cattle_exam,
                SUM(f.cattlecliposFMD) as cattle_pos_fmd,
                SUM(f.cattlecliposLSD) as cattle_pos_lsd,
                SUM(f.sheepexam) as sheep_exam,
                SUM(f.sheepposFMD) as sheep_pos_fmd,
                SUM(f.sheepposSGP) as sheep_pos_sgp,
                SUM(f.sheepposPPR) as sheep_pos_ppr,
                SUM(f.goatsexam) as goat_exam,
                SUM(f.goatsposFMD) as goat_pos_fmd,
                SUM(f.goatsposSGP) as goat_pos_sgp,
                SUM(f.goatsposPPR) as goat_pos_ppr,
                SUM(f.buffaloesexam) as buffalo_exam,
                SUM(f.buffaloesposFMD) as buffalo_pos_fmd,
                SUM(f.buffaloesposLSD) as buffalo_pos_lsd,
                i.target_clinical as target
            FROM thrace.epiunits_view AS e
            INNER JOIN thrace.factivities AS f ON e.epiunitID = f.epiunitID
            LEFT OUTER JOIN thrace.inventory AS i 
                ON e.{group_field} = i.{group_field}
                AND YEAR(f.dt_insp) = i.anno
            WHERE QUARTER(f.dt_insp) = %s
                AND e.nationID = %s
                AND YEAR(f.dt_insp) = %s
            GROUP BY e.country, e.{display_field}
            ORDER BY e.{display_field}
        """
        
        # Section 3: Serological Examination
        serology_query = f"""
            SELECT 
                e.country,
                e.{display_field} as district_province,
                QUARTER(f.dt_insp) as quarter,
                YEAR(f.dt_insp) as year,
                COUNT(DISTINCT e.epiunitID) as distinct_epiunits,
                COUNT(e.epiunitID) as total_visits,
                SUM(f.cattlesample) as cattle_sample,
                SUM(f.cattleseroposFMD) as cattle_sero_fmd,
                SUM(f.cattleseroposLSD) as cattle_sero_lsd,
                SUM(f.sheepsample) as sheep_sample,
                SUM(f.sheepseroposFMD) as sheep_sero_fmd,
                SUM(f.sheepseroposSGP) as sheep_sero_sgp,
                SUM(f.sheepseroposPPR) as sheep_sero_ppr,
                SUM(f.goatsample) as goat_sample,
                SUM(f.goatsseroposFMD) as goat_sero_fmd,
                SUM(f.goatsseroposSGP) as goat_sero_sgp,
                SUM(f.goatsseroposPPR) as goat_sero_ppr,
                SUM(f.pigssample) as pig_sample,
                SUM(f.pigsserosposFMD) as pig_sero_fmd,
                SUM(f.buffaloessample) as buffalo_sample,
                SUM(f.buffaloesseroposFMD) as buffalo_sero_fmd,
                SUM(f.buffaloesseroposLSD) as buffalo_sero_lsd,
                SUM(f.wildsample) as wild_sample,
                SUM(f.wildserosposFMD) as wild_sero_fmd,
                i.target_serological as target
            FROM thrace.epiunits_view AS e
            INNER JOIN thrace.factivities AS f ON e.epiunitID = f.epiunitID
            LEFT OUTER JOIN thrace.inventory AS i 
                ON e.{group_field} = i.{group_field}
                AND YEAR(f.dt_insp) = i.anno
            WHERE QUARTER(f.dt_insp) = %s
                AND e.nationID = %s
                AND YEAR(f.dt_insp) = %s
            GROUP BY e.country, e.{display_field}
            ORDER BY e.{display_field}
        """
        
        params = (quarter, country_id, year)
        
        # Execute queries
        population_result = await DatabaseHelper.execute_thrace_query(population_query, params)
        clinical_result = await DatabaseHelper.execute_thrace_query(clinical_query, params)
        serology_result = await DatabaseHelper.execute_thrace_query(serology_query, params)
        
        if population_result.get("error"):
            raise HTTPException(status_code=500, detail=f"Population query error: {population_result['error']}")
        if clinical_result.get("error"):
            raise HTTPException(status_code=500, detail=f"Clinical query error: {clinical_result['error']}")
        if serology_result.get("error"):
            raise HTTPException(status_code=500, detail=f"Serology query error: {serology_result['error']}")
        
        return {
            "success": True,
            "country_id": country_id,
            "year": year,
            "quarter": quarter,
            "data": {
                "population": population_result.get("data", []),
                "clinical": clinical_result.get("data", []),
                "serology": serology_result.get("data", [])
            }
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Cycle report error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error generating cycle report: {str(e)}")

@router.get("/map-districts")
async def get_map_districts(current_user: dict = Depends(get_current_user)):
    """Districts grouped by country for the Thrace map filter (hierarchical multi-select)."""
    query = """
        SELECT DISTINCT
            e.nationID,
            e.country,
            e.districtID,
            e.district_name
        FROM thrace.epiunits_view e
        WHERE e.districtID IS NOT NULL
          AND e.district_name IS NOT NULL
          AND e.district_name != ''
        ORDER BY e.country, e.district_name
    """
    result = await DatabaseHelper.execute_thrace_query(query)
    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    NATION_LABELS = {
        100: "Bulgaria",
        300: "Greece",
        792: "Türkiye",
    }

    grouped: Dict[str, Any] = {}
    for row in result.get("data") or []:
        nation_id = int(row["nationID"]) if row.get("nationID") is not None else None
        country_label = NATION_LABELS.get(nation_id) or row.get("country") or "Unknown"
        key = str(nation_id) if nation_id is not None else country_label
        if key not in grouped:
            grouped[key] = {
                "nationID": nation_id,
                "country": country_label,
                "districts": [],
            }
        grouped[key]["districts"].append({
            "districtID": row["districtID"],
            "district_name": row["district_name"],
        })

    # Stable order: Bulgaria, Greece, Türkiye, then others
    order = {100: 0, 300: 1, 792: 2}
    countries = sorted(
        grouped.values(),
        key=lambda c: order.get(c["nationID"], 99),
    )
    return {"success": True, "countries": countries}


@router.get("/map-data")
async def get_map_data(
    start_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    district_ids: Optional[str] = Query(
        None,
        description="Comma-separated district IDs",
    ),
    current_user: dict = Depends(get_current_user),
):
    """Epiunit points for the Thrace map, with visit counts in the selected period.

    Visits are counted from thrace.factivities (epiunit-level). Districts only filter
    which epiunits are included. Epiunits without coordinates are omitted.
    """
    if not district_ids or not str(district_ids).strip():
        raise HTTPException(
            status_code=400,
            detail="Select at least one district",
        )

    try:
        ids = [int(x.strip()) for x in str(district_ids).split(",") if x.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid district_ids")

    if not ids:
        raise HTTPException(status_code=400, detail="Select at least one district")

    # Default period: last 90 days if not provided
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="end_date must be YYYY-MM-DD")
    else:
        end_dt = date.today()

    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="start_date must be YYYY-MM-DD")
    else:
        start_dt = date.fromordinal(end_dt.toordinal() - 90)

    placeholders = ", ".join(["%s"] * len(ids))
    query = f"""
        SELECT
            e.epiunitID,
            e.epiunitname,
            e.epiunitcountrycode,
            e.villagename,
            e.latit,
            e.longi,
            e.districtID,
            e.district_name,
            e.nationID,
            e.country,
            COALESCE(v.visits, 0) AS visits
        FROM thrace.epiunits_view e
        LEFT JOIN (
            SELECT f.epiunitID, COUNT(*) AS visits
            FROM thrace.factivities f
            WHERE f.dt_insp >= %s
              AND f.dt_insp <= %s
            GROUP BY f.epiunitID
        ) v ON v.epiunitID = e.epiunitID
        WHERE e.districtID IN ({placeholders})
          AND e.latit IS NOT NULL
          AND e.longi IS NOT NULL
          AND TRIM(CAST(e.latit AS CHAR)) != ''
          AND TRIM(CAST(e.longi AS CHAR)) != ''
    """
    params = (start_dt, end_dt, *ids)
    result = await DatabaseHelper.execute_thrace_query(query, params)
    if result.get("error"):
        raise HTTPException(status_code=500, detail=result["error"])

    NATION_LABELS = {
        100: "Bulgaria",
        300: "Greece",
        792: "Türkiye",
    }

    points = []
    for row in result.get("data") or []:
        try:
            lat = float(row["latit"])
            lon = float(row["longi"])
        except (TypeError, ValueError):
            continue
        if not (-90 <= lat <= 90 and -180 <= lon <= 180):
            continue
        if lat == 0 and lon == 0:
            continue

        visits = int(row["visits"] or 0)
        nation_id = int(row["nationID"]) if row.get("nationID") is not None else None
        points.append({
            "epiunitID": row["epiunitID"],
            "epiunitname": row.get("epiunitname") or "",
            "epiunitcountrycode": row.get("epiunitcountrycode") or "",
            "villagename": row.get("villagename") or "",
            "lat": lat,
            "lon": lon,
            "districtID": row.get("districtID"),
            "district_name": row.get("district_name") or "",
            "nationID": nation_id,
            "country": NATION_LABELS.get(nation_id) or row.get("country") or "",
            "visits": visits,
            "visited": visits > 0,
        })

    return {
        "success": True,
        "start_date": start_dt.isoformat(),
        "end_date": end_dt.isoformat(),
        "point_count": len(points),
        "points": points,
    }


@router.get("/freedom-data")
async def get_freedom_analysis(
    species: str = "ALL",
    disease: str = "FMD",
    region: str = "GR",
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate freedom-from-disease analysis on-demand from thrace.factivities using the
    corrected model (Ausvet/EuFMD post-evaluation). The corrected model is per-country:
    region must be one of GR, BG, TK (not ALL). Parameters come from static reference data
    under backend/data/thrace/, not the legacy DB params table.
    """
    try:
        calculator = ThraceCalculator(thrace_engine)

        print(
            f"Calculating freedom analysis: species={species}, disease={disease}, region={region}"
        )

        results = calculator.calculate_system_sensitivity(
            species_filter=species,
            disease=disease,
            region_filter=region,
        )

        month_count = len(results.get('labels', []))

        return {
            "success": True,
            "species": species,
            "disease": disease,
            "region": region,
            "data": results,
            "metadata": {
                "years_included": "all",
                "month_count": month_count,
                "calculation_method": "Corrected THRACE model (sequential SeH, risk levels, EDSSe)",
                "data_source": "thrace.factivities (live) + backend/data/thrace reference config",
                "corrections_applied": ["R1", "R2", "R4", "R7", "R8", "R11", "R12", "R14", "R16", "R17", "R18"]
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in freedom analysis: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error calculating freedom data: {str(e)}")


@router.get("/metadata")
async def get_thrace_metadata(current_user: dict = Depends(get_current_user)):
    """Return the THRACE simple product metadata as raw YAML.

    Served as-is from backend/data/thrace/metadata.yaml so authenticated users can view or
    download it. The frontend displays the text and offers a client-side download.
    """
    path = Path(__file__).resolve().parents[1] / "data" / "thrace" / "metadata.yaml"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Metadata file not found")
    try:
        content = path.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading metadata: {str(e)}")
    return Response(content=content, media_type="application/x-yaml")


