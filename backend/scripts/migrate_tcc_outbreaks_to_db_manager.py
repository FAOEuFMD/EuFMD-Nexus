"""
Migrate TCC outbreaks → db_manager.risp_outbreaks (SOI historical).

Rules:
  - One TCC event → one risp_outbreaks row (number_outbreaks=1)
  - source_tcc_id = outbreakID
  - user_id via users.TCC_id; orphan userID 91 mapped by outbreak country
    (IRQ→Samir 159, TUR→Bulut 131, IRN→Javadi 147, …)
  - country from COALESCE(row.nationID, district→province.nationID) → ISO3 → name_un
  - district/province via districts.source_tcc_id
  - year/quarter from COALESCE(dt_conf, dt_susp, dt_inival)
  - conf_type L/C → status JSON; disease FMD → Foot-and-Mouth Disease - FMD
  - program='soi', visibility='public'
  - Skip rows with no resolvable SOI nation (orphan districtIDs)
  - Leave program='risp' rows untouched

Usage (from backend/):
  python scripts/migrate_tcc_outbreaks_to_db_manager.py --dry-run
  python scripts/migrate_tcc_outbreaks_to_db_manager.py
  python scripts/migrate_tcc_outbreaks_to_db_manager.py --iso3 IRQ
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from database import main_engine, tcc_engine  # noqa: E402

DISEASE_MAP = {
    "FMD": "Foot-and-Mouth Disease - FMD",
    "LSD": "Lumpy Skin Disease - LSD",
    "PPR": "Peste Des Petits Ruminants - PPR",
    "SPGP": "Sheep Pox And Goat Pox - SPGP",
    "RVF": "Rift Valley Fever - RVF",
}

SPECIES_MAP = {
    "CATTLE": ["Cattle"],
    "BUFFALO": ["Buffalo"],
    "SMALL RUMINANTS": ["Sheep", "Goats"],
    "PIGS": ["Pigs"],
    "SHEEP": ["Sheep"],
    "GOATS": ["Goats"],
}

SEROTYPE_MAP = {
    "O": "O",
    "A": "A",
    "C": "C",
    "ASIA 1": "Asia 1",
    "ASIA1": "Asia 1",
    "SAT1": "SAT 1",
    "SAT 1": "SAT 1",
    "SAT2": "SAT 2",
    "SAT 2": "SAT 2",
    "SAT3": "SAT 3",
    "SAT 3": "SAT 3",
    "PCR(+)": "unknown",
    "UNKNOWN": "unknown",
}

CONF_STATUS = {
    "L": ["Laboratory confirmed"],
    "C": ["Clinically confirmed"],
}

# Orphan TCC userID 91 (not in users) → national reporter by outbreak ISO3
ORPHAN_91_BY_ISO3 = {
    "IRQ": 159,  # Samir
    "TUR": 131,  # Bulut
    "IRN": 147,  # Javadi
    "ARM": 134,  # Satenik
    "AZE": 133,  # Tamilla
    "GEO": 132,  # Tengiz
    "RUS": 140,  # Karaulov
    "PAK": 160,  # Pilar
}
ORPHAN_DEFAULT_TCC = 92  # Vitelli


def _as_date(val) -> date | None:
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        if val.year < 1900:
            return None
        return val
    s = str(val).strip()
    if not s or s.startswith("0000"):
        return None
    try:
        return datetime.strptime(s[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _coord(val, lo: float, hi: float) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
    except (TypeError, ValueError):
        return None
    if f < lo or f > hi:
        return None
    return f


def year_quarter(event: date) -> tuple[str, str]:
    return str(event.year), f"Q{(event.month - 1) // 3 + 1}"


def map_species(desc: str | None) -> list[str]:
    if not desc:
        return []
    return SPECIES_MAP.get(desc.strip().upper(), [])


def map_serotype(desc: str | None) -> list[str]:
    if not desc:
        return []
    raw = desc.strip()
    if raw in ("--", "-", ""):
        return []
    mapped = SEROTYPE_MAP.get(raw.upper(), SEROTYPE_MAP.get(raw, None))
    if mapped:
        return [mapped]
    return [raw]


def map_status(conf_type: str | None) -> list[str]:
    if not conf_type:
        return []
    return CONF_STATUS.get(conf_type.strip().upper(), [])


def resolve_tcc_user(tcc_uid: int | None, iso3: str, user_map: dict[int, int]) -> int | None:
    if tcc_uid is None:
        return None
    if tcc_uid in user_map:
        return user_map[tcc_uid]
    if tcc_uid == 91:
        mapped = ORPHAN_91_BY_ISO3.get(iso3, ORPHAN_DEFAULT_TCC)
        return user_map.get(mapped)
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--iso3", default=None, help="Optional SOI ISO3 filter (e.g. IRQ)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    iso3_filter = args.iso3.strip().upper() if args.iso3 else None

    with main_engine.connect() as main:
        soi_countries = {
            r["iso3"]: {"id": int(r["id"]), "name": r["name_un"]}
            for r in main.execute(
                text("SELECT id, name_un, iso3 FROM countries WHERE soi = 1")
            ).mappings()
        }
        user_map = {
            int(r["TCC_id"]): int(r["id"])
            for r in main.execute(
                text("SELECT id, TCC_id FROM users WHERE TCC_id IS NOT NULL")
            ).mappings()
            if r["TCC_id"] is not None
        }
        # district source_tcc_id → geo (any SOI country)
        district_map: dict[int, dict] = {}
        for r in main.execute(
            text(
                """
                SELECT d.id, d.name, d.source_tcc_id, d.province_id,
                       p.name AS province_name, c.iso3, c.name_un AS country_name
                FROM districts d
                JOIN provinces p ON p.id = d.province_id
                JOIN countries c ON c.id = p.country_id
                WHERE c.soi = 1 AND d.source_tcc_id IS NOT NULL
                """
            )
        ).mappings():
            district_map[int(r["source_tcc_id"])] = {
                "district_id": int(r["id"]),
                "province_id": int(r["province_id"]),
                "district_name": r["name"],
                "iso3": r["iso3"],
                "country_name": r["country_name"],
            }

    if iso3_filter and iso3_filter not in soi_countries:
        raise SystemExit(f"No soi=1 country with iso3={iso3_filter}")

    print(f"SOI countries: {len(soi_countries)} | TCC user map: {len(user_map)} | districts: {len(district_map)}")
    if iso3_filter:
        print(f"Filter: {iso3_filter} ({soi_countries[iso3_filter]['name']})")

    with tcc_engine.connect() as tcc:
        rows = [
            dict(r)
            for r in tcc.execute(
                text(
                    """
                    SELECT o.outbreakID, o.userID, o.nationID, o.districtID,
                           o.epiunit, o.latit, o.longi,
                           o.dt_susp, o.dt_conf, o.dt_inival, o.conf_type,
                           o.diseasecod, o.speID, o.seroID,
                           n.three_letter_code AS row_iso3,
                           pn.three_letter_code AS prov_iso3,
                           d.district_name AS tcc_district_name,
                           dis.description AS disease_desc,
                           sp.description AS species_desc,
                           se.description AS serotype_desc
                    FROM outbreaks o
                    LEFT JOIN nations n ON n.nationID = NULLIF(o.nationID, 0)
                    LEFT JOIN districts d ON d.districtID = o.districtID
                    LEFT JOIN provinces p ON p.provinceID = d.provinceID
                    LEFT JOIN nations pn ON pn.nationID = p.nationID
                    LEFT JOIN diseases dis ON dis.diseasecod = o.diseasecod
                    LEFT JOIN species sp ON sp.speID = o.speID
                    LEFT JOIN serotypes se ON se.seroID = o.seroID
                    ORDER BY o.outbreakID
                    """
                )
            ).mappings()
        ]

    print(f"TCC outbreaks fetched: {len(rows)}")

    prepared: list[dict] = []
    skipped_nation = 0
    skipped_user = 0
    skipped_date = 0
    skipped_filter = 0
    missing_districts: set[int] = set()
    orphan91_remap: dict[str, int] = {}

    for o in rows:
        iso3 = (o.get("row_iso3") or o.get("prov_iso3") or "").strip().upper() or None
        if not iso3 or iso3 not in soi_countries:
            skipped_nation += 1
            continue
        if iso3_filter and iso3 != iso3_filter:
            skipped_filter += 1
            continue

        country_name = soi_countries[iso3]["name"]

        raw_uid = o.get("userID")
        tcc_uid = int(raw_uid) if raw_uid is not None else None
        nexus_uid = resolve_tcc_user(tcc_uid, iso3, user_map)
        if not nexus_uid:
            skipped_user += 1
            continue
        if tcc_uid == 91:
            orphan91_remap[iso3] = orphan91_remap.get(iso3, 0) + 1

        dt_conf = _as_date(o.get("dt_conf"))
        dt_susp = _as_date(o.get("dt_susp"))
        dt_inival = _as_date(o.get("dt_inival"))
        event = dt_conf or dt_susp or dt_inival
        if not event:
            skipped_date += 1
            continue
        year, quarter = year_quarter(event)

        tcc_did = o.get("districtID")
        geo = None
        if tcc_did is not None and int(tcc_did) != 0:
            tcc_did = int(tcc_did)
            geo = district_map.get(tcc_did)
            if not geo:
                missing_districts.add(tcc_did)

        location = None
        province_id = None
        district_id = None
        if geo:
            location = geo["district_name"]
            province_id = geo["province_id"]
            district_id = geo["district_id"]
        else:
            location = (o.get("tcc_district_name") or "").strip() or None
            if not location:
                epi = (o.get("epiunit") or "").strip()
                location = epi or "Unknown"

        disease_code = (o.get("diseasecod") or "").strip().upper()
        disease_name = DISEASE_MAP.get(
            disease_code,
            DISEASE_MAP.get((o.get("disease_desc") or "").strip().upper(), "Foot-and-Mouth Disease - FMD"),
        )

        epiunit = (o.get("epiunit") or "").strip() or None
        additional = f"epiunit: {epiunit}" if epiunit else None

        created = dt_inival or event

        prepared.append(
            {
                "user_id": nexus_uid,
                "tcc_user_id": tcc_uid,
                "country": country_name,
                "iso3": iso3,
                "year": year,
                "quarter": quarter,
                "disease_name": disease_name,
                "number_outbreaks": 1,
                "locations": json.dumps([location] if location else []),
                "location": location,
                "status": json.dumps(map_status(o.get("conf_type"))),
                "serotype": json.dumps(map_serotype(o.get("serotype_desc"))),
                "species": json.dumps(map_species(o.get("species_desc"))),
                "control_measures": json.dumps([]),
                "additional_info": additional,
                "date_suspected": dt_susp,
                "date_confirmed": dt_conf,
                "latitude": _coord(o.get("latit"), -90, 90),
                "longitude": _coord(o.get("longi"), -180, 180),
                "province_id": province_id,
                "district_id": district_id,
                "program": "soi",
                "visibility": "public",
                "source_tcc_id": int(o["outbreakID"]),
                "created_at": datetime(created.year, created.month, created.day),
            }
        )

    by_country: dict[str, int] = {}
    by_user: dict[int, int] = {}
    by_year: dict[str, int] = {}
    for p in prepared:
        by_country[p["iso3"]] = by_country.get(p["iso3"], 0) + 1
        by_user[p["user_id"]] = by_user.get(p["user_id"], 0) + 1
        by_year[p["year"]] = by_year.get(p["year"], 0) + 1

    print(f"\nPrepared SOI rows: {len(prepared)}")
    print("By ISO3:", dict(sorted(by_country.items(), key=lambda x: -x[1])))
    print("By Nexus user_id:", dict(sorted(by_user.items())))
    print("By year:", dict(sorted(by_year.items())))
    print(
        f"Skipped: no_nation={skipped_nation} filter={skipped_filter} "
        f"user={skipped_user} date={skipped_date}"
    )
    if orphan91_remap:
        print("Orphan userID 91 remapped by ISO3:", dict(sorted(orphan91_remap.items())))
    if missing_districts:
        print(
            f"Note: {len(missing_districts)} TCC districtIDs not in Nexus "
            f"(rows kept with location fallback): {sorted(missing_districts)[:20]}"
        )

    if args.dry_run:
        print("\nDRY RUN - no writes.")
        for p in prepared[:3]:
            print(
                f"  eg src={p['source_tcc_id']} {p['iso3']} {p['year']}{p['quarter']} "
                f"user={p['user_id']} loc={p['location']} "
                f"sp={p['species']} st={p['status']} sero={p['serotype']}"
            )
        return

    # Clear prior SOI ETL (optionally one country)
    countries_to_clear = (
        [soi_countries[iso3_filter]["name"]]
        if iso3_filter
        else [c["name"] for c in soi_countries.values()]
    )

    with main_engine.begin() as main:
        cleared = 0
        for cname in countries_to_clear:
            n = main.execute(
                text(
                    """
                    SELECT COUNT(*) FROM risp_outbreaks
                    WHERE program = 'soi' AND country = :c AND source_tcc_id IS NOT NULL
                    """
                ),
                {"c": cname},
            ).scalar()
            if not n:
                continue
            try:
                main.execute(
                    text(
                        """
                        DELETE FROM risp_outbreaks
                        WHERE program = 'soi' AND country = :c AND source_tcc_id IS NOT NULL
                        """
                    ),
                    {"c": cname},
                )
                cleared += int(n)
            except Exception as exc:
                print(f"DELETE denied for {cname} ({exc}); soft-deleting")
                main.execute(
                    text(
                        """
                        UPDATE risp_outbreaks
                        SET location = '__deleted__',
                            locations = CAST('[]' AS JSON),
                            number_outbreaks = 0
                        WHERE program = 'soi' AND country = :c AND source_tcc_id IS NOT NULL
                          AND (location IS NULL OR location <> '__deleted__')
                        """
                    ),
                    {"c": cname},
                )
                cleared += int(n)
        if cleared:
            print(f"Cleared {cleared} prior SOI ETL outbreak rows")

        insert_sql = text(
            """
            INSERT INTO risp_outbreaks (
              user_id, country, year, quarter, disease_name, number_outbreaks,
              locations, location, status, serotype, species, control_measures,
              additional_info, date_suspected, date_confirmed,
              latitude, longitude, province_id, district_id,
              program, visibility, source_tcc_id, created_at
            ) VALUES (
              :user_id, :country, :year, :quarter, :disease_name, :number_outbreaks,
              CAST(:locations AS JSON), :location, CAST(:status AS JSON),
              CAST(:serotype AS JSON), CAST(:species AS JSON), CAST(:control_measures AS JSON),
              :additional_info, :date_suspected, :date_confirmed,
              :latitude, :longitude, :province_id, :district_id,
              :program, :visibility, :source_tcc_id, :created_at
            )
            """
        )
        for p in prepared:
            main.execute(
                insert_sql,
                {
                    "user_id": p["user_id"],
                    "country": p["country"],
                    "year": p["year"],
                    "quarter": p["quarter"],
                    "disease_name": p["disease_name"],
                    "number_outbreaks": p["number_outbreaks"],
                    "locations": p["locations"],
                    "location": p["location"],
                    "status": p["status"],
                    "serotype": p["serotype"],
                    "species": p["species"],
                    "control_measures": p["control_measures"],
                    "additional_info": p["additional_info"],
                    "date_suspected": p["date_suspected"],
                    "date_confirmed": p["date_confirmed"],
                    "latitude": p["latitude"],
                    "longitude": p["longitude"],
                    "province_id": p["province_id"],
                    "district_id": p["district_id"],
                    "program": p["program"],
                    "visibility": p["visibility"],
                    "source_tcc_id": p["source_tcc_id"],
                    "created_at": p["created_at"],
                },
            )

        print("\nInserted. Active SOI ETL outbreaks by country:")
        for r in main.execute(
            text(
                """
                SELECT country, COUNT(*) n, SUM(number_outbreaks) outbreaks
                FROM risp_outbreaks
                WHERE program = 'soi' AND source_tcc_id IS NOT NULL
                  AND (location IS NULL OR location <> '__deleted__')
                GROUP BY country
                ORDER BY n DESC
                """
            )
        ).mappings():
            print(f"  {r['country']}: rows={r['n']} sum={r['outbreaks']}")

        risp_n = main.execute(
            text("SELECT COUNT(*) FROM risp_outbreaks WHERE program = 'risp'")
        ).scalar()
        print(f"\nUnchanged program=risp rows: {risp_n}")

        print("\nBy user:")
        for r in main.execute(
            text(
                """
                SELECT v.user_id, u.email, u.TCC_id, COUNT(*) n
                FROM risp_outbreaks v
                JOIN users u ON u.id = v.user_id
                WHERE v.program = 'soi' AND v.source_tcc_id IS NOT NULL
                  AND (v.location IS NULL OR v.location <> '__deleted__')
                GROUP BY v.user_id, u.email, u.TCC_id
                ORDER BY n DESC
                """
            )
        ).mappings():
            print(f"  Nexus {r['user_id']} TCC {r['TCC_id']} {r['email']}: rows={r['n']}")


if __name__ == "__main__":
    main()
