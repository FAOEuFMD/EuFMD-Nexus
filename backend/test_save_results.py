"""
Test save_calculation_results functionality
"""
import asyncio
from database import thrace_engine, db_helper
from routers.thrace_calculator import ThraceCalculator

async def test_save_results():
    print('='*80)
    print('TESTING SAVE CALCULATION RESULTS (R24)')
    print('='*80)
    
    # First, ensure table exists
    print('\n1. Checking if table exists...')
    check_query = """
        SELECT COUNT(*) as cnt 
        FROM information_schema.tables 
        WHERE table_schema = 'thrace' 
        AND table_name = 'thrace_calculation_results'
    """
    result = await db_helper.execute_thrace_query(check_query)
    
    if result['error']:
        print(f'   ❌ Error checking table: {result["error"]}')
        print('   Please run: backend/migrations/create_thrace_calculation_results.sql')
        return
    
    table_exists = result['data'][0]['cnt'] > 0 if result['data'] else False
    
    if not table_exists:
        print('   ⚠️  Table does not exist!')
        print('   Creating table...')
        
        # Read and execute the creation SQL
        with open('migrations/create_thrace_calculation_results.sql', 'r') as f:
            create_sql = f.read()
        
        create_result = await db_helper.execute_thrace_query(create_sql)
        if create_result['error']:
            print(f'   ❌ Failed to create table: {create_result["error"]}')
            return
        print('   ✅ Table created successfully')
    else:
        print('   ✅ Table exists')
    
    # Run a calculation
    print('\n2. Running calculation...')
    calculator = ThraceCalculator(thrace_engine)
    results = calculator.calculate_system_sensitivity('BOV', 'FMD', 'GR', 2024)
    print(f'   ✅ Calculated {len(results["labels"])} months')
    
    # Save results
    print('\n3. Saving results to database...')
    try:
        calculator.save_calculation_results(
            results=results,
            species_filter='BOV',
            disease='FMD',
            region_filter='GR',
            user_id=999  # Test user ID
        )
        print(f'   ✅ Saved {len(results["labels"])} records')
    except Exception as e:
        print(f'   ❌ Error saving: {str(e)}')
        import traceback
        traceback.print_exc()
        return
    
    # Verify saved data
    print('\n4. Verifying saved data...')
    verify_query = """
        SELECT COUNT(*) as cnt, 
               MIN(result_year) as min_year, 
               MAX(result_year) as max_year,
               MIN(result_month) as min_month,
               MAX(result_month) as max_month
        FROM thrace.thrace_calculation_results 
        WHERE species_filter='BOV' 
        AND disease='FMD' 
        AND region_filter='GR'
        AND calculated_by=999
        AND calculated_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)
    """
    verify_result = await db_helper.execute_thrace_query(verify_query)
    
    if verify_result['error']:
        print(f'   ❌ Error verifying: {verify_result["error"]}')
    elif verify_result['data']:
        row = verify_result['data'][0]
        print(f'   ✅ Found {row["cnt"]} saved records')
        print(f'   Date range: {row["min_year"]}/{row["min_month"]} to {row["max_year"]}/{row["max_month"]}')
    
    # Show sample records
    print('\n5. Sample saved records:')
    sample_query = """
        SELECT result_year, result_month, sse, pintro, pfreedom, animals, herds
        FROM thrace.thrace_calculation_results 
        WHERE species_filter='BOV' 
        AND disease='FMD' 
        AND region_filter='GR'
        AND calculated_by=999
        ORDER BY result_year DESC, result_month DESC
        LIMIT 3
    """
    sample_result = await db_helper.execute_thrace_query(sample_query)
    
    if sample_result['data']:
        for row in sample_result['data']:
            print(f'   {row["result_year"]}-{str(row["result_month"]).zfill(2)}: '
                  f'SSe={row["sse"]:.6f}, P(free)={row["pfreedom"]:.4f}, '
                  f'Animals={row["animals"]}, Herds={row["herds"]}')
    
    print('\n' + '='*80)
    print('SAVE FUNCTIONALITY TEST COMPLETE ✅')
    print('='*80)
    print('\nNote: Test data saved with user_id=999')
    print('You can clean up test data with:')
    print('DELETE FROM thrace.thrace_calculation_results WHERE calculated_by=999;')

if __name__ == '__main__':
    asyncio.run(test_save_results())
