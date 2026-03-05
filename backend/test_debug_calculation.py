"""
Debug the calculation step-by-step for January 2024
"""

import sys
import asyncio
from database import DatabaseHelper, thrace_engine
from routers.thrace_calculator import ThraceCalculator

async def debug_january_calculation():
    """Step through the calculation for January 2024"""
    
    print("\n" + "="*80)
    print("DEBUG: JANUARY 2024 CALCULATION")
    print("="*80)
    
    # Get January 2024 activities directly
    query = """
        SELECT 
            fa.factivityID,
            fa.dt_insp,
            fa.cattle, fa.cattleexam, fa.cattletested, fa.cattlesample,
            fa.sheep, fa.sheepexam, fa.sheeptested, fa.sheepsample,
            eu.risklevel
        FROM thrace.factivities fa
        JOIN thrace.epiunits eu ON fa.epiunitID = eu.epiunitID
        WHERE YEAR(fa.dt_insp) = 2024 AND MONTH(fa.dt_insp) = 1
        LIMIT 10
    """
    
    result = await DatabaseHelper.execute_thrace_query(query)
    
    print("\n📊 Sample January 2024 Activities:")
    print(f"{'ID':<10} {'Date':<12} {'Cattle':<8} {'C.Exam':<8} {'C.Test':<8} {'C.Samp':<8} {'Risk':<8}")
    print("-" * 80)
    
    for row in result.get("data", []):
        print(f"{row['factivityID']:<10} "
              f"{str(row['dt_insp']):<12} "
              f"{row['cattle'] or 0:<8} "
              f"{row['cattleexam'] or 0:<8} "
              f"{row['cattletested'] or 'NULL':<8} "
              f"{row['cattlesample'] or 0:<8} "
              f"{row['risklevel'] or 'NULL':<8}")
    
    # Now run the Python calculator and see intermediate values
    print("\n" + "="*80)
    print("RUNNING PYTHON CALCULATOR FOR JAN 2024")
    print("="*80)
    
    calculator = ThraceCalculator(thrace_engine)
    
    # Get parameters
    params = calculator.get_params('FMD', 'ALL')
    print(f"\n📋 Parameters for FMD/ALL:")
    for key, val in params.items():
        print(f"  {key}: {val}")
    
    # Get activities
    activities = calculator.get_factivities_data(
        year=2024,
        countries=['GRC', 'BGR', 'TUR'],
        disease='FMD',
        species_list=['cattle', 'buffalo', 'sheep', 'goat', 'pig']
    )
    
    # Filter to January
    jan_activities = [a for a in activities if a['dt_insp'].month == 1]
    
    print(f"\n📊 January 2024 Activities: {len(jan_activities)} records")
    
    # Calculate totals
    total_cattle = sum(a['populations']['cattle'] for a in jan_activities)
    total_cattle_exam = sum(a['examined']['cattle'] for a in jan_activities)
    total_cattle_tested_raw = sum(a['tested']['cattle'] or 0 for a in jan_activities)
    total_cattle_sample = sum(a['sampled']['cattle'] for a in jan_activities)
    
    print(f"\n🔬 Raw January Totals (ALL species):")
    print(f"  Cattle population: {total_cattle}")
    print(f"  Cattle examined: {total_cattle_exam}")
    print(f"  Cattle tested (raw): {total_cattle_tested_raw}")
    print(f"  Cattle sampled: {total_cattle_sample}")
    
    # Now apply protocol rules (R2)
    total_clin_tested_after_protocol = 0
    
    for act in jan_activities[:5]:  # Just first 5 for inspection
        cattle_exam = act['examined']['cattle']
        cattle_tested_raw = act['tested']['cattle']
        
        # Apply protocol (simplified - just for cattle/FMD)
        clin_tested = calculator.get_tested_count(
            species='cattle',
            disease='FMD',
            country=act['country'],
            exam_count=cattle_exam,
            tested_count=cattle_tested_raw,
            visit_date=act['dt_insp']
        )
        
        total_clin_tested_after_protocol += clin_tested
        
        print(f"  Activity {act['factivityID']}: exam={cattle_exam}, tested_raw={cattle_tested_raw}, after_protocol={clin_tested}")
    
    print(f"\n  Total clin tested (first 5 activities after protocol): {total_clin_tested_after_protocol}")

async def main():
    await debug_january_calculation()

if __name__ == "__main__":
    asyncio.run(main())
