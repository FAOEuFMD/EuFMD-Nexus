# SOI upload-template column usage (TCC)

**Generated:** 8 July 2026 (blankness) · **Reporting consistency added:** 31 July 2026  
**Database:** TCC (SOI)  
**Goal:** Identify columns that countries don’t report (or mostly leave blank) so we can clean up the **upload Excel templates** and corresponding database fields safely; and assess **who reports what, how often**, against the expected TCC cadence.

**Blank definition:** `NULL`, empty string, or whitespace-only text. Numeric `0` is treated as a reported value.

**Expected reporting countries (TCC SOI):** Azerbaijan, Armenia, Georgia, Iran, Iraq, Pakistan, Russian Federation, Turkey.  
**Expected cadence:** outbreaks **every month**; market price and vaccination **every 3 months**.

---

## Executive summary

### Template vs database reality

- **Outbreaks template** (`frontend/public/templates/outbreaks.xlsx`) requests a small set of fields (epiunit, coordinates, dates, confirmation type, species, disease, serotype). It **does not request Country/Province/District** in the spreadsheet.
- **Vaccination template** (`frontend/public/templates/vaccination.xlsx`) is a multi-row header form focused on LR/SR population and dose estimates. It **does not request manufacturer, strains, exact vaccination date, or coordinates**, even though those exist in the DB and SOI API.

### “Never reported” by country

- For the vaccination template-backed fields, **no country has a field that is 100% blank** in the current database snapshot.
- However, several fields are **highly country-dependent** (SR fields mostly blank in Türkiye; target-pop and first-visit fields mostly blank in Armenia).

### Outbreak country reference issue (data quality)

Outbreak rows have `nationID` filled, but the join to `nations.country` is missing for most rows:
- **751 / 776** outbreak rows have no joined country name
- those rows use `nationID = 0`

So any “by country” outbreak conclusions that rely only on `outbreaks.nationID` are **not trustworthy** until reference integrity is fixed.

**Workaround used for the consistency section below:** resolve country as  
`outbreaks.nationID` (when > 0) → else `districts → provinces.nationID` → else `users.nationID`.  
That recovers country for **736 / 776** rows via the district→province path.

### Reporting consistency (snapshot 31 July 2026) — headline

| Stream | Cadence | Recent reality (last ~24 months / ~8 quarters) |
|---|---|---|
| **Market price** | Quarterly | **Strong** for Armenia, Azerbaijan, Georgia, Turkey (100% of recent due periods). Iraq partial. Iran/Pakistan/Russia **none**. |
| **Outbreaks** | Monthly | **Weak.** Only Turkey has several recent months; Azerbaijan has 1 recent month. Armenia, Georgia, Iran, Iraq, Pakistan, Russia: **no months in the last 24**. |
| **Vaccination** | Quarterly | **Active for Caucasus** when using the correct table (`vacc_activities`, not legacy `vaccinations`). Armenia ~88%, Azerbaijan/Georgia 75% of last 8 quarters (through mid-2026). Turkey thin (25%). Iran/Iraq/Pakistan/Russia **none recently**. |
| **Pakistan** | All streams | **No rows** in outbreaks, `vacc_activities`, or marketprice. One registered user has never uploaded. |

**Orphan `userID = 91`:** not present in `users` (hence no name / `nationID`). **385** outbreak rows. Via district→province, **329 → Iraq** (`IRAQ-DISTRICTS` / `IRAQ-PROVINCE`), plus smaller mixes into Turkey (48), Iran (1), Armenia (1), and 6 unresolved. This is why many outbreak rows show `nationID = 0` in the raw table.

---

## Outbreaks template (`outbreaks.xlsx`)

### Template columns requested

Sheet `Foglio1` requests:
- **Epiunit**
- **Latitude**
- **Longitude**
- **Date of suspition** (DD/MM/YYYY)
- **Date of confirmation** (DD/MM/YYYY)
- **Confirmation type**
- **Specie**
- **Disease**
- **Serotype**

It also contains a **“To be imported”** helper column.

### Corresponding database fields (raw `outbreaks`)

