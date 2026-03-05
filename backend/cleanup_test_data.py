import asyncio
from database import db_helper

async def cleanup():
    result = await db_helper.execute_thrace_query(
        'DELETE FROM thrace.thrace_calculation_results WHERE calculated_by=999'
    )
    if result['error']:
        print(f'Error: {result["error"]}')
    else:
        print(f'✅ Deleted {result["data"]} test records')

asyncio.run(cleanup())
