"""
SOI dashboard APIs — read from db_manager risp_* tables (not TCC).

Prefix kept as /api/tcc for frontend compatibility; data source is db_manager.
"""

from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query

from database import db_helper

router = APIRouter(prefix="/api/tcc", tags=["soi"])

OB_ACTIVE = "(o.location IS NULL OR o.location <> '__deleted__')"
VACC_ACTIVE = "(v.location IS NULL OR v.location <> '__deleted__')"
MP_ACTIVE = "(mp.reference IS NULL OR mp.reference <> '__deleted__')"


def _parse_json_list(val: Any) -> list:
    if val is None:
        return []
    if isinstance(val, list):
        return val
    if isinstance(val, (bytes, bytearray)):
        val = val.decode("utf-8", errors="ignore")
    if isinstance(val, str):
        s = val.strip()
        if not s:
            return []
        try:
            parsed = json.loads(s)
            return parsed if isinstance(parsed, list) else [parsed]
        except json.JSONDecodeError:
            return [s]
    return []


def _first_json(val: Any) -> Optional[str]:
    items = _parse_json_list(val)
    return str(items[0]) if items else None


def _status_to_conf_type(status_val: Any) -> Optional[str]:
    items = [str(x).lower() for x in _parse_json_list(status_val)]
    joined = " ".join(items)
    if "laboratory" in joined:
        return "L"
    if "clinical" in joined:
        return "C"
    if "suspect" in joined:
        return "S"
    return None


def _quarter_start(year: str | int, quarter: str | None) -> str:
    y = int(year)
    q = (quarter or "Q1").upper()
    month = {"Q1": "01", "Q2": "04", "Q3": "07", "Q4": "10"}.get(q, "01")
    return f"{y}-{month}-01"


def _period_id(year: str | int, quarter: str | None) -> int:
    y = int(year)
    qn = {"Q1": 1, "Q2": 2, "Q3": 3, "Q4": 4}.get((quarter or "Q1").upper(), 1)
    return y * 10 + qn


def _opt_str(val: Any) -> Optional[str]:
    """Coerce FastAPI Query defaults when calling endpoints directly."""
    return val if isinstance(val, str) and val else None


def _opt_int(val: Any, default: int) -> int:
    if isinstance(val, int) and not isinstance(val, bool):
        return val
    if isinstance(val, str) and val.isdigit():
        return int(val)
    return default


def _disease_sql_clause(column: str, disease: Optional[str], params: list) -> Optional[str]:
    """Match disease_name allowing 'Name - CODE' vs 'Name' variants."""
    d = _opt_str(disease)
    if not d:
        return None
    base = d.rsplit(" - ", 1)[0].strip() if " - " in d else d
    params.extend([d, base, f"{base} - %", f"%{base}%"])
    return f"({column} = %s OR {column} = %s OR {column} LIKE %s OR {column} LIKE %s)"


async def _main(query: str, params=None):
    result = await db_helper.execute_main_query(query, params)
    if result["error"]:
        raise HTTPException(status_code=500, detail=result["error"])
    return result["data"] or []


# ---------------------------------------------------------------------------
# Map / list endpoints
# ---------------------------------------------------------------------------


@router.get("/outbreaks")
async def get_outbreaks():
    """Outbreak points for the SOI map (db_manager.risp_outbreaks)."""
    try:
        rows = await _main(
            f"""
            SELECT
              o.country AS Country,
              p.name AS Province,
              d.name AS District,
              o.additional_info AS Epi_Unit,
              o.latitude AS Latitude,
              o.longitude AS Longitude,
              o.disease_name AS Disease,
              o.species AS Species,
              o.serotype AS Serotype,
              o.status AS StatusJson,
              o.date_suspected AS Date_Suspected,
              o.date_confirmed AS Date_Confirmed
            FROM risp_outbreaks o
            LEFT JOIN provinces p ON p.id = o.province_id
            LEFT JOIN districts d ON d.id = o.district_id
            WHERE {OB_ACTIVE}
            ORDER BY o.date_confirmed DESC, o.date_suspected DESC
            """
        )
        data = []
        for r in rows:
            conf = _status_to_conf_type(r.get("StatusJson"))
            data.append(
                {
                    "Country": r.get("Country"),
                    "Province": r.get("Province"),
                    "District": r.get("District"),
                    "Epi_Unit": r.get("Epi_Unit"),
                    "Latitude": float(r["Latitude"]) if r.get("Latitude") is not None else None,
                    "Longitude": float(r["Longitude"]) if r.get("Longitude") is not None else None,
                    "Disease": r.get("Disease"),
                    "Species": _first_json(r.get("Species")),
                    "Serotype": _first_json(r.get("Serotype")),
                    "Date_Suspected": str(r["Date_Suspected"]) if r.get("Date_Suspected") else None,
                    "Date_Confirmed": str(r["Date_Confirmed"]) if r.get("Date_Confirmed") else None,
                    "Confirmation_Type": conf,
                }
            )
        return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vaccination")
