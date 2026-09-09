"""Dynamic Excel templates for RISP/SOI bulk entry."""

from __future__ import annotations

from io import BytesIO
from datetime import date
from typing import Any, Callable, Dict, List, Optional, Tuple

import httpx
import openpyxl
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.utils.datetime import to_excel
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.worksheet import Worksheet

# --- Option lists (mirror frontend/src/services/risp/rispService.ts) ---

DISEASE_OPTIONS = [
    "Foot-and-Mouth Disease - FMD",
    "Lumpy Skin Disease - LSD",
    "Peste Des Petits Ruminants - PPR",
    "Sheep Pox And Goat Pox - SPGP",
    "Rift Valley Fever - RVF",
]

OUTBREAK_STATUS_OPTIONS = [
    "Laboratory confirmed",
    "Clinically confirmed",
    "Suspected case",
]

SPECIES_OPTIONS = [
    "Cattle",
    "Buffalo",
    "Sheep",
    "Goats",
    "Pigs",
    "Wildlife",
    "Information not available",
]

FMD_SEROTYPES = ["O", "A", "C", "Asia 1", "SAT 1", "SAT 2", "SAT 3", "unknown"]

CONTROL_MEASURES = [
    "Ring Vaccination",
    "Restriction of movements",
    "Markets closure",
    "Stamping out",
    "Awareness raising campaigns",
    "None",
    "Other",
]

OUTBREAK_RISP_LOCATIONS = [
    "National",
    "Within 50km from the border",
    "Far from the border",
    "Specify region",
]

VACCINATION_RISP_LOCATIONS = ["National", "Specify region"]

VACCINATION_STATUS = ["Ongoing", "Planned", "Closed"]

VACCINATION_TYPES = [
    ("Mass", "Mass vaccination"),
    ("RiskBased", "Risk-based vaccination"),
    ("Ring", "Ring vaccination"),
    ("OwnerRequest", "On request of owner"),
    ("Trade", "Related to trade"),
]

QUARTERS = ["Q1", "Q2", "Q3", "Q4"]

MARKET_SPECIES = ["cattle", "sheep", "pig"]
MARKET_LEVELS = ["district", "capital"]
MARKET_PRODUCTS = ["live", "meat"]

RISP_EMPTY_ROWS = 50

# countriesnow.space often expects English exonyms
_COUNTRY_ALIASES_FOR_STATES = {
    "türkiye": "Turkey",
    "turkiye": "Turkey",
    "turkey": "Turkey",
    "iran (islamic republic of)": "Iran",
    "russian federation": "Russia",
    "syria": "Syria",
    "syrian arab republic": "Syria",
}

HEADER_FILL = PatternFill("solid", fgColor="2E7D32")
HEADER_FONT = Font(color="FFFFFF", bold=True)
DATE_CELL_FORMAT = "yyyy-mm-dd"
DATE_MIN = date(1990, 1, 1)
DATE_MAX = date(2100, 12, 31)
DATE_MIN_SERIAL = to_excel(DATE_MIN)
DATE_MAX_SERIAL = to_excel(DATE_MAX)


def _resolve_country_id(cursor, country: Optional[str]) -> Optional[int]:
    if not country:
        return None
    cursor.execute(
        """
        SELECT id FROM countries
        WHERE name_un = %s OR name_moodle = %s
           OR (%s LIKE '%%Iraq%%' AND iso3 = 'IRQ')
           OR (%s LIKE '%%rkiye%%' AND iso3 = 'TUR')
           OR (%s = 'Turkey' AND iso3 = 'TUR')
        LIMIT 1
        """,
        (country, country, country, country, country),
    )
    row = cursor.fetchone()
    return row["id"] if row else None


def _fetch_soi_districts(cursor, country_id: int) -> List[Dict[str, Any]]:
    cursor.execute(
        """
        SELECT d.id AS district_id, d.name AS district_name,
               p.id AS province_id, p.name AS province_name
        FROM districts d
        JOIN provinces p ON p.id = d.province_id
        WHERE p.country_id = %s
        ORDER BY p.name, d.name, d.id
        """,
        (country_id,),
    )
    return list(cursor.fetchall() or [])


