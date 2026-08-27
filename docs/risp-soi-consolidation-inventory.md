# RISP ↔ SOI consolidation inventory

**Created:** 26 August 2026  
**Status:** Phase 1 draft — schemas dumped from live DBs; field gap analysis for extending `db_manager` RISP tables.  
**Related:** [soi-column-blank-analysis.md](./soi-column-blank-analysis.md)

---

## Decisions (locked)

| Decision | Choice |
|---|---|
| Where new data is stored | `db_manager` RISP tables (extended) — **not** TCC for new entry |
| Keep TCC DB? | No for new writes; archive + later historical ETL only |
| Outbreak grain | **One row = one location line** (many rows allowed per quarter × disease) |
| Location model | **Single** location per row: either a RISP preset (`National`, `Within 50km from the border: X`, `Far from the border`, …) **or one district** — not a multi-select JSON array |
| Dates | Add `date_suspected` / `date_confirmed` (required for SOI-style rows; optional for simple RISP lines) |
| Year/quarter | Keep for organisation/filtering |
| Unique key | **Remove** `unique_outbreak_submission` after splitting multi-location rows |
| Geo | Copy TCC `provinces` + `districts` into `db_manager`; keep existing `countries` (correct names e.g. Türkiye); map TCC `nations` via ISO3 — do not replace `countries` |
| Tags | `program` (`risp` \| `soi`) and `visibility` (`private` \| `public`) |
| Excel | Optional convenience; small N (2–3 districts) entered as table rows in UI |
| Historical TCC data | Clean + migrate **after** new entry path works |
| Vaccination UX | Keep RISP campaign style; add **district** (same single-geo idea) |
| Market prices | New RISP table + form (Excel optional later) |
| Old PHP app | [`TCC/tcc-app.tar`](../TCC/tcc-app.tar) — local reference only (gitignored) |

### Why this is better than keeping TCC

- One reporting model for all countries (simpler product + Fast Report sharing tags).
- TCC is “flexible” for events but messy (orphaned `nationID`, dual vacc tables, wide marketprice).
- `db_manager.countries` already has preferred names (`name_un` / Moodle) and EuFMD flags (`eufmd_seen`, etc.).

---

## 1. Current RISP schema (`db_manager`)

### 1.1 `risp_outbreaks`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK AI | |
| `user_id` | int FK → users | |
| `country` | varchar(255) | From JWT user |
| `year` | varchar(4) | |
| `quarter` | varchar(2) | e.g. `Q1` |
| `disease_name` | varchar(255) | |
| `number_outbreaks` | int | Aggregate count |
| `locations` | json | Free-text location tags |
| `status` | json | |
| `serotype` | json | |
| `species` | json | |
| `control_measures` | json | |
| `additional_info` | text | |
| `created_at` / `updated_at` | timestamp | |

**Unique key:** `unique_outbreak_submission` (`user_id`, `country`, `year`, `quarter`, `disease_name`)

**Implication for SOI:** one row per disease per quarter — **not** event-level. SOI outbreaks are one row per epiunit/event. Unique key must change or we need a separate event table / soften uniqueness when `program=soi`.

### 1.2 `risp_vaccination`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK AI | |
| `user_id` | int FK | |
| `country` | varchar(255) | |
| `disease_name` | varchar(255) | |
| `year` | varchar(4) | |
| `status` | varchar(255) | |
| `vaccination_type` | varchar(255) | |
| `geographical_areas` | json | Free-text areas (no district) |
| `species` | json | |
| `q1`–`q4`, `total`, `coverage` | int | Quarterly doses |
| `vaccine_details` | text | |
| `created_at` | timestamp | |

**Indexes:** PK + `user_id` only (no unique constraint).

### 1.3 `risp_surveillance`

| Column | Type |
|---|---|
| `id`, `user_id`, `country`, `year`, `quarter`, `disease_name` | |
| `passive_surveillance` | text |
| `active_surveillance` | json |
| `details` | text |
| `created_at` | timestamp |

**Unique key:** `unique_submission` (`user_id`, `country`, `year`, `quarter`, `disease_name`)