- Epiunit → `outbreaks.epiunit`
- Latitude/Longitude → `outbreaks.latit` / `outbreaks.longi`
- Date of suspicion → `outbreaks.dt_susp`
- Date of confirmation → `outbreaks.dt_conf`
- Confirmation type → `outbreaks.conf_type`
- Specie/Disease/Serotype → stored as IDs (`speID`, `diseasecod`, `seroID`) and joined to descriptions in the SOI API

### Blankness of template-backed fields (776 outbreak rows)

| Template field | Raw DB column(s) | Blank rows | % blank |
|---|---|---:|---:|
| Epiunit | `epiunit` | 17 | 2.2% |
| Latitude | `latit` | 0 | 0% |
| Longitude | `longi` | 0 | 0% |
| Date of suspition | `dt_susp` | 0 | 0% |
| Date of confirmation | `dt_conf` | 496 | **63.9%** |
| Confirmation type | `conf_type` | 450 | **58.0%** |
| Specie | `speID` | 0 | 0% |
| Disease | `diseasecod` | 0 | 0% |
| Serotype | `seroID` | 0 | 0% |

### Country reporting for outbreaks

The template does not request country, and the country reference join is missing for most outbreak rows (see summary). Blankness-by-country was not produced in the July blankness pass. The **consistency section** below attributes outbreaks via district→province for coverage analysis.

---

## Vaccination template (`vaccination.xlsx`)

### Template structure and requested columns

The `Data` sheet uses a multi-row header. The user-entered columns correspond to the LR/SR pairs under:
- **Census**: total animals present (LR, SR)
- **Target population** (LR, SR)
- **Young animals to be revaccinated** (LR, SR)
- **Estimated vaccine doses** (LR, SR)

The form also captures a **Vaccination campaign** selection.

### Corresponding database fields (raw `vaccinations`)

Likely mapping (LR = cattle, SR = small ruminants):
- Census LR/SR → `cattle_pop`, `sr_pop`
- Target pop LR/SR → `cattle_target_pop`, `sr_target_pop`
- Estimated doses LR/SR → `cattle_est_vacc_doses`, `sr_est_vacc_doses`
- “Young animals to be revaccinated” LR/SR → **ambiguous**; closest fields are:
  - `cattle_vacc_first_visit`, `sr_vacc_first_visit`
  - `cattle_total_first_visit`, `sr_total_first_visit`

### Blankness of template-backed fields (1,224 vaccination rows)

| Template area | Raw DB column | Blank rows | % blank |
|---|---|---:|---:|
| Census (SR) | `sr_pop` | 182 | 14.9% |
| Target population (LR) | `cattle_target_pop` | 427 | **34.9%** |
| Target population (SR) | `sr_target_pop` | 610 | **49.8%** |
| Estimated doses (LR) | `cattle_est_vacc_doses` | 185 | 15.1% |
| Estimated doses (SR) | `sr_est_vacc_doses` | 368 | 30.1% |
| Young revacc (LR?) | `cattle_vacc_first_visit` | 403 | **32.9%** |
| Young revacc (LR?) | `cattle_total_first_visit` | 605 | **49.4%** |
| Young revacc (SR?) | `sr_vacc_first_visit` | 607 | **49.6%** |
| Young revacc (SR?) | `sr_total_first_visit` | 744 | **60.8%** |

### Country-by-country highlights (highest blankness)

No country has a field that is 100% blank, but the “worst reporters” differ by field:

- **SR_Population (`sr_pop`)**: Türkiye **84.0% blank** (173/206)
- **Cattle_Target_Pop (`cattle_target_pop`)**: Armenia **72.7% blank** (427/587)
- **SR_Target_Pop (`sr_target_pop`)**: Türkiye **84.0% blank**; Armenia **72.7% blank**
- **Cattle_Vacc_First_Visit (`cattle_vacc_first_visit`)**: Armenia **66.4% blank** (390/587)
- **Cattle_Total_First_Visit (`cattle_total_first_visit`)**: Armenia **72.7% blank**; Georgia **66.3% blank**
- **SR_Vacc_First_Visit / SR_Total_First_Visit**: Türkiye **84.0% blank**; Armenia ~**71–73% blank**

