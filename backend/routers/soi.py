from fastapi import APIRouter, HTTPException, Query
from database import db_helper
from typing import Optional

router = APIRouter(prefix="/api/tcc", tags=["soi"])


@router.get("/outbreaks")
async def get_outbreaks():
    """Get all outbreak data from TCC database"""
    try:
        result = await db_helper.execute_tcc_query(
            "SELECT "
            "n.country AS Country, "
            "p.province_name AS Province, "
            "d.district_name AS District, "
            "o.epiunit AS Epi_Unit, "
            "o.latit AS Latitude, "
            "o.longi AS Longitude, "
            "dis.description AS Disease, "
            "sp.description AS Species, "
            "se.description AS Serotype, "
            "o.dt_susp AS Date_Suspected, "
            "o.dt_conf AS Date_Confirmed, "
            "o.conf_type AS Confirmation_Type "
            "FROM outbreaks o "
            "LEFT JOIN nations n ON o.nationID = n.nationID "
            "LEFT JOIN districts d ON o.districtID = d.districtID "
            "LEFT JOIN provinces p ON d.provinceID = p.provinceID "
            "LEFT JOIN diseases dis ON o.diseasecod = dis.diseasecod "
            "LEFT JOIN species sp ON o.speID = sp.speID "
            "LEFT JOIN serotypes se ON o.seroID = se.seroID "
            "ORDER BY o.dt_conf DESC, o.dt_susp DESC"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/economic/outbreak-price-correlation")
async def get_outbreak_price_correlation(
    nationID: Optional[int] = Query(None, description="Filter by nation ID"),
    months: int = Query(12, description="Number of recent periods to include"),
):
    """Correlate outbreak counts with market prices over time.
    Joins outbreak counts per period with cattle price data."""
    try:
        # Build params: outbreak params first, then price params
        ob_params: list = []
        price_params: list = []
        if nationID is not None:
            ob_params.append(nationID)
            price_params.append(nationID)

        ob_where = ["o.dt_conf IS NOT NULL"]
        if nationID is not None:
            ob_where.append("o.nationID = %s")
        ob_where_sql = " AND ".join(ob_where)

        price_where = ["1=1"]
        if nationID is not None:
            price_where.append("mp.nationID = %s")
        price_where_sql = " AND ".join(price_where)

        query = (
            "SELECT "
            "  p.periodID AS periodID, "
            "  p.dt_from, "
            "  p.descrizione, "
            "  COALESCE(ob.outbreak_count, 0) AS outbreak_count, "
            "  mp.ctl_dis_liveAVG, "
            "  mp.ctl_dis_meatAVG, "
            "  mp.ctl_cap_liveAVG, "
            "  mp.ctl_cap_meatAVG "
            "FROM marketprice_period p "
            "LEFT JOIN ( "
            "  SELECT "
            "    pp.periodID, "
            "    COUNT(*) AS outbreak_count "
            "  FROM outbreaks o "
            "  LEFT JOIN marketprice_period pp ON o.dt_conf >= pp.dt_from "
            f"  WHERE {ob_where_sql} "
            "  GROUP BY pp.periodID "
            ") ob ON p.periodID = ob.periodID "
            "LEFT JOIN ( "
            "  SELECT "
            "    mp2.periodID, "
            "    mp2.ctl_dis_liveAVG, "
            "    mp2.ctl_dis_meatAVG, "
            "    mp2.ctl_cap_liveAVG, "
            "    mp2.ctl_cap_meatAVG "
            "  FROM marketprice mp2 "
            f"  WHERE {price_where_sql} "
            f"  ORDER BY mp2.periodID DESC LIMIT {months} "
            ") mp ON p.periodID = mp.periodID "
            "WHERE ob.outbreak_count IS NOT NULL OR mp.periodID IS NOT NULL "
            "ORDER BY p.dt_from ASC"
        )

        all_params = tuple(ob_params + price_params)
        result = await db_helper.execute_tcc_query(query, all_params if all_params else None)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])

        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/economic/capital-district-divergence")