SOI does not have a separate surveillance entry stream (derived from outbreak confirm timing). Keep RISP surveillance as-is for FAST users.

### 1.4 `users`

| Column | Type |
|---|---|
| `id`, `name` (unique), `email`, `password`, `country`, `role` | |

**Live roles:** `rmt` (48), `risp` (20), `admin` (1). **No `soi` role yet.**

---

## 2. What SOI expects (TCC + templates)

### 2.1 Outbreaks — event-level

**Template** (`frontend/public/templates/outbreaks.xlsx`): Epiunit, Latitude, Longitude, Date of suspicion, Date of confirmation, Confirmation type, Specie, Disease, Serotype.

**TCC `outbreaks` columns that matter:**

| TCC | Meaning |
|---|---|
| `districtID` | District (required for geography) |
| `epiunit` | Epidemiological unit name |
| `latit` / `longi` | Coordinates |
| `dt_susp` / `dt_conf` | Dates |
| `conf_type` | Confirmation type |
| `speID` / `seroID` / `diseasecod` | Species / serotype / disease |
| `nationID`, `userID` | Country / reporter |
| `ExcelFile` | Source upload filename |

Cadence expected: **monthly**. Grain: **one event per row**.

### 2.2 Vaccination — district-level (live tables)

Operational truth (see blankness doc):

- `vacc_headers` — district census / targets / estimated doses (per campaign header)
- `vacc_activities` — year/month doses injected + manufacturer/strain
- `vacc_activities_irn` — Iran-specific parallel table

Legacy `vaccinations` stops ~2021 — do **not** use for new design.

**Template** asks: census LR/SR, target pop LR/SR, young to revaccinate, estimated doses, campaign — plus implicit district via upload context.

**For RISP consolidation we keep RISP-style fields** and add district; we do **not** port full header/activity campaign complexity.

Minimal SOI vaccination needs vs current RISP:

| Need | In RISP today? |
|---|---|
| Country | Yes |
| Disease | Yes |
| Year (+ quarter or month) | Year + q1–q4 doses |
| Species / doses / coverage | Yes (JSON + ints) |
| **Province / district** | **No** |
| Manufacturer / strain | Only free-text `vaccine_details` |
| Cattle vs SR split columns | No (species JSON instead) |

### 2.3 Market prices — SOI-only today

Wide row in TCC `marketprice`: species (ctl/shp/pig) × level (dis/cap) × product (live/meat) × MIN/MAX/AVG, plus `periodID`, `nationID`, `reference`.

**Not present in RISP at all.**

### 2.4 Geography refs (needed for SOI dropdowns / Excel validation)

| Table | Key fields |
|---|---|
| `nations` | `nationID`, `country`, ISO codes |
| `provinces` | `provinceID`, `nationID`, `province_name` |
| `districts` | `districtID`, `provinceID`, `district_name` |

Recommend **copying** SOI-country districts into `db_manager` lookups so runtime does not depend on TCC.

### 2.5 Current Nexus SOI UI / API note

- **Reads:** [`backend/routers/soi.py`](../backend/routers/soi.py) GET `/api/tcc/*` (outbreaks, vaccination, marketprice, KPIs, charts).
- **Templates download + data export:** wired in [`RISPSOI.tsx`](../frontend/src/pages/RISPSOI.tsx).
- **Upload file input:** present in UI; **no POST upload endpoint in `soi.py`** in this branch (Thrace has a working Excel upload pattern at `/api/thrace/upload-data` we can mirror). If uploads currently land in TCC, that may still be via the old PHP app — confirm before wiring RISP writes.

---

## 3. Gap analysis — what to add / change on RISP

### 3.1 Tags (all reporting tables)

| Addition | Purpose |
|---|---|
| `program` ENUM(`risp`,`soi`) DEFAULT `risp` | Separate SOI vs FAST rows |
| `visibility` ENUM(`private`,`public`) DEFAULT `public` | Sharing with Fast Report |

Backfill existing rows: `program='risp'`, `visibility='public'`.