Interpretation: this looks like campaign structure differences (cattle-only vs mixed campaigns) more than “never reported”, so removing SR columns entirely would risk losing valid data for countries that do report them.

**Note:** blankness above is measured on legacy table `vaccinations`. Operational monthly/campaign activity used for consistency scoring is **`vacc_activities`** (linked via `vacc_headers`).

---

## Reporting consistency (who reports, how often)

**Snapshot date:** 31 July 2026  
**Expected countries:** Azerbaijan, Armenia, Georgia, Iran, Iraq, Pakistan, Russian Federation, Turkey  
**Expected cadence:** outbreaks **monthly**; vaccination & market price **every 3 months**

### Tables used

| Stream | Primary table(s) | Rows (snapshot) | Period key |
|---|---|---:|---|
| Outbreaks | `outbreaks` (+ `districts`→`provinces` for country) | 776 | `COALESCE(dt_susp, dt_conf, dt_inival)` → month |
| Vaccination (live) | **`vacc_activities`** ⋈ **`vacc_headers`** | 6,746 | `year` + `month` → quarter; country = `vacc_headers.nationid` |
| Vaccination (Iran) | **`vacc_activities_irn`** (+ district→province) | 1,690 | `year` + `month` → quarter |
| Vaccination (legacy — do not use for cadence) | `vaccinations` | 1,224 | stops ~2021; used only in blankness section above |
| Market price | `marketprice` ⋈ `marketprice_period` | 97 | `marketprice_period.dt_from` → quarter |
| Identity | `users`, `nations` | 31 users | `userID` → name / home nation |

**Recent windows (coverage %):**
- Outbreaks: last **24** months `2024-08` … `2026-07`
- Vaccination: last **8** quarters `2024-Q4` … `2026-Q3` (`2026-Q3` still open)
- Market price: last **7** due periods with `dt_from ≤ 2026-07-31` → `2024-Q4` … `2026-Q2`

Coverage = share of periods with **≥1 row** for that country (presence, not epiunit completeness).

### Country scorecard (recent window)

| Country | Outbreaks | Vaccination | Market price | Last outbreak | Last vacc month | Last market Q |
|---|---:|---:|---:|---|---|---|
| Azerbaijan | **4.2%** (1/24) | **75%** (6/8) | **100%** (7/7) | 2025-10 | 2026-06 | 2026-Q2 |
| Armenia | **0%** | **87.5%** (7/8)* | **100%** (7/7) | 2016-01† | 2026-06 | 2026-Q2 |
| Georgia | **0%** | **75%** (6/8) | **100%** (7/7) | — | 2026-04 | 2026-Q2 |
| Iran | **0%** | **0%** ‡ | **0%** | 2023-03 | 2023-03 (irn) | 2022-Q1 |
| Iraq | **0%** | **0%** | **71.4%** (5/7) | 2024-03 | — | 2026-Q2 |
| Pakistan | **0%** | **0%** | **0%** | — | — | — |
| Russian Federation | **0%** | **0%** | **0%** | 2020-01 | 2021-08 | — |
| Turkey | **20.8%** (5/24) | **25%** (2/8) | **100%** (7/7) | 2025-08 | 2025-03 | 2026-Q2 |

\*Only miss is open **2026-Q3**. †Single orphan-`userID 91` row, not national reporting. ‡Iran uses `vacc_activities_irn`, not `vacc_activities`.

---

### Per-country detail

#### Azerbaijan

| Stream | Recent hit | Recent miss | Lifetime / notes |
|---|---|---|---|
| Outbreaks | `2025-10` | all other months in window (23) | 1 resolved outbreak row total |
| Vaccination | `2024-Q4`, `2025-Q2`–`2026-Q2` | `2025-Q1`, `2026-Q3` | **2,930** `vacc_activities` rows; months since 2024: 2024-03,04,06,09,11,12; 2025-04,06–12; 2026-03,04,06 |
| Market price | all 7 recent periods | — | Quarters reported: `2021-Q1`…`2021-Q4`, `2022-Q2`…`2026-Q2` (gap only `2022-Q1` historically) |