async def get_vaccination():
    """Vaccination rows for SOI choropleth (needs Country + Province)."""
    try:
        rows = await _main(
            f"""
            SELECT
              v.country AS Country,
              p.name AS Province,
              d.name AS District,
              v.year AS Year,
              v.q1, v.q2, v.q3, v.q4,
              v.disease_name AS Disease,
              v.vaccine_details AS Vaccination_Campaign,
              v.created_at AS Vaccination_Date,
              v.total AS Vaccination_Doses,
              v.coverage AS Coverage,
              v.species AS Species
            FROM risp_vaccination v
            LEFT JOIN provinces p ON p.id = v.province_id
            LEFT JOIN districts d ON d.id = v.district_id
            WHERE {VACC_ACTIVE}
            ORDER BY v.year DESC, v.id DESC
            """
        )
        data = []
        for r in rows:
            data.append(
                {
                    "Country": r.get("Country"),
                    "Province": r.get("Province"),
                    "District": r.get("District"),
                    "Year": r.get("Year"),
                    "Q1": r.get("q1"),
                    "Q2": r.get("q2"),
                    "Q3": r.get("q3"),
                    "Q4": r.get("q4"),
                    "Disease": r.get("Disease"),
                    "Vaccination_Campaign": r.get("Vaccination_Campaign"),
                    "Vaccination_Date": str(r["Vaccination_Date"])[:10] if r.get("Vaccination_Date") else None,
                    "Vaccination_Doses": r.get("Vaccination_Doses"),
                    "Coverage": r.get("Coverage"),
                    "Species": _first_json(r.get("Species")),
                    # No lat/long on risp_vaccination — choropleth uses Province only
                    "Latitude": None,
                    "Longitude": None,
                }
            )
        return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/marketprice")
async def get_marketprice():
    """Normalized market prices pivoted lightly for legacy consumers."""
    try:
        rows = await _main(
            f"""
            SELECT country, year, quarter, species, market_level, product,
                   price_min, price_max, price_avg, reference
            FROM risp_marketprice mp
            WHERE {MP_ACTIVE}
            ORDER BY year DESC, quarter DESC, country
            """
        )
        # Group by country+year+quarter into wide-ish records for compatibility
        grouped: dict[tuple, dict] = {}
        for r in rows:
            key = (r["country"], r["year"], r["quarter"])
            if key not in grouped:
                grouped[key] = {
                    "Country": r["country"],
                    "Quarter": f"{r['year']}-{r['quarter']}",
                    "Reference": r.get("reference"),
                }
            sp = (r.get("species") or "").lower()
            lvl = (r.get("market_level") or "").lower()
            prod = (r.get("product") or "").lower()
            sp_label = {"cattle": "Cattle", "sheep": "Sheep", "pig": "Pig"}.get(sp)
            lvl_label = {"district": "Districts", "capital": "Capital"}.get(lvl)
            prod_label = {"live": "Live", "meat": "Meat"}.get(prod)
            if not (sp_label and lvl_label and prod_label):
                continue
            prefix = f"{sp_label}_{lvl_label}_{prod_label}"
            g = grouped[key]
            g[f"{prefix}_Min"] = r.get("price_min")
            g[f"{prefix}_Max"] = r.get("price_max")
            g[f"{prefix}_Avg"] = r.get("price_avg")
        return {"data": list(grouped.values())}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# KPIs
# ---------------------------------------------------------------------------


