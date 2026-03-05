# THRACE Freedom Analysis API - Usage Examples

## Endpoints

### 1. GET /api/thrace/freedom-data
Calculate freedom analysis without saving results.

**Use Case**: Quick calculations, testing, data exploration

**Example Request**:
```bash
curl -X GET "https://nexus.eufmd-tom.com/api/thrace/freedom-data?species=BOV&disease=FMD&region=GR&year=2024" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Example Response**:
```json
{
  "success": true,
  "species": "BOV",
  "disease": "FMD",
  "region": "GR",
  "year": 2024,
  "data": {
    "labels": ["2016-01-01", "2016-02-01", ...],
    "pfree": ["0.6067", "0.7141", ...],
    "sens": ["0.3619", "0.3754", ...],
    "pintro": ["0.2", "0.2", ...],
    "animals": [1234, 1456, ...],
    "herds": [45, 48, ...],
    "sero": [500, 550, ...],
    "clin": [300, 320, ...]
  },
  "metadata": {
    "calculation_method": "Cameron et al. (FAO 2014) - Combined Herd Sensitivity",
    "corrections_applied": ["R1", "R2", "R4", "R11", "R12", "R14"]
  }
}
```

### 2. POST /api/thrace/calculate-freedom (NEW - R24)
Calculate freedom analysis AND save results to audit table.

**Use Case**: Official calculations, record-keeping, audit trail

**Example Request**:
```bash
curl -X POST "https://nexus.eufmd-tom.com/api/thrace/calculate-freedom" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "species": "BOV",
    "disease": "FMD",
    "region": "GR",
    "year": 2024,
    "save_results": true
  }'
```

**Example Response**:
```json
{
  "success": true,
  "species": "BOV",
  "disease": "FMD",
  "region": "GR",
  "year": 2024,
  "data": {
    "labels": ["2016-01-01", "2016-02-01", ...],
    "pfree": ["0.6067", "0.7141", ...],
    "sens": ["0.3619", "0.3754", ...],
    ...
  },
  "saved": true,
  "saved_count": 117,
  "calculated_by": 42,
  "metadata": {
    "calculation_method": "Cameron et al. (FAO 2014) - Combined Herd Sensitivity",
    "corrections_applied": ["R1", "R2", "R4", "R11", "R12", "R14", "R24"]
  }
}
```

## Parameters

### Species Filter
- `ALL` - All species
- `LR` - Large ruminants (cattle + buffalo)
- `BOV` - Cattle only
- `BUF` - Buffalo only
- `SR` - Small ruminants (sheep + goat)
- `OVI` - Sheep only
- `CAP` - Goat only
- `POR` - Pigs

### Disease
- `FMD` - Foot and Mouth Disease
- `PPR` - Peste des Petits Ruminants (⚠️ Cannot use region=ALL)
- `LSD` - Lumpy Skin Disease
- `SGP` - Sheep and Goat Pox

### Region
- `ALL` - All regions (Greece, Bulgaria, Türkiye)
- `GR` - Greece only
- `BG` - Bulgaria only
- `TK` - Türkiye only

**Important**: PPR cannot be calculated for `region=ALL` due to protocol differences between countries.

### Year
- Any year from 2016 onwards
- Defaults to current year if not specified
- Note: Calculation now processes ALL historical years, not just the specified year

### Save Results (POST only)
- `true` (default) - Save to audit table
- `false` - Calculate only, don't save

## Frontend Integration (React/TypeScript)

```typescript
import { apiService } from '../services/api';

// Quick calculation (no save)
const quickCalculation = async () => {
  try {
    const response = await apiService.thrace.getFreedomData(
      'BOV',  // species
      'FMD',  // disease
      'GR',   // region
      false   // refresh_summary
    );
    console.log('Results:', response.data);
  } catch (error) {
    console.error('Calculation failed:', error);
  }
};

// Official calculation with save
const officialCalculation = async () => {
  try {
    const response = await apiService.thrace.calculateAndSaveFreedom({
      species: 'BOV',
      disease: 'FMD',
      region: 'GR',
      year: 2024,
      save_results: true
    });
    
    if (response.data.saved) {
      console.log(`Saved ${response.data.saved_count} monthly records`);
    }
    
    // Display results
    plotFreedomChart(response.data.data);
  } catch (error) {
    console.error('Calculation failed:', error);
  }
};
```

## Database Audit Trail

All saved calculations are stored in `thrace.thrace_calculation_results`:

```sql
-- View recent calculations
SELECT 
  species_filter, disease, region_filter,
  COUNT(*) as months,
  calculated_by, calculated_at
FROM thrace.thrace_calculation_results
GROUP BY species_filter, disease, region_filter, calculated_by, calculated_at
ORDER BY calculated_at DESC
LIMIT 10;

-- Get specific calculation details
SELECT 
  result_year, result_month, sse, pintro, pfreedom,
  animals, herds, sero_samples, clin_examined
FROM thrace.thrace_calculation_results
WHERE species_filter='BOV' 
  AND disease='FMD' 
  AND region_filter='GR'
  AND calculated_by=42
  AND calculated_at >= '2026-03-01'
ORDER BY result_year, result_month;

-- Cleanup test data
DELETE FROM thrace.thrace_calculation_results 
WHERE calculated_by=999;
```

## Error Handling

### Common Errors

1. **No authentication token**
   ```json
   {
     "detail": "Could not validate credentials"
   }
   ```
   Solution: Include `Authorization: Bearer TOKEN` header

2. **Invalid species/disease/region combination**
   ```json
   {
     "success": false,
     "error": "No data found for specified parameters"
   }
   ```
   Solution: Check parameter validity (e.g., PPR cannot use ALL regions)

3. **Database connection error**
   ```json
   {
     "detail": "Error calculating freedom data: ..."
   }
   ```
   Solution: Check database connectivity and permissions

4. **Save failed (POST endpoint)**
   - Calculation still succeeds
   - Returns `"saved": false`
   - Check database table exists and user has INSERT permission

## Testing

Run comprehensive tests:

```bash
cd backend

# Test calculation
python test_final_validation.py

# Test save functionality
python test_save_results.py

# Test formula accuracy
python test_corrections_validation.py
```

Expected output:
```
✅ FMD + Cattle + Greece: 117 months
✅ PPR + Small Ruminants + Greece: 117 months
✅ LSD + Large Ruminants + Bulgaria: 115 months
✅ Saved 117 records to thrace_calculation_results
```