async def get_capital_district_divergence(
    nationID: Optional[int] = Query(None, description="Filter by nation ID"),
    months: int = Query(12, description="Number of recent periods to include"),
):
    """Calculate the price gap between Capital and District markets.
    Large gaps may indicate trade restrictions or quarantines."""
    try:
        params: list = []
        if nationID is not None:
            params.append(nationID)

        where_clauses = ["1=1"]
        if nationID is not None:
            where_clauses.append("mp.nationID = %s")
        where_sql = " AND ".join(where_clauses)

        query = (
            "SELECT "
            "  p.periodID AS periodID, "
            "  p.descrizione, "
            "  p.dt_from, "
            "  mp.ctl_dis_liveAVG, "
            "  mp.ctl_cap_liveAVG, "
            "  ROUND(mp.ctl_cap_liveAVG - mp.ctl_dis_liveAVG, 2) AS live_price_gap, "
            "  ROUND(((mp.ctl_cap_liveAVG - mp.ctl_dis_liveAVG) / NULLIF(mp.ctl_dis_liveAVG, 0)) * 100, 2) AS live_price_gap_percent, "
            "  mp.ctl_dis_meatAVG, "
            "  mp.ctl_cap_meatAVG, "
            "  ROUND(mp.ctl_cap_meatAVG - mp.ctl_dis_meatAVG, 2) AS meat_price_gap, "
            "  ROUND(((mp.ctl_cap_meatAVG - mp.ctl_dis_meatAVG) / NULLIF(mp.ctl_dis_meatAVG, 0)) * 100, 2) AS meat_price_gap_percent "
            "FROM marketprice mp "
            "INNER JOIN marketprice_period p ON mp.periodID = p.periodID "
            f"WHERE {where_sql} "
            "ORDER BY p.dt_from DESC "
            f"LIMIT {months}"
        )

        result = await db_helper.execute_tcc_query(query, tuple(params) if params else None)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])

        # Reverse so oldest period is first (for time-series display)
        data = result["data"]
        if data:
            data = list(reversed(data))

        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/economic/species-price-comparison")
