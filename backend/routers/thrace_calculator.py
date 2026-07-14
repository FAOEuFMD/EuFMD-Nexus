"""
THRACE Freedom Model Calculator (corrected model).

Faithful Python port of update_database_R_corrected.R (Ausvet / EuFMD post-evaluation
corrections). Replaces the legacy thrace.get_freedom_data() SQL and the previous
independence-formula Python calculator.

Key properties of the corrected model:
  - Sequential (overlap-corrected) herd sensitivity: clinical component (USe_2) first,
    then serological (USe_1), carrying the posterior forward.
  - Real risk levels (high/low) by epiunit/district/province (not all "high").
  - Pseudo-species (all_sp, sr, lr) aggregated per epiunit to avoid assuming
    independence between species within a unit.
  - Disease-specific monthly P(intro) with year-specific override and generic fallback.
  - Positive-case reset in the Bayesian update.
  - Early Detection System Sensitivity (EDSSe) track.

Reference model configuration (corrected values) is shipped as static data under
backend/data/thrace/ (params.csv, monthly_pintro.csv, tot_n_epiunits.csv,
risk_levels.json). The live thrace DB still holds the legacy values and is intentionally
NOT used for parameters. Only factivities (real surveillance data) comes from the DB.

The corrected model is per-country: region must be one of GR / BG / TK (not ALL).
"""

import csv
import json
import math
from datetime import date, datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Union

from sqlalchemy import text
from sqlalchemy.engine import Engine

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "thrace"

EPS = 2.220446049250313e-16  # .Machine$double.eps

SPECIES_BASE = ["cattle", "buffalo", "pig", "sheep", "goat"]
DISEASES = ["FMD", "LSD", "SGP", "PPR"]

SPECIES_FILTER_MAP = {
    "ALL": "all_sp",
    "LR": "lr",
    "BOV": "cattle",
    "BUF": "buffalo",
    "SR": "sr",
    "OVI": "sheep",
    "CAP": "goat",
    "POR": "pig",
}

REGION_MAP = {"GR": "GRC", "BG": "BGR", "TK": "TUR"}

# Column used for size / clinical / serology per base species.
SIZE_COL = {"cattle": "cattle", "sheep": "sheep", "goat": "goat", "buffalo": "buffalo", "pig": "pig"}
CLIN_COL = {"cattle": "cattleexam", "sheep": "sheepexam", "goat": "goatsexam", "buffalo": "buffaloesexam"}
SERO_COL = {"cattle": "cattlesample", "sheep": "sheepsample", "goat": "goatsample",
            "buffalo": "buffaloessample", "pig": "pigssample"}
# R2 "tested" seam (Q2): when USE_TESTED_COLUMNS becomes True, effective serology reads
# the reported *_tested column when populated, else falls back to the sample-based value.
TESTED_COL = {"cattle": "cattletested", "sheep": "sheeptested", "goat": "goattested",
              "buffalo": "buffalotested", "pig": "pigtested"}
USE_TESTED_COLUMNS = False  # keep False to match the R reference (adjusted sample)

CLINPOS_COL = {
    ("FMD", "cattle"): "cattlecliposFMD", ("FMD", "buffalo"): "buffaloesposFMD",
    ("FMD", "sheep"): "sheepposFMD", ("FMD", "goat"): "goatsposFMD",
    ("LSD", "cattle"): "cattlecliposLSD", ("LSD", "buffalo"): "buffaloesposLSD",
    ("SGP", "sheep"): "sheepposSGP", ("SGP", "goat"): "goatsposSGP",
    ("PPR", "sheep"): "sheepposPPR", ("PPR", "goat"): "goatsposPPR",
}
SEROPOS_COL = {
    ("FMD", "cattle"): "cattleseroposFMD", ("FMD", "buffalo"): "buffaloesseroposFMD",
    ("FMD", "sheep"): "sheepseroposFMD", ("FMD", "goat"): "goatsseroposFMD",
    ("LSD", "cattle"): "cattleseroposLSD", ("LSD", "buffalo"): "buffaloesseroposLSD",
    ("SGP", "sheep"): "sheepseroposSGP", ("SGP", "goat"): "goatsseroposSGP",
    ("PPR", "sheep"): "sheepseroposPPR", ("PPR", "goat"): "goatsseroposPPR",
}


