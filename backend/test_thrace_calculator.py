"""
Test script to compare ThraceCalculator (Python) results with all_data table (SQL) results
"""

import sys
import asyncio
from database import DatabaseHelper, thrace_engine
from routers.thrace_calculator import ThraceCalculator
import json
from datetime import datetime

async def get_all_data_results(species: str, disease: str, region: str):
    """Get results from the old SQL function via all_data table"""
    print(f"\n{'='*80}")
    print(f"FETCHING SQL RESULTS FROM all_data TABLE")
    print(f"Species: {species}, Disease: {disease}, Region: {region}")
    print(f"{'='*80}")
    
    try:
        # Try to call the old get_freedom_data SQL function
        result = await DatabaseHelper.execute_thrace_query(
            "SELECT thrace.get_freedom_data(%s, %s, %s) AS result",
            (species, disease, region)
        )
        
        if result.get("error"):
            print(f"SQL Error: {result['error']}")
            return None
        
        rows = result.get("data", [])
        if not rows or "result" not in rows[0] or rows[0]["result"] is None:
            print("No SQL results found")
            return None
        
        try:
            payload = json.loads(rows[0]["result"])
            print(f"✅ SQL results retrieved successfully")
            print(f"   Months: {len(payload.get('labels', []))}")
            return payload
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            return None
            
    except Exception as e:
        print(f"Exception getting SQL results: {str(e)}")
        return None