async def get_species_price_comparison(
    nationID: Optional[int] = Query(None, description="Filter by nation ID"),
    periodID: Optional[int] = Query(None, description="Filter by specific period ID"),
):
    """Compare prices across species (Cattle, Sheep, Pig) for the most recent period.
    Returns one row per species with District and Capital average prices."""
    try:
        # Build params: repeat for each of the 3 UNION subqueries
        sub_params: list = []
        if periodID is not None:
            sub_params.append(periodID)
        if nationID is not None:
            sub_params.append(nationID)

        # Each UNION subquery needs its own set of params
        # So we repeat params 3 times (once per UNION)
        all_params = sub_params + sub_params + sub_params

        # Determine the period to use
        period_sub = "(SELECT periodID FROM marketprice_period ORDER BY dt_from DESC LIMIT 1)"
        if periodID is not None:
            period_sub = "%s"

        nation_sub = ""
        if nationID is not None:
            nation_sub = "AND mp.nationID = %s"

        # Build the WHERE clause for each subquery
        if periodID is not None:
            period_where = f"AND mp.periodID = %s {nation_sub}"
        else:
            period_where = f"AND mp.periodID = {period_sub} {nation_sub}"

        # For UNION subqueries, each needs independent %s placeholders
        # Build 3 separate WHERE clauses with their own params
        sub1_where = "WHERE 1=1"
        sub2_where = "WHERE 1=1"
        sub3_where = "WHERE 1=1"
        sub1_params: list = []
        sub2_params: list = []
        sub3_params: list = []

        if periodID is not None:
            sub1_where += " AND mp.periodID = %s"
            sub2_where += " AND mp.periodID = %s"
            sub3_where += " AND mp.periodID = %s"
            sub1_params.append(periodID)
            sub2_params.append(periodID)
            sub3_params.append(periodID)
        else:
            sub1_where += f" AND mp.periodID = {period_sub}"
            sub2_where += f" AND mp.periodID = {period_sub}"
            sub3_where += f" AND mp.periodID = {period_sub}"

        if nationID is not None:
            sub1_where += " AND mp.nationID = %s"
            sub2_where += " AND mp.nationID = %s"
            sub3_where += " AND mp.nationID = %s"
            sub1_params.append(nationID)
            sub2_params.append(nationID)
            sub3_params.append(nationID)

        query = (
            "SELECT species, "
            "  ROUND(AVG(district_live_avg), 2) AS district_live_avg, "
            "  ROUND(AVG(capital_live_avg), 2) AS capital_live_avg, "
            "  ROUND(AVG(district_meat_avg), 2) AS district_meat_avg, "
            "  ROUND(AVG(capital_meat_avg), 2) AS capital_meat_avg, "
            "  ROUND(((AVG(capital_live_avg) - AVG(district_live_avg)) / NULLIF(AVG(district_live_avg), 0)) * 100, 2) AS price_gap_percent "
            "FROM ( "
            "  SELECT 'Cattle' AS species, "
            "    ctl_dis_liveAVG AS district_live_avg, "
            "    ctl_cap_liveAVG AS capital_live_avg, "
            "    ctl_dis_meatAVG AS district_meat_avg, "
            "    ctl_cap_meatAVG AS capital_meat_avg "
            "  FROM marketprice mp "
            f"  {sub1_where} "
            "  UNION ALL "
            "  SELECT 'Sheep' AS species, "
            "    shp_dis_liveAVG, shp_cap_liveAVG, shp_dis_meatAVG, shp_cap_meatAVG "
            "  FROM marketprice mp "
            f"  {sub2_where} "
            "  UNION ALL "
            "  SELECT 'Pig' AS species, "
            "    pig_dis_liveAVG, pig_cap_liveAVG, pig_dis_meatAVG, pig_cap_meatAVG "
            "  FROM marketprice mp "
            f"  {sub3_where} "
            ") all_species "
            "GROUP BY species "
            "ORDER BY FIELD(species, 'Cattle', 'Sheep', 'Pig')"
        )

        final_params = tuple(sub1_params + sub2_params + sub3_params)
        result = await db_helper.execute_tcc_query(query, final_params if final_params else None)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])

        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/surveillance/response-time-distribution")
async def get_response_time_distribution(
    nationID: Optional[int] = Query(None, description="Filter by nation ID"),
    months: int = Query(12, description="Number of recent months to include"),
):
    """Calculate time-to-confirmation for outbreaks and group into performance buckets."""
    try:
        params: list = []
        where_clauses = [
            "o.dt_susp IS NOT NULL",
            "o.dt_conf IS NOT NULL",
            "o.dt_conf >= o.dt_susp",
        ]
        if nationID is not None:
            where_clauses.append("o.nationID = %s")
            params.append(nationID)

        where_sql = " AND ".join(where_clauses)

        # Get bucketed counts
        bucket_query = (
            "SELECT "
            "  CASE "
            "    WHEN DATEDIFF(o.dt_conf, o.dt_susp) <= 3 THEN 'Excellent (0-3 days)' "
            "    WHEN DATEDIFF(o.dt_conf, o.dt_susp) <= 7 THEN 'Good (4-7 days)' "
            "    WHEN DATEDIFF(o.dt_conf, o.dt_susp) <= 14 THEN 'Delayed (8-14 days)' "
            "    ELSE 'Critical (>14 days)' "
            "  END AS time_bucket, "
            "  COUNT(*) AS outbreak_count "
            "FROM outbreaks o "
            f"WHERE {where_sql} "
            "GROUP BY time_bucket "
            "ORDER BY "
            "  CASE time_bucket "
            "    WHEN 'Excellent (0-3 days)' THEN 1 "
            "    WHEN 'Good (4-7 days)' THEN 2 "
            "    WHEN 'Delayed (8-14 days)' THEN 3 "
            "    WHEN 'Critical (>14 days)' THEN 4 "
            "  END"
        )

        # Get average days
        avg_query = (
            "SELECT ROUND(AVG(DATEDIFF(o.dt_conf, o.dt_susp)), 1) AS avg_days_to_confirm "
            "FROM outbreaks o "
            f"WHERE {where_sql}"
        )

        bucket_result = await db_helper.execute_tcc_query(bucket_query, tuple(params) if params else None)
        if bucket_result["error"]:
            raise HTTPException(status_code=500, detail=bucket_result["error"])

        avg_result = await db_helper.execute_tcc_query(avg_query, tuple(params) if params else None)
        if avg_result["error"]:
            raise HTTPException(status_code=500, detail=avg_result["error"])

        # Calculate percentages
        total = sum(r["outbreak_count"] for r in bucket_result["data"])
        data = []
        for r in bucket_result["data"]:
            pct = round((r["outbreak_count"] / total) * 100, 1) if total > 0 else 0
            data.append({
                "time_bucket": r["time_bucket"],
                "outbreak_count": r["outbreak_count"],
                "percentage": pct,
            })

        avg_days = avg_result["data"][0]["avg_days_to_confirm"] if avg_result["data"] else None

        return {"data": data, "avg_days_to_confirm": avg_days}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/surveillance/confirmation-methods")
