import asyncio
from database import db_helper

async def test_query():
    print("Testing FAST_Report table query...")
    
    # Test with uppercase table name
    result = await db_helper.execute_main_query('SELECT * FROM FAST_Report LIMIT 5')
    print('Uppercase query result:', result)
    
    # Also try with different case
    result2 = await db_helper.execute_main_query('SELECT * FROM fast_report LIMIT 5')
    print('Lowercase query result:', result2)
    
    # Try to get table info
    result3 = await db_helper.execute_main_query('SHOW TABLES LIKE "%fast%"')
    print('Tables matching fast:', result3)
    
    # Try to get table info with FAST
    result4 = await db_helper.execute_main_query('SHOW TABLES LIKE "%FAST%"')
    print('Tables matching FAST:', result4)
    
    # Get all tables to see what exists
    result5 = await db_helper.execute_main_query('SHOW TABLES')
    print('All tables:', result5)

if __name__ == "__main__":
    asyncio.run(test_query())