### 3.2 Outbreaks — unified multi-row model (frozen)

**Keep one table `risp_outbreaks`.** Change grain to: one row = one outbreak line at one location.

**Before UI/API change — data migration order:**

1. **Audit** existing rows where `locations` JSON has >1 entry.
2. **Split** those rows into N rows (copy disease/year/quarter/species/…; each row gets one location string; set `number_outbreaks` carefully — see note below).
3. **Drop** unique key `unique_outbreak_submission`.
4. **Replace** `locations` JSON with a single `location` varchar (or keep JSON temporarily as 1-element during transition).
5. **Add** columns: `province_id`/`district_id`, `latitude`, `longitude`, `date_suspected`, `date_confirmed`, `confirmation_type`, `program`, `visibility`, `source_tcc_id`, single `location` — **done.** Skip `epiunit`.

**Location semantics (all countries):**

| Choice | Stored as |
|---|---|
| National / Far from border / Within 50km… | `location` text preset (same strings as today) |
| Specific district | `district_id` (+ province via join); `location` can mirror district name |

UI: single select — either a preset **or** one district (not multi).

**`number_outbreaks` note:** after split, default each line to `1` unless we can prove the old aggregate should stay on one of the split rows. Confirm during the split dry-run.

**No separate `risp_outbreak_events` table.**

### 3.3 Vaccination — additions

Keep flat RISP row; one **location** per line (National **or** one region/district). Quarters `q1`–`q4`, species JSON, `vaccine_details` text unchanged.

**Done 27 Aug 2026:**
- Added `location`; split **13** multi-area parents → **+80** rows (**110** total); 0 multi-area left. Script: [`backend/scripts/split_risp_vaccination_areas.py`](../backend/scripts/split_risp_vaccination_areas.py).
- **Split rule:** first listed area keeps original `q1`–`q4` / `total` / `coverage`; each expanded location gets **doses = 0** and coverage = 0 (placeholder). Quarters, species JSON, `vaccine_details` unchanged.
- API/UI enforce single location; `district_id`/`province_id`/`program`/`visibility` present for SOI later.
- Skip: monthly activity table, cattle/SR column matrix, census/first-visit, structured manu/strain.

**Follow-up note for countries (vaccination):** Contact **Armenia** and **Georgia** to redistribute quarterly doses across the expanded location lines (aggregates cannot be split automatically). Parent row ids below kept the totals; other locations for that campaign are dose-0 placeholders.

| Parent id | Country | Year | Disease | Strategy | Location kept (doses) | Expanded locations (doses=0) |
|---:|---|---|---|---|---|---|
| 6 | Armenia | 2025 | FMD | Mass | Aragatsotn Region (total 617145) | Ararat Province, Armavir Region, Gegharkunik Province, Kotayk Region, Lori Region, Shirak Region, Syunik Province, Tavush Region, Vayots Dzor Region, Yerevan |
| 8 | Armenia | 2025 | LSD | RiskBased | Armavir Region (total 246467) | Shirak Region, Syunik Province, Lori Region, Aragatsotn Region, Ararat Province, Kotayk Region, Tavush Region, Gegharkunik Province, Vayots Dzor Region |
| 9 | Armenia | 2025 | SPGP | RiskBased | Aragatsotn Region (total 292142) | Ararat Province, Armavir Region, Gegharkunik Province, Kotayk Region, Shirak Region, Tavush Region |
| 51 | Armenia | 2025 | FMD | RiskBased | Aragatsotn Region (total 93815) | Ararat Province, Armavir Region, Gegharkunik Province, Kotayk Region, Shirak Region, Syunik Province, Tavush Region, Lori Region |
| 53 | Armenia | 2025 | FMD | RiskBased | Aragatsotn Region (total 595136) | Ararat Province, Armavir Region, Gegharkunik Province, Lori Region, Shirak Region, Syunik Province, Tavush Region, Vayots Dzor Region |
| 64 | Armenia | 2026 | FMD | RiskBased | Ararat Province (total 6139) | Aragatsotn Region |
| 68 | Armenia | 2026 | LSD | RiskBased | Aragatsotn Region (total 104392) | Ararat Province, Armavir Region, Lori Region, Shirak Region, Syunik Province, Tavush Region |
| 69 | Armenia | 2026 | SPGP | RiskBased | Aragatsotn Region (total 120377) | Ararat Province, Armavir Region, Gegharkunik Province, Tavush Region |
| 46 | Georgia | 2025 | FMD | RiskBased | Kakheti (total 202985) | Kvemo Kartli, Mtskheta-Mtianeti, Samtskhe-Javakheti, Shida Kartli, Tbilisi, Adjara, Autonomous Republic of Abkhazia |
| 47 | Georgia | 2025 | PPR | Mass | Kakheti (total 191317) | Kvemo Kartli, Mtskheta-Mtianeti, Samtskhe-Javakheti, Shida Kartli, Tbilisi |
| 48 | Georgia | 2025 | SPGP | Mass | Kakheti (total 58600) | Kvemo Kartli, Mtskheta-Mtianeti, Samtskhe-Javakheti, Shida Kartli, Tbilisi |
| 60 | Georgia | 2026 | FMD | RiskBased | Adjara (total 1413508) | Kakheti, Kvemo Kartli, Mtskheta-Mtianeti, Samtskhe-Javakheti, Shida Kartli, Tbilisi |
| 65 | Georgia | 2026 | SPGP | Mass | Kakheti (total 130043) | Kvemo Kartli, Mtskheta-Mtianeti, Samtskhe-Javakheti, Shida Kartli, Tbilisi |

