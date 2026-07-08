# SOI upload-template column usage (TCC)

**Generated:** 8 July 2026  
**Database:** TCC (SOI)  
**Goal:** Identify columns that countries don’t report (or mostly leave blank) so we can clean up the **upload Excel templates** and corresponding database fields safely.

**Blank definition:** `NULL`, empty string, or whitespace-only text. Numeric `0` is treated as a reported value.

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

So any “by country” outbreak conclusions are **not trustworthy** until reference integrity is fixed.

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

The template does not request country, and the country reference join is missing for most outbreak rows (see summary), so I did not produce a “by country” blankness table for outbreaks.

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

---

## Methodology

- Read the actual Excel templates in `frontend/public/templates/`.
- Measured blankness using the live TCC database tables `outbreaks` and `vaccinations`.
- For vaccination “by country”, used `vaccinations.nationID → nations.country` (join works).
- For outbreaks “by country”, flagged the broken `nationID` reference (join missing for most rows).