**Reporters:** Tamilla Aliyeva (`userID` 133) — 1 outbreak, **2,860** vacc activities, 17 market · andrea vitelli (staff) — 70 early vacc rows (2021-12)

**Vacc by year (`vacc_activities`):** 2021: 590 (8 mo) · 2022: 316 (4) · 2023: 630 (8) · 2024: 472 (6) · 2025: 682 (8) · 2026: 240 (3)

#### Armenia

| Stream | Recent hit | Recent miss | Lifetime / notes |
|---|---|---|---|
| Outbreaks | — | entire 24-month window | Only `2016-01` (1 orphan row) |
| Vaccination | `2024-Q4`…`2026-Q2` | `2026-Q3` (open) | **2,120** rows; recent months: 2024-04–06,08–12; 2025-03–09,12; 2026-03–06 |
| Market price | all 7 | — | Continuous `2021-Q1` … `2026-Q2` (22 periods) |

**Reporter:** Satenik Kharatyan (`userID` 134) — 0 outbreaks, **2,120** vacc, 22 market (active through 2026-06-30)

**Vacc by year:** 2021–2023: 440 each (10–11 mo) · 2024–2025: 320 (8) · 2026: 160 (4)

#### Georgia

| Stream | Recent hit | Recent miss | Lifetime / notes |
|---|---|---|---|
| Outbreaks | — | entire window | **0** outbreak rows |
| Vaccination | `2024-Q4`…`2025-Q4`, `2026-Q2` | `2026-Q1`, `2026-Q3` | **1,145** rows; recent months: 2024-04,05,09,12; 2025-01,03,06,08,11,12; 2026-04 |
| Market price | all 7 | — | From `2021-Q1` then gap until `2022-Q3`, then continuous to `2026-Q2` |

**Reporters:** Tengiz Chaligava (`userID` 132) — 0 OB, **1,043** vacc, 16 market · andrea vitelli — 102 vacc (through 2023-12)

**Vacc by year:** 2021: 189 · 2022: 254 · 2023: 276 · 2024: 145 · 2025: 244 · 2026: 37 (1 month)

#### Iran

| Stream | Recent hit | Recent miss | Lifetime / notes |
|---|---|---|---|
| Outbreaks | — | entire window | **131** rows; last months cluster through **2023-03** (Amir Javadi) |
| Vaccination | — | all 8 recent Q | **`vacc_activities_irn` only** — 1,690 rows; years 2020:189 · 2021:619 · 2022:693 · 2023:189; last **2023-03** |
| Market price | — | all 7 | Only `2021-Q2`, `2022-Q1` ever |

**Reporters:** Amir Javadi (`userID` 147) — 129 outbreaks, 0 vacc_activities, 2 market · orphan 91 — 438 irn vacc (through 2021-04) · andrea vitelli — **1,252** irn vacc (through 2023-03)

#### Iraq

| Stream | Recent hit | Recent miss | Lifetime / notes |
|---|---|---|---|
| Outbreaks | — | entire window | **479** resolved rows; last outbreak months through **2024-03** |
| Vaccination | — | all 8 | **0** `vacc_activities` rows |
| Market price | `2025-Q1`–`Q3`, `2026-Q1`–`Q2` | `2024-Q4`, `2025-Q4` | 12 market rows lifetime; also earlier 2022–2024 periods |

**Reporters:** orphan 91 — **329** outbreaks · Hudhaifa Hadi (153) — 2 outbreaks (2022-07-30) · Samir Al-Jabir (159) — 2 market (2026-Q1/Q2) · andrea vitelli — 148 outbreaks + 10 market historically

#### Pakistan

| Stream | Status |
|---|---|
| Outbreaks / vacc_activities / marketprice | **No rows ever** |
| Registered user | Riasat Wasee Ullah (`userID` 143), last login 2021-10-20 — never uploaded |

#### Russian Federation

