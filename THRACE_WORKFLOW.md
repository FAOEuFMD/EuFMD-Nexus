# THRACE Module - Complete Workflow

## Overview
The THRACE module manages veterinary field activity surveillance data for FMD, PPR, LSD, and SGP diseases across Turkey, Greece, and Bulgaria. It handles Excel data uploads, validation, approval, and quarterly reporting.

## Architecture

### Database Tables
- **`factivities_tmp`** (Staging): Temporary storage for uploaded data with error tracking
- **`factivities`** (Production): Approved data used for reporting
- **`epiunits_view`**: Master list of epidemiological units with country/province/district hierarchy
- **`inventory`**: Animal population targets per region and year

### Column Structure (45 columns)
The Excel upload format matches the old PHP app:

| Index | Column Name | Description |
|-------|-------------|-------------|
| 0 | Farm ID | (Not imported - for reference only) |
| 1 | Name/villagename | Village name |
| 2 | InspectorID | Inspector performing visit |
| 3 | Village/Epiunit Code | Lookup key to get epiunitID |
| 4 | Entered by | (Not imported) |
| 5-7 | Year, Month, Day | Visit date components |
| 8-12 | Cattle | cattle, sheep, goat, pig, buffalo counts |
| 13-26 | Clinical Exams | Clinical examination counts and positive cases for all species |
| 27-42 | Serology | Serological sample counts and positive cases for all species |
| 43-44 | Wild | Wild animal serology |

## Complete Workflow

### 1. Data Upload (`POST /api/thrace/upload-data`)

**Process:**
1. User uploads Excel file (.xlsx only)
2. Backend reads Excel with `openpyxl` (data_only=True to read formula results)
3. For each row (2-401, row 1 is header):
   - Extract all 45 columns
   - Validate epiunitcountrycode (column 3) exists in epiunits cache
   - Look up epiunitID from epiunitcountrycode
   - Validate date format (year/month/day)
   - Validate positives ≤ exams for all species
   - Build error message if validation fails
   - Insert to `factivities_tmp` (including rows with errors)

**Performance Optimization:**
- Global cache (`_epiunits_cache`): Loads 2188 epiunit mappings once at startup
- Eliminates 2188 database queries per upload
- Cache persists across all uploads until server restart

**Validation Rules:**
- **Required fields**: epiunitID, villagename, inspectorID, date
- **Foreign key**: epiunitcountrycode must exist in epiunits table
- **Date format**: Valid year/month/day combination
- **Logical**: For all species, positive cases ≤ examined/sampled

**Response:**
```json
{
  "success": true,
  "message": "Uploaded 16 rows (14 clean, 2 with errors)",
  "total_rows": 16,
  "clean_rows": 14,
  "error_rows": 2,
  "inserted_count": 16,
  "status": "pending_approval"
}
```

### 2. Staging Summary (`GET /api/thrace/staging-summary`)

**Purpose:** Show user the upload status before approval

**Response:**
```json
{
  "total_rows": 16,
  "clean_rows": 14,
  "error_rows": 2
}
```

### 3. Data Approval (`POST /api/thrace/approve-data`)

**Process:**
1. Check for error rows in `factivities_tmp` for current user
2. **If errors exist**: Return error details, do NOT import
3. **If no errors**: Move clean data to production `factivities` table
4. Clear staging table for this user

**Response (with errors):**
```json
{
  "has_errors": true,
  "error_count": 2,
  "error_rows": [
    {
      "rowId": 123,
      "village": "MESIMVRIA",
      "epiunitcode": "7100006",
      "date": "2026-01-15",
      "error": "Cattle clin. FMD (5) > exams (3); Missing InspectorID;"
    }
  ]
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Data approved and imported successfully",
  "inserted_count": 14,
  "has_errors": false
}
```