def get_python_results(species: str, disease: str, region: str, year: int):
    """Get results from Python ThraceCalculator"""
    print(f"\n{'='*80}")
    print(f"CALCULATING PYTHON RESULTS")
    print(f"Species: {species}, Disease: {disease}, Region: {region}, Year: {year}")
    print(f"{'='*80}")
    
    try:
        calculator = ThraceCalculator(thrace_engine)
        
        results = calculator.calculate_system_sensitivity(
            species_filter=species,
            disease=disease,
            region_filter=region,
            year=year
        )
        
        print(f"✅ Python results calculated successfully")
        print(f"   Months: {len(results.get('labels', []))}")
        return results
        
    except Exception as e:
        print(f"❌ Exception calculating Python results: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return None

def compare_results(sql_results, python_results, species: str, disease: str, region: str):
    """Compare SQL and Python results"""
    print(f"\n{'='*80}")
    print(f"COMPARISON: {species} / {disease} / {region}")
    print(f"{'='*80}")
    
    if not sql_results:
        print("⚠️  No SQL results to compare")
        if python_results:
            print(f"✅ Python results exist with {len(python_results.get('labels', []))} months")
        return
    
    if not python_results:
        print("⚠️  No Python results to compare")
        if sql_results:
            print(f"✅ SQL results exist with {len(sql_results.get('labels', []))} months")
        return
    
    # Compare structure
    sql_labels = sql_results.get('labels', [])
    python_labels = python_results.get('labels', [])
    
    print(f"\n📊 DATA POINTS:")
    print(f"   SQL months:    {len(sql_labels)}")
    print(f"   Python months: {len(python_labels)}")
    
    if len(sql_labels) != len(python_labels):
        print(f"   ⚠️  Different number of months!")
    
    # Compare first few months in detail
    print(f"\n📈 FIRST 5 MONTHS COMPARISON:")
    print(f"{'Month':<15} {'SQL P(free)':<15} {'Py P(free)':<15} {'SQL Sens':<15} {'Py Sens':<15} {'Diff P(free)':<15}")
    print(f"{'-'*100}")
    
    max_compare = min(5, len(sql_labels), len(python_labels))
    
    sql_pfree = [float(x) if x else 0.0 for x in sql_results.get('pfree', [])]
    python_pfree = [float(x) if x else 0.0 for x in python_results.get('pfree', [])]
    sql_sens = [float(x) if x else 0.0 for x in sql_results.get('sens', [])]
    python_sens = [float(x) if x else 0.0 for x in python_results.get('sens', [])]
    
    for i in range(max_compare):
        month = python_labels[i] if i < len(python_labels) else 'N/A'
        sql_pf = sql_pfree[i] if i < len(sql_pfree) else 0.0
        py_pf = python_pfree[i] if i < len(python_pfree) else 0.0
        sql_s = sql_sens[i] if i < len(sql_sens) else 0.0
        py_s = python_sens[i] if i < len(python_sens) else 0.0
        diff_pf = abs(sql_pf - py_pf)
        
        marker = "⚠️" if diff_pf > 0.01 else "✅"
        print(f"{month:<15} {sql_pf:<15.6f} {py_pf:<15.6f} {sql_s:<15.6f} {py_s:<15.6f} {diff_pf:<15.6f} {marker}")
    
    # Compare last month
    if len(sql_labels) > 0 and len(python_labels) > 0:
        print(f"\n📊 LAST MONTH COMPARISON:")
        last_sql_idx = len(sql_labels) - 1
        last_py_idx = len(python_labels) - 1
        
        print(f"   SQL:    P(free)={sql_pfree[last_sql_idx]:.6f}, Sens={sql_sens[last_sql_idx]:.6f}")
        print(f"   Python: P(free)={python_pfree[last_py_idx]:.6f}, Sens={python_sens[last_py_idx]:.6f}")
        print(f"   Diff:   {abs(sql_pfree[last_sql_idx] - python_pfree[last_py_idx]):.6f}")
    
    # Compare sample counts
    print(f"\n🔬 SAMPLE COUNTS (First 5 months):")
    sql_sero = sql_results.get('sero', [])
    python_sero = python_results.get('sero', [])
    sql_clin = sql_results.get('clin', [])
    python_clin = python_results.get('clin', [])
    
    print(f"{'Month':<15} {'SQL Sero':<12} {'Py Sero':<12} {'SQL Clin':<12} {'Py Clin':<12}")
    print(f"{'-'*70}")
    
    for i in range(max_compare):
        month = python_labels[i] if i < len(python_labels) else 'N/A'
        sql_sr = sql_sero[i] if i < len(sql_sero) else 0
        py_sr = python_sero[i] if i < len(python_sero) else 0
        sql_cl = sql_clin[i] if i < len(sql_clin) else 0
        py_cl = python_clin[i] if i < len(python_clin) else 0
        
        sero_match = "✅" if sql_sr == py_sr else "⚠️"
        clin_match = "✅" if sql_cl == py_cl else "⚠️"
        
        print(f"{month:<15} {sql_sr:<12} {py_sr:<12} {sero_match:<2} {sql_cl:<12} {py_cl:<12} {clin_match}")

async def main():
    """Run comparison tests for different combinations"""
    
    test_cases = [
        ("ALL", "FMD", "ALL", 2024),
        ("ALL", "FMD", "GR", 2024),
        ("LR", "FMD", "ALL", 2024),
        ("BOV", "FMD", "ALL", 2024),
    ]
    
    print("\n" + "="*80)
    print("THRACE CALCULATOR VALIDATION TEST")
    print("Comparing Python ThraceCalculator vs SQL get_freedom_data()")
    print("="*80)
    
    for species, disease, region, year in test_cases:
        print(f"\n\n{'#'*80}")
        print(f"TEST CASE: Species={species}, Disease={disease}, Region={region}, Year={year}")
        print(f"{'#'*80}")
        
        # Get SQL results
        sql_results = await get_all_data_results(species, disease, region)
        
        # Get Python results
        python_results = get_python_results(species, disease, region, year)
        
        # Compare
        compare_results(sql_results, python_results, species, disease, region)
        
        print("\n" + "-"*80)
    
    print("\n\n" + "="*80)
    print("TEST COMPLETE")
    print("="*80)

if __name__ == "__main__":
    asyncio.run(main())
