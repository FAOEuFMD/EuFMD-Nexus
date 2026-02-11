from fastapi import APIRouter, HTTPException
from database import training_engine
from typing import Optional
from sqlalchemy import text
from concurrent.futures import ThreadPoolExecutor
import asyncio

router = APIRouter(prefix="/api/training-calendar", tags=["training-calendar"])

@router.get("/events")
async def get_calendar_events(month: Optional[int] = None, year: Optional[int] = None):
    """
    Get training calendar events from db_training database
    Optional filters: month (1-12), year (YYYY)
    """
    try:
        # Base query
        query = """
            SELECT 
                id,
                course_name,
                DATE_FORMAT(start_date, '%d-%b-%y') as start_date,
                DATE_FORMAT(end_date, '%d-%b-%y') as end_date,
                start_date as start_date_raw,
                end_date as end_date_raw,
                description,
                location
            FROM training_calendar_events
            WHERE is_active = 1
        """
        params = {}
        
        # Add filters if provided
        if month:
            query += " AND MONTH(start_date) = :month"
            params['month'] = month
        
        if year:
            query += " AND YEAR(start_date) = :year"
            params['year'] = year
        
        query += " ORDER BY start_date ASC"
        
        # Execute query on training database
        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=5)
        
        def _execute():
            with training_engine.connect() as connection:
                result = connection.execute(text(query), params)
                return [dict(row._mapping) for row in result]
        
        data = await loop.run_in_executor(executor, _execute)
        
        # Format for frontend compatibility
        events = []
        for event in data:
            events.append({
                "id": event["id"],
                "vLearning_Course_Name": event["course_name"],
                "Start_Date": event["start_date"],
                "End_Date": event["end_date"],
                "readableStartDate": event["start_date"],
                "readableEndDate": event["end_date"],
                "description": event.get("description"),
                "location": event.get("location")
            })
        
        return events
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
