from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import settings
import pymysql

# MySQL connection strings
MAIN_DATABASE_URL = f"mysql+pymysql://{settings.db_user}:{settings.db_pass}@{settings.db_host}/{settings.db_name}"
PCP_DATABASE_URL = f"mysql+pymysql://{settings.db_user}:{settings.db_pass}@{settings.db_host}/{settings.db2_name}"

# Create engines
main_engine = create_engine(MAIN_DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
pcp_engine = create_engine(PCP_DATABASE_URL, pool_pre_ping=True, pool_recycle=300)

# Create session makers
MainSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=main_engine)
PCPSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=pcp_engine)

Base = declarative_base()

# Database helpers similar to the Node.js helper functions
class DatabaseHelper:
    @staticmethod
    def get_main_db():
        db = MainSessionLocal()
        try:
            yield db
        finally:
            db.close()
    
    @staticmethod
    def get_pcp_db():
        db = PCPSessionLocal()
        try:
            yield db
        finally:
            db.close()
    



    @staticmethod
    async def execute_main_query(query: str, params=None):
        """Execute raw SQL query on main database"""
        try:
            with main_engine.connect() as connection:
                if params is None:
                    result = connection.execute(text(query))
                else:
                    # Convert params to a dictionary for SQLAlchemy text() binding
                    if isinstance(params, tuple) and len(params) == 1:
                        # Handle the common case of a single parameter
                        result = connection.execute(text(query.replace("%s", ":param1")), {"param1": params[0]})
                    elif isinstance(params, tuple):
                        # Convert tuple params to a dictionary
                        param_dict = {f"param{i+1}": val for i, val in enumerate(params)}
                        # Replace %s placeholders with named parameters
                        modified_query = query
                        for i in range(len(params)):
                            modified_query = modified_query.replace("%s", f":param{i+1}", 1)
                        result = connection.execute(text(modified_query), param_dict)
                    else:
                        # Assume it's already a dict or other compatible format
                        result = connection.execute(text(query), params)
                        
                if query.strip().upper().startswith('SELECT'):
                    rows = [dict(row._mapping) for row in result]
                    return {"data": rows, "error": None}
                else:
                    connection.commit()
                    return {"data": result.rowcount, "error": None}
        except Exception as e:
            return {"data": [], "error": str(e)}
    
    @staticmethod
    async def execute_pcp_query(query: str, params: tuple = ()):
        """Execute raw SQL query on PCP database"""
        try:
            with pcp_engine.connect() as connection:
                if params:
                    # Convert tuple to dictionary for SQLAlchemy text queries
                    # Count the number of %s placeholders and create numbered parameters
                    param_count = query.count('%s')
                    if param_count > 0:
                        # Replace %s with numbered parameters for SQLAlchemy
                        numbered_query = query
                        for i in range(param_count):
                            numbered_query = numbered_query.replace('%s', f':param{i}', 1)
                        
                        # Create parameter dictionary
                        param_dict = {f'param{i}': params[i] for i in range(len(params))}
                        result = connection.execute(text(numbered_query), param_dict)
                    else:
                        result = connection.execute(text(query))
                else:
                    result = connection.execute(text(query))
                    
                if query.strip().upper().startswith('SELECT'):
                    return {"data": [dict(row._mapping) for row in result], "error": None}
                else:
                    connection.commit()
                    return {"data": result.rowcount, "error": None}
        except Exception as e:
            return {"data": [], "error": str(e)}
    

    


# Initialize the helper
db_helper = DatabaseHelper()
