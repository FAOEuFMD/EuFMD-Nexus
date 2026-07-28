"""One-off Thrace DB audit and Nexus calculator smoke test."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from database import thrace_engine
from routers.thrace_calculator import ThraceCalculator


def q(sql, params=None):
    with thrace_engine.connect() as conn:
        return conn.execute(text(sql), params or {}).fetchall()


def main():
    out = {}

    cols = q(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'params' ORDER BY ORDINAL_POSITION"
    )
    out["params_columns"] = [c[0] for c in cols]

    cols = q(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'monthly_pintro' ORDER BY ORDINAL_POSITION"
    )
    out["monthly_pintro_columns"] = [c[0] for c in cols]

    cols = q(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'factivities' AND COLUMN_NAME LIKE '%tested%'"
    )
    out["factivities_tested_cols"] = [c[0] for c in cols]

    cols = q(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS "
        "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'epiunits' AND COLUMN_NAME LIKE '%risk%'"
    )
    out["epiunits_risk_cols"] = [c[0] for c in cols]

    for t in [
        "all_data",
        "thrace_calculation_results",
        "tot_n_epiunits",
        "tot_n_epiunits_wide",
        "factivities_tmp",
        "factivities",
        "epiunits",
    ]:
        try:
            out[f"count_{t}"] = q(f"SELECT COUNT(*) FROM {t}")[0][0]
        except Exception as e:
            out[f"count_{t}"] = f"ERROR: {e}"

    try:
        r = q("SELECT risk, COUNT(*) c FROM all_data GROUP BY risk")
        out["all_data_risk_dist"] = {str(x[0]): x[1] for x in r}
    except Exception as e:
        out["all_data_risk_dist"] = str(e)

    try:
        out["factivities_with_tested"] = q(
            "SELECT COUNT(*) FROM factivities WHERE cattletested IS NOT NULL OR sheeptested IS NOT NULL"
        )[0][0]
    except Exception as e:
        out["factivities_with_tested"] = str(e)

    procs = q(
        "SELECT ROUTINE_NAME FROM information_schema.ROUTINES "
        "WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE'"
    )
    out["procedures"] = [x[0] for x in procs]

    funcs = q(
        "SELECT ROUTINE_NAME FROM information_schema.ROUTINES "
        "WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'FUNCTION'"
    )
    out["functions"] = [x[0] for x in funcs]

    for name in ("create_data_summary", "get_freedom_data"):
        try:
            body = q(
                "SELECT ROUTINE_DEFINITION FROM information_schema.ROUTINES "
                "WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = :n",
                {"n": name},
            )[0][0] or ""
            out[f"{name}_len"] = len(body)
            out[f"{name}_uses_tested"] = "cattletested" in body.lower() or "sheeptested" in body.lower()
            out[f"{name}_hardcodes_high"] = "'high' as risk" in body.lower()
            out[f"{name}_has_risk_update"] = "set risk" in body.lower()
            out[f"{name}_sequential"] = "CSe2" in body or "post2" in body
            out[f"{name}_edsse"] = "edsse" in body.lower()
        except Exception as e:
            out[name] = str(e)

    calc = ThraceCalculator(thrace_engine)
    cases = [
        {"species": "BOV", "disease": "FMD", "region": "GR", "label": "FMD_BOV_GR"},
        {"species": "SR", "disease": "PPR", "region": "GR", "label": "PPR_SR_GR"},
        {"species": "LR", "disease": "LSD", "region": "BG", "label": "LSD_LR_BG"},
    ]
    out["nexus_calculator"] = {}
    for c in cases:
        try:
            result = calc.calculate_system_sensitivity(
                c["species"], c["disease"], c["region"]
            )
            n = len(result.get("labels", []))
            out["nexus_calculator"][c["label"]] = {
                "months": n,
                "first": {
                    "label": result["labels"][0] if n else None,
                    "pfree": result["pfree"][0] if n else None,
                    "sens": result["sens"][0] if n else None,
                    "pintro": result["pintro"][0] if n else None,
                },
                "last": {
                    "label": result["labels"][-1] if n else None,
                    "pfree": result["pfree"][-1] if n else None,
                    "sens": result["sens"][-1] if n else None,
                    "pintro": result["pintro"][-1] if n else None,
                },
            }
        except Exception as e:
            out["nexus_calculator"][c["label"]] = f"ERROR: {e}"

    # Legacy SQL get_freedom_data (if deployed) for same filters
    out["sql_get_freedom_data"] = {}
    for c in cases:
        try:
            with thrace_engine.connect() as conn:
                row = conn.execute(
                    text("SELECT thrace.get_freedom_data(:species, :disease, :region) AS j"),
                    {"species": c["species"], "disease": c["disease"], "region": c["region"]},
                ).fetchone()
                payload = json.loads(row.j) if row and row.j else None
                if payload and payload.get("labels"):
                    out["sql_get_freedom_data"][c["label"]] = {
                        "months": len(payload["labels"]),
                        "first": {
                            "label": payload["labels"][0],
                            "pfree": payload["pfree"][0],
                            "sens": payload["sens"][0],
                            "pintro": payload["pintro"][0],
                        },
                        "last": {
                            "label": payload["labels"][-1],
                            "pfree": payload["pfree"][-1],
                            "sens": payload["sens"][-1],
                            "pintro": payload["pintro"][-1],
                        },
                    }
                else:
                    out["sql_get_freedom_data"][c["label"]] = payload
        except Exception as e:
            out["sql_get_freedom_data"][c["label"]] = f"ERROR: {e}"

    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    main()
