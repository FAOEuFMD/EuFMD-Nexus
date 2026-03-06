from fastapi import APIRouter, HTTPException, Depends, Query
from database import training_engine
from auth import get_current_user
from sqlalchemy import text
from concurrent.futures import ThreadPoolExecutor
import asyncio
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/api/training-credits", tags=["training-credits"])

@router.get("/past")
async def get_past_training_credits(current_user: dict = Depends(get_current_user)):
    """
    Get historical training credits (past allocations) for the authenticated user's country
    """
    try:
        # Get user's country
        country = current_user.get("country")
        if not country:
            raise HTTPException(status_code=400, detail="User country not found")
        
        # Query training_credits_past table from db_training
        query = """
            SELECT 
                id,
                course_short_name,
                training_credits,
                seats,
                used
            FROM training_credits_past
            WHERE country = :country
            ORDER BY course_short_name ASC
        """
        
        # Execute query on training database
        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=5)
        
        def _execute():
            with training_engine.connect() as connection:
                result = connection.execute(text(query), {"country": country})
                return [dict(row._mapping) for row in result]
        
        data = await loop.run_in_executor(executor, _execute)
        
        return data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_training_summary(
    year: Optional[List[str]] = Query(None),
    category: Optional[List[str]] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Get aggregated training statistics for the authenticated user's country
    Combines Moodle and Non-Moodle enrollments
    Optional filters: year (multiple), category (multiple, main_topic)
    """
    try:
        # Get user's country
        country = current_user.get("country")
        if not country:
            raise HTTPException(status_code=400, detail="User country not found")
        
        print(f"Summary request - Country: {country}, Years: {year}, Categories: {category}")
        
        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=5)
        
        def _execute():
            from database import main_engine
            
            # First, get the country code from db_manager
            country_code = None
            with main_engine.connect() as main_conn:
                country_query = text("""
                    SELECT code_moodle 
                    FROM countries 
                    WHERE name_un = :country
                    LIMIT 1
                """)
                result = main_conn.execute(country_query, {"country": country})
                row = result.fetchone()
                if row:
                    country_code = row[0]
            
            print(f"Country: {country}, Country Code: {country_code}")
            
            with training_engine.connect() as connection:
                moodle_courses = []
                non_moodle_courses = []
                
                # Query Moodle enrollments using country code
                if country_code:
                    try:
                        # Build dynamic query with filters
                        moodle_filters = ["mu.country = :country_code", "(mc.main_topic IS NULL OR mc.main_topic != 'NU')"]
                        moodle_params = {"country_code": country_code}
                        
                        if year and len(year) > 0:
                            # Try multiple date formats - the start_date might be in different formats
                            year_conditions = []
                            for i in range(len(year)):
                                # Try both 2-digit year and 4-digit year formats
                                year_conditions.append(
                                    f"(YEAR(STR_TO_DATE(mc.start_date, '%d-%b-%y')) = :year{i} OR "
                                    f"YEAR(STR_TO_DATE(mc.start_date, '%d-%b-%Y')) = :year{i} OR "
                                    f"YEAR(mc.start_date) = :year{i})"
                                )
                                moodle_params[f"year{i}"] = year[i]
                            moodle_filters.append(f"({' OR '.join(year_conditions)})")
                            print(f"Year filter added: {year}")
                        
                        if category and len(category) > 0:
                            category_conditions = [f"mc.main_topic = :category{i}" for i in range(len(category))]
                            moodle_filters.append(f"({' OR '.join(category_conditions)})")
                            for i, c in enumerate(category):
                                moodle_params[f"category{i}"] = c
                            print(f"Category filter added: {category}")
                        
                        moodle_query = text(f"""
                            SELECT 
                                mc.fullname as course_name,
                                mc.shortname as course_shortname,
                                COUNT(me.id) as total_enrollments,
                                SUM(CASE WHEN me.progress = 100 THEN 1 ELSE 0 END) as completed,
                                SUM(CASE WHEN me.progress < 100 OR me.progress IS NULL THEN 1 ELSE 0 END) as in_progress
                            FROM moodle_enrols me
                            JOIN moodle_users mu ON me.user_id = mu.id
                            JOIN moodle_courses mc ON me.course_id = mc.id
                            WHERE {' AND '.join(moodle_filters)}
                            GROUP BY mc.id, mc.fullname, mc.shortname
                        """)
                        
                        print(f"Moodle SQL: {moodle_query}")
                        print(f"Moodle params: {moodle_params}")
                        
                        moodle_result = connection.execute(moodle_query, moodle_params)
                        moodle_courses = [dict(row._mapping) for row in moodle_result]
                        print(f"Moodle query successful: {len(moodle_courses)} courses found")
                    except Exception as e:
                        print(f"Moodle query error: {str(e)}")
                        import traceback
                        traceback.print_exc()
                else:
                    print(f"Country code not found for country: {country}")
                
                # Query Non-Moodle enrollments
                try:
                    # Build dynamic query with filters
                    non_moodle_filters = ["nme.country = :country"]
                    non_moodle_params = {"country": country}
                    
                    if year and len(year) > 0:
                        # Try multiple date formats
                        year_conditions = []
                        for i in range(len(year)):
                            year_conditions.append(
                                f"(YEAR(STR_TO_DATE(nmc.start_date, '%d-%b-%y')) = :year{i} OR "
                                f"YEAR(STR_TO_DATE(nmc.start_date, '%d-%b-%Y')) = :year{i} OR "
                                f"YEAR(nmc.start_date) = :year{i})"
                            )
                            non_moodle_params[f"year{i}"] = year[i]
                        non_moodle_filters.append(f"({' OR '.join(year_conditions)})")
                    
                    if category and len(category) > 0:
                        category_conditions = [f"nmc.main_topic = :category{i}" for i in range(len(category))]
                        non_moodle_filters.append(f"({' OR '.join(category_conditions)})")
                        for i, c in enumerate(category):
                            non_moodle_params[f"category{i}"] = c
                    
                    non_moodle_query = text(f"""
                        SELECT 
                            nmc.fullname as course_name,
                            nmc.shortname as course_shortname,
                            COUNT(nme.id) as total_enrollments,
                            SUM(CASE WHEN nme.status = 'completed' THEN 1 ELSE 0 END) as completed,
                            SUM(CASE WHEN nme.status != 'completed' THEN 1 ELSE 0 END) as in_progress
                        FROM non_moodle_enrols nme
                        JOIN non_moodle_courses nmc ON nme.course_shortname = nmc.shortname
                        WHERE {' AND '.join(non_moodle_filters)}
                        GROUP BY nmc.shortname, nmc.fullname
                    """)
                    
                    print(f"Non-Moodle SQL: {non_moodle_query}")
                    print(f"Non-Moodle params: {non_moodle_params}")
                    
                    non_moodle_result = connection.execute(non_moodle_query, non_moodle_params)
                    non_moodle_courses = [dict(row._mapping) for row in non_moodle_result]
                    print(f"Non-Moodle query successful: {len(non_moodle_courses)} courses found")
                except Exception as e:
                    print(f"Non-Moodle query error: {str(e)}")
                    import traceback
                    traceback.print_exc()
                
                return {
                    "moodle": moodle_courses,
                    "non_moodle": non_moodle_courses
                }
        
        data = await loop.run_in_executor(executor, _execute)
        
        # Combine and aggregate results
        all_courses = []
        total_enrollments = 0
        total_completed = 0
        total_in_progress = 0
        
        # Process Moodle courses
        for course in data["moodle"]:
            enrollments = course["total_enrollments"]
            completed = course["completed"] or 0
            in_progress = course["in_progress"] or 0
            
            total_enrollments += enrollments
            total_completed += completed
            total_in_progress += in_progress
            
            completion_rate = (completed / enrollments * 100) if enrollments > 0 else 0
            
            all_courses.append({
                "course_name": course["course_name"],
                "course_shortname": course["course_shortname"],
                "source": "Moodle",
                "enrollments": enrollments,
                "completed": completed,
                "in_progress": in_progress,
                "completion_rate": round(completion_rate, 1)
            })
        
        # Process Non-Moodle courses
        for course in data["non_moodle"]:
            enrollments = course["total_enrollments"]
            completed = course["completed"] or 0
            in_progress = course["in_progress"] or 0
            
            total_enrollments += enrollments
            total_completed += completed
            total_in_progress += in_progress
            
            completion_rate = (completed / enrollments * 100) if enrollments > 0 else 0
            
            all_courses.append({
                "course_name": course["course_name"],
                "course_shortname": course["course_shortname"],
                "source": "Non-Moodle",
                "enrollments": enrollments,
                "completed": completed,
                "in_progress": in_progress,
                "completion_rate": round(completion_rate, 1)
            })
        
        # Sort courses by enrollment count
        all_courses.sort(key=lambda x: x["enrollments"], reverse=True)
        
        # Calculate overall completion rate
        overall_completion_rate = (total_completed / total_enrollments * 100) if total_enrollments > 0 else 0
        
        return {
            "country": country,
            "total_enrollments": total_enrollments,
            "total_completed": total_completed,
            "total_in_progress": total_in_progress,
            "completion_rate": round(overall_completion_rate, 1),
            "by_course": all_courses
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/competency-framework")
async def get_competency_framework(
    current_user: dict = Depends(get_current_user)
):
    """
    Get competency level distribution for all users in the authenticated user's country.
    Calculates how many users have achieved each level (1-5) for each of the 13 competencies.
    """
    try:
        country = current_user.get("country")
        if not country:
            raise HTTPException(status_code=400, detail="User country not found")
        
        print(f"Competency framework request for country: {country}")
        
        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=5)
        
        def _execute():
            from database import main_engine
            
            # Get country code for Moodle filtering
            country_code = None
            with main_engine.connect() as main_conn:
                country_query = text("SELECT code_moodle FROM countries WHERE name_un = :country LIMIT 1")
                result = main_conn.execute(country_query, {"country": country})
                row = result.fetchone()
                if row:
                    country_code = row[0]
            
            # 13 competencies to track
            competencies = [
                "Application of Epidemiological Principles",
                "Transboundary Diseases",
                "Disease prevention and control programmes",
                "Biosecurity",
                "Sampling",
                "Animal Identification, and Movement Control",
                "Emergency and Disaster Management",
                "Emergency Preparedness",
                "Emergency Response",
                "Veterinary products",
                "Animal Welfare",
                "Application of Risk Analysis",
                "Safety, Health and Wellbeing"
            ]
            
            # Level mapping
            level_values = {
                "Awareness": 1,
                "Beginner": 2,
                "Competent": 3,
                "Proficient": 4,
                "Expert": 5
            }
            
            with training_engine.connect() as connection:
                result_data = {}
                
                for competency in competencies:
                    # Initialize level counts
                    level_distribution = {f"level_{i}": 0 for i in range(1, 6)}
                    user_competency_levels = {}  # user_id -> max_level
                    
                    # Query Moodle enrollments
                    if country_code:
                        try:
                            # Escape competency name for SQL column reference
                            col_name = f"`{competency}`"
                            
                            moodle_query = text(f"""
                                SELECT 
                                    mu.id as user_id,
                                    mu.email,
                                    mc.main_topic,
                                    mc.level as course_level,
                                    tl.{col_name} as competency_level,
                                    me.progress
                                FROM moodle_enrols me
                                JOIN moodle_users mu ON me.user_id = mu.id
                                JOIN moodle_courses mc ON me.course_id = mc.id
                                LEFT JOIN TOM_levels tl ON tl.main_topic = mc.main_topic 
                                    AND tl.course_level = mc.level
                                WHERE mu.country = :country_code
                                AND me.progress = 100
                                AND tl.{col_name} IS NOT NULL
                                AND tl.{col_name} != '?'
                            """)
                            
                            moodle_result = connection.execute(moodle_query, {"country_code": country_code})
                            
                            for row in moodle_result:
                                user_id = row.user_id
                                comp_level_name = row.competency_level
                                
                                # Map level name to numeric value
                                level_value = level_values.get(comp_level_name, 0)
                                
                                # Track highest level per user
                                if user_id not in user_competency_levels or user_competency_levels[user_id] < level_value:
                                    user_competency_levels[user_id] = level_value
                        
                        except Exception as e:
                            print(f"Moodle query error for {competency}: {str(e)}")
                    
                    # Query Non-Moodle enrollments
                    try:
                        col_name = f"`{competency}`"
                        
                        non_moodle_query = text(f"""
                            SELECT 
                                nme.user_fullname,
                                nme.email,
                                nmc.main_topic,
                                nmc.level as course_level,
                                tl.{col_name} as competency_level,
                                nme.status
                            FROM non_moodle_enrols nme
                            JOIN non_moodle_courses nmc ON nme.course_shortname = nmc.shortname
                            LEFT JOIN TOM_levels tl ON tl.main_topic = nmc.main_topic 
                                AND tl.course_level = nmc.level
                            WHERE nme.country = :country
                            AND nme.status = 'completed'
                            AND tl.{col_name} IS NOT NULL
                            AND tl.{col_name} != '?'
                        """)
                        
                        non_moodle_result = connection.execute(non_moodle_query, {"country": country})
                        
                        for row in non_moodle_result:
                            # Use email as user identifier
                            user_id = f"nm_{row.email}"
                            comp_level_name = row.competency_level
                            
                            level_value = level_values.get(comp_level_name, 0)
                            
                            if user_id not in user_competency_levels or user_competency_levels[user_id] < level_value:
                                user_competency_levels[user_id] = level_value
                    
                    except Exception as e:
                        print(f"Non-Moodle query error for {competency}: {str(e)}")
                    
                    # Count users at each level
                    for user_id, max_level in user_competency_levels.items():
                        # User achieves all levels up to and including their max level
                        for level in range(1, max_level + 1):
                            level_distribution[f"level_{level}"] += 1
                    
                    result_data[competency] = {
                        "total_users": len(user_competency_levels),
                        "levels": level_distribution
                    }
                    
                    print(f"{competency}: {len(user_competency_levels)} users, distribution: {level_distribution}")
                
                return result_data
        
        data = await loop.run_in_executor(executor, _execute)
        
        return {
            "country": country,
            "competencies": data
        }
        
    except Exception as e:
        print(f"Competency framework error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