@router.get("/kpi/days-since-last-outbreak")
async def get_days_since_last_outbreak():
    try:
        rows = await _main(
            f"""
            SELECT DATEDIFF(CURDATE(), MAX(date_confirmed)) AS days_since
            FROM risp_outbreaks o
            WHERE {OB_ACTIVE} AND date_confirmed IS NOT NULL
            """
        )
        days = rows[0]["days_since"] if rows and rows[0]["days_since"] is not None else None
        return {"days_since": days}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi/active-hotspots")
async def get_active_hotspots():
    try:
        rows = await _main(
            f"""
            SELECT COUNT(DISTINCT COALESCE(CAST(district_id AS CHAR), location)) AS hotspot_count
            FROM risp_outbreaks o
            WHERE {OB_ACTIVE}
              AND date_confirmed IS NOT NULL
              AND date_confirmed >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            """
        )
        return {"hotspot_count": int(rows[0]["hotspot_count"] or 0) if rows else 0}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi/campaigns")
async def get_campaigns():
    try:
        rows = await _main(
            f"""
            SELECT COUNT(*) AS campaign_count
            FROM risp_vaccination v
            WHERE {VACC_ACTIVE}
              AND created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
            """
        )
        return {"campaign_count": int(rows[0]["campaign_count"] or 0) if rows else 0}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/kpi/dominant-serotype")
async def get_dominant_serotype():
    try:
        rows = await _main(
            f"""
            SELECT serotype
            FROM risp_outbreaks o
            WHERE {OB_ACTIVE}
              AND date_confirmed IS NOT NULL
              AND date_confirmed >= DATE_SUB(CURDATE(), INTERVAL 90 DAY)
              AND serotype IS NOT NULL
            """
        )
        counts: dict[str, int] = {}
        for r in rows:
            for s in _parse_json_list(r.get("serotype")):
                label = str(s).strip()
                if not label or label in ("--", "-"):
                    continue
                counts[label] = counts.get(label, 0) + 1
        serotype = max(counts, key=counts.get) if counts else None
        return {"serotype": serotype}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Vaccine / herd immunity
# ---------------------------------------------------------------------------


@router.get("/herd-immunity-gap")
async def get_herd_immunity_gap(
    country: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    disease: Optional[str] = Query(None),
):
    """Coverage per district from risp_vaccination (cattle-preferring; else all species)."""
    try:
        country = _opt_str(country)
        date_from = _opt_str(date_from)
        date_to = _opt_str(date_to)
        disease = _opt_str(disease)
        where = [VACC_ACTIVE, "d.name IS NOT NULL", "v.country IS NOT NULL"]
        params: list = []
        if country:
            where.append("v.country = %s")
            params.append(country)
        clause = _disease_sql_clause("v.disease_name", disease, params)
        if clause:
            where.append(clause)
        if date_from:
            where.append("v.year >= %s")
            params.append(date_from[:4])
        if date_to:
            where.append("v.year <= %s")
            params.append(date_to[:4])
        where_sql = " AND ".join(where)

        rows = await _main(
            f"""
            SELECT
              v.country AS country,
              p.name AS province_name,
              d.name AS district_name,
              v.total AS doses,
              v.coverage AS coverage,
              v.species AS species
            FROM risp_vaccination v
            LEFT JOIN districts d ON d.id = v.district_id
            LEFT JOIN provinces p ON p.id = v.province_id
            WHERE {where_sql}
            """,
            tuple(params) if params else None,
        )

        # Aggregate per country/province/district; prefer Cattle lines for target math
        agg: dict[tuple, dict] = {}
        for r in rows:
            species = _parse_json_list(r.get("species"))
            is_cattle = any(str(s).lower() == "cattle" for s in species)
            key = (r["country"], r.get("province_name"), r["district_name"])
            cur = agg.setdefault(
                key,
                {"cattle_inj": 0.0, "cattle_tgt": 0.0, "all_inj": 0.0, "all_tgt": 0.0},
            )
            doses = float(r.get("doses") or 0)
            cov = float(r.get("coverage") or 0)
            target = (doses * 100.0 / cov) if cov > 0 else 0.0
            cur["all_inj"] += doses
            cur["all_tgt"] += target
            if is_cattle:
                cur["cattle_inj"] += doses
                cur["cattle_tgt"] += target

        data = []
        for (country_n, prov, dist), v in agg.items():
            inj = v["cattle_inj"] if v["cattle_tgt"] > 0 else v["all_inj"]
            tgt = v["cattle_tgt"] if v["cattle_tgt"] > 0 else v["all_tgt"]
            if tgt <= 0:
                continue
            data.append(
                {
                    "country": country_n,
                    "province_name": prov,
                    "district_name": dist,
                    "total_target": round(tgt, 2),
                    "total_injected": round(inj, 2),
                    "coverage_percentage": round((inj / tgt) * 100, 2),
                }
            )
        data.sort(key=lambda x: x["coverage_percentage"])
        return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/vaccination/coverage-status")