| Stream | Recent | Lifetime |
|---|---|---|
| Outbreaks | none in window | months `2019-01`–`03`, `2020-01` (22 rows; mostly andrea vitelli + 1 Karaulov + 1 Potzsch) |
| Vaccination | none | 26 `vacc_activities` rows in **2021** only (andrea vitelli) |
| Market price | none | **0** rows |

#### Turkey

| Stream | Recent hit | Recent miss | Lifetime / notes |
|---|---|---|---|
| Outbreaks | `2024-11`, `2025-01`, `2025-05`, `2025-07`, `2025-08` | 19 other months in window | **136** rows; also earlier 2023–2024 months |
| Vaccination | `2024-Q4`, `2025-Q1` | `2025-Q2`…`2026-Q3` | **525** rows; recent months 2024-04,05,12; **2025-03** last |
| Market price | all 7 | — | Continuous `2021-Q1` … `2026-Q2` |

**Reporter:** Abdulnaci Bulut (`userID` 131) — 83 outbreaks, **525** vacc activities, 21 market · orphan 91 — 48 outbreak rows (Turkish provinces) · staff leftovers on legacy vacc / small market

**Vacc by year:** 2021: 105 · 2022: 140 · 2023: 140 · 2024: 105 · 2025: 35 (1 month) · **2026: 0**

---

### Vaccination table clarification

| Table | What it is | Years with data | Use for |
|---|---|---|---|
| `vaccinations` | Legacy flat upload store (template blankness) | mostly ≤2021 | Column blankness only |
| `vacc_activities` | Live monthly doses / activity lines (`vchid`→header) | **2021–2026** (437 rows in 2026 through June) | **Cadence / who reports** |
| `vacc_headers` | District/campaign header (`nationid`, pops, targets) | linked to activities | Country + census fields |
| `vacc_activities_irn` | Iran-specific activity store | 2020–2023 | Iran vacc cadence |

**`vacc_activities` global year totals:** 2021: 1,350 · 2022: 1,150 · 2023: 1,486 · 2024: 1,042 · 2025: 1,281 · **2026: 437**

**`vacc_activities` rows × year × country**

| Country | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
|---|---:|---:|---:|---:|---:|---:|
| Armenia | 440 | 440 | 440 | 320 | 320 | 160 |
| Azerbaijan | 590 | 316 | 630 | 472 | 682 | 240 |
| Georgia | 189 | 254 | 276 | 145 | 244 | 37 |
| Turkey | 105 | 140 | 140 | 105 | 35 | 0 |
| Russian Federation | 26 | 0 | 0 | 0 | 0 | 0 |
| Iran / Iraq / Pakistan | 0 in this table | | | | | |

**`vacc_activities_irn` by year:** 2020: 189 · 2021: 619 · 2022: 693 · 2023: 189

---

### Who reports — full user directory

| userID | Name | Home nation (`users`) | Outbreaks | Vacc activities* | Market | First activity | Last activity | Notes |
|---:|---|---|---:|---:|---:|---|---|---|
| 133 | TAMILLA ALIYEVA | Azerbaijan | 1 | 2,860 | 17 | 2022-06-30 | 2026-06-30 | National AZ |
| 134 | Satenik Kharatyan | Armenia | 0 | 2,120 | 22 | 2019-09-15 | 2026-06-30 | National AM |
| 132 | TENGIZ CHALIGAVA | Georgia | 0 | 1,043 | 16 | 2022-09-30 | 2026-06-30 | National GE |
| 131 | ABDULNACI BULUT | Turkey | 83 | 525 | 21 | 2019-04-08 | 2026-06-30 | National TR |
| 147 | AMIR JAVADI | Iran | 129 | 0 | 2 | 2021-02-01 | 2023-03-26 | National IR outbreaks |
| 159 | SAMIR AL-JABIR | Iraq | 0 | 0 | 2 | 2026-03-31 | 2026-06-30 | Recent IQ market |
| 153 | HUDHAIFA HADI | Iraq | 2 | 0 | 0 | 2022-07-30 | 2022-07-30 | One-day OB |
| 140 | ANTON KARAULOV | Russian Federation | 1 | 0 | 0 | 2020-01-27 | 2020-01-27 | Single OB |
| 91 | *(orphan — not in users)* | — | 385 | 438 (irn) | 0 | 2016-01-15 | 2023-09-28 | See orphan section |
| 92 | andrea vitelli | Azerbaijan | 174 | 70 + 1,252 irn + multi-country legacy | 17 | 2017-06-19 | 2025-09-30 | **Staff / multi-country** |
| 156 | ROBERTO CONDOLEO | Italy | 0 | 0 (1 legacy vacc only) | 0 | 2019-09-20 | 2019-09-20 | Staff legacy |
| 0 | *(missing from users)* | — | 0 | 0 (366 legacy vacc only) | 0 | 2019-04-04 | 2019-05-15 | Legacy only |
| 135 | Carsten Potzsch | Germany | 1 | 0 | 0 | 2019-03-08 | 2019-03-08 | 1 RU-attributed OB |