**SQL Operation (step2 from PHP app):**
```sql
INSERT INTO factivities(
    inspectorID, epiunitID, dt_insp, cattle, sheep, goat, pig, buffalo,
    cattleexam, cattlecliposFMD, cattlecliposLSD, ...
)
SELECT 
    inspectorID, epiunitID, dt_insp, cattle, sheep, goat, pig, buffalo,
    cattleexam, cattlecliposFMD, cattlecliposLSD, ...
FROM factivities_tmp
WHERE userID = :user_id AND errore IS NULL
```

### 4. Cycle Report Generation (`GET /api/thrace/cycle-report`)

**Purpose:** Generate quarterly surveillance report matching old PHP app's CycleReport.xlsx

**Parameters:**
- `country_id`: 792 (Turkey), other values (Greece, Bulgaria)
- `year`: Report year (e.g., 2026)
- `quarter`: 1, 2, 3, or 4

**Report Sections:**

#### Section 1: Animal Population
Aggregated by Province (Turkey) or District (other countries):
- Animal population counts (cattle, sheep, goat, buffalo, pig)
- Distinct epidemiological units visited
- Total number of visits
- Average animals per visit

#### Section 2: Clinical Examination
- Clinical examination counts by species
- Positive cases for FMD, LSD, SGP, PPR
- Target vs. achieved percentage

#### Section 3: Serological Examination
- Serological sample counts by species
- Positive cases for FMD, LSD, SGP, PPR
- Target vs. achieved percentage
- Includes pig and wild animal serology

**SQL Pattern:**
```sql
SELECT 
    e.country, 
    e.district_name,
    QUARTER(f.dt_insp) as quarter,
    YEAR(f.dt_insp) as year,
    SUM(f.cattleexam) as cattle_exam,
    SUM(f.cattlecliposFMD) as cattle_pos_fmd,
    ...
FROM epiunits_view AS e
INNER JOIN factivities AS f ON e.epiunitID = f.epiunitID
LEFT OUTER JOIN inventory AS i 
    ON e.district_name = i.district_name
    AND YEAR(f.dt_insp) = i.anno
WHERE QUARTER(f.dt_insp) = :quarter
    AND e.nationID = :country
    AND YEAR(f.dt_insp) = :year
GROUP BY e.country, e.district_name
ORDER BY e.district_name
```

**Response:**
```json
{
  "success": true,
  "country_id": 300,
  "year": 2026,
  "quarter": 1,
  "data": {
    "population": [
      {
        "country": "Greece",
        "district_province": "EVROS",
        "quarter": 1,
        "year": 2026,
        "cattle_pop": 15000,
        "sheep_pop": 45000,
        "distinct_epiunits": 12,
        "total_visits": 45,
        ...
      }
    ],
    "clinical": [...],
    "serology": [...]
  }
}
```

## Frontend Integration

### Thrace Page Flow
1. **Upload Tab**: 
   - Select Excel file
   - Call `POST /api/thrace/upload-data`
   - Display success/error message

2. **Review Tab**: 
   - Call `GET /api/thrace/staging-summary`
   - Show total/clean/error row counts
   - If errors exist, display error details

3. **Approve Button**: 
   - Call `POST /api/thrace/approve-data`
   - If has_errors=true: Show error details, prevent approval
   - If success: Show "Data imported" message, clear staging

4. **Reports Tab**:
   - Select country, year, quarter
   - Call `GET /api/thrace/cycle-report`
   - Display tables or generate Excel download

## Key Differences from Old PHP App

| Feature | Old PHP App | New FastAPI App |
|---------|-------------|-----------------|
| Excel Reading | PHPSpreadsheet | openpyxl (Python) |
| Performance | Query epiunits per row | Global cache (load once) |
| Error Handling | Silent failures possible | Explicit error messages |
| API Format | Page-based navigation | RESTful JSON endpoints |
| Duplicate Check | Per-row during upload | Skipped during upload (too slow) |
| Report Output | Direct Excel download | JSON data (frontend can generate Excel) |

## Database Schema Reference

