import os
from dotenv import load_dotenv

load_dotenv()

MAIN_DATABASE_URL = f"mysql+pymysql://{os.getenv('DB_USER')}:{os.getenv('DB_PASS')}@{os.getenv('DB_HOST')}/{os.getenv('DB_NAME')}"

print("SQLAlchemy URL:")
print(MAIN_DATABASE_URL)

print("\n\nTesting SQLAlchemy connection...")
from sqlalchemy import create_engine, text

try:
    engine = create_engine(MAIN_DATABASE_URL, pool_pre_ping=True, pool_recycle=300, connect_args={'connect_timeout': 10})
    with engine.connect() as conn:
        result = conn.execute(text('SELECT 1'))
        print('✓ SQLAlchemy connection works!')
except Exception as e:
    print(f'✗ SQLAlchemy connection FAILED: {e}')