### 3.4 Market prices — new table

**Done 27 Aug 2026:** created `risp_marketprice` (normalized). TCC `marketprice` is **not** efficient enough to copy as-is: one wide row with **36** price columns (species × district/capital × live/meat × min/max/avg), plus opaque `periodID`. Average ~31 cells filled; pig often empty.

**RISP model (one row = one price line):**

| Column | Notes |
|---|---|
| `user_id`, `country`, `year`, `quarter` | Same cadence as outbreaks (`Q1`–`Q4`); no separate period table |
| `species` | `cattle` \| `sheep` \| `pig` |
| `market_level` | `district` \| `capital` |
| `product` | `live` \| `meat` |
| `price_min`, `price_max`, `price_avg` | nullable decimals |
| `district_id`, `location` | optional geo |
| `reference` | text |
| `program` | default `soi` (market is SOI today) |
| `visibility` | default `public` |
| `source_tcc_id`, `source_tcc_period_id` | for later ETL from TCC wide row |

DDL: [`backend/migrations/2026_08_27_create_risp_marketprice.sql`](../backend/migrations/2026_08_27_create_risp_marketprice.sql). Empty table for now — form/API + historical ETL later.

### 3.5 Geo lookups — copy into `db_manager` (not replace `countries`)

**Already exists:** `countries` (241 rows) with `iso3`, `name_un`, `name_moodle`, EuFMD region flags (`eufmd_seen`, …). Prefer these names (e.g. Türkiye) over TCC `nations.country` (“Turkey, Republic of”).

**Flags added 26 Aug 2026:**
- `soi` = 1 for the 10 countries that have TCC provinces/districts: ARM, AZE, BGR, GEO, GRC, IRN, IRQ, PAK, RUS, TUR
- `thrace` = 1 where TCC `nations.thrace=1`: BGR, GRC, TUR

**Add (copied/cleaned from TCC):**

| New table | Source | Link |
|---|---|---|
| `provinces` | TCC `provinces` (SOI countries only) | `country_id` → `countries.id` + denormalized `iso3`; new auto `id`; `source_tcc_id` = old `provinceID` |
| `districts` | TCC `districts` | `province_id` → `provinces.id`; new auto `id`; `source_tcc_id` = old `districtID` |