### factivities_tmp / factivities
```sql
CREATE TABLE factivities (
    factivityID int NOT NULL AUTO_INCREMENT PRIMARY KEY,
    epiunitID int NOT NULL,
    inspectorID int NOT NULL,
    dt_insp date NOT NULL,
    cattle int DEFAULT NULL,
    sheep int DEFAULT NULL,
    goat int DEFAULT NULL,
    pig int DEFAULT NULL,
    buffalo int DEFAULT NULL,
    cattleexam int DEFAULT NULL,
    cattlecliposFMD int DEFAULT NULL,
    cattlecliposLSD int DEFAULT NULL,
    sheepexam int DEFAULT NULL,
    sheepposFMD int DEFAULT NULL,
    sheepposSGP int DEFAULT NULL,
    sheepposPPR int DEFAULT NULL,
    goatsexam int DEFAULT NULL,
    goatsposFMD int DEFAULT NULL,
    goatsposSGP int DEFAULT NULL,
    goatsposPPR int DEFAULT NULL,
    buffaloesexam int DEFAULT NULL,
    buffaloesposFMD int DEFAULT NULL,
    buffaloesposLSD int DEFAULT NULL,
    cattlesample int DEFAULT NULL,
    cattleseroposFMD int DEFAULT NULL,
    cattleseroposLSD int DEFAULT NULL,
    sheepsample int DEFAULT NULL,
    sheepseroposFMD int DEFAULT NULL,
    sheepseroposSGP int DEFAULT NULL,
    sheepseroposPPR int DEFAULT NULL,
    goatsample int DEFAULT NULL,
    goatsseroposFMD int DEFAULT NULL,
    goatsseroposSGP int DEFAULT NULL,
    goatsseroposPPR int DEFAULT NULL,
    pigssample int DEFAULT NULL,
    pigsserosposFMD int DEFAULT NULL,
    buffaloessample int DEFAULT NULL,
    buffaloesseroposFMD int DEFAULT NULL,
    buffaloesseroposLSD int DEFAULT NULL,
    wildsample int DEFAULT NULL,
    wildserosposFMD int DEFAULT NULL,
    errore varchar(255) DEFAULT NULL,  -- factivities_tmp only
    dt_inival date NOT NULL,
    userID int NOT NULL,
    epiunitcountrycode varchar(20) NOT NULL,  -- factivities_tmp only
    villagename varchar(50) NOT NULL  -- factivities_tmp only
);
```

## Next Steps for Frontend Development

1. **Create Thrace Page with Tabs:**
   - Upload tab with file picker
   - Review/Staging tab showing summary
   - Reports tab with country/year/quarter selectors

2. **Implement Excel Export:**
   - Use a library like `xlsx` or `exceljs` to generate CycleReport.xlsx
   - Apply formatting matching old PHP output (colors, borders, formulas)

3. **Add Download Error Data Feature:**
   - Export rows with errors to Excel for correction
   - Allow user to fix and re-upload

4. **Implement Inspector Management:**
   - Use existing `GET /api/thrace/inspectors` endpoint
   - Add inspector CRUD operations if needed

## Testing Checklist

- [ ] Upload valid Excel file (all clean rows)
- [ ] Upload Excel with validation errors
- [ ] Upload Excel with foreign key errors (invalid epiunitcountrycode)
- [ ] Upload Excel with duplicate records
- [ ] Test approval with clean data
- [ ] Test approval rejection with error rows
- [ ] Generate cycle report for Turkey (province grouping)
- [ ] Generate cycle report for Greece/Bulgaria (district grouping)
- [ ] Test performance with 400-row Excel file
- [ ] Test cache loading on server restart

## Reference Files

- **Backend**: `backend/routers/thrace.py`
- **Old PHP App**: `Thrace/classes/fmd/controllers/toolmng.php` (upload/approval)
- **Old Report**: `Thrace/templates/query/summary/summary.php` (cycle report)
- **Excel Template**: `Thrace/ThraceActivitiesGreece2.xlsx`


# THRACE Old PHP Application - Architecture & Workflow Analysis

## Overview
The THRACE system is a **PHP-based surveillance data management application** designed for monitoring FMD (Foot-and-Mouth Disease), PPR, LSD, and SGP across three countries: Bulgaria, Greece, and Turkey. It handles data collection, processing, storage, and analysis for the Thrace region.

