"""Recompute vaccination consistency from vacc_activities (+ Iran table)."""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from database import tcc_engine

EXPECTED = [
    "Azerbaijan, Republic of",
    "Armenia, Republic of",
    "Georgia",
    "Iran, Islamic, Republic of",
    "Iraq, Republic of",
    "Pakistan, Islamic, Republic of",
    "Russian Federation",
    "Turkey, Republic of",
]
SHORT = {
    "Azerbaijan, Republic of": "Azerbaijan",
    "Armenia, Republic of": "Armenia",
    "Georgia": "Georgia",
    "Iran, Islamic, Republic of": "Iran",
    "Iraq, Republic of": "Iraq",
    "Pakistan, Islamic, Republic of": "Pakistan",
    "Russian Federation": "Russian Federation",
    "Turkey, Republic of": "Turkey",
}
STAFF = {0, 92, 156}


def q(sql, params=None):
    with tcc_engine.connect() as conn:
        return [dict(r._mapping) for r in conn.execute(text(sql), params or {})]


def quarter_key(y, m):
    return f"{int(y):04d}-Q{(int(m) - 1) // 3 + 1}"


def main():
    today = date.today()
    # Match report windows: last 8 calendar quarters through current
    y, qq = today.year, (today.month - 1) // 3 + 1
    window = []
    for _ in range(8):
        window.append(f"{y:04d}-Q{qq}")
        qq -= 1
        if qq < 1:
            qq = 4
            y -= 1
    window = list(reversed(window))

    nations = {r["nationID"]: r["country"] for r in q("SELECT nationID, country FROM nations")}
    users = {
        r["userID"]: r
        for r in q("SELECT userID, name, familyname, nationID FROM users")
    }

    def uname(uid):
        if uid == 91:
            return "(orphan — not in users table)"
        u = users.get(uid)
        if not u:
            return f"(missing user {uid})"
        return f"{(u.get('name') or '').strip()} {(u.get('familyname') or '').strip()}".strip()

    rows = q(
        """
        SELECT n.country, a.year, a.month, a.userid AS act_user, h.userID AS hdr_user,
               COUNT(*) AS n_rows
        FROM vacc_activities a
        JOIN vacc_headers h ON a.vchid = h.vchid
        JOIN nations n ON h.nationid = n.nationID
        GROUP BY n.country, a.year, a.month, a.userid, h.userID
        """
    )

    # Iran separate table — resolve country via district→province
    irn = q(
        """
        SELECT a.year, a.month, a.userid, n.country, COUNT(*) AS n_rows
        FROM vacc_activities_irn a
        LEFT JOIN districts d ON a.districtid = d.districtID
        LEFT JOIN provinces p ON d.provinceID = p.provinceID
        LEFT JOIN nations n ON p.nationID = n.nationID
        GROUP BY a.year, a.month, a.userid, n.country
        """
    )

    quarters = defaultdict(set)
    counts = defaultdict(int)
    reporters = defaultdict(lambda: defaultdict(lambda: {"rows": 0, "quarters": set(), "months": set()}))
    months = defaultdict(set)

    def add(country, year, month, uid, n):
        if not country or not year or not month:
            return
        if not (1 <= int(month) <= 12):
            return
        qk = quarter_key(year, month)
        mk = f"{int(year):04d}-{int(month):02d}"
        quarters[country].add(qk)
        months[country].add(mk)
        counts[country] += int(n)
        if uid is None:
            return
        reporters[country][uid]["rows"] += int(n)
        reporters[country][uid]["quarters"].add(qk)
        reporters[country][uid]["months"].add(mk)

    for r in rows:
        uid = r["act_user"] if r["act_user"] is not None else r["hdr_user"]
        add(r["country"], r["year"], r["month"], uid, r["n_rows"])

    for r in irn:
        country = r["country"] or "Iran, Islamic, Republic of"
        add(country, r["year"], r["month"], r["userid"], r["n_rows"])

    summary = []
    for country in EXPECTED:
        qs = sorted(quarters.get(country, set()))
        ms = sorted(months.get(country, set()))
        hit = [x for x in window if x in set(qs)]
        miss = [x for x in window if x not in set(qs)]
        pct = round(100 * len(hit) / len(window), 1) if window else None
        people = []
        for uid, info in sorted(reporters[country].items(), key=lambda x: -x[1]["rows"]):
            people.append(
                {
                    "userID": uid,
                    "display_name": uname(uid),
                    "staff": uid in STAFF,
                    "rows": info["rows"],
                    "quarters": sorted(info["quarters"]),
                    "months_count": len(info["months"]),
                    "last_month": max(info["months"]) if info["months"] else None,
                    "last_quarter": max(info["quarters"]) if info["quarters"] else None,
                    "user_country": nations.get(users.get(uid, {}).get("nationID")) if uid in users else None,
                }
            )
        summary.append(
            {
                "country": country,
                "short": SHORT[country],
                "rows": counts.get(country, 0),
                "quarters_all": qs,
                "months_all": ms,
                "last_quarter": qs[-1] if qs else None,
                "last_month": ms[-1] if ms else None,
                "recent_window": window,
                "recent_hit": hit,
                "recent_miss": miss,
                "recent_coverage_pct": pct,
                "reporters": people,
            }
        )

    out = {
        "generated": today.isoformat(),
        "source": "vacc_activities (+ vacc_headers.nationid); Iran also vacc_activities_irn via district→province",
        "note_old_table": "vaccinations table is legacy/incomplete for cadence — stops ~2021",
        "window": window,
        "totals": {
            "vacc_activities": q("SELECT COUNT(*) AS c FROM vacc_activities")[0]["c"],
            "vacc_activities_irn": q("SELECT COUNT(*) AS c FROM vacc_activities_irn")[0]["c"],
            "vaccinations_legacy": q("SELECT COUNT(*) AS c FROM vaccinations")[0]["c"],
        },
        "year_counts_vacc_activities": q(
            "SELECT year, COUNT(*) AS c FROM vacc_activities GROUP BY year ORDER BY year"
        ),
        "country_summary": summary,
        "extra_countries": sorted(set(quarters) - set(EXPECTED)),
    }
    path = Path(__file__).resolve().parents[2] / "docs" / "tmp_soi_vacc_activities_consistency.json"
    path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print("Wrote", path)
    for c in summary:
        national = [p for p in c["reporters"] if not p["staff"]]
        staff = [p for p in c["reporters"] if p["staff"]]
        print(
            f"{c['short']}: rows={c['rows']} cov={c['recent_coverage_pct']}% "
            f"last={c['last_month']}/{c['last_quarter']} hit={c['recent_hit']}"
        )
        for p in national:
            print(f"  nat {p['userID']} {p['display_name']} rows={p['rows']} last={p['last_month']}")
        for p in staff:
            print(f"  staff {p['userID']} {p['display_name']} rows={p['rows']} last={p['last_month']}")


if __name__ == "__main__":
    main()