def _fetch_risp_admin_regions(country: Optional[str]) -> List[str]:
    """Same source as the RISP form (countriesnow states) for Excel region dropdowns."""
    if not country or not str(country).strip():
        return []

    candidates = [str(country).strip()]
    alias = _COUNTRY_ALIASES_FOR_STATES.get(candidates[0].lower())
    if alias and alias not in candidates:
        candidates.append(alias)

    for name in candidates:
        try:
            with httpx.Client(timeout=20.0) as client:
                response = client.post(
                    "https://countriesnow.space/api/v0.1/countries/states",
                    json={"country": name},
                )
                response.raise_for_status()
                payload = response.json()
                states = (payload.get("data") or {}).get("states") or []
                names = [s.get("name") for s in states if s.get("name")]
                if names:
                    return names
        except Exception as exc:
            print(f"Could not load admin regions for '{name}': {exc}")
    return []


def _write_list_column(ws: Worksheet, col: int, values: List[str]) -> str:
    """Write values down a column on a hidden sheet; return absolute range ref."""
    if not values:
        ws.cell(row=1, column=col, value="")
        letter = get_column_letter(col)
        return f"'{ws.title}'!${letter}$1:${letter}$1"
    for row_idx, value in enumerate(values, start=1):
        ws.cell(row=row_idx, column=col, value=value)
    letter = get_column_letter(col)
    return f"'{ws.title}'!${letter}$1:${letter}${len(values)}"


def _apply_list_validation(
    ws: Worksheet,
    col_letter: str,
    row_start: int,
    row_end: int,
    range_ref: str,
    *,
    allow_blank: bool = True,
) -> None:
    dv = DataValidation(
        type="list",
        formula1=f"={range_ref}",
        allow_blank=allow_blank,
        showErrorMessage=True,
        errorTitle="Invalid value",
        error="Please choose a value from the dropdown list.",
    )
    ws.add_data_validation(dv)
    dv.add(f"{col_letter}{row_start}:{col_letter}{row_end}")


def _apply_date_columns(
    ws: Worksheet,
    col_letters: List[str],
    row_start: int,
    row_end: int,
) -> None:
    """Format cells as dates and add validation so Excel shows a date picker."""
    for letter in col_letters:
        dv = DataValidation(
            type="date",
            operator="between",
            formula1=DATE_MIN_SERIAL,
            formula2=DATE_MAX_SERIAL,
            allow_blank=True,
            showInputMessage=True,
            promptTitle="Date",
            prompt="Choose a date (calendar picker in Excel).",
            showErrorMessage=True,
            errorTitle="Invalid date",
            error="Enter a valid date between 1990-01-01 and 2100-12-31.",
        )
        ws.add_data_validation(dv)
        dv.add(f"{letter}{row_start}:{letter}{row_end}")
        ws.column_dimensions[letter].width = max(
            ws.column_dimensions[letter].width or 0, 14
        )
        for row_idx in range(row_start, row_end + 1):
            ws[f"{letter}{row_idx}"].number_format = DATE_CELL_FORMAT


def _style_header_row(ws: Worksheet, headers: List[str]) -> None:
    for col_idx, title in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=title)
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
    ws.freeze_panes = "A2"


def _autosize_columns(ws: Worksheet, max_width: int = 42) -> None:
    for col_cells in ws.columns:
        letter = get_column_letter(col_cells[0].column)
        width = max(len(str(c.value or "")) for c in col_cells[:200])
        ws.column_dimensions[letter].width = min(max(width + 2, 10), max_width)


def _workbook_to_response(wb: openpyxl.Workbook, filename: str) -> StreamingResponse:
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_lists_sheet(wb: openpyxl.Workbook) -> Worksheet:
    ws = wb.create_sheet("_Lists")
    ws.sheet_state = "hidden"
    return ws


def _add_instructions_sheet(wb: openpyxl.Workbook, lines: List[str]) -> None:
    ws = wb.create_sheet("Instructions", 0)
    ws["A1"] = "How to fill this template"
    ws["A1"].font = Font(bold=True, size=12)
    for idx, line in enumerate(lines, start=3):
        ws.cell(row=idx, column=1, value=line)
    ws.column_dimensions["A"].width = 100