---

## 1. Application Architecture

### Tech Stack
- **Frontend**: Bootstrap 4.3.1 + PHP templates
- **Backend**: PHP with MVC pattern using custom classes
- **Database**: MySQL (AWS RDS)
- **File Storage**: Server-side (templates, uploads, JSON data files)
- **Entry Point**: `Thrace/public/main.php` - Routes all requests

### Core Classes Structure
```
classes/
├── bb/                    # Base framework classes
│   ├── EntryPoint.php     # Route dispatcher
│   ├── DatabaseTable.php  # ORM-like database operations
│   └── Authentication.php # User authentication
└── fmd/                   # FMD-specific logic
    ├── PcpRoutes.php      # Route definitions & table initialization
    ├── controllers/       # Business logic
    │   ├── factivity.php      # Field activities management
    │   ├── query.php          # Data queries & visualization
    │   ├── epiunit.php        # Epidemiological units
    │   ├── login.php          # Authentication
    │   └── inspector.php      # User/inspector management
    └── entity/            # Data entity classes
        ├── epiunit.php    # Epidemiological unit entity
        ├── nation.php     # Nation entity
        └── user.php       # User entity
```

---

## 2. Database Schema

### Key Tables

#### `users` Table
- User authentication & roles
- Fields: `userID`, `email`, `password`, `role` (1=CVO/Country, 4=WG/WorkingGroup, 6=ADMIN), `nationID`, `provinceID`
- Linked to: `nationscommon_view`, `provincescommon_view`, `districtscommon_view`

#### `epiunits` Table
- Epidemiological units (sampling/surveillance areas)
- Fields: `epiunitID`, `epiunitType`, `nationID`, `provinceID`, `districtID`, `size`, `species`
- Views: `epiunits_view` - filtered/joined view for easier querying

#### `factivities` Table
- Field activities (surveillance events)
- Captures: **clinical samples**, **serological samples**, **clinical positives**, **sero positives**
- Fields: `factivityID`, `epiunitID`, `year`, `month`, `species`, `disease`, `country`, `size`, `risk`, `clin`, `sero`, `clinpos`, `seropos`, `dt_inival` (date)
- States: Active data in `factivities`, Temporary (uploaded) in `factivities_tmp`

#### `all_data` Table
- **Aggregated results** - calculated from field activities
- Contains summarized surveillance statistics per species/disease/country/month
- Used for reporting and visualization

#### `inventory` Table
- Annual inventory of epidemiological units
- Tracks active/inactive units per year and country

#### Supporting Tables
- `nationscommon_view` - Geographic hierarchy (nations)
- `provincescommon_view` - Geographic hierarchy (provinces)
- `districtscommon_view` - Geographic hierarchy (districts)
- `admin_view` - Combined admin view for geographic data
- `inspectors` - Inspector/user details with validity dates
- `view_menu` - Role-based menu definitions

---

## 3. Data Flow Workflow

### 3.1 Template Download
**User Action**: Click "Download Template"
**Files**: `templates/download/download.html.php`, `Excel-download.php`
**Process**:
1. User selects country (Bulgaria/Greece/Turkey)
2. System serves pre-formatted Excel template (`ThraceActivities.xlsx`)
3. Template includes columns for:
   - **Epidemiological Unit ID** (epiunitID)
   - **Year, Month**
   - **Species** (ALL, BOV, BUF, CAP, LR, OVI, POR, SR)
   - **Disease** (FMD, LSD, PPR, SGP)
   - **Country, Risk category**
   - **Sample counts**: `clin` (clinical), `sero` (serological)
   - **Positive counts**: `clinpos`, `seropos`
   - **Size** (population of epiunit)

### 3.2 Data Entry & Upload
**Files**: `templates/download/upload.html.php`, `upload.php`
**Process**:
1. User fills Excel template with surveillance data
2. User uploads file via form submission
3. System parses Excel file and validates data:
   - Column presence and format checks
   - Data type validation (numeric, dates, etc.)
   - Business rule validation (e.g., clinpos ≤ clin)
