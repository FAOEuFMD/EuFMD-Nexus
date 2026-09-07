"""
Temporary script: TCC SOI reporting consistency analysis.
Expected: outbreaks monthly; market price & vaccination every 3 months.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text

from database import tcc_engine

EXPECTED_COUNTRIES = [
    "Azerbaijan, Republic of",
    "Armenia, Republic of",
    "Georgia",
    "Iran, Islamic, Republic of",
    "Iraq, Republic of",
    "Pakistan, Islamic, Republic of",
    "Russian Federation",
    "Turkey, Republic of",
]

EXPECTED_SHORT = {
    "Azerbaijan, Republic of": "Azerbaijan",
    "Armenia, Republic of": "Armenia",
    "Georgia": "Georgia",
    "Iran, Islamic, Republic of": "Iran",
    "Iraq, Republic of": "Iraq",
    "Pakistan, Islamic, Republic of": "Pakistan",
    "Russian Federation": "Russian Federation",
    "Turkey, Republic of": "Turkey",
}

# Known EuFMD / non-national accounts that upload on behalf of countries
STAFF_USER_IDS = {0, 92, 156}  # missing user 0, andrea vitelli, ROBERTO CONDOLEO


def q(sql: str, params=None):
    with tcc_engine.connect() as conn:
        return [dict(r._mapping) for r in conn.execute(text(sql), params or {})]


def month_key(y, m):
    return f"{int(y):04d}-{int(m):02d}"


def quarter_key(y, m=None, q=None):
    if q is None:
        q = (int(m) - 1) // 3 + 1
    return f"{int(y):04d}-Q{int(q)}"


def as_date(val):
    if val is None or val == "":
        return None
    if isinstance(val, datetime):
        return val.date()
    if isinstance(val, date):
        return val
    if isinstance(val, str):
        s = val.strip()[:10]
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y/%m/%d"):
            try:
                return datetime.strptime(s, fmt).date()
            except ValueError:
                continue
    return None


def months_between(start_ym: str, end_ym: str):
    sy, sm = map(int, start_ym.split("-"))
    ey, em = map(int, end_ym.split("-"))
    out = []
    y, m = sy, sm
    while (y, m) <= (ey, em):
        out.append(month_key(y, m))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return out


def quarters_between(start_q: str, end_q: str):
    sy, sq = int(start_q[:4]), int(start_q[-1])
    ey, eq = int(end_q[:4]), int(end_q[-1])
    out = []
    y, qq = sy, sq
    while (y, qq) <= (ey, eq):
        out.append(f"{y:04d}-Q{qq}")
        qq += 1
        if qq > 4:
            qq = 1
            y += 1
    return out


def last_n_months(end: date, n: int):
    y, m = end.year, end.month
    # step back n-1 months
    for _ in range(n - 1):
        m -= 1
        if m < 1:
            m = 12
            y -= 1
    return months_between(month_key(y, m), month_key(end.year, end.month))


def last_n_quarters(end: date, n: int):
    q = (end.month - 1) // 3 + 1
    y = end.year
    keys = []
    for _ in range(n):
        keys.append(f"{y:04d}-Q{q}")
        q -= 1
        if q < 1:
            q = 4
            y -= 1
    return list(reversed(keys))


def coverage(reported: set, window: list):
    if not window:
        return None, [], []
    hit = [x for x in window if x in reported]
    miss = [x for x in window if x not in reported]
    pct = round(100 * len(hit) / len(window), 1)
    return pct, hit, miss


def main():
    today = date.today()

    nations = q("SELECT nationID, country FROM nations")
    nations_by_id = {r["nationID"]: r["country"] for r in nations}
    nation_id_by_country = {r["country"]: r["nationID"] for r in nations}

    users = q(
        "SELECT userID, username, name, familyname, nationID, countrycode, institution, role, "
        "dt_lastlogin, dt_inival, dt_finval FROM users"
    )
    users_by_id = {r["userID"]: r for r in users}

    outbreaks = q(
        """
        SELECT o.outbreakID, o.userID, o.nationID AS row_nationID, o.districtID,
               o.epiunit, o.dt_susp, o.dt_conf, o.dt_inival,
               d.district_name, p.province_name, p.nationID AS province_nationID
        FROM outbreaks o
        LEFT JOIN districts d ON o.districtID = d.districtID
        LEFT JOIN provinces p ON d.provinceID = p.provinceID
        """
    )

    vaccinations = q(
        """
        SELECT vaccinationID, userID, nationID, provinceID, districtID,
               dt_vacci, month_vacc, dt_inival
        FROM vaccinations
        """
    )

    market = q(
        """
        SELECT mp.mpID, mp.userID, mp.nationID, mp.periodID,
               p.descrizione, p.dt_from, mp.dt_inival
        FROM marketprice mp
        LEFT JOIN marketprice_period p ON mp.periodID = p.periodID
        """
    )
    periods = q("SELECT periodID, descrizione, dt_from FROM marketprice_period ORDER BY dt_from")
    # Only periods that have started / are due (dt_from <= today)
    due_periods = [p for p in periods if as_date(p["dt_from"]) and as_date(p["dt_from"]) <= today]

    def resolve_outbreak_country(r):
        row_nid = r.get("row_nationID")
        if row_nid and row_nid in nations_by_id and row_nid != 0:
            return nations_by_id[row_nid], "row_nationID"
        prov_nid = r.get("province_nationID")
        if prov_nid and prov_nid in nations_by_id:
            return nations_by_id[prov_nid], "district→province"
        uid = r.get("userID")
        u = users_by_id.get(uid)
        if u and u.get("nationID") in nations_by_id:
            return nations_by_id[u["nationID"]], "user.nationID"
        if uid == 91:
            # majority of orphan user 91 is Iraq via IRAQ-DISTRICTS; leftover unresolved
            return "(unresolved — orphan userID 91)", "orphan_unresolved"
        return "(unknown)", "unresolved"

    def user_display(uid):
        if uid == 91:
            return {
                "userID": 91,
                "display_name": "(orphan — not in users table)",
                "name": None,
                "familyname": None,
                "user_nationID": None,
                "user_country": None,
                "staff_or_orphan": True,
                "note": "userID 91 missing from users; most rows resolve to Iraq via district IRAQ-DISTRICTS → IRAQ-PROVINCE",
            }
        u = users_by_id.get(uid)
        if not u:
            return {
                "userID": uid,
                "display_name": f"(missing user {uid})",
                "name": None,
                "familyname": None,
                "user_nationID": None,
                "user_country": None,
                "staff_or_orphan": uid in STAFF_USER_IDS,
                "note": "userID not found in users",
            }
        name = (u.get("name") or "").strip()
        fam = (u.get("familyname") or "").strip()
        return {
            "userID": uid,
            "display_name": f"{name} {fam}".strip() or u.get("username") or f"user {uid}",
            "name": name,
            "familyname": fam,
            "user_nationID": u.get("nationID"),
            "user_country": nations_by_id.get(u.get("nationID")),
            "staff_or_orphan": uid in STAFF_USER_IDS,
            "note": None,
        }

    # Aggregate
    reporters = {}  # uid -> profile
    outbreak_months_by_country = defaultdict(set)
    outbreak_rows_by_country = defaultdict(int)
    outbreak_users_by_country = defaultdict(set)
    outbreak_resolve_method = defaultdict(int)

    vacc_quarters_by_country = defaultdict(set)
    vacc_rows_by_country = defaultdict(int)
    vacc_users_by_country = defaultdict(set)

    market_quarters_by_country = defaultdict(set)
    market_rows_by_country = defaultdict(int)
    market_users_by_country = defaultdict(set)
    market_period_labels_by_country = defaultdict(set)

    # Per-reporter country activity (because staff upload for many countries)
    reporter_by_country = defaultdict(lambda: defaultdict(lambda: {
        "outbreaks": 0, "vaccinations": 0, "marketprice": 0,
        "outbreak_months": set(), "vacc_quarters": set(), "market_quarters": set(),
    }))

    def touch(uid):
        if uid not in reporters:
            reporters[uid] = user_display(uid)
            reporters[uid].update({
                "outbreaks": 0,
                "vaccinations": 0,
                "marketprice": 0,
                "countries_touched": set(),
                "first_activity": None,
                "last_activity": None,
            })
        return reporters[uid]

    def bump(prof, dt):
        dt = as_date(dt)
        if not dt:
            return
        if prof["first_activity"] is None or dt < prof["first_activity"]:
            prof["first_activity"] = dt
        if prof["last_activity"] is None or dt > prof["last_activity"]:
            prof["last_activity"] = dt

    for r in outbreaks:
        uid = r["userID"]
        prof = touch(uid)
        country, method = resolve_outbreak_country(r)
        outbreak_resolve_method[method] += 1
        dt = as_date(r["dt_susp"]) or as_date(r["dt_conf"]) or as_date(r["dt_inival"])
        prof["outbreaks"] += 1
        prof["countries_touched"].add(country)
        bump(prof, dt)
        outbreak_rows_by_country[country] += 1
        outbreak_users_by_country[country].add(uid)
        rc = reporter_by_country[uid][country]
        rc["outbreaks"] += 1
        if dt:
            mk = month_key(dt.year, dt.month)
            outbreak_months_by_country[country].add(mk)
            rc["outbreak_months"].add(mk)

    for r in vaccinations:
        uid = r["userID"]
        prof = touch(uid)
        country = nations_by_id.get(r["nationID"]) or "(unknown)"
        prof["vaccinations"] += 1
        prof["countries_touched"].add(country)
        vacc_rows_by_country[country] += 1
        vacc_users_by_country[country].add(uid)
        rc = reporter_by_country[uid][country]
        rc["vaccinations"] += 1

        dt = as_date(r["dt_vacci"]) or as_date(r["dt_inival"])
        bump(prof, dt)
        y = m = None
        if r.get("month_vacc") not in (None, ""):
            try:
                m = int(r["month_vacc"])
            except (TypeError, ValueError):
                m = None
            if m is not None and dt:
                y = dt.year
            elif m is not None:
                dti = as_date(r.get("dt_inival"))
                y = dti.year if dti else None
        if y is None and dt:
            y, m = dt.year, dt.month
        if y and m and 1 <= int(m) <= 12:
            qk = quarter_key(y, int(m))
            vacc_quarters_by_country[country].add(qk)
            rc["vacc_quarters"].add(qk)

    for r in market:
        if r["userID"] is None:
            continue
        uid = int(r["userID"])
        prof = touch(uid)
        country = nations_by_id.get(r["nationID"]) or "(unknown)"
        prof["marketprice"] += 1
        prof["countries_touched"].add(country)
        market_rows_by_country[country] += 1
        market_users_by_country[country].add(uid)
        rc = reporter_by_country[uid][country]
        rc["marketprice"] += 1

        dtf = as_date(r.get("dt_from")) or as_date(r.get("dt_inival"))
        bump(prof, dtf)
        if dtf:
            qk = quarter_key(dtf.year, dtf.month)
            market_quarters_by_country[country].add(qk)
            rc["market_quarters"].add(qk)
            label = r.get("descrizione") or str(r.get("periodID"))
            market_period_labels_by_country[country].add(f"{qk} ({label})")

    # Windows
    recent_ob_window = last_n_months(today, 24)
    recent_q_window = last_n_quarters(today, 8)

    # Market due quarters from catalog (period dt_from)
    market_due_quarters = []
    for p in due_periods:
        dtf = as_date(p["dt_from"])
        if dtf:
            market_due_quarters.append(quarter_key(dtf.year, dtf.month))
    # unique preserve order
    seen = set()
    market_due_quarters_u = []
    for x in market_due_quarters:
        if x not in seen:
            seen.add(x)
            market_due_quarters_u.append(x)
    market_due_quarters = market_due_quarters_u
    recent_market_window = [x for x in market_due_quarters if x in set(recent_q_window)] or market_due_quarters[-8:]

    # Full windows from expected-country activity
    exp_ob = sorted(m for c in EXPECTED_COUNTRIES for m in outbreak_months_by_country.get(c, set()))
    exp_vac = sorted(m for c in EXPECTED_COUNTRIES for m in vacc_quarters_by_country.get(c, set()))
    full_ob_window = months_between(exp_ob[0], exp_ob[-1]) if exp_ob else []
    full_vac_window = quarters_between(exp_vac[0], exp_vac[-1]) if exp_vac else []
    full_market_window = list(market_due_quarters)

    country_summary = []
    for country in EXPECTED_COUNTRIES:
        ob_set = outbreak_months_by_country.get(country, set())
        vac_set = vacc_quarters_by_country.get(country, set())
        mp_set = market_quarters_by_country.get(country, set())

        ob_pct_r, ob_hit_r, ob_miss_r = coverage(ob_set, recent_ob_window)
        vac_pct_r, vac_hit_r, vac_miss_r = coverage(vac_set, recent_q_window)
        mp_pct_r, mp_hit_r, mp_miss_r = coverage(mp_set, recent_market_window)

        ob_pct_f, _, ob_miss_f = coverage(ob_set, full_ob_window)
        vac_pct_f, _, vac_miss_f = coverage(vac_set, full_vac_window)
        mp_pct_f, _, mp_miss_f = coverage(mp_set, full_market_window)

        # National reporters (exclude staff accounts from "primary reporter" list but still show)
        national = []
        staff = []
        for uid in sorted(
            outbreak_users_by_country.get(country, set())
            | vacc_users_by_country.get(country, set())
            | market_users_by_country.get(country, set())
        ):
            info = reporters[uid]
            rc = reporter_by_country[uid][country]
            entry = {
                "userID": uid,
                "display_name": info["display_name"],
                "outbreaks": rc["outbreaks"],
                "vaccinations": rc["vaccinations"],
                "marketprice": rc["marketprice"],
                "outbreak_months": sorted(rc["outbreak_months"]),
                "vacc_quarters": sorted(rc["vacc_quarters"]),
                "market_quarters": sorted(rc["market_quarters"]),
                "note": info.get("note"),
            }
            if info.get("staff_or_orphan") and uid != 91:
                staff.append(entry)
            elif uid == 91:
                # orphan: treat as national for Iraq-attributed rows, but flag
                national.append(entry)
            else:
                # if user's home country differs, still list under activity country
                national.append(entry)

        last_ob = max(ob_set) if ob_set else None
        last_vac = max(vac_set) if vac_set else None
        last_mp = max(mp_set) if mp_set else None

        country_summary.append({
            "country": country,
            "short": EXPECTED_SHORT[country],
            "nationID": nation_id_by_country.get(country),
            "reporters_national": national,
            "reporters_staff": staff,
            "outbreak_rows": outbreak_rows_by_country.get(country, 0),
            "vaccination_rows": vacc_rows_by_country.get(country, 0),
            "market_rows": market_rows_by_country.get(country, 0),
            "outbreak_months_all": sorted(ob_set),
            "vacc_quarters_all": sorted(vac_set),
            "market_quarters_all": sorted(mp_set),
            "market_period_labels": sorted(market_period_labels_by_country.get(country, set())),
            "last_outbreak_month": last_ob,
            "last_vacc_quarter": last_vac,
            "last_market_quarter": last_mp,
            "recent_24m": {
                "outbreak_coverage_pct": ob_pct_r,
                "outbreak_reported": ob_hit_r,
                "outbreak_missing": ob_miss_r,
                "vacc_coverage_pct": vac_pct_r,
                "vacc_reported": vac_hit_r,
                "vacc_missing": vac_miss_r,
                "market_coverage_pct": mp_pct_r,
                "market_reported": mp_hit_r,
                "market_missing": mp_miss_r,
            },
            "full_history": {
                "outbreak_coverage_pct": ob_pct_f,
                "outbreak_missing_count": len(ob_miss_f) if ob_miss_f is not None else None,
                "vacc_coverage_pct": vac_pct_f,
                "vacc_missing": vac_miss_f,
                "market_coverage_pct": mp_pct_f,
                "market_missing": mp_miss_f,
            },
        })

    reporter_list = []
    for uid, p in sorted(reporters.items(), key=lambda x: ((x[1].get("user_country") or ""), x[0])):
        by_c = []
        for cname, rc in sorted(reporter_by_country[uid].items()):
            by_c.append({
                "country": cname,
                "outbreaks": rc["outbreaks"],
                "vaccinations": rc["vaccinations"],
                "marketprice": rc["marketprice"],
                "outbreak_months": sorted(rc["outbreak_months"]),
                "vacc_quarters": sorted(rc["vacc_quarters"]),
                "market_quarters": sorted(rc["market_quarters"]),
            })
        reporter_list.append({
            "userID": uid,
            "display_name": p["display_name"],
            "user_nationID": p.get("user_nationID"),
            "user_country": p.get("user_country"),
            "staff_or_orphan": p.get("staff_or_orphan"),
            "note": p.get("note"),
            "outbreaks": p["outbreaks"],
            "vaccinations": p["vaccinations"],
            "marketprice": p["marketprice"],
            "countries_touched": sorted(p["countries_touched"]),
            "by_country": by_c,
            "first_activity": p["first_activity"].isoformat() if p["first_activity"] else None,
            "last_activity": p["last_activity"].isoformat() if p["last_activity"] else None,
        })

    expected_nation_ids = {nation_id_by_country[c] for c in EXPECTED_COUNTRIES if c in nation_id_by_country}
    reporting_user_ids = set(reporters.keys())
    silent_users = []
    for u in users:
        if u["nationID"] in expected_nation_ids and u["userID"] not in reporting_user_ids:
            login = as_date(u.get("dt_lastlogin"))
            silent_users.append({
                "userID": u["userID"],
                "display_name": f"{(u.get('name') or '').strip()} {(u.get('familyname') or '').strip()}".strip(),
                "username": u.get("username"),
                "nationID": u["nationID"],
                "country": nations_by_id.get(u["nationID"]),
                "role": u.get("role"),
                "institution": u.get("institution"),
                "dt_lastlogin": login.isoformat() if login and login.year < 9000 else None,
            })

    # Orphan user 91 district breakdown
    u91 = defaultdict(int)
    for r in outbreaks:
        if r["userID"] != 91:
            continue
        country, _ = resolve_outbreak_country(r)
        u91[country] += 1

    out = {
        "generated": today.isoformat(),
        "expectations": {
            "outbreaks": "monthly",
            "vaccination": "every 3 months (quarterly)",
            "marketprice": "every 3 months (quarterly)",
            "countries": EXPECTED_COUNTRIES,
        },
        "methodology": {
            "outbreak_country": "Prefer outbreaks.nationID when >0; else districts→provinces.nationID; else users.nationID",
            "outbreak_month": "COALESCE(dt_susp, dt_conf, dt_inival)",
            "vacc_quarter": "month_vacc + year from dt_vacci/dt_inival, else dt_vacci/dt_inival",
            "market_quarter": "marketprice_period.dt_from",
            "recent_windows": {
                "outbreaks": "last 24 calendar months through today",
                "vaccination": "last 8 calendar quarters through today",
                "marketprice": "last 8 due market periods (dt_from <= today)",
            },
            "staff_user_ids": sorted(STAFF_USER_IDS),
        },
        "orphan_user_91": {
            "outbreak_rows": sum(1 for r in outbreaks if r["userID"] == 91),
            "rows_by_resolved_country": dict(sorted(u91.items(), key=lambda x: -x[1])),
            "note": "Not in users table; 329/385 rows are district IRAQ-DISTRICTS → Iraq; remaining mix of Turkey/Iran/Armenia via province",
        },
        "outbreak_nation_resolution": dict(outbreak_resolve_method),
        "windows": {
            "recent_outbreak_months": recent_ob_window,
            "recent_quarters": recent_q_window,
            "recent_market_quarters": recent_market_window,
            "full_outbreak_months": [full_ob_window[0], full_ob_window[-1], len(full_ob_window)] if full_ob_window else None,
            "full_vacc_quarters": full_vac_window,
            "full_market_quarters": full_market_window,
        },
        "totals": {
            "outbreak_rows": len(outbreaks),
            "vaccination_rows": len(vaccinations),
            "marketprice_rows": len(market),
            "reporters": len(reporters),
            "users_total": len(users),
            "silent_users_in_expected_countries": len(silent_users),
        },
        "country_summary": country_summary,
        "reporters": reporter_list,
        "silent_users": silent_users,
        "extra_countries_in_data": sorted(
            (set(outbreak_rows_by_country) | set(vacc_rows_by_country) | set(market_rows_by_country))
            - set(EXPECTED_COUNTRIES)
            - {"(unknown)", "(unresolved — orphan userID 91)"}
        ),
        "market_period_catalog_due": [
            {
                "periodID": p["periodID"],
                "descrizione": p["descrizione"],
                "dt_from": as_date(p["dt_from"]).isoformat(),
                "quarter": quarter_key(as_date(p["dt_from"]).year, as_date(p["dt_from"]).month),
            }
            for p in due_periods
        ],
    }

    out_path = Path(__file__).resolve().parents[2] / "docs" / "tmp_soi_reporting_consistency.json"
    out_path.write_text(json.dumps(out, indent=2, default=str), encoding="utf-8")
    print(f"Wrote {out_path}")
    print("Resolution:", dict(outbreak_resolve_method))
    print("user91:", dict(u91))
    for c in country_summary:
        r = c["recent_24m"]
        names = ", ".join(x["display_name"] for x in c["reporters_national"]) or "—"
        print(
            f"{c['short']}: OB {r['outbreak_coverage_pct']}% VAC {r['vacc_coverage_pct']}% MP {r['market_coverage_pct']}% "
            f"| last OB {c['last_outbreak_month']} VAC {c['last_vacc_quarter']} MP {c['last_market_quarter']} "
            f"| {names}"
        )


if __name__ == "__main__":
    main()
