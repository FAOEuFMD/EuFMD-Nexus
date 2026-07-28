"""Convert the corrected R reference CSVs into clean comma-delimited files
shipped under backend/data/thrace/ and emit risk_levels.json.

Run once when the corrected model config changes. Source files live in the
gitignored Thrace/New items folder; the outputs are version-controlled.
"""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
R_DIR = ROOT / "Thrace" / "New items" / "THRACE R version"
OUT = ROOT / "backend" / "data" / "thrace"
OUT.mkdir(parents=True, exist_ok=True)


def read_semicolon(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def num_or_blank(v):
    if v is None:
        return ""
    v = v.strip()
    if v in ("", "NA"):
        return ""
    return v


def make_params():
    rows = read_semicolon(R_DIR / "params_corrected.csv")
    out_path = OUT / "params.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["disease", "param", "value_fsse", "value_edsse", "region"])
        for r in rows:
            w.writerow([r["disease"], r["param"],
                        num_or_blank(r.get("value_fsse")),
                        num_or_blank(r.get("value_edsse")),
                        r["region"]])
    print(f"wrote {out_path} ({len(rows)} rows)")


def make_pintro():
    rows = read_semicolon(R_DIR / "monthly_pintro_corrected.csv")
    out_path = OUT / "monthly_pintro.csv"
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["year", "month", "pintro_fmd", "pintro_lsd", "pintro_spgp", "pintro_ppr"])
        for r in rows:
            w.writerow([num_or_blank(r.get("year")), r["month"],
                        num_or_blank(r.get("pintro_fmd")),
                        num_or_blank(r.get("pintro_lsd")),
                        num_or_blank(r.get("pintro_spgp")),
                        num_or_blank(r.get("pintro_ppr"))])
    print(f"wrote {out_path} ({len(rows)} rows)")


def make_risk_levels():
    """Risk assignment lists transcribed from update_database_R_corrected.R (lines 172-205)."""
    risk = {
        "_source": "update_database_R_corrected.R lines 168-209",
        "bgr_high_epiunit_ids": [2145, 2153, 2150, 2159, 2162, 2147, 2156, 2149, 2164, 2160,
                                 2152, 2155, 2158, 2157, 2154, 2148, 2151, 2163, 2146, 2161],
        "grc_high_districts": ["ORESTIADA", "DIDYMOTEICHO", "FERES", "ALEXANDROUPOLI"],
        "grc_low_districts": ["SOUFLI"],
        "tur_high_provinces": ["ISTANBUL"],
        "tur_low_provinces": ["CANAKKALE", "EDIRNE", "KIRKLARELI", "TEKIRDAG"],
    }
    out_path = OUT / "risk_levels.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(risk, f, indent=2)
    print(f"wrote {out_path}")


if __name__ == "__main__":
    make_params()
    make_pintro()
    make_risk_levels()