4. **Temporary Storage**: Valid data inserted into `factivities_tmp` table
5. **Manual Review**: Data available for inspection before final commit
6. **Final Approval**: Admin/WG user approves → data moved to `factivities` (live table)

**Entry Point**: Controller `factivity.php`
```php
// Handles upload state management
- Upload form display
- File parsing & validation
- Temp table insertion
- Approval workflow
```

### 3.3 Data Processing & Calculations
**Files**: `public/data/*.json` (pre-calculated summary files)
**Process**:
1. When data is approved and committed to `factivities`:
   - System calculates aggregates per:
     - Species (ALL, BOV, BUF, CAP, LR, OVI, POR, SR)
     - Disease (FMD, LSD, PPR, SGP)
     - Country (Bulgaria, Greece, Turkey, ALL)
     - Month/Year
   - Results stored in `all_data` table
2. **SQL Calculations** - Likely includes:
   - Sample counts aggregation
   - Positivity rates calculation
   - Probability of freedom estimations
   - Risk stratification

### 3.4 Report Download
**Files**: `templates/download/Excel-download.php`
**Process**:
1. User selects filters (country, species, disease, date range)
2. System queries `all_data` table with filters
3. Generates Excel report with:
   - Summary statistics
   - Surveillance coverage
   - Positivity rates
   - Trend analysis (monthly data)
4. User downloads `CycleReport.xlsx` (pre-generated) or dynamically generated

### 3.5 Data Visualization & Queries
**Files**: 
- `classes/fmd/controllers/query.php` - Query building logic
- `templates/query/mappe/epiunits.html.php` - Visualization UI
- `public/data/*.json` - Pre-calculated visualization data

**Visualizations**:
1. **Epiunit Map** (`mappaepi()` function)
   - Geographic distribution of epidemiological units
   - Filtered by: Country, Year, Species, Disease, Risk Category
   - JSON data served from `public/data/` folder
   
2. **Data by Species/Disease**
   - Breakdown tables showing surveillance activity
   - All combinations: `{SPECIES}_{DISEASE}_{COUNTRY}.json`
   - Example: `BOV_FMD_BG.json` - Bovine FMD data for Bulgaria

3. **Risk Stratification**
   - Risk categories displayed per species/disease/country

---

## 4. Field Activity & Epiunit Management

### 4.1 Epidemiological Units (Epiunit)
**Definition**: Geographic/administrative units for surveillance
**Attributes**:
- Location: Country → Province → District
- Species: What animals are sampled (cattle, buffalo, sheep, goat, pig, etc.)
- Size: Population size for statistical relevance
- Types: Different surveillance activity types

**Management**: 
- Admin creates/edits epiunits via `epiunit.php` controller
- Stored in `epiunits` table
- Linked to inspectors & activities

### 4.2 Field Activities (Factivity)
**Definition**: Surveillance events/activities conducted
**Associated with Epiunits**:
- One activity linked to one epiunit
- Captures samples taken during inspection

**Entry Points** (`factivity.php` controller):
- `listactivities()` - List all activities
- `editactivity()` - Edit/create activity form
- `saveactivity()` - Save to database
- `inventory()` - Manage annual inventory

**Data Captured per Activity**:
```
factivityID (auto)
├─ epiunitID (links to epiunit)
├─ Date: year, month, dt_inival (activity start)
├─ Samples: clin, sero (counts)
├─ Results: clinpos, seropos (positive counts)
├─ Species: (cattle, buffalo, sheep, goat, pig, etc.)
├─ Disease: FMD, LSD, PPR, SGP
├─ Risk category
└─ userID (who created)
```

---

## 5. Inspector & User Management

### User Roles
1. **CVO (Country Veterinary Officer)** - Role ID 1
   - Can only see their own country's data
   - Can upload/manage activities for their country

2. **WG (Working Group)** - Role ID 4
   - Can see all countries' data
   - Approve/review uploaded data

