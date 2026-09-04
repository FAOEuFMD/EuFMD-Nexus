"""
Migrate TCC vaccination → db_manager.risp_vaccination (country-by-country).

Default source (ARM/AZE/GEO/TUR/RUS):
  vacc_headers ⋈ vacc_activities — cumulative doses within campaign → MAX

Iran (--iso3 IRN):
  vacc_activities_irn — monthly incremental doses → SUM into q1–q4 per district×year
  Orphan TCC userID 91 (not in users) → mapped to Amir Javadi (TCC 147)

Usage (from backend/):
  python scripts/migrate_tcc_vaccination_to_db_manager.py --iso3 ARM --dry-run
  python scripts/migrate_tcc_vaccination_to_db_manager.py --iso3 IRN
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from database import main_engine, tcc_engine  # noqa: E402

DISEASE_FMD = "Foot-and-Mouth Disease - FMD"

# Iran vacc_activities_irn historical orphan (not in TCC.users)
IRN_ORPHAN_USER_TO_TCC = {91: 147}  # → Amir Javadi


def _num(val) -> float:
    if val is None:
        return 0.0
    if isinstance(val, Decimal):
        return float(val)
    try:
        return float(val)
    except (TypeError, ValueError):
        return 0.0


def _clean_text(val: str | None) -> str | None:
    if not val:
        return None
    s = html.unescape(str(val)).replace("&#34;", '"').strip()
    s = re.sub(r"\s+", " ", s)
    return s or None


def campaign_quarter(description: str | None, last_month: int | None) -> str:
    d = (description or "").upper()
    if "EARLY SPRING" in d:
        return "Q1"
    if "SPRING" in d:
        return "Q2"
    if "AUTUMN" in d or "FALL" in d:
        return "Q4"
    if last_month:
        return f"Q{(last_month - 1) // 3 + 1}"
    return "Q2"


def coverage_pct(vaccinated: float, population: float) -> int:
    if population <= 0:
        return 0
    return max(0, min(100, int(round(100.0 * vaccinated / population))))


def _as_created(val) -> datetime:
    if val is None:
        return datetime.utcnow()
    if isinstance(val, datetime):
        return val
    return datetime(val.year, val.month, val.day)


def prepare_from_iran(
    *,
    country_name: str,
    user_map: dict[int, int],
    district_map: dict[int, dict],
) -> list[dict]:
    """Build rows from vacc_activities_irn (monthly incremental → quarterly sums)."""
    with tcc_engine.connect() as tcc:
        rows = [
            dict(r)
            for r in tcc.execute(
                text(
                    """
                    SELECT vcaiid, districtid, date_activity, year, month,
                           cattle_doses_inj, sr_doses_inj,
                           cattle_total_first_visit, sr_total_first_visit,
                           cattle_manu, sr_manu, cattle_strain, sr_strain,
                           dt_inival, userid
                    FROM vacc_activities_irn
                    ORDER BY districtid, year, month
                    """
                )
            ).mappings()
        ]

    print(f"TCC vacc_activities_irn rows: {len(rows)}")

    # group by district × year
    groups: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for r in rows:
        if r.get("districtid") is None or r.get("year") is None:
            continue
        groups[(int(r["districtid"]), int(r["year"]))].append(r)

    missing_users: set[int] = set()
    missing_districts: set[int] = set()
    prepared: list[dict] = []

    for (tcc_did, year), acts in sorted(groups.items()):
        geo = district_map.get(tcc_did)
        if not geo:
            missing_districts.add(tcc_did)
            continue

        # Prefer latest activity's user; remap Iran orphan 91 → Javadi 147
        tcc_uid = None
        for a in acts:
            if a.get("userid") is not None:
                tcc_uid = int(a["userid"])
        if tcc_uid is None:
            missing_users.add(-1)
            continue
        mapped_tcc = IRN_ORPHAN_USER_TO_TCC.get(tcc_uid, tcc_uid)
        nexus_uid = user_map.get(mapped_tcc)
        if not nexus_uid:
            missing_users.add(tcc_uid)
            continue

        q_cattle = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
        q_sr = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}
        pop_cattle = 0.0
        pop_sr = 0.0
        last_cattle_meta = ("", "")
        last_sr_meta = ("", "")
        created = None

        for a in acts:
            month = int(a["month"])
            q = f"Q{(month - 1) // 3 + 1}"
            c_dose = _num(a.get("cattle_doses_inj"))
            s_dose = _num(a.get("sr_doses_inj"))
            q_cattle[q] += int(round(c_dose))
            q_sr[q] += int(round(s_dose))
            pop_cattle = max(pop_cattle, _num(a.get("cattle_total_first_visit")))
            pop_sr = max(pop_sr, _num(a.get("sr_total_first_visit")))
            if c_dose > 0:
                last_cattle_meta = (
                    _clean_text(a.get("cattle_manu")) or "",
                    _clean_text(a.get("cattle_strain")) or "",
                )
            if s_dose > 0:
                last_sr_meta = (
                    _clean_text(a.get("sr_manu")) or "",
                    _clean_text(a.get("sr_strain")) or "",
                )
            created = a.get("dt_inival") or a.get("date_activity") or created

        location = geo["district_name"]
        year_s = str(year)
        created_dt = _as_created(created)

        specs = []
        cattle_total = sum(q_cattle.values())
        sr_total = sum(q_sr.values())
        if cattle_total > 0:
            specs.append(
                {
                    "species": ["Cattle"],
                    "qs": q_cattle,
                    "total": cattle_total,
                    "coverage": coverage_pct(cattle_total, pop_cattle),
                    "details": " | ".join(x for x in last_cattle_meta if x),
                    "vaccination_type": "Mass",
                    "source_tcc_id": tcc_did * 100000 + year,  # deterministic IRN key
                }
            )
        if sr_total > 0:
            specs.append(
                {
                    "species": ["Sheep", "Goats"],
                    "qs": q_sr,
                    "total": sr_total,
                    "coverage": coverage_pct(sr_total, pop_sr),
                    "details": " | ".join(x for x in last_sr_meta if x),
                    "vaccination_type": "RiskBased",
                    "source_tcc_id": tcc_did * 100000 + year + 50000,
                }
            )

        note = "vacc_activities_irn"
        if tcc_uid != mapped_tcc:
            note += f"; orphan userID {tcc_uid}→TCC {mapped_tcc}"

        for spec in specs:
            details_parts = [p for p in (note, spec["details"]) if p]
            prepared.append(
                {
                    "user_id": nexus_uid,
                    "tcc_user_id": mapped_tcc,
                    "country": country_name,
                    "disease_name": DISEASE_FMD,
                    "year": year_s,
                    "status": "Closed",
                    "vaccination_type": spec["vaccination_type"],
                    "geographical_areas": json.dumps([location]),
                    "location": location,
                    "province_id": geo["province_id"],
                    "district_id": geo["district_id"],
                    "program": "soi",
                    "visibility": "public",
                    "source_tcc_id": spec["source_tcc_id"],
                    "species": json.dumps(spec["species"]),
                    "q1": spec["qs"]["Q1"],
                    "q2": spec["qs"]["Q2"],
                    "q3": spec["qs"]["Q3"],
                    "q4": spec["qs"]["Q4"],
                    "total": spec["total"],
                    "coverage": spec["coverage"],
                    "vaccine_details": " — ".join(details_parts) or None,
                    "created_at": created_dt,
                    "species_label": ",".join(spec["species"]),
                }
            )

    if missing_users:
        raise SystemExit(f"Abort: unmapped TCC userIDs: {sorted(missing_users)}")
    if missing_districts:
        raise SystemExit(f"Abort: unmapped TCC districtIDs: {sorted(missing_districts)[:30]}")

    return prepared


def prepare_from_headers(
    *,
    iso3: str,
    country_name: str,
    user_map: dict[int, int],
    district_map: dict[int, dict],
) -> list[dict]:
    with tcc_engine.connect() as tcc:
        nation = tcc.execute(
            text("SELECT nationID, country FROM nations WHERE three_letter_code = :iso3"),
            {"iso3": iso3},
        ).mappings().first()
        if not nation:
            raise SystemExit(f"TCC nation not found for {iso3}")
        nation_id = int(nation["nationID"])

        headers = [
            dict(r)
            for r in tcc.execute(
                text(
                    """
                    SELECT h.vchid, h.nationid, h.provinceid, h.districtid, h.vacc_campID, h.userID,
                           h.cattle_pop, h.cattle_target_pop, h.cattle_vacc_once,
                           h.sr_pop, h.sr_target_pop, h.sr_vacc_once,
                           h.dt_inival,
                           vc.description AS campaign, vc.anno AS campaign_year,
                           d.district_name, p.province_name
                    FROM vacc_headers h
                    LEFT JOIN vaccination_campaign vc ON vc.vacc_campID = h.vacc_campID
                    LEFT JOIN districts d ON d.districtID = h.districtid
                    LEFT JOIN provinces p ON p.provinceID = h.provinceid
                    WHERE h.nationid = :nid
                    ORDER BY h.vchid
                    """
                ),
                {"nid": nation_id},
            ).mappings()
        ]

        activities = [
            dict(r)
            for r in tcc.execute(
                text(
                    """
                    SELECT a.vchid, a.year, a.month,
                           a.cattle_doses_inj, a.sr_doses_inj,
                           a.cattle_manu, a.sr_manu, a.cattle_strain, a.sr_strain
                    FROM vacc_activities a
                    JOIN vacc_headers h ON h.vchid = a.vchid
                    WHERE h.nationid = :nid
                    ORDER BY a.vchid, a.year, a.month
                    """
                ),
                {"nid": nation_id},
            ).mappings()
        ]

    acts_by_header: dict[int, list[dict]] = {}
    for a in activities:
        acts_by_header.setdefault(int(a["vchid"]), []).append(a)

    print(f"TCC headers: {len(headers)} | activity rows: {len(activities)}")

    missing_users: set[int] = set()
    missing_districts: set[int] = set()
    prepared: list[dict] = []

    for h in headers:
        vchid = int(h["vchid"])
        tcc_uid = h.get("userID")
        if tcc_uid is None:
            missing_users.add(-1)
            continue
        tcc_uid = int(tcc_uid)
        nexus_uid = user_map.get(tcc_uid)
        if not nexus_uid:
            missing_users.add(tcc_uid)
            continue

        tcc_did = h.get("districtid")
        if tcc_did is None:
            missing_districts.add(-1)
            continue
        tcc_did = int(tcc_did)
        geo = district_map.get(tcc_did)
        if not geo:
            missing_districts.add(tcc_did)
            continue

        acts = acts_by_header.get(vchid, [])
        max_cattle = max((_num(a.get("cattle_doses_inj")) for a in acts), default=0.0)
        max_sr = max((_num(a.get("sr_doses_inj")) for a in acts), default=0.0)

        last_month = None
        last_cattle_meta = ("", "")
        last_sr_meta = ("", "")
        for a in acts:
            if a.get("month") is not None:
                last_month = int(a["month"])
            if _num(a.get("cattle_doses_inj")) >= max_cattle and max_cattle > 0:
                last_cattle_meta = (
                    _clean_text(a.get("cattle_manu")) or "",
                    _clean_text(a.get("cattle_strain")) or "",
                )
            if _num(a.get("sr_doses_inj")) >= max_sr and max_sr > 0:
                last_sr_meta = (
                    _clean_text(a.get("sr_manu")) or "",
                    _clean_text(a.get("sr_strain")) or "",
                )

        year = str(h.get("campaign_year") or (acts[-1]["year"] if acts else "") or "")
        if not year:
            continue
        quarter = campaign_quarter(h.get("campaign"), last_month)
        qvals = {"Q1": 0, "Q2": 0, "Q3": 0, "Q4": 0}

        created_dt = _as_created(h.get("dt_inival"))
        location = geo["district_name"]
        campaign_label = _clean_text(h.get("campaign")) or ""

        species_specs = []
        if max_cattle > 0:
            species_specs.append(
                {
                    "species": ["Cattle"],
                    "doses": int(round(max_cattle)),
                    "coverage": coverage_pct(
                        _num(h.get("cattle_vacc_once")) or max_cattle,
                        _num(h.get("cattle_target_pop")) or _num(h.get("cattle_pop")),
                    ),
                    "details": " | ".join(x for x in last_cattle_meta if x),
                    "vaccination_type": "Mass",
                }
            )
        if max_sr > 0:
            species_specs.append(
                {
                    "species": ["Sheep", "Goats"],
                    "doses": int(round(max_sr)),
                    "coverage": coverage_pct(
                        _num(h.get("sr_vacc_once")) or max_sr,
                        _num(h.get("sr_target_pop")) or _num(h.get("sr_pop")),
                    ),
                    "details": " | ".join(x for x in last_sr_meta if x),
                    "vaccination_type": "RiskBased",
                }
            )

        for spec in species_specs:
            qs = dict(qvals)
            qs[quarter] = spec["doses"]
            details_parts = [p for p in (campaign_label, spec["details"]) if p]
            prepared.append(
                {
                    "user_id": nexus_uid,
                    "tcc_user_id": tcc_uid,
                    "country": country_name,
                    "disease_name": DISEASE_FMD,
                    "year": year,
                    "status": "Closed",
                    "vaccination_type": spec["vaccination_type"],
                    "geographical_areas": json.dumps([location]),
                    "location": location,
                    "province_id": geo["province_id"],
                    "district_id": geo["district_id"],
                    "program": "soi",
                    "visibility": "public",
                    "source_tcc_id": vchid,
                    "species": json.dumps(spec["species"]),
                    "q1": qs["Q1"],
                    "q2": qs["Q2"],
                    "q3": qs["Q3"],
                    "q4": qs["Q4"],
                    "total": spec["doses"],
                    "coverage": spec["coverage"],
                    "vaccine_details": " — ".join(details_parts) or None,
                    "created_at": created_dt,
                    "species_label": ",".join(spec["species"]),
                }
            )

    if missing_users:
        raise SystemExit(f"Abort: unmapped TCC userIDs: {sorted(missing_users)}")
    if missing_districts:
        raise SystemExit(f"Abort: unmapped TCC districtIDs: {sorted(missing_districts)[:30]}…")

    return prepared


def write_rows(country_name: str, prepared: list[dict], dry_run: bool) -> None:
    by_user: dict[int, int] = {}
    by_year: dict[str, int] = {}
    for p in prepared:
        by_user[p["user_id"]] = by_user.get(p["user_id"], 0) + 1
        by_year[p["year"]] = by_year.get(p["year"], 0) + 1

    print(f"\nPrepared SOI rows: {len(prepared)}")
    print("By Nexus user_id:", dict(sorted(by_user.items())))
    print("By year:", dict(sorted(by_year.items())))
    cattle_n = sum(1 for p in prepared if "Cattle" in p["species_label"])
    sr_n = sum(1 for p in prepared if "Sheep" in p["species_label"])
    print(f"Cattle lines: {cattle_n} | SR lines: {sr_n}")

    if dry_run:
        print("\nDRY RUN — no writes.")
        for p in prepared[:3]:
            print(
                f"  eg user={p['user_id']} {p['year']} {p['location']} "
                f"{p['species_label']} total={p['total']} "
                f"q1-4=({p['q1']},{p['q2']},{p['q3']},{p['q4']}) src={p['source_tcc_id']}"
            )
        return

    with main_engine.begin() as main:
        existing = main.execute(
            text(
                """
                SELECT COUNT(*) FROM risp_vaccination
                WHERE program = 'soi' AND country = :c AND source_tcc_id IS NOT NULL
                """
            ),
            {"c": country_name},
        ).scalar()
        if existing:
            try:
                main.execute(
                    text(
                        """
                        DELETE FROM risp_vaccination
                        WHERE program = 'soi' AND country = :c AND source_tcc_id IS NOT NULL
                        """
                    ),
                    {"c": country_name},
                )
                print(f"Cleared {existing} prior SOI ETL rows for {country_name}")
            except Exception as exc:
                print(f"DELETE denied ({exc}); soft-deleting prior SOI ETL rows")
                main.execute(
                    text(
                        """
                        UPDATE risp_vaccination
                        SET location = '__deleted__',
                            geographical_areas = CAST('[]' AS JSON),
                            q1=0, q2=0, q3=0, q4=0, total=0
                        WHERE program = 'soi' AND country = :c AND source_tcc_id IS NOT NULL
                          AND (location IS NULL OR location <> '__deleted__')
                        """
                    ),
                    {"c": country_name},
                )

        insert_sql = text(
            """
            INSERT INTO risp_vaccination (
              user_id, country, disease_name, year, status, vaccination_type,
              geographical_areas, location, province_id, district_id,
              program, visibility, source_tcc_id, species,
              q1, q2, q3, q4, total, coverage, vaccine_details, created_at
            ) VALUES (
              :user_id, :country, :disease_name, :year, :status, :vaccination_type,
              CAST(:geographical_areas AS JSON), :location, :province_id, :district_id,
              :program, :visibility, :source_tcc_id, CAST(:species AS JSON),
              :q1, :q2, :q3, :q4, :total, :coverage, :vaccine_details, :created_at
            )
            """
        )
        for p in prepared:
            main.execute(
                insert_sql,
                {
                    "user_id": p["user_id"],
                    "country": p["country"],
                    "disease_name": p["disease_name"],
                    "year": p["year"],
                    "status": p["status"],
                    "vaccination_type": p["vaccination_type"],
                    "geographical_areas": p["geographical_areas"],
                    "location": p["location"],
                    "province_id": p["province_id"],
                    "district_id": p["district_id"],
                    "program": p["program"],
                    "visibility": p["visibility"],
                    "source_tcc_id": p["source_tcc_id"],
                    "species": p["species"],
                    "q1": p["q1"],
                    "q2": p["q2"],
                    "q3": p["q3"],
                    "q4": p["q4"],
                    "total": p["total"],
                    "coverage": p["coverage"],
                    "vaccine_details": p["vaccine_details"],
                    "created_at": p["created_at"],
                },
            )

        soi_n = main.execute(
            text(
                """
                SELECT COUNT(*) FROM risp_vaccination
                WHERE program='soi' AND country=:c AND source_tcc_id IS NOT NULL
                  AND (location IS NULL OR location <> '__deleted__')
                """
            ),
            {"c": country_name},
        ).scalar()
        risp_n = main.execute(
            text(
                """
                SELECT COUNT(*) FROM risp_vaccination
                WHERE program='risp' AND country=:c
                """
            ),
            {"c": country_name},
        ).scalar()
        print(f"\nInserted. Active SOI ETL rows for {country_name}: {soi_n}")
        print(f"Unchanged program=risp rows for {country_name}: {risp_n}")

        print("\nBy user:")
        for r in main.execute(
            text(
                """
                SELECT v.user_id, u.email, u.TCC_id, COUNT(*) n, SUM(v.total) doses
                FROM risp_vaccination v
                JOIN users u ON u.id = v.user_id
                WHERE v.program='soi' AND v.country=:c AND v.source_tcc_id IS NOT NULL
                  AND (v.location IS NULL OR v.location <> '__deleted__')
                GROUP BY v.user_id, u.email, u.TCC_id
                ORDER BY u.TCC_id
                """
            ),
            {"c": country_name},
        ).mappings():
            print(
                f"  Nexus {r['user_id']} TCC {r['TCC_id']} {r['email']}: "
                f"rows={r['n']} sum_total={r['doses']}"
            )

        print("\nBy year:")
        for r in main.execute(
            text(
                """
                SELECT year, COUNT(*) n, SUM(total) doses
                FROM risp_vaccination
                WHERE program='soi' AND country=:c AND source_tcc_id IS NOT NULL
                  AND (location IS NULL OR location <> '__deleted__')
                GROUP BY year ORDER BY year
                """
            ),
            {"c": country_name},
        ).mappings():
            print(f"  {r['year']}: rows={r['n']} doses={r['doses']}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso3", default="ARM", help="SOI country ISO3 to migrate (default ARM)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    iso3 = args.iso3.strip().upper()

    with main_engine.connect() as main:
        country_row = main.execute(
            text("SELECT id, name_un, iso3 FROM countries WHERE iso3 = :iso3 AND soi = 1"),
            {"iso3": iso3},
        ).mappings().first()
        if not country_row:
            raise SystemExit(f"No soi=1 country with iso3={iso3}")
        country_name = country_row["name_un"]
        country_id = int(country_row["id"])

        user_map = {
            int(r["TCC_id"]): int(r["id"])
            for r in main.execute(
                text("SELECT id, TCC_id FROM users WHERE TCC_id IS NOT NULL")
            ).mappings()
            if r["TCC_id"] is not None
        }

        district_map = {
            int(r["source_tcc_id"]): {
                "district_id": int(r["id"]),
                "province_id": int(r["province_id"]),
                "district_name": r["name"],
                "province_name": r["province_name"],
            }
            for r in main.execute(
                text(
                    """
                    SELECT d.id, d.name, d.source_tcc_id, d.province_id, p.name AS province_name
                    FROM districts d
                    JOIN provinces p ON p.id = d.province_id
                    WHERE p.country_id = :cid AND d.source_tcc_id IS NOT NULL
                    """
                ),
                {"cid": country_id},
            ).mappings()
            if r["source_tcc_id"] is not None
        }

    print(f"Country: {country_name} ({iso3}) id={country_id}")
    print(f"Nexus TCC user map: {len(user_map)} | districts mapped: {len(district_map)}")

    if iso3 == "IRN":
        print("Source: vacc_activities_irn (monthly SUM -> quarters)")
        prepared = prepare_from_iran(
            country_name=country_name,
            user_map=user_map,
            district_map=district_map,
        )
    else:
        print("Source: vacc_headers + vacc_activities (campaign MAX)")
        prepared = prepare_from_headers(
            iso3=iso3,
            country_name=country_name,
            user_map=user_map,
            district_map=district_map,
        )

    write_rows(country_name, prepared, args.dry_run)


if __name__ == "__main__":
    main()
