"""
Inspect actual data in factivities table to understand the differences
"""

import sys
import asyncio
from database import DatabaseHelper

async def inspect_january_2024_data():
    """Check January 2024 data to see exam vs tested values"""
    
    print("\n" + "="*80)
    print("INSPECTING JANUARY 2024 DATA")
    print("="*80)
    
    # Get sample of January 2024 data
    query = """
        SELECT 
            factivityID,
            epiunitID,
            dt_insp,
            cattle,
            cattleexam,
            cattletested,
            cattlesample,
            sheep,
            sheepexam,
            sheeptested,
            sheepsample
        FROM thrace.factivities
        WHERE YEAR(dt_insp) = 2024 AND MONTH(dt_insp) = 1
        LIMIT 20
    """
    
    result = await DatabaseHelper.execute_thrace_query(query)
    
    if result.get("error"):
        print(f"Error: {result['error']}")
        return
    
    data = result.get("data", [])
    
    print(f"\nFound {len(data)} sample records from January 2024:\n")
    print(f"{'ID':<10} {'Date':<12} {'Cattle':<8} {'CExam':<8} {'CTested':<8} {'CSample':<8} {'Sheep':<8} {'SExam':<8} {'STested':<8} {'SSample':<8}")
    print("-" * 110)
    
    total_cattle_exam = 0
    total_cattle_tested = 0
    total_sheep_exam = 0
    total_sheep_tested = 0
    
    for row in data:
        print(f"{row['factivityID']:<10} "
              f"{str(row['dt_insp']):<12} "
              f"{row['cattle'] or 0:<8} "
              f"{row['cattleexam'] or 0:<8} "
              f"{row['cattletested'] or 'NULL':<8} "
              f"{row['cattlesample'] or 0:<8} "
              f"{row['sheep'] or 0:<8} "
              f"{row['sheepexam'] or 0:<8} "
              f"{row['sheeptested'] or 'NULL':<8} "
              f"{row['sheepsample'] or 0:<8}")
        
        total_cattle_exam += row['cattleexam'] or 0
        total_cattle_tested += row['cattletested'] or 0
        total_sheep_exam += row['sheepexam'] or 0
        total_sheep_tested += row['sheeptested'] or 0
    
    print("-" * 110)
    print(f"\nSample Totals:")
    print(f"  Cattle Examined: {total_cattle_exam}")
    print(f"  Cattle Tested:   {total_cattle_tested}")
    print(f"  Sheep Examined:  {total_sheep_exam}")
    print(f"  Sheep Tested:    {total_sheep_tested}")
    
    # Check if tested columns are NULL
    null_check = await DatabaseHelper.execute_thrace_query("""
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN cattletested IS NULL THEN 1 ELSE 0 END) as cattle_null,
            SUM(CASE WHEN sheeptested IS NULL THEN 1 ELSE 0 END) as sheep_null,
            SUM(CASE WHEN goattested IS NULL THEN 1 ELSE 0 END) as goat_null
        FROM thrace.factivities
        WHERE YEAR(dt_insp) = 2024 AND MONTH(dt_insp) = 1
    """)
    
    if null_check.get("data"):
        nc = null_check["data"][0]
        print(f"\n📊 NULL Analysis (January 2024):")
        print(f"  Total records: {nc['total']}")
        print(f"  Cattle tested NULL: {nc['cattle_null']} ({nc['cattle_null']/nc['total']*100:.1f}%)")
        print(f"  Sheep tested NULL: {nc['sheep_null']} ({nc['sheep_null']/nc['total']*100:.1f}%)")
        print(f"  Goat tested NULL: {nc['goat_null']} ({nc['goat_null']/nc['total']*100:.1f}%)")
    
    # Get monthly totals for ALL of 2024
    monthly_totals = await DatabaseHelper.execute_thrace_query("""
        SELECT 
            MONTH(dt_insp) as month,
            COUNT(*) as records,
            SUM(cattleexam) as cattle_exam_total,
            SUM(cattletested) as cattle_tested_total,
            SUM(cattlesample) as cattle_sample_total,
            SUM(sheepexam) as sheep_exam_total,
            SUM(sheeptested) as sheep_tested_total,
            SUM(sheepsample) as sheep_sample_total
        FROM thrace.factivities
        WHERE YEAR(dt_insp) = 2024
        GROUP BY MONTH(dt_insp)
        ORDER BY month
    """)
    
    if monthly_totals.get("data"):
        print(f"\n📈 MONTHLY TOTALS FOR 2024:")
        print(f"{'Month':<8} {'Records':<10} {'C.Exam':<10} {'C.Tested':<10} {'C.Sample':<10} {'S.Exam':<10} {'S.Tested':<10} {'S.Sample':<10}")
        print("-" * 90)
        
        for row in monthly_totals["data"]:
            print(f"{row['month']:<8} "
                  f"{row['records']:<10} "
                  f"{row['cattle_exam_total'] or 0:<10} "
                  f"{row['cattle_tested_total'] or 0:<10} "
                  f"{row['cattle_sample_total'] or 0:<10} "
                  f"{row['sheep_exam_total'] or 0:<10} "
                  f"{row['sheep_tested_total'] or 0:<10} "
                  f"{row['sheep_sample_total'] or 0:<10}")

async def main():
    await inspect_january_2024_data()

if __name__ == "__main__":
    asyncio.run(main())
