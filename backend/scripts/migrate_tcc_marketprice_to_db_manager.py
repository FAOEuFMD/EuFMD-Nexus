"""
Migrate TCC marketprice (wide) → db_manager.risp_marketprice (normalized).

Rules:
  - user_id  = users.id WHERE users.TCC_id = marketprice.userID
  - country  = countries.name_un via nations.three_letter_code (row nationID),
               NOT the user's home country (staff may submit for other countries)
  - year/quarter from marketprice_period.dt_from (quarter-end date)
  - One TCC wide row → up to 12 normalized lines (species × level × product)
    when at least one of min/max/avg is non-null
  - program='soi', visibility='public'
  - source_tcc_id = mpID, source_tcc_period_id = periodID

Usage (from backend/):
  python scripts/migrate_tcc_marketprice_to_db_manager.py
  python scripts/migrate_tcc_marketprice_to_db_manager.py --dry-run
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from database import main_engine, tcc_engine  # noqa: E402

SPECIES_MAP = {"ctl": "cattle", "shp": "sheep", "pig": "pig"}
LEVEL_MAP = {"dis": "district", "cap": "capital"}
PRODUCTS = ("live", "meat")

# (species_code, level_code, product) → column prefixes already encode this
DIMS = [
    (sp, lvl, prod)
    for sp in SPECIES_MAP
    for lvl in LEVEL_MAP
    for prod in PRODUCTS
]


def _num(val) -> float | None:
    if val is None:
        return None
    if isinstance(val, Decimal):
        return float(val)
    try:
        f = float(val)
    except (TypeError, ValueError):
        return None
    return f


def period_year_quarter(dt_from: date | datetime | None, descrizione: str | None) -> tuple[str, str]:
    """Derive year + Q1–Q4 from period end date (preferred) or descrizione."""
    if isinstance(dt_from, datetime):
        dt_from = dt_from.date()
    if isinstance(dt_from, date):
        year = str(dt_from.year)
        month = dt_from.month
        q = 1 if month <= 3 else 2 if month <= 6 else 3 if month <= 9 else 4
        return year, f"Q{q}"

    # Fallback: "21-I Q", "26 II Q", "25-III Q"
    s = (descrizione or "").strip().upper()
    m = re.match(r"^(\d{2})\s*-?\s*(I{1,3}|IV)\s*Q$", s)
    if not m:
        m = re.match(r"^(\d{2})\s+(I{1,3}|IV)\s*Q$", s)
    if m:
        yy = int(m.group(1))
        roman = m.group(2)
        qmap = {"I": 1, "II": 2, "III": 3, "IV": 4}
        return str(2000 + yy), f"Q{qmap[roman]}"
    raise ValueError(f"Cannot parse period: dt_from={dt_from!r} descrizione={descrizione!r}")


def expand_wide_row(row: dict) -> list[dict]:
    """Unpivot one TCC wide row into normalized price lines."""
    lines: list[dict] = []
    for sp, lvl, prod in DIMS:
        prefix = f"{sp}_{lvl}_{prod}"
        pmin = _num(row.get(f"{prefix}MIN"))
        pmax = _num(row.get(f"{prefix}MAX"))
        pavg = _num(row.get(f"{prefix}AVG"))
        if pmin is None and pmax is None and pavg is None:
            continue
        lines.append(
            {
                "species": SPECIES_MAP[sp],
                "market_level": LEVEL_MAP[lvl],
                "product": prod,
                "price_min": pmin,
                "price_max": pmax,
                "price_avg": pavg,
            }
        )
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Parse and report only; do not write to db_manager",
    )
    args = parser.parse_args()

    with tcc_engine.connect() as tcc:
        rows = [
            dict(r)
            for r in tcc.execute(
                text(
                    """
                    SELECT mp.*, n.three_letter_code AS iso3, n.country AS tcc_country,
                           p.descrizione AS period_label, p.dt_from AS period_dt_from
                    FROM marketprice mp
                    LEFT JOIN nations n ON n.nationID = mp.nationID
                    LEFT JOIN marketprice_period p ON p.periodID = mp.periodID
                    ORDER BY mp.mpID
                    """
                )
            ).mappings()
        ]

    print(f"TCC marketprice wide rows: {len(rows)}")

    with main_engine.connect() as main:
        user_map = {
            int(r["TCC_id"]): {
                "id": int(r["id"]),
                "email": r["email"],
                "country": r["country"],
            }
            for r in main.execute(
                text("SELECT id, TCC_id, email, country FROM users WHERE TCC_id IS NOT NULL")
            ).mappings()
            if r["TCC_id"] is not None
        }
        country_by_iso = {
            (r["iso3"] or "").upper(): r["name_un"]
            for r in main.execute(
                text("SELECT iso3, name_un FROM countries WHERE soi = 1 AND iso3 IS NOT NULL")
            ).mappings()
        }

    print(f"Nexus users with TCC_id: {len(user_map)}")
    print(f"SOI countries by ISO3: {sorted(country_by_iso)}")

    missing_users: set[int] = set()
    missing_iso: set[str] = set()
    prepared: list[dict] = []
    skipped_empty = 0

    for row in rows:
        tcc_uid = row.get("userID")
        if tcc_uid is None:
            raise SystemExit(f"mpID={row['mpID']}: missing userID")
        tcc_uid = int(tcc_uid)
        nexus_user = user_map.get(tcc_uid)
        if not nexus_user:
            missing_users.add(tcc_uid)
            continue

        iso3 = (row.get("iso3") or "").upper()
        country = country_by_iso.get(iso3)
        if not country:
            missing_iso.add(iso3 or f"nationID={row.get('nationID')}")
            continue

        year, quarter = period_year_quarter(row.get("period_dt_from"), row.get("period_label"))
        lines = expand_wide_row(row)
        if not lines:
            skipped_empty += 1
            continue

        created = row.get("dt_inival")
        if isinstance(created, date) and not isinstance(created, datetime):
            created = datetime(created.year, created.month, created.day)
        if created is None:
            created = datetime.utcnow()

        for line in lines:
            prepared.append(
                {
                    "user_id": nexus_user["id"],
                    "tcc_user_id": tcc_uid,
                    "user_email": nexus_user["email"],
                    "country": country,
                    "iso3": iso3,
                    "year": year,
                    "quarter": quarter,
                    "species": line["species"],
                    "market_level": line["market_level"],
                    "product": line["product"],
                    "price_min": line["price_min"],
                    "price_max": line["price_max"],
                    "price_avg": line["price_avg"],
                    "reference": (row.get("reference") or None),
                    "program": "soi",
                    "visibility": "public",
                    "source_tcc_id": int(row["mpID"]),
                    "source_tcc_period_id": int(row["periodID"]) if row.get("periodID") is not None else None,
                    "created_at": created,
                    "updated_at": created,
                }
            )

    if missing_users:
        raise SystemExit(f"Abort: TCC userIDs with marketprice but no Nexus TCC_id map: {sorted(missing_users)}")
    if missing_iso:
        raise SystemExit(f"Abort: unknown ISO3 / nation for marketprice rows: {sorted(missing_iso)}")

    # Attribution summary
    by_country: dict[str, int] = {}
    by_user: dict[str, int] = {}
    for p in prepared:
        by_country[p["country"]] = by_country.get(p["country"], 0) + 1
        key = f"{p['user_id']}:{p['user_email']}"
        by_user[key] = by_user.get(key, 0) + 1

    print(f"\nNormalized lines to insert: {len(prepared)}")
    print(f"Wide rows with no prices: {skipped_empty}")
    print("\nBy country (from row nationID):")
    for k in sorted(by_country):
        print(f"  {k}: {by_country[k]}")
    print("\nBy Nexus user (from TCC userID map):")
    for k in sorted(by_user, key=lambda x: int(x.split(":")[0])):
        print(f"  {k}: {by_user[k]}")

    # Spot-check: staff Vitelli rows should keep Iraq/Georgia/etc country, user=Vitelli
    vitelli = [p for p in prepared if p["tcc_user_id"] == 92]
    vitelli_countries = sorted({p["country"] for p in vitelli})
    print(f"\nVitelli (TCC 92) lines: {len(vitelli)} across countries {vitelli_countries}")

    if args.dry_run:
        print("\nDRY RUN — no writes.")
        return

    with main_engine.begin() as main:
        existing = main.execute(
            text("SELECT COUNT(*) FROM risp_marketprice WHERE source_tcc_id IS NOT NULL")
        ).scalar()
        if existing:
            # Prefer hard delete of prior ETL rows; fall back to soft-delete marker if denied
            try:
                main.execute(text("DELETE FROM risp_marketprice WHERE source_tcc_id IS NOT NULL"))
                print(f"Cleared {existing} previous ETL rows (DELETE)")
            except Exception as exc:
                print(f"DELETE not allowed ({exc}); soft-deleting prior ETL rows instead")
                main.execute(
                    text(
                        """
                        UPDATE risp_marketprice
                        SET reference = '__deleted__',
                            price_min = NULL, price_max = NULL, price_avg = NULL,
                            updated_at = NOW()
                        WHERE source_tcc_id IS NOT NULL
                          AND (reference IS NULL OR reference <> '__deleted__')
                        """
                    )
                )

        insert_sql = text(
            """
            INSERT INTO risp_marketprice (
              user_id, country, year, quarter,
              species, market_level, product,
              price_min, price_max, price_avg,
              reference,
              program, visibility,
              source_tcc_id, source_tcc_period_id,
              created_at, updated_at
            ) VALUES (
              :user_id, :country, :year, :quarter,
              :species, :market_level, :product,
              :price_min, :price_max, :price_avg,
              :reference,
              :program, :visibility,
              :source_tcc_id, :source_tcc_period_id,
              :created_at, :updated_at
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
                    "species": p["species"],
                    "market_level": p["market_level"],
                    "product": p["product"],
                    "price_min": p["price_min"],
                    "price_max": p["price_max"],
                    "price_avg": p["price_avg"],
                    "reference": p["reference"],
                    "program": p["program"],
                    "visibility": p["visibility"],
                    "source_tcc_id": p["source_tcc_id"],
                    "source_tcc_period_id": p["source_tcc_period_id"],
                    "created_at": p["created_at"],
                    "updated_at": p["updated_at"],
                },
            )

        total = main.execute(text("SELECT COUNT(*) FROM risp_marketprice")).scalar()
        etl = main.execute(
            text(
                """
                SELECT COUNT(*) FROM risp_marketprice
                WHERE source_tcc_id IS NOT NULL
                  AND (reference IS NULL OR reference <> '__deleted__')
                """
            )
        ).scalar()
        print(f"\nInserted. Active ETL rows: {etl} (table total: {total})")

        print("\nVerification by country:")
        for r in main.execute(
            text(
                """
                SELECT country, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users,
                       COUNT(DISTINCT source_tcc_id) AS wide_parents
                FROM risp_marketprice
                WHERE source_tcc_id IS NOT NULL
                  AND (reference IS NULL OR reference <> '__deleted__')
                GROUP BY country
                ORDER BY country
                """
            )
        ).mappings():
            print(f"  {r['country']}: lines={r['n']} users={r['users']} parents={r['wide_parents']}")

        print("\nVerification by user:")
        for r in main.execute(
            text(
                """
                SELECT m.user_id, u.email, u.TCC_id, COUNT(*) AS n,
                       COUNT(DISTINCT m.country) AS countries
                FROM risp_marketprice m
                JOIN users u ON u.id = m.user_id
                WHERE m.source_tcc_id IS NOT NULL
                  AND (m.reference IS NULL OR m.reference <> '__deleted__')
                GROUP BY m.user_id, u.email, u.TCC_id
                ORDER BY u.TCC_id
                """
            )
        ).mappings():
            print(
                f"  Nexus {r['user_id']} TCC {r['TCC_id']} {r['email']}: "
                f"lines={r['n']} countries={r['countries']}"
            )


if __name__ == "__main__":
    main()