**DDL (needs CREATE privilege):** [`backend/migrations/2026_08_26_create_provinces_districts.sql`](../backend/migrations/2026_08_26_create_provinces_districts.sql)  
**Seed:** [`backend/scripts/migrate_tcc_geo_to_db_manager.py`](../backend/scripts/migrate_tcc_geo_to_db_manager.py) — all geo for `soi=1`; TCC `dt_finval` ignored (`0000-00-00` / `9999-12-31` only, no real closures). Optional later: `countries.tcc_nation_id` for ETL — do not overwrite `name_un`.

Scope: `countries.soi = 1` (10 countries). Map via **ISO3**, not name equality.

### 3.6 Roles

| Today | Needed |
|---|---|
| `risp`, `admin`, `rmt` | Add **`soi`** (or flag on user) for SOI messaging + Excel + date-required rules |

---

## 4. Mapping sketch (SOI → RISP target)

### Outbreaks

| SOI / template | Target `risp_outbreaks` |
|---|---|
| District (+ province via join) | `district_id` / `province_id` |
| Epiunit | `epiunit` |
| Lat / Long | `latitude` / `longitude` |
| Date susp / conf | `date_suspected` / `date_confirmed` |
| Confirmation type | *(removed — use `status`)* |
| Specie / Disease / Serotype | `species`, `disease_name`, `serotype` |
| — | `program='soi'`, `visibility=…` |
| `outbreakID` | `source_tcc_id` (ETL only) |
| Year/month of event | Keep `year`+`quarter` derived from date; optional `month` later |

### Vaccination

| SOI live | Target `risp_vaccination` |
|---|---|
| Header district | `district` / `province` |
| Year + month → doses | Map into `q1`–`q4` or store month + `total` |
| Cattle/SR doses inj | `species` JSON + `total` / coverage |
| Strain / manu | `vaccine_details` text (or structured later) |
| — | `program='soi'` |

### Market price

| TCC wide columns | `risp_marketprice` rows (species × level × product) |
|---|---|
| One wide row / period / nation | Up to 36 normalized rows (3 species × 2 levels × 2 products × …) or store AVG only in v1 |

---

## 5. Excel upload/download reuse plan

Reuse from SOI UI / Thrace pattern:

| Asset | Reuse as |
|---|---|
| Template links in RISPSOI | Keep templates; slim columns per blankness analysis |
| Download current data (CSV/XLSX) | Point queries at RISP (`program=soi`) instead of `/api/tcc/*` |
| Upload | New `POST /api/risp/.../upload` writing to RISP tables (mirror Thrace validation loop) |
| Thrace upload UX | Pattern for error report + “nothing imported if invalid” |

---

## 6. Remaining open questions (small)

1. **Default visibility for SOI:** `private` until explicitly shared?
2. ~~**SOI vaccination cadence:** monthly activity vs RISP `q1`–`q4` buckets?~~ → **Resolved:** keep quarters on flat RISP.
3. **Confirm Excel upload target today** (Nexus stub vs old PHP → TCC).
4. ~~**On split of multi-location RISP rows:** set each new row `number_outbreaks=1`, or divide the old count?~~ → **Resolved:** first location keeps original count; expanded rows get `1`; countries review.

---

## 7. Agreed build order (methodical)

1. **Audit** multi-location `risp_outbreaks` rows — **done 26 Aug 2026:**
   - Total rows: **135**
   - Empty locations: **117**
   - Exactly 1 location: **13**
   - Multiple locations: **5** (Türkiye 2, Iraq 3)
   - Split would turn those 5 into **24** rows (+19)
   - Note: Iraq already stored governorate names as free-text “locations”; Türkiye used RISP presets only
   - **Split rule (agreed):** keep the original `number_outbreaks` on the **first** location row; set `number_outbreaks = 1` on each expanded row. EuFMD will **ask the reporting countries (Türkiye, Iraq) to review/edit** these lines after the split, because the historical aggregate cannot be redistributed accurately across locations.
   - **Follow-up note for countries (outbreaks):** After the split, contact **Türkiye** and **Iraq** to correct per-line outbreak counts (and locations if needed). Expanded lines have `number_outbreaks = 1` as a placeholder; parent kept the aggregate.