def build_outbreaks_workbook(
    *,
    is_soi: bool,
    districts: List[Dict[str, Any]],
    admin_regions: List[str],
    year: Optional[str],
    quarter: Optional[str],
) -> openpyxl.Workbook:
    wb = openpyxl.Workbook()
    data_ws = wb.active
    data_ws.title = "Outbreaks"

    if is_soi:
        headers = [
            "year",
            "quarter",
            "disease",
            "number_outbreaks",
            "province",
            "district",
            "date_suspected",
            "date_confirmed",
            "latitude",
            "longitude",
            "species",
            "status",
            "serotype",
            "control_measures",
            "comments",
        ]
        _add_instructions_sheet(
            wb,
            [
                "SOI: each row is a district in your country (province + district pre-filled).",
                "Fill disease and outbreak fields only for districts you are reporting.",
                "Do not rename province/district — upload matches them to the official list by name.",
                "Leave unused district rows blank (no disease) — they are ignored on upload.",
            ],
        )
    else:
        headers = [
            "year",
            "quarter",
            "disease",
            "number_outbreaks",
            "location",
            "region",
            "date_suspected",
            "date_confirmed",
            "latitude",
            "longitude",
            "species",
            "status",
            "serotype",
            "control_measures",
            "comments",
        ]
        _add_instructions_sheet(
            wb,
            [
                "RISP: choose location = National, Within 50km from the border, Far from the border, or Specify region.",
                "If location is National / Far from the border / Within 50km… leave region blank.",
                "If location is Specify region, pick the region from the region dropdown (official list).",
                "Do not type free-text district names — use the dropdown only.",
            ],
        )

    _style_header_row(data_ws, headers)
    col = {h: get_column_letter(i + 1) for i, h in enumerate(headers)}

    if is_soi and districts:
        for row_idx, d in enumerate(districts, start=2):
            data_ws.cell(row=row_idx, column=1, value=year or "")
            data_ws.cell(row=row_idx, column=2, value=quarter or "")
            data_ws.cell(row=row_idx, column=5, value=d["province_name"])
            data_ws.cell(row=row_idx, column=6, value=d["district_name"])
        row_start, row_end = 2, len(districts) + 1
    else:
        for row_idx in range(2, RISP_EMPTY_ROWS + 2):
            if year:
                data_ws.cell(row=row_idx, column=1, value=year)
            if quarter:
                data_ws.cell(row=row_idx, column=2, value=quarter)
        row_start, row_end = 2, RISP_EMPTY_ROWS + 1

    lists_ws = _build_lists_sheet(wb)
    list_col = 1
    validations: List[Tuple[str, str, bool]] = []

    def add_list(header_key: str, options: List[str], *, allow_blank: bool = True) -> None:
        nonlocal list_col
        if header_key not in col:
            return
        range_ref = _write_list_column(lists_ws, list_col, options)
        validations.append((col[header_key], range_ref, allow_blank))
        list_col += 1

    add_list("disease", DISEASE_OPTIONS)
    add_list("quarter", QUARTERS)
    if not is_soi:
        add_list("location", OUTBREAK_RISP_LOCATIONS)
        if admin_regions:
            add_list("region", admin_regions, allow_blank=True)
    add_list("species", SPECIES_OPTIONS)
    add_list("status", OUTBREAK_STATUS_OPTIONS)
    add_list("serotype", FMD_SEROTYPES, allow_blank=True)
    add_list("control_measures", CONTROL_MEASURES)

    for letter, range_ref, allow_blank in validations:
        _apply_list_validation(data_ws, letter, row_start, row_end, range_ref, allow_blank=allow_blank)

    _apply_date_columns(
        data_ws,
        [col["date_suspected"], col["date_confirmed"]],
        row_start,
        row_end,
    )

    _autosize_columns(data_ws)
    return wb