async def get_confirmation_methods(
    nationID: Optional[int] = Query(None, description="Filter by nation ID"),
    months: int = Query(12, description="Number of recent months to include"),
):
    """Determine the ratio of outbreaks confirmed by Laboratory vs Clinical."""
    try:
        params: list = []
        where_clauses = ["o.conf_type IS NOT NULL"]
        if nationID is not None:
            where_clauses.append("o.nationID = %s")
            params.append(nationID)

        where_sql = " AND ".join(where_clauses)

        query = (
            "SELECT "
            "  o.conf_type AS conf_type, "
            "  CASE "
            "    WHEN o.conf_type = 'L' THEN 'Laboratory' "
            "    WHEN o.conf_type = 'C' THEN 'Clinical' "
            "    ELSE o.conf_type "
            "  END AS conf_type_name, "
            "  COUNT(*) AS outbreak_count "
            "FROM outbreaks o "
            f"WHERE {where_sql} "
            "GROUP BY o.conf_type "
            "ORDER BY outbreak_count DESC"
        )

        result = await db_helper.execute_tcc_query(query, tuple(params) if params else None)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])

        total = sum(r["outbreak_count"] for r in result["data"])
        data = []
        for r in result["data"]:
            pct = round((r["outbreak_count"] / total) * 100, 1) if total > 0 else 0
            data.append({
                "conf_type": r["conf_type"],
                "conf_type_name": r["conf_type_name"],
                "outbreak_count": r["outbreak_count"],
                "percentage": pct,
            })

        return {"data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/surveillance/trends")
async def get_surveillance_trends(
    nationID: Optional[int] = Query(None, description="Filter by nation ID"),
    months: int = Query(12, description="Number of recent months to include"),
):
    """Show how diagnostic methods are trending over time."""
    try:
        params: list = []
        where_clauses = [
            "o.dt_conf IS NOT NULL",
            "o.conf_type IS NOT NULL",
        ]
        if nationID is not None:
            where_clauses.append("o.nationID = %s")
            params.append(nationID)

        where_sql = " AND ".join(where_clauses)

        query = (
            "SELECT "
            "  CONCAT(YEAR(o.dt_conf), '-Q', QUARTER(o.dt_conf)) AS period_label, "
            "  o.conf_type AS conf_type, "
            "  COUNT(*) AS outbreak_count "
            "FROM outbreaks o "
            f"WHERE {where_sql} "
            "GROUP BY period_label, conf_type "
            "ORDER BY period_label ASC, conf_type ASC"
        )

        result = await db_helper.execute_tcc_query(query, tuple(params) if params else None)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])

        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/herd-immunity-gap")