3. **ADMIN** - Role ID 6
   - Full system access
   - Manage users, inspectors, epiunits

### Inspectors Table
- `inspectorID`, `FAMILYNAME`, `GIVENNAME`
- Validity dates: `dt_inival`, `dt_finval` (active inspector filtering)
- Linked to `nationID`

---

## 6. UI Components & Entry Points

### Main Routes (from `PcpRoutes.php`)
```php
'home'              → Welcome page
'query/mappaepi'    → Map visualization of epiunits
'login'             → Login form
'download/list'     → Download options (templates, reports)
'download/upload'   → Upload Excel template
'oper/efa'          → Field activity list
'oper/editefa'      → Edit/create field activity
'oper/inv'          → Inventory management
'oper/succ'         → Success confirmation
'conf/admin'        → Admin configuration
'conf/epiunit'      → Epiunit management
```

### Templates Structure
```
templates/
├── login/               # Login form
├── download/           # Template download & upload UI
│   ├── download.html.php
│   ├── upload.html.php
│   └── Excel-download.php
├── fieldactivity/      # Field activities management
│   ├── falist.html.php      # List view
│   ├── faedit.html.php      # Edit/create form
│   └── inventory/           # Inventory management
├── query/              # Visualization & reporting
│   └── mappe/
│       └── epiunits.html.php # Map view
├── epiunits/           # Epiunit management
└── configuration/      # Admin configuration
```

---

## 7. JSON Data Files Structure

### Purpose
Pre-calculated JSON files in `public/data/` for fast visualization without live DB queries.

### Naming Pattern
`{SPECIES}_{DISEASE}_{COUNTRY}.json`

### Example Files
- `ALL_FMD_ALL.json` - All species, FMD, All countries
- `BOV_FMD_BG.json` - Bovine FMD for Bulgaria
- `OVI_PPR_TK.json` - Ovine PPR for Turkey
- `CAP_LSD_GR.json` - Caprine LSD for Greece

### Content
Contains surveillance data aggregated by:
- Epiunit ID
- Month/Year
- Sample counts
- Positive counts
- Risk categories

---

## 8. Key Workflows & Business Processes

### Workflow 1: Data Collection & Upload
```
1. Template Download
   ↓
2. User fills template with surveillance data
   ↓
3. File Upload & Validation
   ↓
4. Data inserted into factivities_tmp
   ↓
5. Manual Review & Approval (WG/ADMIN)
   ↓
6. Move to factivities (live)
   ↓
7. Trigger SQL aggregation → all_data
   ↓
8. Update JSON visualization files
```

### Workflow 2: Reporting & Analysis
```
1. User selects report filters
   ↓
2. System queries all_data table
   ↓
3. Calculations (rates, coverage, POF)
   ↓
4. Generate Excel report
   ↓
5. User downloads CycleReport
```

### Workflow 3: Visualization
```
1. User selects filters (country, species, disease, date)
   ↓
2. System loads pre-calculated JSON from public/data/
   ↓
3. Frontend renders map/charts
   ↓
4. Shows epiunit locations, surveillance status, results
```

---

## 9. Database View Examples

### View: `epiunits_view`
Joins epidemiological units with geographic hierarchy:
```sql
SELECT 
  epiunitID, country, nationID, 
  province_name, provinceID,
  district_name, districtID,
  epiunitType, size, species
FROM epiunits JOIN provinces JOIN districts
```

### View: `admin_view`
Combined geographic data for admin operations:
```sql
SELECT nationID, country, province, district...
```

### View: `view_menu`
Role-based menu structure for UI navigation.

---

## 10. Excel Template Structure

### Template File: `ThraceActivities.xlsx`