\*Live counts from `vacc_activities` unless marked irn / legacy.

**andrea vitelli (`userID` 92) — activity attributed by country (outbreaks / legacy vacc / market from earlier join; live vacc separate):**
- Iraq: 148 outbreaks, 10 market
- Russian Federation: 20 outbreaks, 26 live vacc (2021), legacy vacc
- Armenia / Azerbaijan / Georgia: substantial legacy vacc; small live vacc early years; some market
- Iran: 1 outbreak + bulk of `vacc_activities_irn`
- Turkey: 5 outbreaks, 1 market

---

### Orphan `userID = 91`

- **Not in** `TCC.users` → no `name`, no `nationID` (explains many `outbreaks.nationID = 0` rows).
- **385** outbreak rows; country via `districts → provinces`:

| Resolved country | Outbreak rows |
|---|---:|
| Iraq, Republic of | 329 (`IRAQ-DISTRICTS` / `IRAQ-PROVINCE`, nationID 368) |
| Turkey, Republic of | 48 (e.g. Ağrı, Kars, Ardahan, Iğdır, Artvin districts) |
| *(unresolved — no district)* | 6 |
| Iran, Islamic, Republic of | 1 (`URUMIA` / West Azarbayejan) |
| Armenia, Republic of | 1 (`ARMAVIR`) |

- Also **438** rows on **`vacc_activities_irn`** (through 2021-04).

**Outbreak country resolution method (all 776 rows):**

| Method | Rows |
|---|---:|
| `districts → provinces.nationID` | 736 |
| `outbreaks.nationID` (> 0) | 25 |
| `users.nationID` | 9 |
| Unresolved (orphan, no district) | 6 |

---

### Registered users in expected countries with **no uploads**

| userID | Name | Country | Last login (if real) |
|---:|---|---|---|
| 143 | RIASAT WASEE ULLAH | Pakistan | 2021-10-20 |
| 142 | SHAKIR NEZAL | Iraq | — |
| 150 | ALI ALKHALILI | Iraq | — |
| 144 / 145 | ALIREZA AKBARSHAHI | Iran | — (duplicate accounts) |
| 151 | JAVAD EMAMI | Iran | 2021-03-15 |
| 152 | MOHAMMAD KHAJEH | Iran | 2021-04-20 |
| 157 | KAMBIZ AMJADI GOLPAYGANI | Iran | 2025-07-26 |
| 160 | PILAR RIUS | Armenia | 2026-06-08 |

---

### Lifetime volume by country

| Country | Outbreak rows | Vacc. activities | Market-price rows |
|---|---:|---:|---:|
| Azerbaijan | 1 | 2,930 | 21 |
| Armenia | 1* | 2,120 | 22 |
| Georgia | 0 | 1,145 | 18 |
| Iran | 131 | 1,690 † | 2 |
| Iraq | 479 | 0 | 12 |
| Pakistan | 0 | 0 | 0 |
| Russian Federation | 22 | 26 | 0 |
| Turkey | 136 | 525 | 22 |

\*Orphan single-row caveat. †From `vacc_activities_irn`.

---

### Market-price period catalog (due periods, `dt_from ≤ today`)

