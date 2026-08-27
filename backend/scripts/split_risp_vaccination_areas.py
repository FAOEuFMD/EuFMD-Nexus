"""
Split risp_vaccination rows with multiple geographical_areas into one row per area.

Split rule:
  - First area keeps original q1–q4, total, coverage
  - Expanded rows get doses/coverage = 0 (placeholder; countries should review)
  - Also adds/backfills `location` varchar (single area)

Usage (from backend/):
  python scripts/split_risp_vaccination_areas.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from database import main_engine  # noqa: E402


def parse_areas(val):
    if val is None:
        return []
    if isinstance(val, (bytes, bytearray)):
        val = val.decode("utf-8", errors="replace")
    if isinstance(val, str):
        s = val.strip()
        if not s or s == "null":
            return []
        try:
            val = json.loads(s)
        except Exception:
            return [s] if s else []
    if isinstance(val, list):
        return [str(x).strip() for x in val if x is not None and str(x).strip() != ""]
    return [str(val).strip()] if str(val).strip() else []


def as_json_param(val):
    if val is None:
        return None
    if isinstance(val, str):
        return val
    return json.dumps(val, ensure_ascii=False)


def main() -> None:
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    with main_engine.begin() as c:
        has_loc = c.execute(
            text(
                """
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'risp_vaccination'
                  AND COLUMN_NAME = 'location'
                """
            )
        ).scalar()
        if not has_loc:
            c.execute(
                text(
                    """
                    ALTER TABLE risp_vaccination
                    ADD COLUMN location VARCHAR(255) NULL AFTER geographical_areas
                    """
                )
            )
            print("Added risp_vaccination.location")

        rows = c.execute(
            text(
                """
                SELECT id, user_id, country, disease_name, year, status, vaccination_type,
                       geographical_areas, province_id, district_id, program, visibility,
                       source_tcc_id, species, q1, q2, q3, q4, total, coverage,
                       vaccine_details, created_at
                FROM risp_vaccination
                """
            )
        ).mappings().all()

        split_parents = 0
        inserted = 0
        backfilled = 0

        for r in rows:
            areas = parse_areas(r["geographical_areas"])

            if len(areas) == 0:
                continue

            if len(areas) == 1:
                if not r.get("location"):
                    c.execute(
                        text("UPDATE risp_vaccination SET location = :loc WHERE id = :id"),
                        {"loc": areas[0], "id": r["id"]},
                    )
                    backfilled += 1
                continue

            split_parents += 1
            first, rest = areas[0], areas[1:]

            c.execute(
                text(
                    """
                    UPDATE risp_vaccination
                    SET geographical_areas = CAST(:areas AS JSON),
                        location = :loc
                    WHERE id = :id
                    """
                ),
                {
                    "areas": json.dumps([first], ensure_ascii=False),
                    "loc": first,
                    "id": r["id"],
                },
            )
            print(
                f"UPDATED id={r['id']} {r['country']} {r['year']} {r['disease_name']} "
                f"doses kept on loc={first!r}"
            )

            for loc in rest:
                c.execute(
                    text(
                        """
                        INSERT INTO risp_vaccination
                          (user_id, country, disease_name, year, status, vaccination_type,
                           geographical_areas, location, province_id, district_id,
                           program, visibility, source_tcc_id, species,
                           q1, q2, q3, q4, total, coverage, vaccine_details, created_at)
                        VALUES
                          (:user_id, :country, :disease_name, :year, :status, :vaccination_type,
                           CAST(:geographical_areas AS JSON), :location, :province_id, :district_id,
                           :program, :visibility, :source_tcc_id, CAST(:species AS JSON),
                           0, 0, 0, 0, 0, 0, :vaccine_details, :created_at)
                        """
                    ),
                    {
                        "user_id": r["user_id"],
                        "country": r["country"],
                        "disease_name": r["disease_name"],
                        "year": r["year"],
                        "status": r["status"],
                        "vaccination_type": r["vaccination_type"],
                        "geographical_areas": json.dumps([loc], ensure_ascii=False),
                        "location": loc,
                        "province_id": r["province_id"],
                        "district_id": r["district_id"],
                        "program": r["program"] or "risp",
                        "visibility": r["visibility"] or "public",
                        "source_tcc_id": None,
                        "species": as_json_param(r["species"]),
                        "vaccine_details": r["vaccine_details"],
                        "created_at": r["created_at"] or now,
                    },
                )
                inserted += 1
                print(f"  INSERTED loc={loc!r} doses=0")

        total = c.execute(text("SELECT COUNT(*) FROM risp_vaccination")).scalar()
        left = 0
        for r in c.execute(text("SELECT id, geographical_areas FROM risp_vaccination")).mappings():
            if len(parse_areas(r["geographical_areas"])) > 1:
                left += 1
                print("STILL MULTI", r["id"], r["geographical_areas"])

        print(f"\nParents split: {split_parents}")
        print(f"New rows inserted: {inserted}")
        print(f"Single-area location backfill: {backfilled}")
        print(f"Total risp_vaccination now: {total}")
        print(f"Remaining multi-area rows: {left}")


if __name__ == "__main__":
    main()