async def get_herd_immunity_gap(
    country: Optional[str] = Query(None, description="Filter by country name"),
    date_from: Optional[str] = Query(None, description="Filter vaccinations from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter vaccinations to date (YYYY-MM-DD)"),
):
    """Calculate vaccination coverage percentage per district to identify herd immunity gaps"""
    try:
        where_clauses = ["d.district_name IS NOT NULL"]
        params = []

        if country:
            where_clauses.append("n.country = %s")
            params.append(country)
        if date_from:
            where_clauses.append("v.dt_vacci >= %s")
            params.append(date_from)
        if date_to:
            where_clauses.append("v.dt_vacci <= %s")
            params.append(date_to)

        where_sql = " AND ".join(where_clauses)

        query = (
            "SELECT "
            "d.district_name AS district_name, "
            "SUM(v.cattle_target_pop) AS total_target, "
            "SUM(v.cattle_vacc_doses_inj) AS total_injected, "
            "ROUND((SUM(v.cattle_vacc_doses_inj) / NULLIF(SUM(v.cattle_target_pop), 0)) * 100, 2) AS coverage_percentage "
            "FROM vaccinations v "
            "LEFT JOIN districts d ON v.districtID = d.districtID "
            "LEFT JOIN nations n ON v.nationID = n.nationID "
            f"WHERE {where_sql} "
            "GROUP BY d.district_name "
            "HAVING total_target > 0 "
            "ORDER BY coverage_percentage ASC"
        )

        result = await db_helper.execute_tcc_query(query, params if params else None)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])

        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/serotype-vs-strain-matrix")
async def get_serotype_vs_strain_matrix(
    country: Optional[str] = Query(None, description="Filter by country name"),
    date_from: Optional[str] = Query(None, description="Filter outbreaks from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter outbreaks to date (YYYY-MM-DD)"),
):
    """Create a matrix of outbreak serotypes vs vaccine strains deployed per district.
    Shows which outbreak serotypes are occurring in districts that use each vaccine strain.
    A high count where serotype != vaccine_strain suggests a potential mismatch risk."""

    try:
        params = []

        # Build the vaccination subquery (most common strain per district)
        vacc_inner_where = ["v2.cattle_vacc_strain IS NOT NULL", "v2.districtID IS NOT NULL"]
        if country:
            vacc_inner_where.append("vn2.country = %s")
            params.append(country)

        vacc_inner_where_sql = " AND ".join(vacc_inner_where)

        # Build the outbreak subquery
        outbreak_where = ["se.description IS NOT NULL", "o.districtID IS NOT NULL"]
        if country:
            outbreak_where.append("onat.country = %s")
            params.append(country)
        if date_from:
            outbreak_where.append("o.dt_conf >= %s")
            params.append(date_from)
        if date_to:
            outbreak_where.append("o.dt_conf <= %s")
            params.append(date_to)

        outbreak_where_sql = " AND ".join(outbreak_where)

        query = (
            "SELECT "
            "  ob.serotype_description AS serotype, "
            "  vs.vaccine_strain AS vaccine_strain, "
            "  COUNT(*) AS outbreak_count "
            "FROM ( "
            "  SELECT o.districtID, se.description AS serotype_description "
            "  FROM outbreaks o "
            "  LEFT JOIN serotypes se ON o.seroID = se.seroID "
            "  LEFT JOIN nations onat ON o.nationID = onat.nationID "
            f"  WHERE {outbreak_where_sql} "
            ") ob "
            "INNER JOIN ( "
            "  SELECT v1.districtID, v1.cattle_vacc_strain AS vaccine_strain "
            "  FROM vaccinations v1 "
            "  LEFT JOIN nations vn1 ON v1.nationID = vn1.nationID "
            "  INNER JOIN ( "
            "    SELECT v2.districtID, v2.cattle_vacc_strain "
            "    FROM vaccinations v2 "
            "    LEFT JOIN nations vn2 ON v2.nationID = vn2.nationID "
            f"    WHERE {vacc_inner_where_sql} "
            "    GROUP BY v2.districtID, v2.cattle_vacc_strain "
            "    ORDER BY COUNT(*) DESC "
            "  ) top_strain ON v1.districtID = top_strain.districtID "
            "    AND v1.cattle_vacc_strain = top_strain.cattle_vacc_strain "
            "  WHERE v1.districtID IS NOT NULL "
            "  GROUP BY v1.districtID, v1.cattle_vacc_strain "
            ") vs ON ob.districtID = vs.districtID "
            "GROUP BY ob.serotype_description, vs.vaccine_strain "
            "ORDER BY outbreak_count DESC"
        )

        result = await db_helper.execute_tcc_query(query, params if params else None)
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])

        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi/days-since-last-outbreak")
