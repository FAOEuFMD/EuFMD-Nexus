from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Dict, Any
from database import DatabaseHelper, thrace_engine
from auth import get_current_user
from datetime import datetime
import openpyxl
from io import BytesIO
import json
from .thrace_calculator import ThraceCalculator

router = APIRouter(prefix="/api/thrace", tags=["thrace"])

# Global cache for epiunits mapping - loaded once at startup
_epiunits_cache: Dict[str, int] = {}
_cache_loaded = False

async def load_epiunits_cache():
    """Load epiunits mapping cache at startup (called once)"""
    global _epiunits_cache, _cache_loaded
    if _cache_loaded:
        return
    
    print("Loading epiunits cache at startup...")
    epiunits_query = "SELECT epiunitID, epiunitcountrycode FROM thrace.epiunits"
    epiunits_result = await DatabaseHelper.execute_thrace_query(epiunits_query)
    
    if epiunits_result.get("data"):
        for row in epiunits_result["data"]:
            code = row.get("epiunitcountrycode")
            uid = row.get("epiunitID")
            if code and uid:
                _epiunits_cache[code] = uid
    
    _cache_loaded = True
    print(f"Epiunits cache loaded with {len(_epiunits_cache)} mappings")

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
    Upload Excel file with THRACE surveillance data (45-column format matching old PHP app)
    Validates data and saves to factivities_tmp table with error tracking
    Allows rows with errors to be saved (errore field contains error description)
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
        
        user_id = current_user.get('user_id')
        
        # Clear previous upload for this user - each upload is fresh
        print(f"Clearing previous staging data for user {user_id}...")
        clear_query = "DELETE FROM thrace.factivities_tmp WHERE userID = %s"
        await DatabaseHelper.execute_thrace_query(clear_query, (user_id,))
        print(f"Staging table cleared for user {user_id}")
        
        # Use cached epiunits mapping
        epiunits_map = _epiunits_cache
        print(f"Using cached epiunits mapping with {len(epiunits_map)} entries")
        
        clean_rows = 0
        error_rows = 0
        total_rows = 0
        inserted_data = []
        error_messages = []
        
        # Process rows 2 to 401 (400 data rows max, row 1 is header)
        for row_idx in range(2, min(402, worksheet.max_row + 1)):
            row = worksheet[row_idx]
            
            # Helper function to get cell value by field name
            def get_value(field_name):
                if field_name in column_map:
                    return row[column_map[field_name]].value
                return None
            
            # Check if row is completely empty
            if all(cell.value is None for cell in row):
                continue
            
            # PHP code checks if year is empty to stop processing
            year_value = get_value('year')
            if year_value is None or str(year_value).strip() == '':
                if row_idx <= 10:
                    print(f"Row {row_idx} skipped: Year is empty or None")
                continue
            
            total_rows += 1
            if row_idx <= 6:
                print(f"Row {row_idx} ACCEPTED: total_rows={total_rows}")
            
            # Extract core data using column mapping
            try:
                villagename = str(row[1].value).strip() if row[1].value else ""  # Column 1 is always Name/villagename
                inspectorID = int(float(get_value('inspectorID'))) if is_numeric(get_value('inspectorID')) else 0
                epiunitcountrycode_from_excel = str(get_value('epiunitcountrycode')).strip().upper() if get_value('epiunitcountrycode') else ""
                
                # Look up epiunitID from the epiunitcountrycode
                epiunitID = epiunits_map.get(epiunitcountrycode_from_excel)
                if not epiunitID:
                    epiunitID = 0
                
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
                
                # Foreign key validation - check if epiunitcountrycode exists in epiunits
                if epiunitcountrycode_from_excel and epiunitcountrycode_from_excel not in epiunits_map:
                    error_msg = f"Invalid Village/Epiunit code ({epiunitcountrycode_from_excel}) - not found in epiunits table; "
                
                # Required field validation
                if not epiunitID or epiunitID == 0:
                    error_msg = (error_msg or "") + "Missing or invalid Village/Epiunit code; "
                if not villagename:
                    error_msg = (error_msg or "") + "Missing Name/villagename; "
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
                
                # Skip duplicate check during upload - will be checked during approval
                # This avoids 400+ separate database queries which cause timeout
                
                # Prepare row data for insertion matching SQL table structure (now with 6 new 'tested' fields)
                row_data = (
                    epiunitID,              # int
                    inspectorID,            # int
                    dt_insp,                # date
                    cattle or None,         # int DEFAULT NULL
                    sheep or None,          # int DEFAULT NULL
                    goat or None,           # int DEFAULT NULL
                    pig or None,            # int DEFAULT NULL
                    buffalo or None,        # int DEFAULT NULL
                    cattleexam or None,     # int DEFAULT NULL
                    cattlecliposFMD or None,  # int DEFAULT NULL
                    cattlecliposLSD or None,  # int DEFAULT NULL
                    sheepexam or None,      # int DEFAULT NULL
                    sheepposFMD or None,    # int DEFAULT NULL
                    sheepposSGP or None,    # int DEFAULT NULL
                    sheepposPPR or None,    # int DEFAULT NULL
                    goatsexam or None,      # int DEFAULT NULL
                    goatsposFMD or None,    # int DEFAULT NULL
                    goatsposSGP or None,    # int DEFAULT NULL
                    goatsposPPR or None,    # int DEFAULT NULL
                    buffaloesexam or None,  # int DEFAULT NULL
                    buffaloesposFMD or None,# int DEFAULT NULL
                    buffaloesposLSD or None,# int DEFAULT NULL
                    cattlesample or None,   # int DEFAULT NULL
                    cattleseroposFMD or None,# int DEFAULT NULL
                    cattleseroposLSD or None,# int DEFAULT NULL
                    sheepsample or None,    # int DEFAULT NULL
                    sheepseroposFMD or None,# int DEFAULT NULL
                    sheepseroposSGP or None,# int DEFAULT NULL
                    sheepseroposPPR or None,# int DEFAULT NULL
                    goatsample or None,     # int DEFAULT NULL
                    goatsseroposFMD or None,# int DEFAULT NULL
                    goatsseroposSGP or None,# int DEFAULT NULL
                    goatsseroposPPR or None,# int DEFAULT NULL
                    pigssample or None,     # int DEFAULT NULL
                    pigsserosposFMD or None,# int DEFAULT NULL
                    buffaloessample or None,# int DEFAULT NULL
                    buffaloesseroposFMD or None,# int DEFAULT NULL
                    buffaloesseroposLSD or None,# int DEFAULT NULL
                    wildsample or None,     # int DEFAULT NULL
                    wildserosposFMD or None,# int DEFAULT NULL
                    cattletested or None,   # int DEFAULT NULL - NEW
                    sheeptested or None,    # int DEFAULT NULL - NEW
                    goattested or None,     # int DEFAULT NULL - NEW
                    buffalotested or None,  # int DEFAULT NULL - NEW
                    pigtested or None,      # int DEFAULT NULL - NEW
                    wildtested or None,     # int DEFAULT NULL - NEW
                    error_msg,              # varchar(255) DEFAULT NULL
                    datetime.now().date(),  # dt_inival date NOT NULL
                    user_id,                # userID int NOT NULL
                    epiunitcountrycode_from_excel,     # varchar(20) NOT NULL
                    villagename             # varchar(50) NOT NULL
                )
                
                inserted_data.append(row_data)
                
                if error_msg:
                    error_rows += 1
                    error_messages.append(f"Row {row_idx}: {error_msg}")
                else:
                    clean_rows += 1
                
            except Exception as e:
                error_rows += 1
                error_messages.append(f"Row {row_idx}: Error parsing - {str(e)}")
        
        # Bulk insert all rows (clean + error rows) to factivities_tmp
        if inserted_data:
            try:
                print(f"Starting bulk insert of {len(inserted_data)} rows...")
                
                # Insert all rows using parameterized query (now includes 6 new 'tested' columns)
                insert_query = """
                    INSERT INTO factivities_tmp (
                        epiunitID, inspectorID, dt_insp, cattle, sheep, goat, pig, buffalo,
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
                        errore, dt_inival, userID, epiunitcountrycode, villagename
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
                        %s, %s, %s, %s, %s
                    )
                """
                
                successful_inserts = 0
                print("Starting individual row inserts...")
                for idx, row_data in enumerate(inserted_data):
                    if idx % 5 == 0:  # Log progress every 5 rows
                        print(f"Inserting row {idx+1}/{len(inserted_data)}...")
                    
                    insert_result = await DatabaseHelper.execute_thrace_query(insert_query, row_data)
                    
                    if insert_result.get("error"):
                        print(f"Insert error for row {idx}: {insert_result['error']}")
                        print(f"Row data: {row_data}")
                        raise HTTPException(status_code=500, detail=f"Insert error on row {idx}: {insert_result['error']}")
                    
                    successful_inserts += 1
                
                print(f"Successfully inserted {successful_inserts} rows into factivities_tmp")
                
                return {
                    "success": True,
                    "message": f"Uploaded {total_rows} rows ({clean_rows} clean, {error_rows} with errors)",
                    "total_rows": total_rows,
                    "clean_rows": clean_rows,
                    "error_rows": error_rows,
                    "inserted_count": successful_inserts,
                    "errors": error_messages if error_messages else None,
                    "status": "pending_approval"
                }
            
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Database insert error: {str(e)}")
        else:
            return {
                "success": False,
                "message": "No valid data rows found in file",
                "total_rows": total_rows,
                "clean_rows": clean_rows,
                "error_rows": error_rows,
                "inserted_count": 0
            }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@router.get("/staging-summary")
