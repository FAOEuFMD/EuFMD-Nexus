import asyncio
from database import db_helper

async def check_sql():
    # Check if data exists
    result = await db_helper.execute_thrace_query(
        "SELECT COUNT(*) as cnt FROM all_data WHERE region='GR' AND disease='FMD' AND species='cattle' AND year=2024"
    )
    print(f"SQL rows for 2024: {result}")
    
    # Get sample rows
    result2 = await db_helper.execute_thrace_query(
        "SELECT year, month, CSe, P_freedom FROM all_data WHERE region='GR' AND disease='FMD' AND species='cattle' AND year=2024 ORDER BY month LIMIT 3"
    )
    print(f"\nSample rows: {result2}")

asyncio.run(check_sql())