def build_vaccination_workbook(
    *,
    is_soi: bool,
    districts: List[Dict[str, Any]],
    admin_regions: List[str],
    year: Optional[str],
) -> openpyxl.Workbook:
    wb = openpyxl.Workbook()
    data_ws = wb.active
    data_ws.title = "Vaccination"

    if is_soi:
        headers = [
            "year",
            "disease",
            "status",
            "vaccination_type",
            "species",
            "province",
            "district",
            "q1",
            "q2",
            "q3",
            "q4",
            "coverage",
            "vaccine_details",
        ]
        _add_instructions_sheet(
            wb,
            [
                "SOI: each row is a district (province + district pre-filled).",
                "Fill vaccination fields only for districts you are reporting.",
                "Do not rename province/district — upload matches them by name.",
            ],
        )
    else:
        headers = [
            "year",
            "disease",
            "status",
            "vaccination_type",
            "species",
            "location",
            "region",
            "q1",
            "q2",
            "q3",
            "q4",
            "coverage",
            "vaccine_details",
        ]
        _add_instructions_sheet(
            wb,
            [
                "RISP: choose location = National or Specify region.",
                "If National, leave region blank.",
                "If Specify region, pick from the region dropdown only (no free text).",
            ],
        )

    _style_header_row(data_ws, headers)
    col = {h: get_column_letter(i + 1) for i, h in enumerate(headers)}

    vaccination_type_labels = [label for _, label in VACCINATION_TYPES]

    if is_soi and districts:
        for row_idx, d in enumerate(districts, start=2):
            data_ws.cell(row=row_idx, column=1, value=year or "")
            data_ws.cell(row=row_idx, column=6, value=d["province_name"])
            data_ws.cell(row=row_idx, column=7, value=d["district_name"])
        row_start, row_end = 2, len(districts) + 1
    else:
        for row_idx in range(2, RISP_EMPTY_ROWS + 2):
            if year:
                data_ws.cell(row=row_idx, column=1, value=year)
        row_start, row_end = 2, RISP_EMPTY_ROWS + 1

    lists_ws = _build_lists_sheet(wb)
    list_col = 1
    validations: List[Tuple[str, str, bool]] = []

    def add_list(header_key: str, options: List[str], *, allow_blank: bool = True) -> None:
        nonlocal list_col
        if header_key not in col:
            return
        range_ref = _write_list_column(lists_ws, list_col, options)
        validations.append((col[header_key], range_ref, allow_blank))
        list_col += 1

    add_list("disease", DISEASE_OPTIONS)
    add_list("status", [""] + VACCINATION_STATUS)
    add_list("vaccination_type", vaccination_type_labels)
    add_list("species", SPECIES_OPTIONS)
    if not is_soi:
        add_list("location", VACCINATION_RISP_LOCATIONS)
        if admin_regions:
            add_list("region", admin_regions, allow_blank=True)

    for letter, range_ref, allow_blank in validations:
        _apply_list_validation(data_ws, letter, row_start, row_end, range_ref, allow_blank=allow_blank)

    _autosize_columns(data_ws)
    return wb


def build_marketprice_workbook(
    *,
    is_soi: bool,
    districts: List[Dict[str, Any]],
    admin_regions: List[str],
    year: Optional[str],
    quarter: Optional[str],
) -> openpyxl.Workbook:
    _ = (is_soi, districts, admin_regions)
    wb = openpyxl.Workbook()
    data_ws = wb.active
    data_ws.title = "Market prices"

    headers = [
        "year",
        "quarter",
        "species",
        "market_level",
        "product",
        "price_min",
        "price_max",
        "price_avg",
        "reference",
    ]
    _style_header_row(data_ws, headers)
    col = {h: get_column_letter(i + 1) for i, h in enumerate(headers)}

    for row_idx in range(2, RISP_EMPTY_ROWS + 2):
        if year:
            data_ws.cell(row=row_idx, column=1, value=year)
        if quarter:
            data_ws.cell(row=row_idx, column=2, value=quarter)
    row_start, row_end = 2, RISP_EMPTY_ROWS + 1

    lists_ws = _build_lists_sheet(wb)
    list_col = 1
    for options, key in (
        (QUARTERS, "quarter"),
        (MARKET_SPECIES, "species"),
        (MARKET_LEVELS, "market_level"),
        (MARKET_PRODUCTS, "product"),
    ):
        range_ref = _write_list_column(lists_ws, list_col, options)
        _apply_list_validation(data_ws, col[key], row_start, row_end, range_ref)
        list_col += 1

    _autosize_columns(data_ws)
    return wb


BUILDERS: Dict[str, Callable[..., openpyxl.Workbook]] = {
    "outbreaks": build_outbreaks_workbook,
    "vaccination": build_vaccination_workbook,
    "marketprice": build_marketprice_workbook,
}


def generate_template_response(
    category: str,
    *,
    is_soi: bool,
    districts: List[Dict[str, Any]],
    admin_regions: List[str],
    year: Optional[str],
    quarter: Optional[str],
    country: Optional[str],
) -> StreamingResponse:
    builder = BUILDERS.get(category)
    if not builder:
        raise HTTPException(status_code=404, detail=f"Unknown template category: {category}")

    if category == "vaccination":
        wb = builder(
            is_soi=is_soi,
            districts=districts,
            admin_regions=admin_regions,
            year=year,
        )
    else:
        wb = builder(
            is_soi=is_soi,
            districts=districts,
            admin_regions=admin_regions,
            year=year,
            quarter=quarter,
        )

    suffix = "soi" if is_soi else "risp"
    country_bit = (country or "country").replace(" ", "_")[:40]
    period = f"_{year}_{quarter}" if year and quarter else (f"_{year}" if year else "")
    filename = f"risp_{category}_{country_bit}{period}_{suffix}.xlsx"
    return _workbook_to_response(wb, filename)