| periodID | Label | dt_from | Quarter |
|---:|---|---|---|
| 2 | 21-I Q | 2021-03-31 | 2021-Q1 |
| 3 | 21-II Q | 2021-06-30 | 2021-Q2 |
| 4 | 21-III Q | 2021-09-30 | 2021-Q3 |
| 5 | 21-IV Q | 2021-12-31 | 2021-Q4 |
| 6 | 22-I Q | 2022-03-31 | 2022-Q1 |
| 7 | 22-II Q | 2022-06-30 | 2022-Q2 |
| 8 | 22-III Q | 2022-09-30 | 2022-Q3 |
| 9 | 22-IV Q | 2022-12-31 | 2022-Q4 |
| 10 | 23-I Q | 2023-03-31 | 2023-Q1 |
| 11 | 23-II Q | 2023-06-30 | 2023-Q2 |
| 12 | 23-III Q | 2023-09-30 | 2023-Q3 |
| 13 | 23-IV Q | 2023-12-31 | 2023-Q4 |
| 14 | 24-I Q | 2024-03-31 | 2024-Q1 |
| 15 | 24-II Q | 2024-06-30 | 2024-Q2 |
| 16 | 24-III Q | 2024-09-30 | 2024-Q3 |
| 17 | 24-IV Q | 2024-12-31 | 2024-Q4 |
| 18 | 25-I Q | 2025-03-31 | 2025-Q1 |
| 19 | 25-II Q | 2025-06-30 | 2025-Q2 |
| 20 | 25-III Q | 2025-09-30 | 2025-Q3 |
| 21 | 25-IV Q | 2025-12-31 | 2025-Q4 |
| 22 | 26-I Q | 2026-03-31 | 2026-Q1 |
| 23 | 26 II Q | 2026-06-30 | 2026-Q2 |

(Future catalog rows `26 III Q` / `26 IV Q` exist but were not yet due at snapshot.)

---

### Interpretation / follow-ups

1. **Market price + `vacc_activities` are healthy for Armenia / Azerbaijan / Georgia**; Turkey strong on market, weaker on recent vacc and outbreaks.
2. Do **not** use legacy **`vaccinations`** for cadence — prefer **`vacc_activities` + `vacc_headers`** (and **`vacc_activities_irn`** for Iran).
3. **Monthly outbreak reporting is not being met** in the last 24 months except partial Turkey (+ one Azerbaijan month).
4. **Pakistan:** never reported. **Iraq:** no vacc activities; outbreaks stopped after early 2024; market partial.
5. **Iran:** vacc (irn) and outbreaks stopped in early 2023; market effectively inactive.
6. **Fix reference data:** recreate/map `userID 91` in `users`; backfill `outbreaks.nationID` from district→province.
7. Score **national reporters** separately from **staff uploaders** (`andrea vitelli`, legacy `userID 0`).

---

## Methodology

### Blankness (8 July 2026)

- Read the actual Excel templates in `frontend/public/templates/`.
- Measured blankness using the live TCC database tables `outbreaks` and `vaccinations` (legacy vacc table aligned to the upload template fields).
- For vaccination “by country”, used `vaccinations.nationID → nations.country` (join works).
- For outbreaks “by country”, flagged the broken `nationID` reference (join missing for most rows).

### Reporting consistency (31 July 2026; vaccination corrected same day)

- Queried live TCC via the Nexus `tcc_engine` / `DB6_NAME`.
- Country for outbreaks: `nationID` when > 0, else `districts → provinces.nationID`, else `users.nationID`.
- Vaccination cadence: **`vacc_activities.year`/`month`**, country from **`vacc_headers.nationid`**; Iran also **`vacc_activities_irn`** via district→province.
- Reporter identity: `userID` / `userid` → `users.name` / `users.familyname` / `users.nationID`.
- Coverage = at least one row in the period for that country (presence, not completeness of epiunits).
- Supporting snapshots: `docs/tmp_soi_reporting_consistency.json`, `docs/tmp_soi_vacc_activities_consistency.json`.
- Regenerators: `backend/scripts/tmp_soi_reporting_consistency.py`, `backend/scripts/tmp_soi_vacc_activities_consistency.py`.