def _c(v) -> int:
    """coalesce to int 0."""
    if v is None or v == "":
        return 0
    try:
        f = float(v)
    except (TypeError, ValueError):
        return 0
    if math.isnan(f):
        return 0
    return int(f)


def parse_date(value: Union[datetime, date, str, None]) -> Optional[date]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:19] if len(s) > 10 and fmt != "%Y-%m-%d" else s, fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s[:19]).date()
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Reference-data loading (cached module-level)
# ---------------------------------------------------------------------------
_PARAMS: Optional[Dict[Tuple[str, str, str], Dict[str, Optional[float]]]] = None
_PINTRO: Optional[Dict[str, Dict]] = None
_TOT_N: Optional[Dict[Tuple[str, str], Dict[str, float]]] = None
_RISK: Optional[Dict] = None


def _load_params() -> Dict[Tuple[str, str, str], Dict[str, Optional[float]]]:
    global _PARAMS
    if _PARAMS is None:
        out: Dict[Tuple[str, str, str], Dict[str, Optional[float]]] = {}
        with open(DATA_DIR / "params.csv", newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                key = (r["disease"], r["param"], r["region"])

                def fnum(v):
                    return float(v) if v not in (None, "", "NA") else None

                out[key] = {"fsse": fnum(r["value_fsse"]), "edsse": fnum(r["value_edsse"])}
        _PARAMS = out
    return _PARAMS


def _load_pintro() -> Dict[str, Dict]:
    """Return {'default': {month: {disease: pintro}}, 'year': {(year,month): {disease: pintro}}}."""
    global _PINTRO
    if _PINTRO is None:
        default: Dict[int, Dict[str, float]] = {}
        year: Dict[Tuple[int, int], Dict[str, float]] = {}
        col = {"FMD": "pintro_fmd", "LSD": "pintro_lsd", "SGP": "pintro_spgp", "PPR": "pintro_ppr"}
        with open(DATA_DIR / "monthly_pintro.csv", newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                m = int(r["month"])
                vals = {dz: (float(r[c]) if r[c] not in (None, "", "NA") else None) for dz, c in col.items()}
                if r["year"] in (None, "", "NA"):
                    default[m] = vals
                else:
                    year[(int(r["year"]), m)] = vals
        _PINTRO = {"default": default, "year": year}
    return _PINTRO


def _load_tot_n() -> Dict[Tuple[str, str], Dict[str, float]]:
    global _TOT_N
    if _TOT_N is None:
        out: Dict[Tuple[str, str], Dict[str, float]] = {}
        with open(DATA_DIR / "tot_n_epiunits.csv", newline="", encoding="utf-8") as f:
            for r in csv.DictReader(f):
                key = (r["country"], r["risklevel"])
                out[key] = {k: float(v) for k, v in r.items() if k.startswith("n_")}
        _TOT_N = out
    return _TOT_N


def _load_risk() -> Dict:
    global _RISK
    if _RISK is None:
        with open(DATA_DIR / "risk_levels.json", encoding="utf-8") as f:
            _RISK = json.load(f)
    return _RISK


def get_param(disease: str, param: str, region: str, which: str = "fsse") -> Optional[float]:
    return _load_params().get((disease, param, region), {}).get(which)


def lookup_pintro(disease: str, year: int, month: int) -> float:
    pi = _load_pintro()
    yv = pi["year"].get((year, month))
    if yv and yv.get(disease) is not None:
        return yv[disease]
    dv = pi["default"].get(month)
    if dv and dv.get(disease) is not None:
        return dv[disease]
    return 0.0167


def assign_risk(country: str, epiunit_id: int, district_name: Optional[str],
                province_name: Optional[str]) -> Optional[str]:
    """Mirror update_database_R_corrected.R risk assignment (BGR ids, GRC districts, TUR provinces)."""
    risk = _load_risk()
    r = None
    if epiunit_id in risk["bgr_high_epiunit_ids"]:
        r = "high"
    if district_name in risk["grc_high_districts"]:
        r = "high"
    if district_name in risk["grc_low_districts"]:
        r = "low"
    if province_name in risk["tur_high_provinces"]:
        r = "high"
    if province_name in risk["tur_low_provinces"]:
        r = "low"
    return r


# ---------------------------------------------------------------------------
# all_data construction
# ---------------------------------------------------------------------------
def build_all_data(rows: List[Dict], strict_risk: bool = False) -> List[Dict]:
    """Reshape joined factivities rows into the corrected long all_data (incl. pseudo-species).

    Each input row must contain: epiunitID, country (three_letter_code), district_name,
    province_name, dt_insp, and the factivities count columns.
    """
    base: List[Dict] = []
    unresolved_risk = 0

    for row in rows:
        d = parse_date(row.get("dt_insp"))
        if d is None:
            continue
        year, month = d.year, d.month
        if not (year > 2015 and year < 2050):
            continue
        epiunit_id = int(row["epiunitID"])
        country = row.get("country")
        district_name = row.get("district_name")
        province_name = row.get("province_name")

        risk = assign_risk(country, epiunit_id, district_name, province_name)
        if risk is None:
            unresolved_risk += 1
            if strict_risk:
                continue
            risk = "high"  # prod fallback for epiunits outside the reference lists

        for species in SPECIES_BASE:
            size = _c(row.get(SIZE_COL[species]))
            if size <= 0:
                continue
            for disease in DISEASES:
                # impossible species/disease combinations (from SQL/R)
                if (species in ("cattle", "buffalo") and disease in ("SGP", "PPR")):
                    continue
                if (species in ("sheep", "goat") and disease == "LSD"):
                    continue
                if (species == "pig" and disease in ("LSD", "SGP", "PPR")):
                    continue
                # Springer historical deletions
                if country == "TUR" and disease == "LSD" and year <= 2016:
                    continue
                if country == "TUR" and disease == "SGP" and year <= 2017:
                    continue
                if country == "BGR" and disease == "LSD" and year <= 2016:
                    continue
                if country == "BGR" and disease == "PPR" and year <= 2018:
                    continue
                if country == "GRC" and disease == "LSD" and year <= 2017:
                    continue
                if country == "GRC" and disease == "SGP" and year <= 2018:
                    continue

                clin = _c(row.get(CLIN_COL.get(species))) if species in CLIN_COL else 0
                sero = _effective_sero(row, species)
                clinpos = _c(row.get(CLINPOS_COL.get((disease, species)))) if (disease, species) in CLINPOS_COL else 0
                seropos = _c(row.get(SEROPOS_COL.get((disease, species)))) if (disease, species) in SEROPOS_COL else 0

                base.append({
                    "species": species, "disease": disease, "country": country,
                    "year": year, "month": month, "epiunitID": epiunit_id,
                    "size": size, "risk": risk, "clin": clin, "sero": sero,
                    "clinpos": clinpos, "seropos": seropos,
                })

    # sero adjustments (applied to base species before pseudo-species aggregation)
    for r in base:
        if (r["country"] == "GRC" and r["disease"] == "PPR" and r["species"] in ("sheep", "goat")
                and (r["year"] in (2022, 2023) or (r["year"] == 2024 and 1 <= r["month"] <= 6))):
            r["sero"] = math.floor(r["sero"] * 0.25)
        if r["disease"] == "PPR" and r["country"] == "TUR":
            r["sero"] = 0
        if r["disease"] in ("SGP", "LSD"):
            r["sero"] = 0

    all_data = list(base)
    all_data.extend(_aggregate_pseudo(base, SPECIES_BASE, "all_sp"))
    all_data.extend(_aggregate_pseudo([r for r in base if r["species"] in ("sheep", "goat")], None, "sr"))
    all_data.extend(_aggregate_pseudo([r for r in base if r["species"] in ("cattle", "buffalo")], None, "lr"))

    if unresolved_risk:
        print(f"[thrace] WARNING: {unresolved_risk} rows had no reference risk level; defaulted to 'high'")
    return all_data


def _effective_sero(row: Dict, species: str) -> int:
    """R2 seam: reported tested when enabled and present, else sample-based (matches R)."""
    if USE_TESTED_COLUMNS and species in TESTED_COL:
        tested = row.get(TESTED_COL[species])
        if tested not in (None, "") and _c(tested) > 0:
            return _c(tested)
    return _c(row.get(SERO_COL.get(species))) if species in SERO_COL else 0


def _aggregate_pseudo(rows: List[Dict], species_subset, label: str) -> List[Dict]:
    """Aggregate sum(size,clin,sero,clinpos,seropos) grouped by disease,country,year,month,epiunit,risk."""
    agg: Dict[Tuple, Dict] = {}
    for r in rows:
        key = (r["disease"], r["country"], r["year"], r["month"], r["epiunitID"], r["risk"])
        a = agg.get(key)
        if a is None:
            a = {"species": label, "disease": r["disease"], "country": r["country"],
                 "year": r["year"], "month": r["month"], "epiunitID": r["epiunitID"],
                 "risk": r["risk"], "size": 0, "clin": 0, "sero": 0, "clinpos": 0, "seropos": 0}
            agg[key] = a
        a["size"] += r["size"]
        a["clin"] += r["clin"]
        a["sero"] += r["sero"]
        a["clinpos"] += r["clinpos"]
        a["seropos"] += r["seropos"]
    return list(agg.values())


# ---------------------------------------------------------------------------
# get_freedom_data
# ---------------------------------------------------------------------------
def get_freedom_data(sp: str, dz: str, reg: str, all_data: List[Dict]) -> List[Dict]:
    if reg not in REGION_MAP:
        raise ValueError(
            f"Region '{reg}' not supported by the corrected model. Use one of GR, BG, TK "
            f"(the corrected model is per-country)."
        )
    if sp not in SPECIES_FILTER_MAP:
        raise ValueError(f"Unknown species filter '{sp}'.")

    sp_label = SPECIES_FILTER_MAP[sp]
    reg_vec = REGION_MAP[reg]

    rr_high = get_param(dz, "RR_high", reg_vec, "fsse")
    rr_low = get_param(dz, "RR_low", reg_vec, "fsse")
    prp_high = get_param(dz, "PrP_high", reg_vec, "fsse")
    denom = (rr_high * prp_high) + (rr_low * (1 - prp_high))
    ar_high = rr_high / denom
    ar_low = rr_low / denom

    pstar_h = get_param(dz, "PstarH", reg_vec, "fsse")
    use2 = get_param(dz, "USe_2", reg_vec, "fsse")
    use1 = get_param(dz, "USe_1", reg_vec, "fsse")
    pstar_a = get_param(dz, "PstarA", reg_vec, "fsse")
    pstar_a_edsse = get_param(dz, "PstarA", reg_vec, "edsse")

    mydata = [dict(r) for r in all_data
              if r["disease"] == dz and r["species"] == sp_label and r["country"] == reg_vec]

    for r in mydata:
        size = r["size"]
        n_fsse = int(math.ceil(size * pstar_a))
        n_edsse = int(math.ceil(size * pstar_a_edsse))
        ar = ar_high if str(r["risk"]).lower() == "high" else ar_low

        # Component 2: clinical
        prior2 = pstar_h
        seh2 = 1 - (1 - (use2 * r["clin"] / size)) ** n_fsse
        seh2_e = 1 - (1 - (use2 * r["clin"] / size)) ** n_edsse
        epi2 = ar * prior2
        p_neg2 = 1 - (seh2 * epi2)
        post2 = (1 - (1 - epi2) / (1 - epi2 * seh2)) if r["clin"] > 0 else prior2

        # Component 1: serology (prior = posterior of component 2)
        prior1 = post2
        seh1 = 1 - (1 - (use1 * r["sero"] / size)) ** n_fsse
        seh1_e = 1 - (1 - (use1 * r["sero"] / size)) ** n_edsse
        epi1 = ar * prior1
        p_neg1 = 1 - (seh1 * epi1)

        r["p_neg2"] = p_neg2
        r["p_neg1"] = p_neg1
        r["sehcomb_edsse"] = 1 - (1 - seh2_e) * (1 - seh1_e)

    # month keys
    month_keys = sorted({(r["year"], r["month"]) for r in mydata})

    outputs: List[Dict] = []
    for (y, m) in month_keys:
        sub = [r for r in mydata if r["year"] == y and r["month"] == m]
        cse_clin = 1 - math.exp(sum(math.log(max(r["p_neg2"], EPS)) for r in sub))
        cse_sero = 1 - math.exp(sum(math.log(max(r["p_neg1"], EPS)) for r in sub))
        sse = 1 - (1 - cse_clin) * (1 - cse_sero)
        outputs.append({
            "year": y, "month": m, "mth": f"{y}-{m:02d}-01",
            "cse_clin": cse_clin, "cse_sero": cse_sero, "sse": sse,
            "animals": sum(r["size"] for r in sub), "herds": len(sub),
            "sero": sum(r["sero"] for r in sub), "clin": sum(r["clin"] for r in sub),
            "seropos": sum(r["seropos"] for r in sub), "clinpos": sum(r["clinpos"] for r in sub),
        })

    # pintro
    for o in outputs:
        o["pintro"] = lookup_pintro(dz, o["year"], o["month"])

    # Bayesian update with positive-case reset
    p_free_init = 0.5
    for i, o in enumerate(outputs):
        if i == 0:
            prior = p_free_init
        else:
            prev = outputs[i - 1]
            if o["clinpos"] + o["seropos"] > 0:
                prior = 0.0
            elif (o["clinpos"] + o["seropos"]) == 0 and (prev["clinpos"] + prev["seropos"]) > 0:
                prior = p_free_init
            else:
                prior = outputs[i - 1]["posterior"]
        sse_i = o["sse"]
        o["prior"] = prior
        o["posterior"] = ((1 - o["pintro"]) * prior) / (1 - sse_i + (prior * sse_i))

    # EDSSe
    t_cov = get_param(dz, "t_cov", reg_vec, "edsse")
    rr_high_e = get_param(dz, "RR_high", reg_vec, "edsse")
    rr_low_e = get_param(dz, "RR_low", reg_vec, "edsse")
    pr_high = rr_high_e / (rr_high_e + rr_low_e)
    pr_low = rr_low_e / (rr_high_e + rr_low_e)
    tot_n = _load_tot_n()
    n_col = "n_" + sp_label
    denom_high = tot_n.get((reg_vec, "high"), {}).get(n_col)
    denom_low = tot_n.get((reg_vec, "low"), {}).get(n_col)

    out_by_key = {(o["year"], o["month"]): o for o in outputs}
    for (y, m) in month_keys:
        sub = [r for r in mydata if r["year"] == y and r["month"] == m]
        low = [r for r in sub if r["risk"] == "low"]
        high = [r for r in sub if r["risk"] == "high"]
        ser_low = (sum(r["sehcomb_edsse"] for r in low) / len(low)) if low else float("nan")
        ser_high = (sum(r["sehcomb_edsse"] for r in high) / len(high)) if high else float("nan")
        cpr_low = (len(low) / denom_low) if (low and denom_low) else None
        cpr_high = (len(high) / denom_high) if (high and denom_high) else None

        if low and high:
            edsse = (pr_low * cpr_low * t_cov * ser_low) + (pr_high * cpr_high * t_cov * ser_high)
        elif low:
            edsse = pr_low * cpr_low * t_cov * ser_low
        elif high:
            edsse = pr_high * cpr_high * t_cov * ser_high
        else:
            edsse = None
        out_by_key[(y, m)]["edsse"] = edsse

    return outputs


# ---------------------------------------------------------------------------
# Row loading
# ---------------------------------------------------------------------------
FACT_COLUMNS = [
    "cattle", "sheep", "goat", "pig", "buffalo",
    "cattleexam", "cattlecliposFMD", "cattlecliposLSD",
    "sheepexam", "sheepposFMD", "sheepposSGP", "sheepposPPR",
    "goatsexam", "goatsposFMD", "goatsposSGP", "goatsposPPR",
    "buffaloesexam", "buffaloesposFMD", "buffaloesposLSD",
    "cattlesample", "cattleseroposFMD", "cattleseroposLSD",
    "sheepsample", "sheepseroposFMD", "sheepseroposSGP", "sheepseroposPPR",
    "goatsample", "goatsseroposFMD", "goatsseroposSGP", "goatsseroposPPR",
    "pigssample", "pigsserosposFMD",
    "buffaloessample", "buffaloesseroposFMD", "buffaloesseroposLSD",
    "cattletested", "sheeptested", "goattested", "buffalotested", "pigtested",
]


# nationID (ISO 3166 numeric) -> three-letter code used by the model (matches nations reference).
NATION_TO_COUNTRY = {100: "BGR", 300: "GRC", 792: "TUR"}


def load_rows_from_db(engine: Engine) -> List[Dict]:
    """Load joined factivities + geography rows from the live thrace database.

    Geography is read from thrace.epiunits_view (which already resolves nation / district /
    province names) rather than the shared tcc.* tables, which the Nexus DB user cannot read.
    """
    cols = ", ".join(f"f.{c}" for c in FACT_COLUMNS)
    sql = text(f"""
        SELECT f.epiunitID, f.dt_insp, {cols},
               e.nationID AS nationID,
               e.district_name AS district_name,
               e.province_name AS province_name
        FROM thrace.factivities f
        JOIN thrace.epiunits_view e ON f.epiunitID = e.epiunitID
    """)
    with engine.connect() as conn:
        rows = [dict(row._mapping) for row in conn.execute(sql)]
    for r in rows:
        nation_id = r.get("nationID")
        r["country"] = NATION_TO_COUNTRY.get(int(nation_id)) if nation_id is not None else None
    return rows


class ThraceCalculator:
    """Corrected freedom model. Reads factivities from the DB; parameters from static reference data."""

    def __init__(self, db_engine: Engine):
        self.db = db_engine
        self._all_data: Optional[List[Dict]] = None

    def _ensure_all_data(self) -> List[Dict]:
        if self._all_data is None:
            rows = load_rows_from_db(self.db)
            self._all_data = build_all_data(rows)
        return self._all_data

    def calculate_system_sensitivity(self, species_filter: str, disease: str,
                                     region_filter: str, **_ignored) -> Dict:
        all_data = self._ensure_all_data()
        outputs = get_freedom_data(species_filter, disease, region_filter, all_data)
        return format_outputs(outputs)


def format_outputs(outputs: List[Dict]) -> Dict:
    """Shape the model output for the API / frontend (adds EDSSe alongside legacy keys)."""
    def fmt(v, nd=4):
        if v is None or (isinstance(v, float) and math.isnan(v)):
            return None
        return f"{v:.{nd}f}"

    return {
        "labels": [o["mth"] for o in outputs],
        "pfree": [fmt(o["posterior"], 4) for o in outputs],
        "sens": [fmt(o["sse"], 6) for o in outputs],
        "edsse": [fmt(o.get("edsse"), 6) for o in outputs],
        "pintro": [fmt(o["pintro"], 6) for o in outputs],
        "animals": [o["animals"] for o in outputs],
        "herds": [o["herds"] for o in outputs],
        "sero": [o["sero"] for o in outputs],
        "clin": [o["clin"] for o in outputs],
        "seropos": [o["seropos"] for o in outputs],
        "clinpos": [o["clinpos"] for o in outputs],
    }