async def get_days_since_last_outbreak():
    """Get the number of days since the most recent outbreak confirmation date"""
    try:
        result = await db_helper.execute_tcc_query(
            "SELECT DATEDIFF(CURDATE(), MAX(dt_conf)) AS days_since "
            "FROM outbreaks WHERE dt_conf IS NOT NULL"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        days = result["data"][0]["days_since"] if result["data"] and result["data"][0]["days_since"] is not None else None
        return {"days_since": days}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi/active-hotspots")
async def get_active_hotspots():
    """Get count of districts and epiunits with outbreaks in the last 30 days"""
    try:
        result = await db_helper.execute_tcc_query(
            "SELECT COUNT(DISTINCT CONCAT(d.district_name, '-', o.epiunit)) AS hotspot_count "
            "FROM outbreaks o "
            "LEFT JOIN districts d ON o.districtID = d.districtID "
            "WHERE o.dt_conf >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) "
            "AND o.dt_conf IS NOT NULL"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        count = result["data"][0]["hotspot_count"] if result["data"] else 0
        return {"hotspot_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi/campaigns")
async def get_campaigns():
    """Get count of current vaccination campaigns in progress"""
    try:
        result = await db_helper.execute_tcc_query(
            "SELECT COUNT(DISTINCT vacc_campID) AS campaign_count "
            "FROM vaccinations "
            "WHERE dt_vacci >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) "
            "AND dt_vacci IS NOT NULL"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        count = result["data"][0]["campaign_count"] if result["data"] else 0
        return {"campaign_count": count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi/dominant-serotype")
async def get_dominant_serotype():
    """Get the most common serotype from recent outbreaks (last 90 days)"""
    try:
        result = await db_helper.execute_tcc_query(
            "SELECT se.description AS serotype, COUNT(*) AS cnt "
            "FROM outbreaks o "
            "LEFT JOIN serotypes se ON o.seroID = se.seroID "
            "WHERE o.dt_conf >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) "
            "AND o.dt_conf IS NOT NULL "
            "AND se.description IS NOT NULL "
            "GROUP BY se.description "
            "ORDER BY cnt DESC "
            "LIMIT 1"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        serotype = result["data"][0]["serotype"] if result["data"] else None
        return {"serotype": serotype}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vaccination")
async def get_vaccination():
    """Get all vaccination data from TCC database"""
    try:
        result = await db_helper.execute_tcc_query(
            "SELECT "
            "n.country AS Country, "
            "p.province_name AS Province, "
            "d.district_name AS District, "
            "vc.description AS Vaccination_Campaign, "
            "v.dt_vacci AS Vaccination_Date, "
            "v.vacc_manu AS Vaccine_Manufacturer, "
            "v.cattle_vacc_strain AS Cattle_Strain, "
            "v.sr_vacc_strain AS SR_Strain, "
            "v.cattle_pop AS Cattle_Population, "
            "v.cattle_target_pop AS Cattle_Target_Pop, "
            "v.cattle_est_vacc_doses AS Cattle_Estimated_Doses, "
            "v.cattle_vacc_doses_inj AS Cattle_Doses_Injected, "
            "v.sr_pop AS SR_Population, "
            "v.sr_target_pop AS SR_Target_Pop, "
            "v.sr_est_vacc_doses AS SR_Estimated_Doses, "
            "v.sr_vacc_doses_inj AS SR_Doses_Injected, "
            "v.latit AS Latitude, "
            "v.longi AS Longitude "
            "FROM vaccinations v "
            "LEFT JOIN nations n ON v.nationID = n.nationID "
            "LEFT JOIN provinces p ON v.provinceID = p.provinceID "
            "LEFT JOIN districts d ON v.districtID = d.districtID "
            "LEFT JOIN vaccination_campaign vc ON v.vacc_campID = vc.vacc_campID "
            "ORDER BY v.dt_vacci DESC"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/marketprice")
async def get_marketprice():
    """Get all market price data from TCC database"""
    try:
        result = await db_helper.execute_tcc_query(
            "SELECT "
            "n.country AS Country, "
            "p.descrizione AS Quarter, "
            "mp.reference AS Reference, "
            "mp.ctl_dis_liveMIN AS Cattle_Districts_Live_Min, "
            "mp.ctl_dis_liveMAX AS Cattle_Districts_Live_Max, "
            "mp.ctl_dis_liveAVG AS Cattle_Districts_Live_Avg, "
            "mp.ctl_dis_meatMIN AS Cattle_Districts_Meat_Min, "
            "mp.ctl_dis_meatMAX AS Cattle_Districts_Meat_Max, "
            "mp.ctl_dis_meatAVG AS Cattle_Districts_Meat_Avg, "
            "mp.ctl_cap_liveMIN AS Cattle_Capital_Live_Min, "
            "mp.ctl_cap_liveMAX AS Cattle_Capital_Live_Max, "
            "mp.ctl_cap_liveAVG AS Cattle_Capital_Live_Avg, "
            "mp.ctl_cap_meatMIN AS Cattle_Capital_Meat_Min, "
            "mp.ctl_cap_meatMAX AS Cattle_Capital_Meat_Max, "
            "mp.ctl_cap_meatAVG AS Cattle_Capital_Meat_Avg, "
            "mp.shp_dis_liveMIN AS Sheep_Districts_Live_Min, "
            "mp.shp_dis_liveMAX AS Sheep_Districts_Live_Max, "
            "mp.shp_dis_liveAVG AS Sheep_Districts_Live_Avg, "
            "mp.shp_dis_meatMIN AS Sheep_Districts_Meat_Min, "
            "mp.shp_dis_meatMAX AS Sheep_Districts_Meat_Max, "
            "mp.shp_dis_meatAVG AS Sheep_Districts_Meat_Avg, "
            "mp.shp_cap_liveMIN AS Sheep_Capital_Live_Min, "
            "mp.shp_cap_liveMAX AS Sheep_Capital_Live_Max, "
            "mp.shp_cap_liveAVG AS Sheep_Capital_Live_Avg, "
            "mp.shp_cap_meatMIN AS Sheep_Capital_Meat_Min, "
            "mp.shp_cap_meatMAX AS Sheep_Capital_Meat_Max, "
            "mp.shp_cap_meatAVG AS Sheep_Capital_Meat_Avg, "
            "mp.pig_dis_liveMIN AS Pig_Districts_Live_Min, "
            "mp.pig_dis_liveMAX AS Pig_Districts_Live_Max, "
            "mp.pig_dis_liveAVG AS Pig_Districts_Live_Avg, "
            "mp.pig_dis_meatMIN AS Pig_Districts_Meat_Min, "
            "mp.pig_dis_meatMAX AS Pig_Districts_Meat_Max, "
            "mp.pig_dis_meatAVG AS Pig_Districts_Meat_Avg, "
            "mp.pig_cap_liveMIN AS Pig_Capital_Live_Min, "
            "mp.pig_cap_liveMAX AS Pig_Capital_Live_Max, "
            "mp.pig_cap_liveAVG AS Pig_Capital_Live_Avg, "
            "mp.pig_cap_meatMIN AS Pig_Capital_Meat_Min, "
            "mp.pig_cap_meatMAX AS Pig_Capital_Meat_Max, "
            "mp.pig_cap_meatAVG AS Pig_Capital_Meat_Avg "
            "FROM marketprice mp "
            "LEFT JOIN nations n ON mp.nationID = n.nationID "
            "LEFT JOIN marketprice_period p ON mp.periodID = p.periodID "
            "ORDER BY p.dt_from DESC, n.country ASC"
        )
        if result["error"]:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return {"data": result["data"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))