**Columns**:
| Column | Data Type | Example | Notes |
|--------|-----------|---------|-------|
| epiunitID | Integer | 101 | References epidemiological unit |
| Year | Integer | 2024 | Surveillance year |
| Month | Integer | 1-12 | Month of activity |
| Species | String | BOV, OVI, CAP, etc. | 8 types total |
| Disease | String | FMD, PPR, LSD, SGP | Disease being monitored |
| Country | String | BG, GR, TK | Bulgaria, Greece, Turkey |
| Risk | String | H, M, L | High, Medium, Low |
| Size | Integer | 500 | Population of epiunit |
| Clin | Integer | 10 | Clinical samples collected |
| Sero | Integer | 15 | Serological samples collected |
| ClinPos | Integer | 2 | Positive clinical samples |
| SeroPos | Integer | 3 | Positive serological samples |

---

## 11. Error Handling & Validation

### File Upload Validation
- Column presence check
- Data type validation
- Business rule validation:
  - ClinPos ≤ Clin
  - SeroPos ≤ Sero
  - Valid species/disease/country codes
  - Valid date range

### Database Operations
- Exception handling via try-catch
- PDOException logging
- User-friendly error messages displayed

---

## 12. Configuration & Security

### Authentication
- Session-based (PHP sessions)
- Password storage: Database (check `users` table)
- Role-based access control (RBAC)

### Configuration File
`config.php` defines:
```php
DB_SERVER        // AWS RDS endpoint
DB_USERNAME      // Database user
DB_PASSWORD      // Database password
DB_DATABASE      // 'thrace' database
BASE_URL         // Application URL
K_CVO = 1        // Role constants
K_WG = 4
K_ADMIN = 6
```

### Languages
Multi-language support via:
- `languages/lingua_en.php` - English strings
- `languages/lingua_fr.php` - French strings (presumed)
- Runtime selection via `$_SESSION['lang']`

---

## 13. File Management

### Uploaded Files Location
`templates/download/filetmp/` - Temporary Excel files

### Template Location
`templates/` - Master templates for download

### Generated Reports
`download/` folder - Reports ready for user download

### JSON Data Files
`public/data/` - Pre-calculated visualization data (52 JSON files total)

---

## 14. Key Technical Patterns

### MVC-like Structure
- **Model**: `entity/` classes (User, Nation, Epiunit, etc.)
- **View**: `templates/` PHP files
- **Controller**: `controllers/` classes (factivity, query, login, etc.)

### ORM Approach
`DatabaseTable` class provides:
- `findAll()` - Get all records
- `findById()` - Get single record
- `findFiltered()` - Query with WHERE clause
- `save()` - Insert/update
- `delete()` - Remove record
- `querylibera()` - Raw SQL execution

### Routing
`EntryPoint` class intercepts requests:
```
URL?route=controller/action
↓
Parses to: controller → action
↓
Instantiates controller class
↓
Calls action method
↓
Returns template & variables
```

---

## Summary: High-Level Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    THRACE SYSTEM FLOW                            │
└─────────────────────────────────────────────────────────────────┘

1. USER LOGIN
   ↓
2. SELECT ACTION
   ├─→ Download Template → Get Excel → Fill with data
   │   ↓
   ├─→ Upload Data → Validate → Temp storage → Approve → Live DB
   │   ↓
   ├─→ View Results → Query all_data → Generate Report → Download
   │   ↓
   └─→ View Map → Load JSON → Visualize epiunits & results

3. BACKGROUND PROCESSING
   ├─→ Data approval → Aggregate to all_data
   ├─→ Calculate statistics & POF
   └─→ Update JSON visualization files

4. ROLE-BASED ACCESS
   ├─→ CVO (1): See own country only
   ├─→ WG (4): See all countries, approve data
   └─→ ADMIN (6): Full system control
```

---

## Conclusion

The THRACE old app is a **structured surveillance data management system** with:
- ✅ Clear data flow (download → enter → upload → validate → report)
- ✅ Role-based access control
- ✅ Multi-step approval process
- ✅ Comprehensive reporting & visualization
- ✅ Geographic hierarchy management
- ✅ Multiple surveillance metrics (FMD, PPR, LSD, SGP)

**Next Step**: Implement these features in the React-based EuFMD Nexus application while maintaining the same data integrity and business logic.