async def get_vaccination_coverage_status():
    try:
        rows = await _main(
            f"""
            SELECT
              v.country AS country,
              COUNT(*) AS vacc_rows,
              SUM(CASE WHEN v.coverage IS NOT NULL AND v.coverage > 0 THEN 1 ELSE 0 END) AS rows_with_coverage
            FROM risp_vaccination v
            WHERE {VACC_ACTIVE} AND v.country IS NOT NULL
            GROUP BY v.country
            ORDER BY v.country
            """
        )
        data = [
            {
                "country": row["country"],
                "has_records": int(row["vacc_rows"] or 0) > 0,
                "has_calculable_coverage": int(row["rows_with_coverage"] or 0) > 0,
            }
            for row in rows
        ]
        return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/serotype-vs-strain-matrix")
async def get_serotype_vs_strain_matrix(
    country: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Best-effort matrix from outbreak serotypes (vaccine strain not stored separately in Nexus)."""
    try:
        where = [OB_ACTIVE, "o.district_id IS NOT NULL", "o.serotype IS NOT NULL"]
        params: list = []
        if country:
            where.append("o.country = %s")
            params.append(country)
        if date_from:
            where.append("o.date_confirmed >= %s")
            params.append(date_from)
        if date_to:
            where.append("o.date_confirmed <= %s")
            params.append(date_to)
        where_sql = " AND ".join(where)
        rows = await _main(
            f"""
            SELECT o.serotype
            FROM risp_outbreaks o
            WHERE {where_sql}
            """,
            tuple(params) if params else None,
        )
        # Vaccine strain not on risp_outbreaks — matrix uses serotype vs unknown
        counts: dict[tuple, int] = {}
        for r in rows:
            for s in _parse_json_list(r.get("serotype")):
                key = (str(s), "unknown")
                counts[key] = counts.get(key, 0) + 1
        data = [
            {"serotype": s, "vaccine_strain": vs, "outbreak_count": n}
            for (s, vs), n in sorted(counts.items(), key=lambda x: -x[1])
        ]
        return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Surveillance quality (from outbreak dates / status)
# ---------------------------------------------------------------------------


def _outbreak_country_filters(
    country: Optional[str],
    date_from: Optional[str],
    date_to: Optional[str],
    disease: Optional[str] = None,
) -> tuple[list[str], list]:
    country = _opt_str(country)
    date_from = _opt_str(date_from)
    date_to = _opt_str(date_to)
    disease = _opt_str(disease)
    where = [OB_ACTIVE]
    params: list = []
    if country:
        where.append("o.country = %s")
        params.append(country)
    clause = _disease_sql_clause("o.disease_name", disease, params)
    if clause:
        where.append(clause)
    if date_from:
        where.append("COALESCE(o.date_confirmed, o.date_suspected) >= %s")
        params.append(date_from)
    if date_to:
        where.append("COALESCE(o.date_confirmed, o.date_suspected) <= %s")
        params.append(date_to)
    return where, params


@router.get("/surveillance/response-time-distribution")
async def get_response_time_distribution(
    nationID: Optional[int] = Query(None),  # ignored — Nexus uses country name
    country: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    disease: Optional[str] = Query(None),
    months: int = Query(12),
):
    try:
        where, params = _outbreak_country_filters(country, date_from, date_to, disease)
        where.extend(
            [
                "o.date_suspected IS NOT NULL",
                "o.date_confirmed IS NOT NULL",
                "o.date_confirmed >= o.date_suspected",
            ]
        )
        where_sql = " AND ".join(where)
        bucket_rows = await _main(
            f"""
            SELECT
              CASE
                WHEN DATEDIFF(o.date_confirmed, o.date_suspected) <= 3 THEN 'Excellent (0-3 days)'
                WHEN DATEDIFF(o.date_confirmed, o.date_suspected) <= 7 THEN 'Good (4-7 days)'
                WHEN DATEDIFF(o.date_confirmed, o.date_suspected) <= 14 THEN 'Delayed (8-14 days)'
                ELSE 'Critical (>14 days)'
              END AS time_bucket,
              COUNT(*) AS outbreak_count
            FROM risp_outbreaks o
            WHERE {where_sql}
            GROUP BY time_bucket
            """,
            tuple(params) if params else None,
        )
        avg_rows = await _main(
            f"""
            SELECT ROUND(AVG(DATEDIFF(o.date_confirmed, o.date_suspected)), 1) AS avg_days_to_confirm
            FROM risp_outbreaks o
            WHERE {where_sql}
            """,
            tuple(params) if params else None,
        )
        order = {
            "Excellent (0-3 days)": 1,
            "Good (4-7 days)": 2,
            "Delayed (8-14 days)": 3,
            "Critical (>14 days)": 4,
        }
        bucket_rows.sort(key=lambda r: order.get(r["time_bucket"], 99))
        total = sum(int(r["outbreak_count"]) for r in bucket_rows)
        data = [
            {
                "time_bucket": r["time_bucket"],
                "outbreak_count": int(r["outbreak_count"]),
                "percentage": round((int(r["outbreak_count"]) / total) * 100, 1) if total else 0,
            }
            for r in bucket_rows
        ]
        avg_days = avg_rows[0]["avg_days_to_confirm"] if avg_rows else None
        return {"data": data, "avg_days_to_confirm": avg_days}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/surveillance/confirmation-methods")
async def get_confirmation_methods(
    nationID: Optional[int] = Query(None),
    country: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    disease: Optional[str] = Query(None),
    months: int = Query(12),
):
    try:
        where, params = _outbreak_country_filters(country, date_from, date_to, disease)
        where.append("o.status IS NOT NULL")
        where_sql = " AND ".join(where)
        rows = await _main(
            f"SELECT o.status FROM risp_outbreaks o WHERE {where_sql}",
            tuple(params) if params else None,
        )
        counts = {"L": 0, "C": 0, "S": 0}
        for r in rows:
            ct = _status_to_conf_type(r.get("status"))
            if ct in counts:
                counts[ct] += 1
        total = sum(counts.values())
        labels = {"L": "Laboratory", "C": "Clinical", "S": "Suspected"}
        data = []
        for code, n in counts.items():
            if n == 0:
                continue
            data.append(
                {
                    "conf_type": code,
                    "conf_type_name": labels[code],
                    "outbreak_count": n,
                    "percentage": round((n / total) * 100, 1) if total else 0,
                }
            )
        data.sort(key=lambda x: -x["outbreak_count"])
        return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/surveillance/trends")
async def get_surveillance_trends(
    nationID: Optional[int] = Query(None),
    country: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    disease: Optional[str] = Query(None),
    months: int = Query(12),
):
    try:
        where, params = _outbreak_country_filters(country, date_from, date_to, disease)
        where.append("o.date_confirmed IS NOT NULL")
        where.append("o.status IS NOT NULL")
        where_sql = " AND ".join(where)
        rows = await _main(
            f"""
            SELECT o.year, o.quarter, o.status, o.date_confirmed
            FROM risp_outbreaks o
            WHERE {where_sql}
            """,
            tuple(params) if params else None,
        )
        counts: dict[tuple, int] = {}
        for r in rows:
            ct = _status_to_conf_type(r.get("status"))
            if not ct:
                continue
            if r.get("year") and r.get("quarter"):
                period = f"{r['year']}-{r['quarter']}"
            else:
                dc = r["date_confirmed"]
                period = f"{dc.year}-Q{(dc.month - 1) // 3 + 1}"
            key = (period, ct)
            counts[key] = counts.get(key, 0) + 1
        data = [
            {"period_label": period, "conf_type": ct, "outbreak_count": n}
            for (period, ct), n in sorted(counts.items())
        ]
        return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# Economic (risp_marketprice)
# ---------------------------------------------------------------------------


@router.get("/economic/outbreak-price-correlation")
async def get_outbreak_price_correlation(
    nationID: Optional[int] = Query(None),
    country: Optional[str] = Query(None),
    months: int = Query(12),
):
    try:
        country = _opt_str(country)
        if not country:
            return {"data": []}

        price_rows = await _main(
            f"""
            SELECT year, quarter, market_level, product, AVG(price_avg) AS avg_price
            FROM risp_marketprice mp
            WHERE {MP_ACTIVE} AND country = %s AND species = 'cattle' AND price_avg IS NOT NULL
            GROUP BY year, quarter, market_level, product
            ORDER BY year, quarter
            """,
            (country,),
        )
        ob_rows = await _main(
            f"""
            SELECT year, quarter, COUNT(*) AS outbreak_count
            FROM risp_outbreaks o
            WHERE {OB_ACTIVE} AND country = %s
            GROUP BY year, quarter
            """,
            (country,),
        )
        ob_map = {(r["year"], r["quarter"]): int(r["outbreak_count"]) for r in ob_rows}

        by_period: dict[tuple, dict] = {}
        for r in price_rows:
            key = (r["year"], r["quarter"])
            slot = by_period.setdefault(
                key,
                {
                    "periodID": _period_id(r["year"], r["quarter"]),
                    "dt_from": _quarter_start(r["year"], r["quarter"]),
                    "descrizione": f"{r['year']}-{r['quarter']}",
                    "outbreak_count": ob_map.get(key, 0),
                    "Country": country,
                    "ctl_dis_liveAVG": None,
                    "ctl_dis_meatAVG": None,
                    "ctl_cap_liveAVG": None,
                    "ctl_cap_meatAVG": None,
                },
            )
            field = {
                ("district", "live"): "ctl_dis_liveAVG",
                ("district", "meat"): "ctl_dis_meatAVG",
                ("capital", "live"): "ctl_cap_liveAVG",
                ("capital", "meat"): "ctl_cap_meatAVG",
            }.get((r["market_level"], r["product"]))
            if field:
                slot[field] = float(r["avg_price"]) if r["avg_price"] is not None else None

        # Include outbreak-only periods too
        for key, cnt in ob_map.items():
            if key not in by_period:
                y, q = key
                by_period[key] = {
                    "periodID": _period_id(y, q),
                    "dt_from": _quarter_start(y, q),
                    "descrizione": f"{y}-{q}",
                    "outbreak_count": cnt,
                    "Country": country,
                    "ctl_dis_liveAVG": None,
                    "ctl_dis_meatAVG": None,
                    "ctl_cap_liveAVG": None,
                    "ctl_cap_meatAVG": None,
                }

        data = sorted(by_period.values(), key=lambda x: x["dt_from"])
        months_n = _opt_int(months, 12)
        if months_n and len(data) > months_n:
            data = data[-months_n:]
        return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/economic/capital-district-divergence")
async def get_capital_district_divergence(
    nationID: Optional[int] = Query(None),
    country: Optional[str] = Query(None),
    months: int = Query(12),
):
    try:
        country = _opt_str(country)
        if not country:
            return {"data": []}
        rows = await _main(
            f"""
            SELECT year, quarter, market_level, product, AVG(price_avg) AS avg_price
            FROM risp_marketprice mp
            WHERE {MP_ACTIVE} AND country = %s AND species = 'cattle' AND price_avg IS NOT NULL
            GROUP BY year, quarter, market_level, product
            ORDER BY year, quarter
            """,
            (country,),
        )
        by_period: dict[tuple, dict] = {}
        for r in rows:
            key = (r["year"], r["quarter"])
            slot = by_period.setdefault(
                key,
                {
                    "periodID": _period_id(r["year"], r["quarter"]),
                    "descrizione": f"{r['year']}-{r['quarter']}",
                    "dt_from": _quarter_start(r["year"], r["quarter"]),
                    "ctl_dis_liveAVG": None,
                    "ctl_cap_liveAVG": None,
                    "ctl_dis_meatAVG": None,
                    "ctl_cap_meatAVG": None,
                },
            )
            field = {
                ("district", "live"): "ctl_dis_liveAVG",
                ("capital", "live"): "ctl_cap_liveAVG",
                ("district", "meat"): "ctl_dis_meatAVG",
                ("capital", "meat"): "ctl_cap_meatAVG",
            }.get((r["market_level"], r["product"]))
            if field:
                slot[field] = float(r["avg_price"]) if r["avg_price"] is not None else None

        data = []
        for slot in sorted(by_period.values(), key=lambda x: x["dt_from"]):
            dis_l = slot["ctl_dis_liveAVG"]
            cap_l = slot["ctl_cap_liveAVG"]
            dis_m = slot["ctl_dis_meatAVG"]
            cap_m = slot["ctl_cap_meatAVG"]
            live_gap = round(cap_l - dis_l, 2) if cap_l is not None and dis_l is not None else None
            meat_gap = round(cap_m - dis_m, 2) if cap_m is not None and dis_m is not None else None
            live_pct = (
                round(((cap_l - dis_l) / dis_l) * 100, 2)
                if cap_l is not None and dis_l not in (None, 0)
                else None
            )
            meat_pct = (
                round(((cap_m - dis_m) / dis_m) * 100, 2)
                if cap_m is not None and dis_m not in (None, 0)
                else None
            )
            data.append(
                {
                    **slot,
                    "live_price_gap": live_gap,
                    "live_price_gap_percent": live_pct,
                    "meat_price_gap": meat_gap,
                    "meat_price_gap_percent": meat_pct,
                }
            )
        months_n = _opt_int(months, 12)
        if months_n and len(data) > months_n:
            data = data[-months_n:]
        return {"data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/economic/species-price-comparison")
async def get_species_price_comparison(
    nationID: Optional[int] = Query(None),
    country: Optional[str] = Query(None),
    periodID: Optional[int] = Query(None),
):
    try:
        country = _opt_str(country)
        if not country:
            return {"data": [], "period": None}

        periods = await _main(
            f"""
            SELECT DISTINCT year, quarter
            FROM risp_marketprice mp
            WHERE {MP_ACTIVE} AND country = %s
            ORDER BY year DESC, quarter DESC
            LIMIT 40
            """,
            (country,),
        )
        if not periods:
            return {"data": [], "period": None}

        chosen = None
        if periodID is not None:
            for p in periods:
                if _period_id(p["year"], p["quarter"]) == periodID:
                    chosen = p
                    break
        if chosen is None:
            chosen = periods[0]

        year, quarter = chosen["year"], chosen["quarter"]
        period_meta = {
            "periodID": _period_id(year, quarter),
            "descrizione": f"{year}-{quarter}",
            "dt_from": _quarter_start(year, quarter),
        }

        rows = await _main(
            f"""
            SELECT species, market_level, product, AVG(price_avg) AS avg_price
            FROM risp_marketprice mp
            WHERE {MP_ACTIVE} AND country = %s AND year = %s AND quarter = %s
              AND price_avg IS NOT NULL
            GROUP BY species, market_level, product
            """,
            (country, year, quarter),
        )
        by_sp: dict[str, dict] = {
            "cattle": {},
            "sheep": {},
            "pig": {},
        }
        for r in rows:
            sp = (r.get("species") or "").lower()
            if sp not in by_sp:
                continue
            key = f"{r['market_level']}_{r['product']}"
            by_sp[sp][key] = float(r["avg_price"]) if r["avg_price"] is not None else None

        data = []
        for sp, label in (("cattle", "Cattle"), ("sheep", "Sheep"), ("pig", "Pig")):
            vals = by_sp[sp]
            dis_l = vals.get("district_live")
            cap_l = vals.get("capital_live")
            gap = (
                round(((cap_l - dis_l) / dis_l) * 100, 2)
                if cap_l is not None and dis_l not in (None, 0)
                else None
            )
            data.append(
                {
                    "species": label,
                    "district_live_avg": dis_l,
                    "capital_live_avg": cap_l,
                    "district_meat_avg": vals.get("district_meat"),
                    "capital_meat_avg": vals.get("capital_meat"),
                    "price_gap_percent": gap,
                }
            )
        return {"data": data, "period": period_meta}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
