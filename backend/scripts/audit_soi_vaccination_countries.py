"""Audit SOI vaccination data by TCC nation name vs dashboard allow-list."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import tcc_engine

SOI_TO_GEO = {
    "Azerbaijan, Republic of": "Azerbaijan",
    "Armenia, Republic of": "Armenia",
    "Georgia": "Georgia",
    "Iran, Islamic, Republic of": "Iran",
    "Iraq, Republic of": "Iraq",
    "Pakistan, Islamic, Republic of": "Pakistan",
    "Russian Federation": "Russia",
    "Turkey, Republic of": "Turkey",
}

# Docs mention 10 SOI countries; db_manager soi=1 includes Bulgaria, Greece too
EXTRA_SOI_HINTS = ["Bulgaria", "Greece", "Bulgaria, Republic of", "Greece, Republic of"]


def main() -> None:
    with tcc_engine.connect() as conn:
        print("=== All TCC nations with any vaccination rows ===")
        rows = conn.execute(
            text(
                """
                SELECT n.nationID, n.country, n.three_letter_code AS iso3,
                       COUNT(*) AS vacc_rows,
                       COUNT(DISTINCT v.districtID) AS districts,
                       SUM(CASE WHEN v.cattle_target_pop > 0 THEN 1 ELSE 0 END) AS rows_with_cattle_target,
                       MIN(v.dt_vacci) AS min_date,
                       MAX(v.dt_vacci) AS max_date
                FROM vaccinations v
                JOIN nations n ON v.nationID = n.nationID
                GROUP BY n.nationID, n.country, n.three_letter_code
                ORDER BY vacc_rows DESC
                """
            )
        ).mappings().all()
        for r in rows:
            in_map = "YES" if r["country"] in SOI_TO_GEO else "NO"
            print(
                f"  [{in_map}] {r['country']!r} iso3={r['iso3']} "
                f"rows={r['vacc_rows']} districts={r['districts']} "
                f"cattle_target_rows={r['rows_with_cattle_target']} "
                f"dates={r['min_date']}..{r['max_date']}"
            )

        print("\n=== Herd-immunity-gap query (same as Vaccine tab country chart) ===")
        herd = conn.execute(
            text(
                """
                SELECT n.country AS country,
                       COUNT(*) AS district_groups,
                       SUM(v.cattle_target_pop) AS total_target,
                       SUM(v.cattle_vacc_doses_inj) AS total_injected
                FROM vaccinations v
                LEFT JOIN districts d ON v.districtID = d.districtID
                LEFT JOIN provinces p ON d.provinceID = p.provinceID
                LEFT JOIN nations n ON v.nationID = n.nationID
                WHERE d.district_name IS NOT NULL AND n.country IS NOT NULL
                GROUP BY n.country, p.province_name, d.district_name
                HAVING SUM(v.cattle_target_pop) > 0
                """
            )
        ).mappings().all()
        by_country: dict[str, int] = {}
        for r in herd:
            by_country[r["country"]] = by_country.get(r["country"], 0) + 1
        print(f"  Countries with >=1 district in herd chart: {len(by_country)}")
        for c, n in sorted(by_country.items(), key=lambda x: -x[1]):
            in_map = "YES" if c in SOI_TO_GEO else "NO"
            print(f"    [{in_map}] {c!r}: {n} districts")

        print("\n=== Map endpoint rows (needs lat/long for markers; choropleth uses province) ===")
        map_rows = conn.execute(
            text(
                """
                SELECT n.country,
                       COUNT(*) AS total,
                       SUM(CASE WHEN v.latit IS NOT NULL AND v.longi IS NOT NULL
                                AND v.latit <> 0 AND v.longi <> 0 THEN 1 ELSE 0 END) AS with_coords,
                       SUM(CASE WHEN p.province_name IS NOT NULL THEN 1 ELSE 0 END) AS with_province
                FROM vaccinations v
                JOIN nations n ON v.nationID = n.nationID
                LEFT JOIN provinces p ON v.provinceID = p.provinceID
                GROUP BY n.country
                ORDER BY total DESC
                """
            )
        ).mappings().all()
        for r in map_rows:
            in_map = "YES" if r["country"] in SOI_TO_GEO else "NO"
            print(
                f"  [{in_map}] {r['country']!r}: total={r['total']} "
                f"with_coords={r['with_coords']} with_province={r['with_province']}"
            )

        print("\n=== Nations in SOI allow-list but ZERO vaccination rows ===")
        have = {r["country"] for r in rows}
        for formal in SOI_TO_GEO:
            if formal not in have:
                print(f"  MISSING DATA: {formal!r}")

        print("\n=== Nations with vaccination data NOT in SOI_TO_GEO (filtered out on map) ===")
        for r in rows:
            if r["country"] not in SOI_TO_GEO:
                print(f"  EXCLUDED: {r['country']!r} ({r['vacc_rows']} rows)")


if __name__ == "__main__":
    main()
