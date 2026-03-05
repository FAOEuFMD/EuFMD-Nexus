"""
Test to verify USe_1 and USe_2 parameter usage
"""

import asyncio
from database import DatabaseHelper

async def check_params():
    # Get params from database
    result = await DatabaseHelper.execute_thrace_query("""
        SELECT disease, param, value FROM thrace.params 
        WHERE disease='FMD' AND region='GRC,BGR,TUR' 
        AND param IN ('USe_1', 'USe_2', 'USe_3')
        ORDER BY param
    """)
    
    print("Parameter values from database:")
    for row in result['data']:
        print(f"  {row['param']}: {row['value']}")
    
    print("\nFrom SQL function (lines 619-620):")
    print("  First term: USe_1 * sero/size  → USe_1 is for SEROLOGY")
    print("  Second term: USe_2 * clin/size  → USe_2 is for CLINICAL")
    
    print("\nFMD parameter values:")
    print("  USe_1 = 0.92 (SEROLOGY test sensitivity)")
    print("  USe_2 = 0.2 (CLINICAL examination sensitivity)")
    print("  USe_3 = 0.3 (not used in formula)")
    
    print("\nPython calculator assumption:")
    print("  use_clin = params.get('USe_1', 0.92)  ← WRONG!")
    print("  use_sero = params.get('USe_2', 0.2)   ← WRONG!")
    print("")
    print("Should be:")
    print("  use_sero = params.get('USe_1', 0.92)  ← Correct")
    print("  use_clin = params.get('USe_2', 0.2)   ← Correct")

asyncio.run(check_params())
