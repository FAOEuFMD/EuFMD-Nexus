"""Compare live DB params / monthly_pintro against corrected R CSVs."""
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import thrace_engine

R_DIR = Path(r"C:\Users\user\EUFMD\New Programme\EuFMD-Nexus\Thrace\New items\THRACE R version")


def q(sql):
    with thrace_engine.connect() as conn:
        return conn.execute(text(sql)).fetchall()


def load_csv_semicolon(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def main():
    out = {}

    # --- DB params ---
    db_params = q("SELECT disease, param, value, region FROM params ORDER BY region, disease, param")
    out["db_params_count"] = len(db_params)
    db_map = {(r[0], r[1], r[3]): float(r[2]) for r in db_params if r[2] is not None}

    # --- corrected params ---
    csv_params = load_csv_semicolon(R_DIR / "params_corrected.csv")
    out["csv_params_count"] = len(csv_params)

    # compare fsse to db value
    diffs = []
    only_in_csv = []
    for row in csv_params:
        key = (row["disease"], row["param"], row["region"])
        fsse = row.get("value_fsse")
        edsse = row.get("value_edsse")
        try:
            fsse_f = float(fsse) if fsse not in (None, "", "NA") else None
        except ValueError:
            fsse_f = None
        db_val = db_map.get(key)
        if db_val is None:
            only_in_csv.append({"key": key, "fsse": fsse, "edsse": edsse})
        elif fsse_f is not None and abs(db_val - fsse_f) > 1e-9:
            diffs.append({"key": key, "db_value": db_val, "csv_fsse": fsse_f, "csv_edsse": edsse})
    out["params_value_vs_fsse_diffs"] = diffs
    out["params_only_in_csv"] = only_in_csv

    # does fsse == edsse in csv? (where they differ matters for EDSSe)
    fsse_ne_edsse = []
    for row in csv_params:
        f = row.get("value_fsse"); e = row.get("value_edsse")
        if f != e:
            fsse_ne_edsse.append({"disease": row["disease"], "param": row["param"],
                                  "region": row["region"], "fsse": f, "edsse": e})
    out["params_fsse_ne_edsse"] = fsse_ne_edsse

    # keys in DB missing from CSV
    csv_keys = {(r["disease"], r["param"], r["region"]) for r in csv_params}
    out["params_in_db_not_csv"] = [list(k) for k in db_map.keys() if k not in csv_keys]

    # --- DB monthly_pintro ---
    db_pintro = q("SELECT year, month, pintro FROM monthly_pintro ORDER BY year, month")
    out["db_pintro_count"] = len(db_pintro)
    out["db_pintro_sample"] = [[r[0], r[1], float(r[2]) if r[2] is not None else None] for r in db_pintro[:6]]

    csv_pintro = load_csv_semicolon(R_DIR / "monthly_pintro_corrected.csv")
    out["csv_pintro_count"] = len(csv_pintro)

    # Are the 4 disease columns identical to each other in the CSV? (i.e. is disease-specific real?)
    disease_specific_rows = []
    for row in csv_pintro:
        vals = {row.get("pintro_fmd"), row.get("pintro_lsd"),
                row.get("pintro_spgp"), row.get("pintro_ppr")}
        if len(vals) > 1:
            disease_specific_rows.append({"id": row.get("id"), "year": row.get("year"),
                                          "month": row.get("month"),
                                          "fmd": row.get("pintro_fmd"), "lsd": row.get("pintro_lsd"),
                                          "spgp": row.get("pintro_spgp"), "ppr": row.get("pintro_ppr")})
    out["pintro_disease_specific_rows"] = disease_specific_rows

    # Does DB pintro match CSV pintro_fmd for matching year/month?
    db_pi_map = {(r[0], r[1]): float(r[2]) for r in db_pintro if r[2] is not None}
    pi_diffs = []
    for row in csv_pintro:
        y = row.get("year")
        y = int(y) if y not in (None, "", "NA") else None
        m = int(row["month"])
        fmd = row.get("pintro_fmd")
        try:
            fmd_f = float(fmd)
        except (ValueError, TypeError):
            fmd_f = None
        db_val = db_pi_map.get((y, m))
        if db_val is not None and fmd_f is not None and abs(db_val - fmd_f) > 1e-6:
            pi_diffs.append({"year": y, "month": m, "db": db_val, "csv_fmd": fmd_f})
    out["pintro_db_vs_csv_fmd_diffs"] = pi_diffs[:30]
    out["pintro_db_vs_csv_fmd_diff_count"] = len(pi_diffs)

    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    main()
