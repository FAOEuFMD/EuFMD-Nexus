"""
Copy TCC provinces + districts into db_manager for SOI countries only.

Creates:
  provinces (id PK, country_id FK, iso3, name, code, sort_order, source_tcc_id)
  districts (id PK, province_id FK, name, code, sort_order, source_tcc_id)

Rules:
  - Only countries with countries.soi = 1 (mapped by ISO3)
  - New auto-increment IDs (do not reuse TCC IDs as PKs)
  - Keep source_tcc_id for historical ETL
  - Skip TCC validity dates (legacy 0000-00-00 / 9999-12-31 only; no real closures)
  - Skip blank district names

Usage (from backend/):
  python scripts/migrate_tcc_geo_to_db_manager.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from database import main_engine, tcc_engine  # noqa: E402


def clean_name(val) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def main() -> None:
    with main_engine.begin() as main:
        for t in ("provinces", "districts"):
            exists = main.execute(
                text(
                    """
                    SELECT COUNT(*) FROM information_schema.TABLES
                    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t
                    """
                ),
                {"t": t},
            ).scalar()
            if not exists:
                raise SystemExit(
                    f"Table `{t}` missing. Run migrations/2026_08_26_create_provinces_districts.sql "
                    f"with a user that has CREATE privilege, then re-run this script."
                )

        soi = main.execute(
            text("SELECT id, iso3, name_un FROM countries WHERE soi = 1 AND iso3 IS NOT NULL")
        ).mappings().all()
        by_iso = {r["iso3"].upper(): r for r in soi if r["iso3"]}
        print(f"SOI countries: {sorted(by_iso)}")
        if len(by_iso) != 10:
            raise SystemExit(f"Expected 10 soi countries, found {len(by_iso)}")

        existing_p = main.execute(text("SELECT COUNT(*) FROM provinces")).scalar()
        existing_d = main.execute(text("SELECT COUNT(*) FROM districts")).scalar()
        if existing_p or existing_d:
            main.execute(text("DELETE FROM districts"))
            main.execute(text("DELETE FROM provinces"))
            print(f"Cleared existing rows (had {existing_p} provinces, {existing_d} districts)")

    # Read TCC in a separate connection
    with tcc_engine.connect() as tcc:
        iso_list = sorted(by_iso.keys())
        placeholders = ", ".join(f":iso{i}" for i in range(len(iso_list)))
        iso_params = {f"iso{i}": v for i, v in enumerate(iso_list)}

        prov_rows = tcc.execute(
            text(
                f"""
                SELECT p.provinceID, p.province_name, p.provincecode, p.orderby,
                       n.three_letter_code AS iso3
                FROM provinces p
                JOIN nations n ON n.nationID = p.nationID
                WHERE n.three_letter_code IN ({placeholders})
                ORDER BY n.three_letter_code, p.orderby, p.province_name
                """
            ),
            iso_params,
        ).mappings().all()

        dist_rows = tcc.execute(
            text(
                f"""
                SELECT d.districtID, d.district_name, d.districtcode, d.orderby,
                       d.provinceID AS tcc_province_id,
                       n.three_letter_code AS iso3
                FROM districts d
                JOIN provinces p ON p.provinceID = d.provinceID
                JOIN nations n ON n.nationID = p.nationID
                WHERE n.three_letter_code IN ({placeholders})
                ORDER BY n.three_letter_code, d.orderby, d.district_name
                """
            ),
            iso_params,
        ).mappings().all()

    tcc_prov_to_new: dict[int, int] = {}

    with main_engine.begin() as main:
        inserted_p = 0
        skipped_p = 0
        for r in prov_rows:
            iso3 = (r["iso3"] or "").upper()
            country = by_iso.get(iso3)
            name = clean_name(r["province_name"])
            if not country or not name:
                skipped_p += 1
                continue
            code = clean_name(r["provincecode"])
            result = main.execute(
                text(
                    """
                    INSERT INTO provinces
                      (country_id, iso3, name, code, sort_order, source_tcc_id)
                    VALUES
                      (:country_id, :iso3, :name, :code, :sort_order, :source_tcc_id)
                    """
                ),
                {
                    "country_id": country["id"],
                    "iso3": iso3,
                    "name": name,
                    "code": code,
                    "sort_order": r["orderby"],
                    "source_tcc_id": r["provinceID"],
                },
            )
            tcc_prov_to_new[int(r["provinceID"])] = int(result.lastrowid)
            inserted_p += 1

        inserted_d = 0
        skipped_d = 0
        for r in dist_rows:
            name = clean_name(r["district_name"])
            tcc_pid = int(r["tcc_province_id"])
            new_pid = tcc_prov_to_new.get(tcc_pid)
            if not name or new_pid is None:
                skipped_d += 1
                continue
            code = clean_name(r["districtcode"])
            main.execute(
                text(
                    """
                    INSERT INTO districts
                      (province_id, name, code, sort_order, source_tcc_id)
                    VALUES
                      (:province_id, :name, :code, :sort_order, :source_tcc_id)
                    """
                ),
                {
                    "province_id": new_pid,
                    "name": name,
                    "code": code,
                    "sort_order": r["orderby"],
                    "source_tcc_id": r["districtID"],
                },
            )
            inserted_d += 1

        print(f"Provinces inserted: {inserted_p} (skipped {skipped_p})")
        print(f"Districts inserted: {inserted_d} (skipped {skipped_d})")

        print("=== by country ===")
        for r in main.execute(
            text(
                """
                SELECT c.iso3, c.name_un,
                       COUNT(DISTINCT p.id) AS provinces,
                       COUNT(DISTINCT d.id) AS districts
                FROM countries c
                LEFT JOIN provinces p ON p.country_id = c.id
                LEFT JOIN districts d ON d.province_id = p.id
                WHERE c.soi = 1
                GROUP BY c.id, c.iso3, c.name_un
                ORDER BY c.name_un
                """
            )
        ):
            print(r)

        orphans = main.execute(
            text(
                """
                SELECT COUNT(*) FROM districts d
                LEFT JOIN provinces p ON p.id = d.province_id
                WHERE p.id IS NULL
                """
            )
        ).scalar()
        no_country = main.execute(
            text(
                """
                SELECT COUNT(*) FROM provinces p
                LEFT JOIN countries c ON c.id = p.country_id
                WHERE c.id IS NULL
                """
            )
        ).scalar()
        print(f"Orphan districts: {orphans}; provinces without country: {no_country}")
        print(
            "Totals:",
            main.execute(text("SELECT COUNT(*) FROM provinces")).scalar(),
            "provinces,",
            main.execute(text("SELECT COUNT(*) FROM districts")).scalar(),
            "districts",
        )


if __name__ == "__main__":
    main()
