"""
Test freedom analysis calculation and compare Python vs SQL results
"""
import asyncio
from database import thrace_engine, db_helper
from routers.thrace_calculator import ThraceCalculator

async def test_freedom_data():
    calculator = ThraceCalculator(thrace_engine)
    
    # Test with FMD, cattle (BOV), Greece (GR), year 2024
    print("Running Python Calculator for FMD, cattle, Greece, 2024...")
    result = calculator.calculate_system_sensitivity('BOV', 'FMD', 'GR', 2024)
    
    print('\nPython Calculator Results (2024):')
    print(f'  Result keys: {result.keys()}')
    print(f'  Months calculated: {len(result.get("labels", []))}')
    if result and 'labels' in result:
        labels = result['labels']
        pfree = result['pfree']
        sens = result['sens']
        print(f'  First month: {labels[0]}, CSe={float(sens[0]):.6f}, P(free)={float(pfree[0]):.6f}')
        print(f'  Last month: {labels[-1]}, CSe={float(sens[-1]):.6f}, P(free)={float(pfree[-1]):.6f}')
    
    # Compare with SQL function get_freedom_data
    sql_query = """
        SELECT thrace.get_freedom_data('BOV', 'FMD', 'GR') as result
    """
    sql_result = await db_helper.execute_thrace_query(sql_query)
    
    print('\nSQL get_freedom_data() function result:')
    if sql_result['error']:
        print(f'  ERROR: {sql_result["error"]}')
    elif sql_result['data']:
        import json
        sql_data_str = sql_result['data'][0]['result']
        sql_data = json.loads(sql_data_str)
        print(f'  Result keys: {sql_data.keys()}')
        print(f'  Months: {len(sql_data.get("labels", []))}')
        
        if 'labels' in sql_data:
            sql_labels = sql_data['labels']
            sql_sens = sql_data['sens']
            sql_pfree = sql_data['pfree']
            print(f'  First month: {sql_labels[0]}, CSe={float(sql_sens[0]):.6f}, P(free)={float(sql_pfree[0]):.6f}')
            print(f'  Last month: {sql_labels[-1]}, CSe={float(sql_sens[-1]):.6f}, P(free)={float(sql_pfree[-1]):.6f}')
            
            
            # Compare side by side
            print('\nMonth-by-month comparison (showing first 12 months):')
            print(f'{"Month":<12} {"Python CSe":<15} {"SQL CSe":<15} {"Diff":<10} {"Python P(free)":<15} {"SQL P(free)":<15} {"Diff":<10}')
            print('-' * 110)
            
            py_labels = result.get('labels', [])
            py_sens = result.get('sens', [])
            py_pfree = result.get('pfree', [])
            
            for i in range(min(12, len(py_labels), len(sql_labels))):
                py_cse = float(py_sens[i])
                py_pf = float(py_pfree[i])
                sql_cse = float(sql_sens[i])
                sql_pf = float(sql_pfree[i])
                cse_diff = abs(py_cse - sql_cse)
                pfree_diff = abs(py_pf - sql_pf)
                print(f'{py_labels[i]:<12} {py_cse:<15.6f} {sql_cse:<15.6f} {cse_diff:<10.6f} {py_pf:<15.6f} {sql_pf:<15.6f} {pfree_diff:<10.6f}')
    
    return result

if __name__ == '__main__':
    asyncio.run(test_freedom_data())