async def get_staging_summary(current_user: dict = Depends(get_current_user)):
    """
    Get summary of staging data for current user:
    - Total rows uploaded
    - Clean rows (no errors)
    - Rows with errors
    """
    user_id = current_user.get("user_id")
    
    try:
        # Total rows
        total_query = "SELECT COUNT(*) as count FROM thrace.factivities_tmp WHERE userID = %s"
        total_result = await DatabaseHelper.execute_thrace_query(total_query, (user_id,))
        total_rows = total_result["data"][0]["count"] if total_result["data"] else 0
        
        # Clean rows
        clean_query = "SELECT COUNT(*) as count FROM thrace.factivities_tmp WHERE userID = %s AND errore IS NULL"
        clean_result = await DatabaseHelper.execute_thrace_query(clean_query, (user_id,))
        clean_rows = clean_result["data"][0]["count"] if clean_result["data"] else 0
        
        # Error rows
        error_query = "SELECT COUNT(*) as count FROM thrace.factivities_tmp WHERE userID = %s AND errore IS NOT NULL"
        error_result = await DatabaseHelper.execute_thrace_query(error_query, (user_id,))
        error_rows = error_result["data"][0]["count"] if error_result["data"] else 0
        
        return {
            "total_rows": total_rows,
            "clean_rows": clean_rows,
            "error_rows": error_rows
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching staging summary: {str(e)}")


@router.post("/approve-data")
async def approve_staging_data(current_user: dict = Depends(get_current_user)):
    """
    Approve and move clean data from factivities_tmp to factivities.
    If there are errors, return them instead of approving.
    
    Returns:
    - If errors exist: {"has_errors": True, "error_rows": [...]}
    - If no errors: {"success": True, "message": "Data approved and imported", "inserted_count": N}
    """
    user_id = current_user.get("user_id")
    
    try:
        print(f"Approval endpoint called for user {user_id}")
        
        # Check for error rows
        error_query = """
            SELECT factivity_tmpID, villagename, epiunitcountrycode, dt_insp, errore 
            FROM thrace.factivities_tmp 
            WHERE userID = %s AND errore IS NOT NULL
            ORDER BY factivity_tmpID
        """
        error_result = await DatabaseHelper.execute_thrace_query(error_query, (user_id,))
        print(f"Error check result: {error_result}")
        
        error_rows = error_result.get("data", []) if error_result else []
        print(f"Found {len(error_rows)} error rows")
        
        # If there are errors, return them without approving
        if error_rows:
            print(f"Returning {len(error_rows)} error rows to user")
            return {
                "has_errors": True,
                "error_count": len(error_rows),
                "error_rows": [
                    {
                        "rowId": row.get("factivity_tmpID"),
                        "village": row.get("villagename"),
                        "country": row.get("epiunitcountrycode"),
                        "date": row.get("dt_insp"),
                        "error": row.get("errore")
                    }
                    for row in error_rows
                ]
            }
        
        # No errors - move clean data to factivities
        print(f"No errors found. Moving clean data to production for user {user_id}")
        
        insert_query = """
            INSERT INTO thrace.factivities(
                inspectorID, epiunitID, dt_insp, cattle, sheep, goat, pig, buffalo,
                cattleexam, cattlecliposFMD, cattlecliposLSD, sheepexam, sheepposFMD, sheepposSGP, sheepposPPR,
                goatsexam, goatsposFMD, goatsposSGP, goatsposPPR, buffaloesexam, buffaloesposFMD, buffaloesposLSD,
                cattlesample, cattleseroposFMD, cattleseroposLSD, sheepsample, sheepseroposFMD, sheepseroposSGP, sheepseroposPPR,
                goatsample, goatsseroposFMD, goatsseroposSGP, goatsseroposPPR, pigssample, pigsserosposFMD,
                buffaloessample, buffaloesseroposFMD, buffaloesseroposLSD, wildsample, wildserosposFMD,
                cattletested, sheeptested, goattested, buffalotested, pigtested, wildtested,
                dt_inival, userID
            )
            SELECT 
                inspectorID, epiunitID, dt_insp, cattle, sheep, goat, pig, buffalo,
                cattleexam, cattlecliposFMD, cattlecliposLSD, sheepexam, sheepposFMD, sheepposSGP, sheepposPPR,
                goatsexam, goatsposFMD, goatsposSGP, goatsposPPR, buffaloesexam, buffaloesposFMD, buffaloesposLSD,
                cattlesample, cattleseroposFMD, cattleseroposLSD, sheepsample, sheepseroposFMD, sheepseroposSGP, sheepseroposPPR,
                goatsample, goatsseroposFMD, goatsseroposSGP, goatsseroposPPR, pigssample, pigsserosposFMD,
                buffaloessample, buffaloesseroposFMD, buffaloesseroposLSD, wildsample, wildserosposFMD,
                cattletested, sheeptested, goattested, buffalotested, pigtested, wildtested,
                dt_inival, userID
            FROM thrace.factivities_tmp
            WHERE userID = %s AND errore IS NULL
        """
        
        insert_result = await DatabaseHelper.execute_thrace_query(insert_query, (user_id,))
        print(f"Insert result: {insert_result}")
        
        if insert_result.get("error"):
            print(f"Insert error: {insert_result['error']}")
            raise HTTPException(status_code=500, detail=f"Error importing data: {insert_result['error']}")
        
        inserted_count = insert_result.get("data", 0)
        print(f"Successfully inserted {inserted_count} rows")
        
        return {
            "success": True,
            "message": "Data approved and imported successfully",
            "inserted_count": inserted_count,
            "has_errors": False
        }
    
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Approval endpoint error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error approving data: {str(e)}")

def is_numeric(value):
    """Check if value can be converted to a number"""
    if value is None:
        return False
    try:
        float(value)
        return True
    except (ValueError, TypeError):
        return False


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

@router.get("/freedom-data")
async def get_freedom_analysis(
    species: str = "ALL",
    disease: str = "FMD",
    region: str = "ALL",
    year: int = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate freedom-from-disease analysis using Python ThraceCalculator.
    Replaces old SQL function: thrace.get_freedom_data()
    
    Corrections Implemented:
    - R1: Combined herd sensitivity with overlap correction (Cameron et al. FAO 2014)
    - R2: Uses *_tested columns from Excel uploads (protocol-based)
    - R4: Uses risklevel from epiunits table
    - R11-R12: Year-specific monthly P(intro) with fallback
    - R14: Greece RR=1 (risk-based not applicable)
    
    Parameters:
    - species: ALL, LR, BOV, BUF, SR, OVI, CAP, POR
    - disease: FMD, LSD, SGP, PPR
    - region: ALL, GR, BG, TK
    - year: Calculation year (defaults to current year)
    """
    try:
        # Default to current year if not specified
        if year is None:
            year = datetime.now().year
        
        # Initialize calculator with thrace database engine
        calculator = ThraceCalculator(thrace_engine)
        
        # Calculate system sensitivity and probability of freedom
        # Show data from 2015 onwards (when surveillance activities started)
        print(f"Calculating freedom analysis: species={species}, disease={disease}, region={region}, year={year}")
        
        results = calculator.calculate_system_sensitivity(
            species_filter=species,
            disease=disease,
            region_filter=region,
            year=year,
            min_year=2015  # Start graph from 2015
        )
        
        return {
            "success": True,
            "species": species,
            "disease": disease,
            "region": region,
            "year": year,
            "data": results,
            "metadata": {
                "calculation_method": "Cameron et al. (FAO 2014) - Combined Herd Sensitivity",
                "corrections_applied": ["R1", "R2", "R4", "R11", "R12", "R14"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in freedom analysis: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error calculating freedom data: {str(e)}")


@router.post("/calculate-freedom")
async def calculate_and_save_freedom(
    species: str = "ALL",
    disease: str = "FMD",
    region: str = "ALL",
    year: int = None,
    save_results: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """
    Calculate freedom-from-disease analysis and optionally save to audit table.
    
    R24: Saves calculation results to thrace.thrace_calculation_results for audit trail.
    
    Parameters:
    - species: ALL, LR, BOV, BUF, SR, OVI, CAP, POR
    - disease: FMD, LSD, SGP, PPR
    - region: ALL, GR, BG, TK
    - year: Calculation year (defaults to current year)
    - save_results: Whether to save results to permanent table (default: True)
    
    Returns:
    - success: Boolean indicating if calculation succeeded
    - data: Calculation results (same format as GET endpoint)
    - saved: Boolean indicating if results were saved
    - saved_count: Number of monthly records saved
    """
    try:
        # Default to current year if not specified
        if year is None:
            year = datetime.now().year
        
        # Initialize calculator with thrace database engine
        calculator = ThraceCalculator(thrace_engine)
        
        # Calculate system sensitivity and probability of freedom
        # Show data from 2015 onwards (when surveillance activities started)
        print(f"Calculating freedom analysis: species={species}, disease={disease}, region={region}, year={year}")
        
        results = calculator.calculate_system_sensitivity(
            species_filter=species,
            disease=disease,
            region_filter=region,
            year=year,
            min_year=2015  # Start graph from 2015
        )
        
        # R24: Save to permanent table for audit trail
        saved = False
        saved_count = 0
        if save_results:
            try:
                calculator.save_calculation_results(
                    results=results,
                    species_filter=species,
                    disease=disease,
                    region_filter=region,
                    user_id=current_user.get('id')
                )
                saved = True
                saved_count = len(results.get('labels', []))
                print(f"Saved {saved_count} monthly results to thrace_calculation_results table")
            except Exception as save_error:
                print(f"Warning: Failed to save results: {str(save_error)}")
                # Continue even if save fails - calculation is still valid
        
        return {
            "success": True,
            "species": species,
            "disease": disease,
            "region": region,
            "year": year,
            "data": results,
            "saved": saved,
            "saved_count": saved_count,
            "calculated_by": current_user.get('id'),
            "metadata": {
                "calculation_method": "Cameron et al. (FAO 2014) - Combined Herd Sensitivity",
                "corrections_applied": ["R1", "R2", "R4", "R11", "R12", "R14", "R24"]
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in freedom analysis: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error calculating freedom data: {str(e)}")