| Parent id | Country | Period | Disease | Count kept on first loc | First location | Expanded (+1 each) |
|---:|---|---|---|---:|---|---|
| 777 | Türkiye | 2025 Q3 | FMD | 501 | Far from the border | Within 50km from the border |
| 780 | Türkiye | 2025 Q3 | SPGP | 11 | Far from the border | Within 50km from the border |
| 873 | Iraq | 2025 Q4 | FMD | 52 | Far from the border | Al Anbar, Basra, Baghdad, Diyala, Najaf, Dhi Qar, Karbala, Nineveh Governorates |
| 875 | Iraq | 2025 Q4 | PPR | 8 | Far from the border | Al Anbar, Basra, Saladin, Nineveh Governorates |
| 876 | Iraq | 2025 Q4 | SPGP | 16 | Far from the border | Al Anbar, Babylon, Diyala, Karbala, Nineveh Governorates |
   - **DB / split (done 26 Aug 2026):** added `idx_risp_outbreaks_user_id`, dropped `unique_outbreak_submission` (FK on `user_id` required the extra index), then ran [`backend/scripts/split_risp_outbreak_locations.py`](../backend/scripts/split_risp_outbreak_locations.py). Result: 5 parents → +19 rows; **154** total; 0 multi-location left. First loc kept original counts (e.g. Türkiye FMD 501, Iraq FMD 52); expanded rows = 1.
2. **Split** those rows → one location each; **drop unique key** — **done 26 Aug 2026.** Remaining: switch app/UI to single `location` (stop multi-select / `ON DUPLICATE KEY`).
3. **Geo:** map TCC nations→`countries` via ISO3; copy **provinces** + **districts** into `db_manager` (cleaned) — **done 26 Aug 2026:** 187 provinces, 1898 districts for `soi=1` (3 blank district names skipped); linked by `country_id` + `iso3`; new auto IDs; `source_tcc_id` kept. FKs omitted (no REFERENCES privilege); indexes present.
4. **Extend** `risp_outbreaks` with dates, district_id, program, visibility, etc. — **done 26 Aug 2026 (slim set):**
   - Added: `date_suspected`, `date_confirmed`, `latitude`, `longitude`, `location`, `province_id`, `district_id`, `program`, `visibility`, `source_tcc_id`
   - **Dropped 27 Aug 2026:** `confirmation_type` (redundant with `status`)
   - **Not kept:** `epiunit` (lat/long preferred for place)
   - `program`: tag `risp` vs `soi` on the same table (defaults `risp` for existing rows) — drives SOI messaging/Excel/date rules vs simple RISP entry without splitting tables
   - Existing rows: `program='risp'`, `visibility='public'`; `location` backfilled from first JSON `locations` entry where present
   - Legacy `locations` JSON still present for app compat until UI/API switch to single `location`
5. **UI/API:** single location select (preset **or** one district); dates; many rows per quarter×disease — **in progress 27 Aug 2026:** shared welcome (SOI vs RISP by `countries.soi`), bulk Excel strip on outbreak/vaccination/market-price pages, Market Price nav after Surveillance, outbreak save no longer uses unique upsert, marketprice CRUD API.
6. Same pattern for vaccination (district) — **done 27 Aug 2026**. Market prices table — **done 27 Aug 2026** (`risp_marketprice` normalized); form/API + ETL later.
7. Historical TCC ETL last.

---

## 8. Phase checklist

- [x] Phase 0 — gitignore `TCC/` + `*.tar`
- [x] Phase 1 — this inventory (RISP + TCC schemas + gap list)
- [x] Phase 2 — model freeze (unified multi-row + single location + geo copy)
- [x] Phase 3a — dry-run audit of multi-location RISP rows
- [x] Phase 3b — split rows + drop unique key (app/UI single `location` still pending)
- [x] Phase 3c — copy provinces/districts + country ISO3 map
- [x] Phase 3d — add dates/program/visibility/confirmation_type columns (no epiunit)
- [ ] Phase 4 — `soi` role + messaging
- [ ] Phase 5 — API/UI + Excel → RISP + market form
- [ ] Phase 6 — historical clean + ETL
- [ ] Phase 7 — retire TCC reads
