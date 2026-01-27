from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from typing import List, Dict, Any
from database import DatabaseHelper
from auth import get_current_user
from datetime import datetime
import openpyxl
from io import BytesIO
import json

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
        
        # 45-column structure: indices 0-44
        # Columns: epiunitID, villagename, epiunitcountrycode, inspectorID, dt_insp, 
        #          cattle, cattleexam, cattleclinposFMD, cattleclinposLSD,
        #          sheep, sheepexam, sheepposFMD, sheepposSGP, sheepposPPR,
        #          goat, goatexam, goatposFMD, goatposSGP, goatposPPR,
        #          buffalo, buffaloesexam, buffaloesposFMD, buffaloesposLSD,
        #          pig, pigssample, pigsserosposFMD,
        #          wildsample, wildserosposFMD (+ additional columns)
        
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
            
            # Extract 45 columns (indices 0-44)
            data = [row[col_idx].value for col_idx in range(45)]
            
            # Skip completely empty rows
            if all(v is None for v in data):
                continue
            
            # Debug: print first 3 rows with all data
            if row_idx <= 4:
                print(f"\nRow {row_idx} - ALL DATA (45 columns):")
                for i, val in enumerate(data):
                    if val is not None:
                        print(f"  data[{i}] = {val}")
            
            # PHP code checks if data[5] (year) is empty to stop processing
            if data[5] is None or str(data[5]).strip() == '':
                if row_idx <= 10:
                    print(f"Row {row_idx} skipped: data[5] (Year) is empty or None")
                continue
            
            total_rows += 1
            if row_idx <= 6:
                print(f"Row {row_idx} ACCEPTED: total_rows={total_rows}")
            
            # Extract core data - correct Excel column mapping:
            # data[0] = Farm ID (not used)
            # data[1] = Name/villagename
            # data[2] = InspectorID
            # data[3] = Village/Epiunit code (epiunitcountrycode) - used to look up epiunitID
            # data[4] = Entered by (not used)
            # data[5,6,7] = year, month, day
            try:
                villagename = str(data[1]).strip() if data[1] else ""
                inspectorID = int(float(data[2])) if is_numeric(data[2]) else 0
                epiunitcountrycode_from_excel = str(data[3]).strip().upper() if data[3] else ""
                
                # Look up epiunitID from the epiunitcountrycode
                epiunitID = epiunits_map.get(epiunitcountrycode_from_excel)
                if not epiunitID:
                    epiunitID = 0
                
                # Build date from year/month/day columns
                year = int(float(data[5])) if is_numeric(data[5]) else None
                month = int(float(data[6])) if is_numeric(data[6]) else None
                day = int(float(data[7])) if is_numeric(data[7]) else None
                
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
                
                # Species-specific validation - PHP uses verificaLR(), verificaSR(), verificaPig(), verificaWA()
                # Cattle clinical: col 8-12 (cattle, cattleexam, cattlecliposFMD, cattlecliposLSD)
                cattle = to_int(data[8])
                cattleexam = to_int(data[13])
                cattlecliposFMD = to_int(data[14])
                cattlecliposLSD = to_int(data[15])
                if cattlecliposFMD > cattleexam:
                    error_msg = (error_msg or "") + f"Cattle clin. FMD ({cattlecliposFMD}) > exams ({cattleexam}); "
                if cattlecliposLSD > cattleexam:
                    error_msg = (error_msg or "") + f"Cattle clin. LSD ({cattlecliposLSD}) > exams ({cattleexam}); "
                
                # Sheep clinical: col 9, 16-19 (sheep, sheepexam, sheepposFMD, sheepposSGP, sheepposPPR)
                sheep = to_int(data[9])
                sheepexam = to_int(data[16])
                sheepposFMD = to_int(data[17])
                sheepposSGP = to_int(data[18])
                sheepposPPR = to_int(data[19])
                if sheepposFMD > sheepexam:
                    error_msg = (error_msg or "") + f"Sheep clin. FMD ({sheepposFMD}) > exams ({sheepexam}); "
                if sheepposSGP > sheepexam:
                    error_msg = (error_msg or "") + f"Sheep clin. SGP ({sheepposSGP}) > exams ({sheepexam}); "
                if sheepposPPR > sheepexam:
                    error_msg = (error_msg or "") + f"Sheep clin. PPR ({sheepposPPR}) > exams ({sheepexam}); "
                
                # Goat clinical: col 10, 20-23 (goat, goatsexam, goatsposFMD, goatsposSGP, goatsposPPR)
                goat = to_int(data[10])
                goatsexam = to_int(data[20])
                goatsposFMD = to_int(data[21])
                goatsposSGP = to_int(data[22])
                goatsposPPR = to_int(data[23])
                if goatsposFMD > goatsexam:
                    error_msg = (error_msg or "") + f"Goat clin. FMD ({goatsposFMD}) > exams ({goatsexam}); "
                if goatsposSGP > goatsexam:
                    error_msg = (error_msg or "") + f"Goat clin. SGP ({goatsposSGP}) > exams ({goatsexam}); "
                if goatsposPPR > goatsexam:
                    error_msg = (error_msg or "") + f"Goat clin. PPR ({goatsposPPR}) > exams ({goatsexam}); "
                
                # Buffalo clinical: col 12, 24-26 (buffalo, buffaloesexam, buffaloesposFMD, buffaloesposLSD)
                buffalo = to_int(data[12])
                buffaloesexam = to_int(data[24])
                buffaloesposFMD = to_int(data[25])
                buffaloesposLSD = to_int(data[26])
                if buffaloesposFMD > buffaloesexam:
                    error_msg = (error_msg or "") + f"Buffalo clin. FMD ({buffaloesposFMD}) > exams ({buffaloesexam}); "
                if buffaloesposLSD > buffaloesexam:
                    error_msg = (error_msg or "") + f"Buffalo clin. LSD ({buffaloesposLSD}) > exams ({buffaloesexam}); "
                
                # Cattle serology: col 27-29 (cattlesample, cattleseroposFMD, cattleseroposLSD)
                cattlesample = to_int(data[27])
                cattleseroposFMD = to_int(data[28])
                cattleseroposLSD = to_int(data[29])
                if cattleseroposFMD > cattlesample:
                    error_msg = (error_msg or "") + f"Cattle sero. FMD ({cattleseroposFMD}) > samples ({cattlesample}); "
                if cattleseroposLSD > cattlesample:
                    error_msg = (error_msg or "") + f"Cattle sero. LSD ({cattleseroposLSD}) > samples ({cattlesample}); "
                
                # Sheep serology: col 30-33 (sheepsample, sheepseroposFMD, sheepseroposSGP, sheepseroposPPR)
                sheepsample = to_int(data[30])
                sheepseroposFMD = to_int(data[31])
                sheepseroposSGP = to_int(data[32])
                sheepseroposPPR = to_int(data[33])
                if sheepseroposFMD > sheepsample:
                    error_msg = (error_msg or "") + f"Sheep sero. FMD ({sheepseroposFMD}) > samples ({sheepsample}); "
                if sheepseroposSGP > sheepsample:
                    error_msg = (error_msg or "") + f"Sheep sero. SGP ({sheepseroposSGP}) > samples ({sheepsample}); "
                if sheepseroposPPR > sheepsample:
                    error_msg = (error_msg or "") + f"Sheep sero. PPR ({sheepseroposPPR}) > samples ({sheepsample}); "
                
                # Goat serology: col 34-37 (goatsample, goatsseroposFMD, goatsseroposSGP, goatsseroposPPR)
                goatsample = to_int(data[34])
                goatsseroposFMD = to_int(data[35])
                goatsseroposSGP = to_int(data[36])
                goatsseroposPPR = to_int(data[37])
                if goatsseroposFMD > goatsample:
                    error_msg = (error_msg or "") + f"Goat sero. FMD ({goatsseroposFMD}) > samples ({goatsample}); "
                if goatsseroposSGP > goatsample:
                    error_msg = (error_msg or "") + f"Goat sero. SGP ({goatsseroposSGP}) > samples ({goatsample}); "
                if goatsseroposPPR > goatsample:
                    error_msg = (error_msg or "") + f"Goat sero. PPR ({goatsseroposPPR}) > samples ({goatsample}); "
                
                # Pig: col 11, 38-39 (pig, pigssample, pigsserosposFMD)
                pig = to_int(data[11])
                pigssample = to_int(data[38])
                pigsserosposFMD = to_int(data[39])
                if pigsserosposFMD > pigssample:
                    error_msg = (error_msg or "") + f"Pig sero. FMD ({pigsserosposFMD}) > samples ({pigssample}); "
                
                # Buffalo serology: col 40-42 (buffaloessample, buffaloesseroposFMD, buffaloesseroposLSD)
                buffaloessample = to_int(data[40])
                buffaloesseroposFMD = to_int(data[41])
                buffaloesseroposLSD = to_int(data[42])
                if buffaloesseroposFMD > buffaloessample:
                    error_msg = (error_msg or "") + f"Buffalo sero. FMD ({buffaloesseroposFMD}) > samples ({buffaloessample}); "
                if buffaloesseroposLSD > buffaloessample:
                    error_msg = (error_msg or "") + f"Buffalo sero. LSD ({buffaloesseroposLSD}) > samples ({buffaloessample}); "
                
                # Wild: col 43-44 (wildsample, wildserosposFMD)
                wildsample = to_int(data[43])
                wildserosposFMD = to_int(data[44])
                if wildserosposFMD > wildsample:
                    error_msg = (error_msg or "") + f"Wild sero. FMD ({wildserosposFMD}) > samples ({wildsample}); "
                
                # Skip duplicate check during upload - will be checked during approval
                # This avoids 400+ separate database queries which cause timeout
                
                # Prepare row data for insertion matching SQL table structure
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
                
                # Insert all rows using parameterized query
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
                buffaloessample, buffaloesseroposFMD, buffaloesseroposLSD, wildsample, wildserosposFMD, dt_inival, userID
            )
            SELECT 
                inspectorID, epiunitID, dt_insp, cattle, sheep, goat, pig, buffalo,
                cattleexam, cattlecliposFMD, cattlecliposLSD, sheepexam, sheepposFMD, sheepposSGP, sheepposPPR,
                goatsexam, goatsposFMD, goatsposSGP, goatsposPPR, buffaloesexam, buffaloesposFMD, buffaloesposLSD,
                cattlesample, cattleseroposFMD, cattleseroposLSD, sheepsample, sheepseroposFMD, sheepseroposSGP, sheepseroposPPR,
                goatsample, goatsseroposFMD, goatsseroposSGP, goatsseroposPPR, pigssample, pigsserosposFMD,
                buffaloessample, buffaloesseroposFMD, buffaloesseroposLSD, wildsample, wildserosposFMD, dt_inival, userID
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
    refresh_summary: bool = False,
    current_user: dict = Depends(get_current_user)
):
    """
    Return freedom-from-disease analysis by delegating to the legacy SQL routines.
    - Optionally refresh the precomputed summary table via create_data_summary().
    - Then call get_freedom_data(species, disease, region) which returns JSON.
    """
    try:
        if refresh_summary:
            refresh = await DatabaseHelper.execute_thrace_query("CALL thrace.create_data_summary()")
            if refresh.get("error"):
                raise HTTPException(status_code=500, detail=f"Summary refresh failed: {refresh['error']}")
        result = await DatabaseHelper.execute_thrace_query(
            "SELECT thrace.get_freedom_data(%s, %s, %s) AS result",
            (species, disease, region)
        )
        if result.get("error"):
            raise HTTPException(status_code=500, detail=f"Freedom data query failed: {result['error']}")
        rows = result.get("data", [])
        if not rows or "result" not in rows[0] or rows[0]["result"] is None:
            raise HTTPException(status_code=404, detail="Freedom data not found")
        try:
            payload = json.loads(rows[0]["result"])
        except json.JSONDecodeError:
            raise HTTPException(status_code=500, detail="Freedom data returned invalid JSON")
        return {
            "success": True,
            "species": species,
            "disease": disease,
            "region": region,
            "data": payload,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving freedom data: {str(e)}")
