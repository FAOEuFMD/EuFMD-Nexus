"""
Migrate TCC SOI reporter users into db_manager.users.

- Adds TCC_id column if missing
- Updates 3 already-matched users: set TCC_id + role=soi
- Inserts missing reporters + Pilar Rius with new auto ids, role=soi,
  password copied as-is (bcrypt), email = lower(TCC username)

Usage (from backend/):
  python scripts/migrate_tcc_users_to_db_manager.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from database import main_engine, tcc_engine  # noqa: E402

# Existing Nexus users matched by email → TCC userID
EXISTING_BY_EMAIL = {
    "abdulnaci.bulut@tarimorman.gov.tr": 131,
    "tengiz.chaligava@nfa.gov.ge": 132,
    "samir.sameer.prtb@gmail.com": 159,
}

# New inserts: TCC userIDs (reporters not already in Nexus) + Pilar Rius
INSERT_TCC_IDS = [92, 133, 134, 135, 140, 147, 153, 156, 160]

# TCC nationID / ISO3 → Nexus users.country (match countries.name_un / existing rows)
COUNTRY_BY_ISO3 = {
    "ARM": "Armenia",
    "AZE": "Azerbaijan",
    "GEO": "Georgia",
    "DEU": "Germany",
    "IRN": "Iran (Islamic Republic of)",
    "IRQ": "Iraq",
    "ITA": "Italy",
    "RUS": "Russian Federation",
    "TUR": "Türkiye",
    "ESP": "Spain",
}


def ensure_tcc_id_column(conn) -> None:
    exists = conn.execute(
        text(
            """
            SELECT COUNT(*) FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'users'
              AND COLUMN_NAME = 'TCC_id'
            """
        )
    ).scalar()
    if exists:
        print("Column users.TCC_id already exists")
        return
    conn.execute(
        text(
            """
            ALTER TABLE users
              ADD COLUMN TCC_id INT NULL COMMENT 'Source userID from TCC.users' AFTER id
            """
        )
    )
    # Note: CREATE INDEX is denied for db_manager_user on users; uniqueness
    # is enforced in this script instead.
    print("Added users.TCC_id (no unique index — privilege denied)")


def display_name(first: str | None, family: str | None, username: str) -> str:
    parts = [((first or "").strip()), ((family or "").strip())]
    name = " ".join(p for p in parts if p)
    if not name:
        name = username.split("@")[0]
    # Title-case words but keep short particles as-is when already mixed
    return " ".join(w[:1].upper() + w[1:] if w else w for w in name.split())


def resolve_country(iso3: str | None, nation_name: str | None, username: str) -> str | None:
    # Pilar: FAO / +34 — TCC nationID points at Armenia; use Spain for Nexus
    if (username or "").upper() == "PILAR.RIUSMUNOZ@FAO.ORG":
        return "Spain"
    if iso3 and iso3.upper() in COUNTRY_BY_ISO3:
        return COUNTRY_BY_ISO3[iso3.upper()]
    if nation_name:
        for _iso, label in COUNTRY_BY_ISO3.items():
            if label.lower() in (nation_name or "").lower():
                return label
    return nation_name


def main() -> None:
    all_tcc_ids = sorted(set(EXISTING_BY_EMAIL.values()) | set(INSERT_TCC_IDS))
    id_list = ", ".join(str(i) for i in all_tcc_ids)

    with tcc_engine.connect() as tcc:
        tcc_users = {
            r["userID"]: dict(r)
            for r in tcc.execute(
                text(
                    f"""
                    SELECT u.userID, u.username, u.password, u.name, u.familyname,
                           u.nationID, n.country AS nation, n.three_letter_code AS iso3
                    FROM users u
                    LEFT JOIN nations n ON n.nationID = u.nationID
                    WHERE u.userID IN ({id_list})
                    """
                )
            ).mappings()
        }

    missing = [i for i in all_tcc_ids if i not in tcc_users]
    if missing:
        raise SystemExit(f"TCC users not found: {missing}")

    with main_engine.begin() as main:
        ensure_tcc_id_column(main)

        # --- update the 3 existing matches ---
        print("\nUpdating existing users:")
        for email, tcc_id in EXISTING_BY_EMAIL.items():
            row = main.execute(
                text("SELECT id, name, email, role, TCC_id FROM users WHERE LOWER(email) = :e"),
                {"e": email.lower()},
            ).mappings().first()
            if not row:
                raise SystemExit(f"Expected existing user missing: {email}")
            main.execute(
                text(
                    """
                    UPDATE users
                    SET TCC_id = :tcc_id, role = 'soi'
                    WHERE id = :id
                    """
                ),
                {"tcc_id": tcc_id, "id": row["id"]},
            )
            print(
                f"  id={row['id']} {row['email']}: TCC_id={tcc_id}, "
                f"role {row['role']!r} -> 'soi'"
            )

        # --- insert missing reporters + Pilar ---
        print("\nInserting new users:")
        for tcc_id in INSERT_TCC_IDS:
            u = tcc_users[tcc_id]
            email = (u["username"] or "").strip().lower()
            if not email:
                raise SystemExit(f"TCC user {tcc_id} has empty username")

            already = main.execute(
                text(
                    """
                    SELECT id, email, TCC_id FROM users
                    WHERE LOWER(email) = :e OR TCC_id = :tcc_id
                    """
                ),
                {"e": email, "tcc_id": tcc_id},
            ).mappings().first()
            if already:
                print(f"  SKIP TCC {tcc_id} — already present as id={already['id']} email={already['email']}")
                # Ensure TCC_id + soi if somehow present without them
                main.execute(
                    text(
                        """
                        UPDATE users
                        SET TCC_id = COALESCE(TCC_id, :tcc_id), role = 'soi'
                        WHERE id = :id
                        """
                    ),
                    {"tcc_id": tcc_id, "id": already["id"]},
                )
                continue

            name = display_name(u["name"], u["familyname"], email)
            # Avoid UNIQUE(name) collisions
            clash = main.execute(
                text("SELECT id FROM users WHERE name = :n"), {"n": name}
            ).first()
            if clash:
                name = f"{name} (TCC {tcc_id})"

            country = resolve_country(u.get("iso3"), u.get("nation"), u["username"])
            # Prefer canonical Türkiye spelling from countries table
            if u.get("iso3") and u["iso3"].upper() == "TUR":
                tur = main.execute(
                    text("SELECT name_un FROM countries WHERE iso3 = 'TUR' LIMIT 1")
                ).scalar()
                if tur:
                    country = tur

            main.execute(
                text(
                    """
                    INSERT INTO users (name, email, password, country, role, TCC_id)
                    VALUES (:name, :email, :password, :country, 'soi', :tcc_id)
                    """
                ),
                {
                    "name": name,
                    "email": email,
                    "password": u["password"],
                    "country": country,
                    "tcc_id": tcc_id,
                },
            )
            new_id = main.execute(text("SELECT LAST_INSERT_ID()")).scalar()
            print(
                f"  inserted id={new_id} TCC_id={tcc_id} email={email} "
                f"name={name!r} country={country!r}"
            )

        print("\nVerification (users with TCC_id):")
        rows = main.execute(
            text(
                """
                SELECT id, TCC_id, name, email, role, country,
                       LENGTH(password) AS pwd_len,
                       LEFT(password, 4) AS pwd_prefix
                FROM users
                WHERE TCC_id IS NOT NULL
                ORDER BY TCC_id
                """
            )
        ).mappings().all()
        for r in rows:
            print(
                f"  Nexus id={r['id']:3d} TCC_id={r['TCC_id']:3d} role={r['role']:<4} "
                f"pwd={r['pwd_prefix']}…({r['pwd_len']}) {r['email']} | {r['name']} | {r['country']}"
            )
        print(f"Total with TCC_id: {len(rows)}")


if __name__ == "__main__":
    main()
