# THRACE Module — Canonical Documentation

**Last updated:** July 2026
**Audience:** EuFMD Nexus developers, THRACE working group, external evaluators
**Status:** Corrected freedom model (Ausvet/EuFMD post-evaluation) **ported to Python and live**; validated against the R reference by automated parity tests.

> This is the single source of truth for the THRACE module. It replaces and consolidates the former `THRACE_WORKFLOW.md`, `THRACE_API_USAGE.md`, `THRACE_IMPLEMENTATION_COMPLETE.md`, and `THRACE_FIXES_SUMMARY.md`, which have been deleted.

---

## Table of contents

1. [What changed and why (decisions)](#1-what-changed-and-why-decisions)
2. [Architecture](#2-architecture)
3. [The corrected freedom model](#3-the-corrected-freedom-model)
4. [Reference data](#4-reference-data)
5. [Upload workflow](#5-upload-workflow)
6. [API reference](#6-api-reference)
7. [Parity tests (R vs Python)](#7-parity-tests-r-vs-python)
8. [Legacy PHP application and database](#8-legacy-php-application-and-database)
9. [Management corrections R1–R24](#9-management-corrections-r1r24)
10. [Backlog / not replicated](#10-backlog--not-replicated)

---

## 1. What changed and why (decisions)

The previous Nexus implementation reproduced the **legacy independence model** (`thrace.get_freedom_data` SQL over the `all_data` summary table), which does **not** meet the management corrections. It also required a multi-step upload (staging table + manual approval) and a "refresh summary" step that called the legacy `create_data_summary` stored procedure. This has been replaced.

**Decisions taken (agreed with the working group):**

- **Freedom model = faithful Python port of the corrected R** (`update_database_R_corrected.R`), not the legacy SQL and not `update_database_2025_v3.sql`. The R script is the authoritative reference.
- **On-demand only.** Freedom analysis is computed live from `thrace.factivities` when the user requests it. No AWS cron jobs, no pre-cached JSON, no `all_data` table, no `create_data_summary` call.
- **Decision 1A — reference config ships as static files** under `backend/data/thrace/` (corrected `params`, `monthly_pintro`, `tot_n_epiunits`, `risk_levels`). The live `thrace` DB parameter tables are **left untouched** (the legacy PHP app still reads them). Nexus never reads `params` / `monthly_pintro` from the DB.
- **Decision 2A — "tested vs sampled" seam.** The model currently uses the R reference's adjusted serology **sample** counts (to match R exactly). A code seam (`USE_TESTED_COLUMNS` in `thrace_calculator.py`) allows a later switch to the reported `*_tested` columns without a DB migration.
- **Upload simplified.** Validate → **direct insert into `factivities`**. No `factivities_tmp`, no manual approval. If any row fails validation the whole file is rejected with an error report; nothing is imported.
- **Legacy DB objects left in place but unused by Nexus.** `create_data_summary`, `get_freedom_data`, `get_param`, `all_data`, and `factivities_tmp` remain in the DB for the legacy PHP app / any running cron, but Nexus no longer calls or writes them.
- **Per-country model.** The corrected model is country-specific (parameters, risk strata, and EDSSe denominators differ per country). Region **must be `GR`, `BG`, or `TK`** — there is no `ALL` region.

---

## 2. Architecture

```
Upload:
  Excel → POST /api/thrace/upload-data
    → validate every row
    → all clean?  yes → INSERT directly into thrace.factivities
                   no  → reject file, return error report (nothing imported)

Freedom analysis (on demand):
  Thrace.tsx "Load analysis"
    → GET /api/thrace/freedom-data?species=&disease=&region=
    → ThraceCalculator (backend/routers/thrace_calculator.py)
        1. load_rows_from_db(): thrace.factivities ⋈ thrace.epiunits_view (geography)
        2. build_all_data(): reshape to long per-species rows + pseudo-species (all_sp, sr, lr),
           apply filters, Springer deletions, risk levels, serology adjustments
        3. get_freedom_data(): sequential SeH (clinical then serological), monthly SSe,
           disease-specific P(intro), Bayesian P(free) with positive-case reset, EDSSe
    → JSON → Plotly
```

The same `freedom-data` endpoint returns both the freedom (FSSe) and early-detection (EDSSe) series. The frontend presents them as **two separate sections/buttons**:

- **Freedom from disease analysis** — P(free), surveillance sensitivity (FSSe), P(intro), animals tested.
- **Early detection** — EDSSe (computed with the edsse design parameters), P(intro), animals tested.

**Key files:**

| Concern | File |
|---------|------|
| API endpoints | `backend/routers/thrace.py` |
| Corrected model | `backend/routers/thrace_calculator.py` |
| Reference data (shipped) | `backend/data/thrace/{params,monthly_pintro,tot_n_epiunits}.csv`, `risk_levels.json` |
| Reference-data generator | `backend/scripts/thrace_make_refdata.py` |
| Base-R reference runner | `backend/scripts/thrace_r_reference.R` |
| Parity tests | `backend/tests/test_thrace_parity.py` + `backend/tests/thrace_reference/*.csv` |
| Frontend | `frontend/src/pages/Thrace.tsx` |

No dependency on `thrace.all_data`, `create_data_summary`, `get_freedom_data`, `get_param`, or `factivities_tmp`.

---

## 3. The corrected freedom model

Ported line-for-line from `update_database_R_corrected.R`. The Python core is pure (no pandas), so it can be unit-tested against R.

**`build_all_data(rows)`** — reshape joined factivities into the long analysis table:

- Cross join each activity by 5 base species (cattle, buffalo, pig, sheep, goat) × 4 diseases (FMD, LSD, SGP, PPR).
- Keep `dt_insp` year in `[2016, 2050)`; drop rows with `size == 0`.
- Drop impossible species/disease combinations (e.g. sheep+LSD, cattle+PPR, pig+{LSD,SGP,PPR}).
- **Springer historical deletions** (per country/disease/year cutoffs).
- **Risk levels (R4/R16):** high/low assigned from `risk_levels.json` (BGR by epiunit ID, GRC by district, TUR by province). Epiunits outside the reference lists fall back to `high` with a logged warning (the R reference errors instead; the fallback keeps production robust for new epiunits).
- **Serology adjustments:** GRC PPR sheep/goat in 2022–2023 and 2024-H1 → `floor(sample × 0.25)`; TUR PPR → 0; all SGP and LSD serology → 0.
- **Pseudo-species (R8):** aggregate per epiunit to `all_sp` (all five), `sr` (sheep+goat), `lr` (cattle+buffalo) so within-unit species are not treated as independent.

**`get_freedom_data(sp, dz, reg, all_data)`** — the model:

- **Sequential herd sensitivity (R1):** clinical component first (`USe_2`, prior `PstarH`), then serological (`USe_1`) using the clinical posterior as its prior. `seh = 1 − (1 − USe·pos/size)^ceil(size·PstarA)`. This removes the double-counting of the legacy independence formula.
- **Adjusted risk (R4):** `ar_high`/`ar_low` from relative risk (`RR_high`, `RR_low`) and high-risk proportion (`PrP_high`).
- **Monthly system sensitivity:** `cse = 1 − exp(Σ ln(p_neg))` for clinical and serological; `SSe = 1 − (1 − cse_clin)(1 − cse_sero)`.
- **Disease-specific P(intro) (R11/R12):** per-disease monthly value with a year-specific override and a generic per-month fallback.
- **Bayesian P(free) with positive-case reset (R17):** `posterior = ((1 − pintro)·prior) / (1 − SSe + prior·SSe)`; when a month has clinical/sero positives the prior resets to 0, and the month after a positive resets to the 0.5 initial.
- **EDSSe (R18):** early-detection sensitivity per month using combined per-herd sensitivity at the EDSSe design prevalence, coverage `t_cov`, risk weighting, and the `tot_n_epiunits` denominators.

Output per month: `cse_clin`, `cse_sero`, `sse`, `edsse`, `pintro`, `prior`, `posterior`, plus `animals`, `herds`, `sero`, `clin`, `seropos`, `clinpos`.

---

## 4. Reference data

Shipped under `backend/data/thrace/` (version-controlled) and loaded once, cached in-process:

| File | Contents | Source |
|------|----------|--------|
| `params.csv` | `disease, param, value_fsse, value_edsse, region` | `params_corrected.csv` |
| `monthly_pintro.csv` | `year, month, pintro_fmd, pintro_lsd, pintro_spgp, pintro_ppr` (blank `year` = generic) | `monthly_pintro_corrected.csv` |
| `tot_n_epiunits.csv` | EDSSe denominators: active epiunit counts per country × risk × species group | computed by the base-R runner from the census |
| `risk_levels.json` | BGR high-risk epiunit IDs; GRC high/low districts; TUR high/low provinces | transcribed from the R script |
| `metadata.yaml` | Simple product metadata (no formal standard): custodian, contact, access, extent, lineage | hand-maintained |

To regenerate (when the corrected R config changes), with the gitignored `Thrace/New items/THRACE R version/` inputs present:

```bash
python backend/scripts/thrace_make_refdata.py          # params, monthly_pintro, risk_levels
Rscript backend/scripts/thrace_r_reference.R            # tot_n_epiunits + R parity fixtures
```

The legacy DB `params` / `monthly_pintro` tables are intentionally **not** used and remain on the legacy (single-`value`) schema for the PHP app.

---

## 5. Upload workflow

- `POST /api/thrace/upload-data` reads the Excel headers dynamically (45-column format + six `*_tested` columns).
- Every row is validated (seropositives ≤ samples, clinical positives ≤ examined, date/epiunit resolution, etc.).
- **All rows clean →** inserted directly into `thrace.factivities` (`success: true`, `inserted_count`).
- **Any row invalid →** nothing is imported; response has `has_errors: true` and `error_rows_detail` (row, village, country, date, error) for correction and re-upload.
- The staging table `factivities_tmp` and the `/staging-summary` and `/approve-data` endpoints have been removed from Nexus.

---

## 6. API reference

### `GET /api/thrace/freedom-data`

On-demand corrected freedom analysis (no persistence).

| Parameter | Values |
|-----------|--------|
| `species` | `ALL`, `LR`, `BOV`, `BUF`, `SR`, `OVI`, `CAP`, `POR` |
| `disease` | `FMD`, `PPR`, `LSD`, `SGP` |
| `region` | `GR`, `BG`, `TK` (no `ALL` — per-country model; returns HTTP 400 otherwise) |

Response `data`: `labels`, `pfree`, `sens` (FSSe), `edsse`, `pintro`, `animals`, `herds`, `sero`, `clin`, `seropos`, `clinpos`.

### Other endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/thrace/upload-data` | POST | Validate + direct import into `factivities` |
| `/api/thrace/cycle-report` | GET | Quarterly report JSON (frontend Excel export) |
| `/api/thrace/inspectors` | GET | Inspector list |
| `/api/thrace/map-districts` | GET | Countries → districts for map filter |
| `/api/thrace/map-data` | GET | Epiunit points + visit counts (`district_ids`, `start_date`, `end_date`) |
| `/api/thrace/metadata` | GET | Simple product metadata (YAML) |

---

## 7. Parity tests (R vs Python)

`backend/tests/test_thrace_parity.py` proves the Python port matches the R reference.

- `backend/scripts/thrace_r_reference.R` is a **base-R** runner (no `dplyr`/`tidyr`/`lubridate`, so it runs on the stock R install). The numeric core `get_freedom_data` is copied verbatim from the corrected R; only the `all_data` build was translated to base R. It writes fixtures to `backend/tests/thrace_reference/` and the EDSSe denominators to `backend/data/thrace/tot_n_epiunits.csv`.
- The test rebuilds `all_data` in Python from the **same input CSVs**, runs `get_freedom_data` for FMD/BOV/GR, PPR/SR/GR, LSD/LR/BG, and asserts equality (abs tol `1e-6`) on `cse_clin`, `cse_sero`, `sse`, `pintro`, `prior`, `posterior`, `edsse`, and exact equality on the integer counts.
- The R input CSVs are gitignored; if absent the test **skips** (the committed fixtures alone cannot rebuild `all_data`).

Run:

```bash
cd backend
PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python -m pytest tests/test_thrace_parity.py -v
```

(`PYTEST_DISABLE_PLUGIN_AUTOLOAD` avoids an unrelated third-party plugin that is broken on Python 3.12.)

Current status: **3/3 pass**.

---

## 8. Legacy PHP application and database

### 8.1 Application overview

The original THRACE system is a **PHP MVC application** for surveillance data management across **Bulgaria, Greece, and Türkiye** (FMD, PPR, LSD, SGP). It lives in the gitignored `/Thrace/` folder (local copy only) and still runs against the same `thrace` MySQL database.

| Layer | Location |
|-------|----------|
| Entry point | `Thrace/public/main.php?route=...` |
| Routes | `Thrace/classes/fmd/PcpRoutes.php` |
| Controllers | `Thrace/classes/fmd/controllers/` |
| Templates | `Thrace/templates/` (Bootstrap 4) |
| Auth | Session-based, roles 1=CVO, 4=WG, 6=ADMIN |

### 8.2 Legacy data workflow (for reference only — not used by Nexus)

```
Template download → Excel fill → upload (factivities_tmp)
  → review → approve (factivities)
  → create_data_summary() → all_data
  → daily cron → 128 JSON files → freedom.html reads cached JSON
```

### 8.3 Database

Nexus uses the same `thrace` MySQL database (`db5_name` in `backend/config.py`). Geography (nation / district / province names per epiunit) is read from **`thrace.epiunits_view`** — the Nexus DB user cannot read the shared `tcc.*` tables, and the view already resolves the joins. `nationID` is mapped to the model country code (100→BGR, 300→GRC, 792→TUR). Nexus additions: six `*_tested` columns on `factivities`.

| Table | Role | Nexus use |
|-------|------|-----------|
| `factivities` | Production surveillance rows | **Read** (freedom) + **write** (upload) |
| `factivities_tmp` | Legacy staging | Not used |
| `epiunits` | Epidemiological units | Read (geography join) |
| `all_data` | Legacy denormalized summary | Not used |
| `params`, `monthly_pintro` | Legacy single-`value` parameters | Not used (Nexus ships corrected CSVs) |
| `thrace_calculation_results` | Old Nexus audit table | Not used |

Legacy stored routines (`create_data_summary`, `get_freedom_data`, `get_param`) remain in the DB for the PHP app; Nexus does not call them. Their behaviour is documented in `backend/migrations/thrace.txt` — notably the legacy model hardcodes `'high'` risk for every row and uses the independence sensitivity formula, which is why Nexus replaced it.

---

## 9. Management corrections R1–R24

**Source:** `Thrace/New items/THRACE Corrections implemented.docx` (Nov 2025), reference implementation `update_database_R_corrected.R`.
**Legend:** ✅ implemented in Nexus (Python) · ⚠️ partial · ❌ not implemented · ➖ out of freedom-model scope

| ID | Requirement (summary) | Status | Notes |
|----|----------------------|--------|-------|
| **R1** | Sequential (overlap-corrected) herd sensitivity | ✅ | Clinical then serological, posterior carried forward |
| **R2** | Distinguish examined vs tested animals | ⚠️ | `*_tested` stored on upload; model uses adjusted sample to match R, with `USE_TESTED_COLUMNS` seam to switch later (Decision 2A) |
| **R3** | Inventory validation checks | ❌ | Not in upload validation |
| **R4** | Real epiunit/district/province risk levels | ✅ | `risk_levels.json`; high/low strata |
| **R5** | Cycle report stratified by risk | ❌ | Cycle report unchanged |
| **R6** | Bulgaria epiunit corrections | ➖ | Data/geography task with country team |
| **R7** | Dual parameters FSSe / EDSSe | ✅ | `params.csv` has `value_fsse` and `value_edsse` |
| **R8** | Pseudo-species aggregation | ✅ | `all_sp`, `sr`, `lr` per epiunit |
| **R9** | PPR not usable with region ALL | ✅ | Model is per-country; no ALL region at all |
| **R10** | Vaccination data integration | ❌ | Not in scope |
| **R11** | Year-specific monthly P(intro) | ✅ | Year override then generic month |
| **R12** | Disease-specific P(intro) | ✅ | `pintro_fmd/lsd/spgp/ppr` |
| **R13** | Updated PrP_high priors | ✅ | In `params.csv` (e.g. GRC FMD PrP_high 0.72) |
| **R14** | Greece RR corrections | ✅ | From corrected params (per-country RR) |
| **R15** | Additional parameter updates | ✅ | In `params.csv` |
| **R16** | Risk assignment in data build | ✅ | In `build_all_data` |
| **R17** | Positive-case reset in Bayesian update | ✅ | Implemented in the monthly loop |
| **R18** | EDSSe (early-detection) sensitivity track | ✅ | Computed + charted alongside FSSe |
| **R19** | Herd count / weighting refinements | ⚠️ | `herds` returned; risk-weighted EDSSe done |
| **R20** | Model versioning / reproducibility | ⚠️ | Reference config version-controlled; parity fixtures committed |
| **R21** | Formal workflow documentation | ✅ | This document |
| **R22** | API documentation | ✅ | Section 6 |
| **R23** | Extended herd-level metrics | ⚠️ | `animals`, `herds`, `sero`, `clin`, `seropos`, `clinpos` returned |
| **R24** | Persist official calculation runs | ➖ | Dropped for now; analysis is on-demand and reproducible from committed reference data + code |

---

## 10. Backlog / not replicated

| Legacy feature | Nexus status |
|----------------|--------------|
| User registration / password reset, grant/ungrant | Uses Nexus global auth; grants not built |
| Epiunit CRUD, manual field-activity entry | Not built |
| Surveillance map (locations / visited / intensity) | Built — Map button; district filter; epiunit points from `epiunits_view` + visit counts from `factivities` |
| Activities list/export, inventory UI, delete-activities tool | Not built |
| CVO country-scoped data filter | Not implemented |
| Multi-language | English only |
| 128 pre-cached JSON files / daily cron | Replaced by live on-demand API |
| Duplicate detection at upload | Deferred (performance) |

### Gitignore

`.gitignore` keeps `/Thrace/` local (legacy PHP app, `New items/` docx + v3 SQL + R script + data exports). Version-controlled documentation lives in **`docs/Thrace.md` only**. The corrected reference **configuration** is committed under `backend/data/thrace/`, and R parity **fixtures** under `backend/tests/thrace_reference/`.
