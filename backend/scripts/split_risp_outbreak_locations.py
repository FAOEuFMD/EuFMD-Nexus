"""
Split risp_outbreaks rows that have multiple JSON locations into one row per location.

Prerequisites:
  - Index unique_outbreak_submission must already be dropped (and a plain
    user_id index present for the FK). This was applied live on 26 Aug 2026.

Split rule (agreed):
  - First location keeps the original number_outbreaks
  - Each expanded location gets number_outbreaks = 1
  - EuFMD will ask Türkiye and Iraq to review/edit after the split

Usage (from backend/):
  python scripts/split_risp_outbreak_locations.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

# Allow `python scripts/...` from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from database import main_engine  # noqa: E402


def parse_locations(val):
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
        # Fail fast if unique key still present
        idx = c.execute(
            text(
                """
                SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'risp_outbreaks'
                  AND INDEX_NAME = 'unique_outbreak_submission'
                """
            )
        ).scalar()
        if idx:
            raise SystemExit(
                "Index unique_outbreak_submission still exists. "
                "Drop it first (add idx_risp_outbreaks_user_id for the user_id FK, "
                "then DROP INDEX unique_outbreak_submission)."
            )

        rows = c.execute(
            text(
                """
                SELECT id, user_id, country, year, quarter, disease_name, number_outbreaks,
                       locations, status, serotype, species, control_measures, additional_info,
                       created_at, updated_at
                FROM risp_outbreaks
                """
            )
        ).mappings().all()

        split_parents = 0
        inserted = 0

        for r in rows:
            locs = parse_locations(r["locations"])
            if len(locs) <= 1:
                continue

            split_parents += 1
            first, rest = locs[0], locs[1:]

            c.execute(
                text(
                    """
                    UPDATE risp_outbreaks
                    SET locations = CAST(:locs AS JSON), updated_at = :upd
                    WHERE id = :id
                    """
                ),
                {
                    "locs": json.dumps([first], ensure_ascii=False),
                    "upd": now,
                    "id": r["id"],
                },
            )
            print(
                f"UPDATED id={r['id']} {r['country']} {r['year']} {r['quarter']} "
                f"{r['disease_name']} count={r['number_outbreaks']} loc={first!r}"
            )

            for loc in rest:
                c.execute(
                    text(
                        """
                        INSERT INTO risp_outbreaks
                          (user_id, country, year, quarter, disease_name, number_outbreaks,
                           locations, status, serotype, species, control_measures, additional_info,
                           created_at, updated_at)
                        VALUES
                          (:user_id, :country, :year, :quarter, :disease_name, 1,
                           CAST(:locations AS JSON), CAST(:status AS JSON), CAST(:serotype AS JSON),
                           CAST(:species AS JSON), CAST(:control_measures AS JSON), :additional_info,
                           :created_at, :updated_at)
                        """
                    ),
                    {
                        "user_id": r["user_id"],
                        "country": r["country"],
                        "year": r["year"],
                        "quarter": r["quarter"],
                        "disease_name": r["disease_name"],
                        "locations": json.dumps([loc], ensure_ascii=False),
                        "status": as_json_param(r["status"]),
                        "serotype": as_json_param(r["serotype"]),
                        "species": as_json_param(r["species"]),
                        "control_measures": as_json_param(r["control_measures"]),
                        "additional_info": r["additional_info"],
                        "created_at": r["created_at"] or now,
                        "updated_at": now,
                    },
                )
                inserted += 1
                print(f"  INSERTED loc={loc!r} number_outbreaks=1")

        total = c.execute(text("SELECT COUNT(*) FROM risp_outbreaks")).scalar()
        print(f"\nParents split: {split_parents}")
        print(f"New rows inserted: {inserted}")
        print(f"Total risp_outbreaks now: {total}")

        left = 0
        for r in c.execute(text("SELECT id, locations FROM risp_outbreaks")).mappings():
            if len(parse_locations(r["locations"])) > 1:
                left += 1
                print("STILL MULTI", r["id"], r["locations"])
        print(f"Remaining multi-location rows: {left}")


if __name__ == "__main__":
    main()
